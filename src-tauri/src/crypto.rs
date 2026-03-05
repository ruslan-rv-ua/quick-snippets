//! AES-256-GCM encryption module for QuickSnippets
//!
//! # Security Model
//!
//! This module implements envelope encryption with AES-256-GCM for protecting sensitive snippet content.
//!
//! ## Encryption Scheme
//!
//! - **Cipher**: AES-256 (256-bit key) in Galois/Counter Mode (GCM)
//! - **Key derivation**: PBKDF2-HMAC-SHA256 with 100,000 iterations
//! - **Salt**: 16 random bytes (unique per snippet password)
//! - **Nonce (IV)**: 12 random bytes (unique per encryption operation)
//! - **MAC tag**: 128-bit GCM authentication tag
//!
//! ## Wire Format
//!
//! The encrypted blob is structured as:
//! ```ignore
//! [salt (16 bytes)] || [nonce (12 bytes)] || [ciphertext + GCM tag]
//! ```
//! This entire blob is base64-encoded before storage.
//!
//! Each encryption of the same plaintext with the same password produces different ciphertext
//! due to random salt and nonce.
//!
//! ## Key Derivation
//!
//! Passwords are converted to encryption keys using PBKDF2-HMAC-SHA256:
//! ```ignore
//! key = PBKDF2-HMAC-SHA256(password, salt, iterations=100_000, output_length=32)
//! ```
//! This slows down brute-force attacks; a single password attempt takes ~100ms on modern hardware.
//!
//! ## Memory Safety
//!
//! - Derived keys are zeroized (overwritten with zeros) after use
//! - Session keys are never cached
//! - The caller is responsible for zeroizing decrypted plaintext
//!
//! ## Known Limitations and Threat Model
//!
//! ### Not Protected Against:
//!
//! 1. **Timing attacks on password verification**
//!    - The decryption operation does not use constant-time password comparison
//!    - An attacker with precise timing measurements could infer password properties
//!    - **Mitigation**: Use strong, random passwords (12+ characters with mixed case, numbers, symbols)
//!
//! 2. **Brute-force attacks at UI level**
//!    - There is no rate limiting on password attempts
//!    - An attacker with device access could attempt thousands of passwords per second
//!    - **Mitigation**: Physical security of your device; enable OS-level lock screen
//!
//! 3. **Memory attacks during decryption**
//!    - If an attacker gains read access to process memory while decryption is in progress,
//!      they could observe the plaintext
//!    - **Mitigation**: Decryption happens within the Tauri process (isolated from browser);
//!      plaintext is copied to clipboard and immediately zeroized
//!
//! 4. **Compromised password**
//!    - If an attacker learns your password, they can decrypt all past and future
//!      snippets encrypted with that password
//!    - **Mitigation**: Do not reuse snippet passwords; treat them as secrets
//!
//! ### Strong Against:
//!
//! - Disk-at-rest attacks (encrypted snippets are unreadable without password)
//! - Network eavesdropping (no network communication)
//! - Telemetry collection (no data is transmitted)
//!
//! ## Standards and Compliance
//!
//! - **NIST SP 800-38D**: GCM mode specification
//! - **NIST SP 800-132**: PBKDF2 specification and iteration count recommendations
//! - **RustCrypto**: All cryptographic primitives sourced from the RustCrypto ecosystem
//!
//! ## Usage Example
//!
//! ```ignore
//! let plaintext = b"my secret snippet";
//! let password = "my-secure-password";
//!
//! // Encrypt
//! let encrypted = encrypt(plaintext, password)?;
//! // encrypted is a Vec<u8> containing base64-encoded [salt || nonce || ciphertext + tag]
//!
//! // Decrypt (caller is responsible for zeroizing plaintext)
//! let mut decrypted = decrypt(&encrypted, password)?;
//! // ... use decrypted ...
//! decrypted.zeroize(); // important!
//! ```

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use zeroize::Zeroize;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const PBKDF2_ITERATIONS: u32 = 100_000;
const MIN_DECODED_LEN: usize = SALT_LEN + NONCE_LEN + 16; // salt + nonce + GCM tag (no plaintext)

