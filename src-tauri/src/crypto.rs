// AES-256-GCM encryption

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
fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

/// Encrypt plaintext with a password.
/// Returns base64-encoded blob: `salt[16] || nonce[12] || ciphertext || GCM-tag[16]`.
pub fn encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    // Generate random salt and nonce
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    // Derive key
    let mut key = derive_key(password, &salt);

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

/// Decrypt a base64-encoded blob produced by `encrypt`.
/// Returns the original plaintext.
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
    let mut key = derive_key(password, salt);

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

    // --- Basic roundtrip ---

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