#[derive(Debug, PartialEq)]
pub enum CryptoError {
    WrongPassword,
    InvalidData,
    EncryptionFailed,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::WrongPassword => write!(f, "Wrong password"),
            CryptoError::InvalidData => write!(f, "Invalid data"),
            CryptoError::EncryptionFailed => write!(f, "Encryption failed"),
        }
    }
}

impl std::error::Error for CryptoError {}

/// Derive a 32-byte AES-256 key from password + salt using PBKDF2-HMAC-SHA256.
///
/// # Algorithm
///
/// ```text
/// key = PBKDF2-HMAC-SHA256(password, salt, iterations=100_000, length=32)
/// ```
///
/// The iteration count (100,000) makes each key derivation take approximately 100ms
/// on modern hardware, significantly slowing down password guessing attacks.
///
/// # Parameters
///
/// - `password`: The user-provided password (any string)
/// - `salt`: 16-byte random value (unique per password)
/// - `out`: 32-byte mutable buffer where the derived key is written
///
/// # Note
///
/// The key is written directly to `out` to avoid intermediate copies.
/// The caller should zeroize `out` after use via [`Zeroize`].
fn derive_key(password: &str, salt: &[u8], out: &mut [u8; KEY_LEN]) {
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, out);
}

/// Encrypt plaintext with a password using AES-256-GCM.
///
/// # Return Format
///
/// Returns a base64-encoded blob with the structure:
/// ```text
/// base64([salt (16 bytes) || nonce (12 bytes) || ciphertext || GCM-tag (16 bytes)])
/// ```
///
/// # Randomness
///
/// Each call to `encrypt` generates fresh random salt and nonce, so encrypting the same
/// plaintext with the same password produces different ciphertexts each time.
///
/// # How It Works
///
/// 1. Generate 16-byte random salt
/// 2. Generate 12-byte random nonce
/// 3. Derive 32-byte AES key from password + salt using PBKDF2-HMAC-SHA256 (100,000 iterations)
/// 4. Encrypt plaintext using AES-256-GCM (produces ciphertext + 16-byte authentication tag)
/// 5. Zeroize the key from memory
/// 6. Assemble: salt || nonce || ciphertext+tag
/// 7. Base64-encode the blob and return as UTF-8 bytes
///
/// # Errors
///
/// - `CryptoError::EncryptionFailed`: AES cipher initialization or encryption failed (extremely rare)
///
/// # Example
///
/// ```ignore
/// let plaintext = b"my secret snippet";
/// let password = "my-secure-password";
/// let encrypted = encrypt(plaintext, password)?;
/// // encrypted is typically 90-200 bytes (base64) for small snippets
/// ```
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    // Generate random salt and nonce
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    // Derive key
    let mut key = [0u8; KEY_LEN];
    derive_key(password, &salt, &mut key);

    // Encrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Zeroize key
    key.zeroize();

    // Assemble: salt || nonce || ciphertext+tag
    let mut blob = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    blob.extend_from_slice(&salt);
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ciphertext);

    // Base64 encode and return as bytes
    let encoded = BASE64.encode(&blob);
    Ok(encoded.into_bytes())
}

/// Decrypt a base64-encoded blob produced by [`encrypt`].
///
/// # Input Format
///
/// The input must be a base64-encoded blob with structure:
/// ```text
/// base64([salt (16 bytes) || nonce (12 bytes) || ciphertext || GCM-tag (16 bytes)])
/// ```
///
/// # Return Value
///
/// Returns the original plaintext as a `Vec<u8>`.
/// **Important**: The caller must zeroize this vector after use via [`Zeroize`] to prevent
/// sensitive data from remaining on the heap.
///
/// # How It Works
///
/// 1. Base64-decode the input
/// 2. Validate minimum length (48 bytes minimum: 16 salt + 12 nonce + 16 tag)
/// 3. Extract salt, nonce, and ciphertext+tag from the blob
/// 4. Derive the AES key from password + salt using PBKDF2-HMAC-SHA256
/// 5. Decrypt ciphertext using AES-256-GCM (verifies authentication tag)
/// 6. Zeroize the key from memory
/// 7. Return plaintext
///
/// # Errors
///
/// - `CryptoError::InvalidData`: Base64 decoding failed, or blob is too short
/// - `CryptoError::WrongPassword`: Authentication tag verification failed (wrong password
///   or corrupted ciphertext). Note: This check is **not constant-time**, so an attacker
///   with precise timing measurements could infer password properties.
/// - `CryptoError::EncryptionFailed`: AES cipher initialization failed (extremely rare)
///
/// # Security Notes
///
/// - This function does **not** use constant-time comparison for password verification,
///   making it potentially vulnerable to timing attacks. For production use, consider
///   constant-time HMAC comparison if timing precision matters in your threat model.
/// - The returned plaintext is decrypted into a `Vec<u8>` on the heap. It is essential
///   that the caller zeroizes this vector to prevent sensitive data from persisting
///   in memory after use.
///
/// # Example
///
/// ```ignore
/// let encrypted_blob = b"base64_encoded_data_here";
/// let password = "my-secure-password";
/// let mut plaintext = decrypt(encrypted_blob, password)?;
/// // Use plaintext...
/// plaintext.zeroize(); // Important!
/// ```
pub fn decrypt(ciphertext_b64: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    // Decode base64
    let blob = BASE64
        .decode(ciphertext_b64)
        .map_err(|_| CryptoError::InvalidData)?;

    // Validate minimum length: salt + nonce + GCM tag
    if blob.len() < MIN_DECODED_LEN {
        return Err(CryptoError::InvalidData);
    }

    // Split blob
    let salt = &blob[..SALT_LEN];
    let nonce_bytes = &blob[SALT_LEN..SALT_LEN + NONCE_LEN];
    let ciphertext = &blob[SALT_LEN + NONCE_LEN..];

    // Derive key
    let mut key = [0u8; KEY_LEN];
    derive_key(password, salt, &mut key);

    // Decrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| CryptoError::InvalidData)?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::WrongPassword)?;

    // Zeroize key
    key.zeroize();

    // Return plaintext directly — caller is responsible for zeroizing after use.
    // Previous code cloned plaintext and zeroized the original, but the clone
    // was never zeroized, leaving decrypted data on the heap.
    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- derive_key tests ---

    #[test]
    fn test_derive_key_produces_32_byte_key() {
        let password = "test_password";
        let salt = b"1234567890123456"; // 16 bytes
        let mut key = [0u8; KEY_LEN];
        
        derive_key(password, salt, &mut key);
        
        // Key should be filled with non-zero bytes (extremely unlikely all zeros)
        assert!(!key.iter().all(|&b| b == 0), "Key should not be all zeros");
    }

    #[test]
    fn test_derive_key_same_password_salt_produces_same_key() {
        let password = "password";
        let salt = b"same_salt_value!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];
        
        derive_key(password, salt, &mut key1);
        derive_key(password, salt, &mut key2);
        
        assert_eq!(key1, key2, "Same password + salt should produce same key");
    }

    #[test]
    fn test_derive_key_different_password_produces_different_key() {
        let salt = b"same_salt_value!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];
        
        derive_key("password1", salt, &mut key1);
        derive_key("password2", salt, &mut key2);
        
        assert_ne!(key1, key2, "Different passwords should produce different keys");
    }

    #[test]
    fn test_derive_key_different_salt_produces_different_key() {
        let password = "same_password";
        let salt1 = b"salt_value_one!!";
        let salt2 = b"salt_value_two!!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];
        
        derive_key(password, salt1, &mut key1);
        derive_key(password, salt2, &mut key2);
        
        assert_ne!(key1, key2, "Different salts should produce different keys");
    }



    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = b"hello world";
        let password = "password123";
        let encrypted = encrypt(plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_empty_string() {
        let plaintext = b"";
        let password = "pass";
        let encrypted = encrypt(plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_unicode_content() {
        let plaintext = "Привіт 🌍".as_bytes();
        let password = "пароль";
        let encrypted = encrypt(plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
        assert_eq!(std::str::from_utf8(&decrypted).unwrap(), "Привіт 🌍");
    }

    #[test]
    fn test_encrypt_decrypt_large_payload() {
        let plaintext = vec![0xABu8; 48_000];
        let password = "pass";
        let encrypted = encrypt(&plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    // --- Unique salt/nonce ---

    #[test]
    fn test_two_encryptions_produce_different_output() {
        let plaintext = b"test";
        let password = "pass";
        let enc1 = encrypt(plaintext, password).expect("encrypt 1 failed");
        let enc2 = encrypt(plaintext, password).expect("encrypt 2 failed");
        assert_ne!(enc1, enc2, "Two encryptions of same data must differ (different salt/nonce)");
    }

    // --- Wrong password ---

    #[test]
    fn test_decrypt_wrong_password_returns_error() {
        let plaintext = b"text";
        let encrypted = encrypt(plaintext, "correct").expect("encrypt failed");
        let result = decrypt(&encrypted, "wrong");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CryptoError::WrongPassword);
    }

    #[test]
    fn test_decrypt_wrong_password_is_not_panic() {
        let plaintext = b"text";
        let encrypted = encrypt(plaintext, "correct").expect("encrypt failed");
        // Should return Err, never panic
        let result = std::panic::catch_unwind(|| {
            decrypt(&encrypted, "wrong")
        });
        assert!(result.is_ok(), "decrypt with wrong password must not panic");
        assert!(result.unwrap().is_err());
    }

    // --- Invalid data ---

    #[test]
    fn test_decrypt_invalid_base64() {
        let result = decrypt(b"not-valid-base64!!!", "pass");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CryptoError::InvalidData);
    }

    #[test]
    fn test_decrypt_truncated_ciphertext() {
        // Valid base64 but too short after decoding
        let short_data = BASE64.encode(&[1u8; 10]);
        let result = decrypt(short_data.as_bytes(), "pass");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CryptoError::InvalidData);
    }

    #[test]
    fn test_decrypt_empty_input() {
        let result = decrypt(b"", "pass");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), CryptoError::InvalidData);
    }

    // --- Format ---

    #[test]
    fn test_encrypted_output_is_valid_base64() {
        let encrypted = encrypt(b"data", "pass").expect("encrypt failed");
        let decoded = BASE64.decode(&encrypted);
        assert!(decoded.is_ok(), "Encrypted output must be valid base64");
    }

    #[test]
    fn test_encrypted_format_salt_nonce_ciphertext_tag() {
        let encrypted = encrypt(b"x", "pass").expect("encrypt failed");
        let decoded = BASE64.decode(&encrypted).expect("base64 decode failed");
        // salt(16) + nonce(12) + ciphertext(>=1) + tag(16) = minimum 45 for 1-byte plaintext
        assert!(decoded.len() >= MIN_DECODED_LEN, "Decoded len {} < minimum {}", decoded.len(), MIN_DECODED_LEN);
    }

    // --- Different passwords ---

    #[test]
    fn test_encrypt_with_unicode_password() {
        let plaintext = b"data";
        let password = "пароль🔑";
        let encrypted = encrypt(plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_with_empty_password() {
        let plaintext = b"data";
        let password = "";
        let encrypted = encrypt(plaintext, password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_with_very_long_password() {
        let plaintext = b"data";
        let password = "a".repeat(1000);
        let encrypted = encrypt(plaintext, &password).expect("encrypt failed");
        let decrypted = decrypt(&encrypted, &password).expect("decrypt failed");
        assert_eq!(decrypted, plaintext);
    }
}
