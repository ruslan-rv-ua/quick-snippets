//! AES-256-GCM encryption module for QuickSnippets
//!
//! # Security Model
//!
//! This module implements envelope encryption with AES-256-GCM for protecting sensitive snippet content.
//!
//! ## Encryption Scheme
//!
//! - **Cipher**: AES-256 (256-bit key) in Galois/Counter Mode (GCM)
//! - **Key derivation**: PBKDF2-HMAC-SHA256 with 600,000 iterations (the OWASP minimum for
//!   this algorithm); 100,000 iterations for blobs in the legacy format
//! - **Salt**: 16 random bytes (unique per encryption operation)
//! - **Nonce (IV)**: 12 random bytes (unique per encryption operation)
//! - **MAC tag**: 128-bit GCM authentication tag
//!
//! ## Stored Formats
//!
//! Two formats exist. [`encrypt`] always writes the current one; [`decrypt`] reads both.
//!
//! **Current format, "v2"** (QuickSnippets 0.3.0 and later):
//! ```ignore
//! "v2:" || base64([salt (16 bytes)] || [nonce (12 bytes)] || [ciphertext + GCM tag])
//! ```
//! The key is derived with 600,000 iterations. The marker bytes `v2:` are also passed to
//! AES-GCM as associated data, so the authentication tag covers the marker.
//!
//! **Legacy format** (QuickSnippets 0.1.0 to 0.2.1), no marker:
//! ```ignore
//! base64([salt (16 bytes)] || [nonce (12 bytes)] || [ciphertext + GCM tag])
//! ```
//! The key is derived with 100,000 iterations and there is no associated data.
//!
//! The two cannot be confused: a legacy blob is pure standard base64, and `:` is not a
//! base64 character, so a legacy blob never starts with `v2:`.
//!
//! The iteration count is fixed by the format and is not stored in the blob. Changing the
//! key derivation again needs a new marker (for example `v3:`). The iteration constants in
//! this file must never change, or existing snippets stop decrypting.
//!
//! Legacy blobs are upgraded outside this module: after a successful decrypt during copy
//! or auto-type, `commands::activate_snippet_get_content` re-encrypts the snippet in the
//! current format. Versions before 0.3.0 cannot read the current format.
//!
//! Each encryption of the same plaintext with the same password produces different ciphertext
//! due to random salt and nonce.
//!
//! ## Key Derivation
//!
//! Passwords are converted to encryption keys using PBKDF2-HMAC-SHA256:
//! ```ignore
//! key = PBKDF2-HMAC-SHA256(password, salt, iterations=600_000, output_length=32)
//! ```
//! This slows down brute-force attacks: every password guess costs 600,000 HMAC-SHA256
//! computations (roughly 0.1 to 0.5 seconds on a desktop CPU, depending on its age).
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
//! // encrypted is a Vec<u8> containing "v2:" + base64-encoded [salt || nonce || ciphertext + tag]
//!
//! // Decrypt (caller is responsible for zeroizing plaintext)
//! let mut decrypted = decrypt(&encrypted, password)?;
//! // ... use decrypted ...
//! decrypted.zeroize(); // important!
//! ```

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use zeroize::Zeroizing;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const TAG_LEN: usize = 16;
const MIN_DECODED_LEN: usize = SALT_LEN + NONCE_LEN + TAG_LEN; // salt + nonce + GCM tag (no plaintext)

/// PBKDF2 iterations of the legacy format (QuickSnippets 0.1.0 to 0.2.1).
///
/// Never change this value: snippets stored in the legacy format would stop decrypting.
const LEGACY_PBKDF2_ITERATIONS: u32 = 100_000;

/// PBKDF2 iterations of format v2: the OWASP minimum for PBKDF2-HMAC-SHA256 (checked 2026-11).
///
/// Never change this value: v2 snippets would stop decrypting. To raise the count, add a
/// new format marker (for example `v3:`) and keep reading v2.
const V2_PBKDF2_ITERATIONS: u32 = 600_000;

/// Marker in front of every v2 blob, also used as the AES-GCM associated data of v2.
///
/// `:` is not a base64 character, so a legacy blob (pure base64) never starts with it.
const V2_PREFIX: &[u8] = b"v2:";

/// The text of a wrong password, exactly as the frontend gets it from `activate_snippet` and
/// `autotype_snippet`. The password dialog says "wrong password" only for this text
/// (`WRONG_PASSWORD` in src/utils/errors.ts): change the two together.
pub const WRONG_PASSWORD: &str = "Wrong password";

#[derive(Debug, PartialEq)]
pub enum CryptoError {
    WrongPassword,
    InvalidData,
    EncryptionFailed,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::WrongPassword => f.write_str(WRONG_PASSWORD),
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
/// key = PBKDF2-HMAC-SHA256(password, salt, iterations, length=32)
/// ```
///
/// # Parameters
///
/// - `password`: The user-provided password (any string)
/// - `salt`: 16-byte random value (unique per encryption)
/// - `iterations`: fixed by the stored format; see [`V2_PBKDF2_ITERATIONS`] and
///   [`LEGACY_PBKDF2_ITERATIONS`]
/// - `out`: 32-byte mutable buffer where the derived key is written
///
/// # Note
///
/// The key is written directly to `out` to avoid intermediate copies.
/// Callers keep `out` in a [`Zeroizing`] buffer, so the key is wiped on every return path.
fn derive_key(password: &str, salt: &[u8], iterations: u32, out: &mut [u8; KEY_LEN]) {
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, out);
}

/// Encrypt `plaintext` and return `base64(salt || nonce || ciphertext + tag)`.
///
/// Shared by the current format and, in tests, the legacy one; they differ only in the
/// iteration count and the associated data.
fn seal(
    plaintext: &[u8],
    password: &str,
    iterations: u32,
    associated_data: &[u8],
) -> Result<String, CryptoError> {
    // Generate random salt and nonce
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);

    // Derive key (wiped when `key` goes out of scope, also on the error paths)
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    derive_key(password, &salt, iterations, &mut key);

    // Encrypt
    let cipher =
        Aes256Gcm::new_from_slice(key.as_slice()).map_err(|_| CryptoError::EncryptionFailed)?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: plaintext,
                aad: associated_data,
            },
        )
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Assemble: salt || nonce || ciphertext+tag
    let mut blob = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    blob.extend_from_slice(&salt);
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&blob))
}

/// Decrypt `base64(salt || nonce || ciphertext + tag)`, the counterpart of [`seal`].
fn open(
    payload_b64: &[u8],
    password: &str,
    iterations: u32,
    associated_data: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    // Decode base64
    let blob = BASE64
        .decode(payload_b64)
        .map_err(|_| CryptoError::InvalidData)?;

    // Validate minimum length: salt + nonce + GCM tag
    if blob.len() < MIN_DECODED_LEN {
        return Err(CryptoError::InvalidData);
    }

    // Split blob
    let (salt, rest) = blob.split_at(SALT_LEN);
    let (nonce_bytes, ciphertext) = rest.split_at(NONCE_LEN);

    // Derive key (wiped when `key` goes out of scope, also when the password is wrong)
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    derive_key(password, salt, iterations, &mut key);

    // Decrypt
    let cipher = Aes256Gcm::new_from_slice(key.as_slice()).map_err(|_| CryptoError::InvalidData)?;
    // Return plaintext directly — caller is responsible for zeroizing after use.
    cipher
        .decrypt(
            Nonce::from_slice(nonce_bytes),
            Payload {
                msg: ciphertext,
                aad: associated_data,
            },
        )
        .map_err(|_| CryptoError::WrongPassword)
}

/// Encrypt plaintext with a password using AES-256-GCM.
///
/// # Return Format
///
/// Returns a blob in the current format ("v2"):
/// ```text
/// "v2:" || base64([salt (16 bytes) || nonce (12 bytes) || ciphertext || GCM-tag (16 bytes)])
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
/// 3. Derive 32-byte AES key from password + salt using PBKDF2-HMAC-SHA256 (600,000 iterations)
/// 4. Encrypt plaintext using AES-256-GCM with `v2:` as associated data
///    (produces ciphertext + 16-byte authentication tag)
/// 5. Zeroize the key from memory
/// 6. Assemble: salt || nonce || ciphertext+tag
/// 7. Base64-encode the blob, put `v2:` in front and return as UTF-8 bytes
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
    let payload = seal(plaintext, password, V2_PBKDF2_ITERATIONS, V2_PREFIX)?;

    let mut stored = Vec::with_capacity(V2_PREFIX.len() + payload.len());
    stored.extend_from_slice(V2_PREFIX);
    stored.extend_from_slice(payload.as_bytes());
    Ok(stored)
}

/// Decrypt a blob produced by [`encrypt`], in the current or the legacy format.
///
/// # Input Format
///
/// Current format ("v2", 600,000 PBKDF2 iterations, `v2:` as associated data):
/// ```text
/// "v2:" || base64([salt (16 bytes) || nonce (12 bytes) || ciphertext || GCM-tag (16 bytes)])
/// ```
///
/// Legacy format (QuickSnippets 0.1.0 to 0.2.1; 100,000 iterations, no associated data):
/// ```text
/// base64([salt (16 bytes) || nonce (12 bytes) || ciphertext || GCM-tag (16 bytes)])
/// ```
///
/// Anything that does not start with `v2:` is read as the legacy format. A blob with an
/// unknown marker is therefore rejected as `InvalidData`, because the marker is not base64.
///
/// # Return Value
///
/// Returns the original plaintext as a `Vec<u8>`.
/// **Important**: The caller must zeroize this vector after use via [`zeroize::Zeroize`] to prevent
/// sensitive data from remaining on the heap.
///
/// # How It Works
///
/// 1. Pick the format by the `v2:` marker
/// 2. Base64-decode the payload
/// 3. Validate minimum length (44 bytes minimum: 16 salt + 12 nonce + 16 tag)
/// 4. Extract salt, nonce, and ciphertext+tag from the blob
/// 5. Derive the AES key from password + salt using PBKDF2-HMAC-SHA256
///    with the iteration count of that format
/// 6. Decrypt ciphertext using AES-256-GCM (verifies authentication tag)
/// 7. Zeroize the key from memory
/// 8. Return plaintext
///
/// # Errors
///
/// - `CryptoError::InvalidData`: Base64 decoding failed, or blob is too short
/// - `CryptoError::WrongPassword`: Authentication tag verification failed (wrong password
///   or corrupted ciphertext). Note: This check is **not constant-time**, so an attacker
///   with precise timing measurements could infer password properties.
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
/// let encrypted_blob = b"v2:base64_encoded_data_here";
/// let password = "my-secure-password";
/// let mut plaintext = decrypt(encrypted_blob, password)?;
/// // Use plaintext...
/// plaintext.zeroize(); // Important!
/// ```
pub fn decrypt(stored: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
    match stored.strip_prefix(V2_PREFIX) {
        Some(payload_b64) => open(payload_b64, password, V2_PBKDF2_ITERATIONS, V2_PREFIX),
        None => open(stored, password, LEGACY_PBKDF2_ITERATIONS, &[]),
    }
}

/// Whether a stored blob is in the format that [`encrypt`] writes today.
///
/// `false` means the legacy format: the snippet still decrypts, and the caller should
/// re-encrypt it once the password is known.
pub fn is_current_format(stored: &[u8]) -> bool {
    stored.starts_with(V2_PREFIX)
}

/// Encrypt in the legacy format, exactly as QuickSnippets 0.1.0 to 0.2.1 did.
///
/// Test-only: the app no longer writes this format.
#[cfg(test)]
pub(crate) fn encrypt_legacy(plaintext: &[u8], password: &str) -> Vec<u8> {
    seal(plaintext, password, LEGACY_PBKDF2_ITERATIONS, &[])
        .expect("legacy encrypt failed")
        .into_bytes()
}

/// Fixed blobs for known-answer tests. They pin both stored formats: if a format constant
/// or the blob layout ever changes by accident, these stop decrypting and the tests fail.
#[cfg(test)]
pub(crate) mod test_vectors {
    /// Made by the unmodified `encrypt` of QuickSnippets v0.2.1 (crypto.rs from the
    /// `v0.2.1` tag, built with the crate versions of that release).
    pub const LEGACY_BLOB: &[u8] = b"8mq9jzu9NZn0hTHxn85tmWZ4N6qWyLfdMTmpXl0OnjXe9m84m23BTP1TPWyGtE3OkRTbEEGNNTbjJwPjMiu+VBcjrDpDiyxh1jxLoT21zEYSt1i6HoY=";
    pub const LEGACY_PASSWORD: &str = "Старий пароль 0.2.1 🔑";
    pub const LEGACY_PLAINTEXT: &str = "Сніпет із QuickSnippets 0.2.1 🔐";

    /// Made by an independent implementation of format v2 (.NET `Rfc2898DeriveBytes.Pbkdf2`
    /// with SHA-256 and 600,000 iterations, `AesGcm` with `v2:` as associated data).
    pub const V2_BLOB: &[u8] = b"v2:9Z/Jo2InXGL0EspifqgmtkMRFzxtmhooQ6f5ZSBuvGbcRJH8xPwp7pS8Xj8nSz0+hhnz98JGcY49Nj6cVknMEDsdv79tPzHos9h+9cIRExIrN6/QV1Nsit3EKFmvYv9qLA==";
    pub const V2_PASSWORD: &str = "Новий пароль v2 🔑";
    pub const V2_PLAINTEXT: &str = "Сніпет у форматі v2 🔐 (made by .NET)";
}

#[cfg(test)]
mod tests {
    use super::test_vectors::*;
    use super::*;

    /// Iteration count for tests of `derive_key` properties that do not depend on the count.
    const TEST_ITERATIONS: u32 = 1_000;

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    // --- derive_key tests ---

    #[test]
    fn test_derive_key_matches_rfc7914_pbkdf2_hmac_sha256_vectors() {
        // RFC 7914, section 11. The RFC lists 64 output bytes; the first 32 are our key.
        let mut key = [0u8; KEY_LEN];

        derive_key("passwd", b"salt", 1, &mut key);
        assert_eq!(
            hex(&key),
            "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc"
        );

        derive_key("Password", b"NaCl", 80_000, &mut key);
        assert_eq!(
            hex(&key),
            "4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56"
        );
    }

    #[test]
    fn test_derive_key_depends_on_iteration_count() {
        let salt = b"same_salt_value!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];

        derive_key("password", salt, TEST_ITERATIONS, &mut key1);
        derive_key("password", salt, TEST_ITERATIONS + 1, &mut key2);

        assert_ne!(
            key1, key2,
            "Different iteration counts should produce different keys"
        );
    }

    #[test]
    fn test_derive_key_produces_32_byte_key() {
        let password = "test_password";
        let salt = b"1234567890123456"; // 16 bytes
        let mut key = [0u8; KEY_LEN];

        derive_key(password, salt, TEST_ITERATIONS, &mut key);

        // Key should be filled with non-zero bytes (extremely unlikely all zeros)
        assert!(!key.iter().all(|&b| b == 0), "Key should not be all zeros");
    }

    #[test]
    fn test_derive_key_same_password_salt_produces_same_key() {
        let password = "password";
        let salt = b"same_salt_value!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];

        derive_key(password, salt, TEST_ITERATIONS, &mut key1);
        derive_key(password, salt, TEST_ITERATIONS, &mut key2);

        assert_eq!(key1, key2, "Same password + salt should produce same key");
    }

    #[test]
    fn test_derive_key_different_password_produces_different_key() {
        let salt = b"same_salt_value!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];

        derive_key("password1", salt, TEST_ITERATIONS, &mut key1);
        derive_key("password2", salt, TEST_ITERATIONS, &mut key2);

        assert_ne!(
            key1, key2,
            "Different passwords should produce different keys"
        );
    }

    #[test]
    fn test_derive_key_different_salt_produces_different_key() {
        let password = "same_password";
        let salt1 = b"salt_value_one!!";
        let salt2 = b"salt_value_two!!";
        let mut key1 = [0u8; KEY_LEN];
        let mut key2 = [0u8; KEY_LEN];

        derive_key(password, salt1, TEST_ITERATIONS, &mut key1);
        derive_key(password, salt2, TEST_ITERATIONS, &mut key2);

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
        assert_ne!(
            enc1, enc2,
            "Two encryptions of same data must differ (different salt/nonce)"
        );
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
        let result = std::panic::catch_unwind(|| decrypt(&encrypted, "wrong"));
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
        let short_data = BASE64.encode([1u8; 10]);
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
    fn test_encrypted_output_is_v2_marker_plus_valid_base64() {
        let encrypted = encrypt(b"data", "pass").expect("encrypt failed");
        let payload = encrypted
            .strip_prefix(b"v2:".as_slice())
            .expect("Encrypted output must start with the v2: marker");
        let decoded = BASE64.decode(payload);
        assert!(
            decoded.is_ok(),
            "The part after the marker must be valid base64"
        );
    }

    #[test]
    fn test_encrypted_format_salt_nonce_ciphertext_tag() {
        let encrypted = encrypt(b"x", "pass").expect("encrypt failed");
        let payload = encrypted
            .strip_prefix(V2_PREFIX)
            .expect("v2: marker missing");
        let decoded = BASE64.decode(payload).expect("base64 decode failed");
        // salt(16) + nonce(12) + ciphertext(1) + tag(16) = 45 for 1-byte plaintext
        assert_eq!(decoded.len(), MIN_DECODED_LEN + 1);
    }

    #[test]
    fn test_encrypted_output_is_ascii_text() {
        // The blob is stored as text bytes; the marker must not break that.
        let encrypted = encrypt("Привіт 🌍".as_bytes(), "пароль").expect("encrypt failed");
        assert!(encrypted.is_ascii());
    }

    // --- Format constants ---

    #[test]
    fn test_format_constants_are_pinned() {
        // These values are part of the stored data format. Changing one locks users out of
        // their encrypted snippets. A new key derivation setting needs a new format marker.
        assert_eq!(LEGACY_PBKDF2_ITERATIONS, 100_000);
        assert_eq!(V2_PBKDF2_ITERATIONS, 600_000);
        assert_eq!(V2_PREFIX, b"v2:");
        assert_eq!((SALT_LEN, NONCE_LEN, KEY_LEN, TAG_LEN), (16, 12, 32, 16));
    }

    #[test]
    fn test_v2_marker_is_not_base64() {
        // This is what keeps the two formats apart: a legacy blob is pure base64, and the
        // marker ends with a character that base64 never produces.
        assert_eq!(V2_PREFIX.last(), Some(&b':'));
        assert!(
            BASE64.decode(b"v2AA").is_ok(),
            "four base64 characters decode"
        );
        assert!(
            BASE64.decode(b"v2:A").is_err(),
            "':' is not a base64 character"
        );
        // No byte that the base64 encoder can emit is ':'.
        let all_bytes: Vec<u8> = (0..=255).collect();
        assert!(!BASE64.encode(&all_bytes).contains(':'));
    }

    // --- Known-answer blobs ---

    #[test]
    fn test_decrypt_legacy_blob_made_by_v0_2_1() {
        let decrypted = decrypt(LEGACY_BLOB, LEGACY_PASSWORD).expect("legacy blob must decrypt");
        assert_eq!(std::str::from_utf8(&decrypted).unwrap(), LEGACY_PLAINTEXT);
    }

    #[test]
    fn test_decrypt_v2_blob_made_by_independent_implementation() {
        let decrypted = decrypt(V2_BLOB, V2_PASSWORD).expect("v2 blob must decrypt");
        assert_eq!(std::str::from_utf8(&decrypted).unwrap(), V2_PLAINTEXT);
    }

    #[test]
    fn test_known_answer_blobs_reject_wrong_password() {
        assert_eq!(
            decrypt(LEGACY_BLOB, V2_PASSWORD).unwrap_err(),
            CryptoError::WrongPassword
        );
        assert_eq!(
            decrypt(V2_BLOB, LEGACY_PASSWORD).unwrap_err(),
            CryptoError::WrongPassword
        );
    }

    // --- Legacy format (QuickSnippets 0.1.0 to 0.2.1) ---

    #[test]
    fn test_legacy_blob_has_no_marker_and_is_plain_base64() {
        let legacy = encrypt_legacy(b"x", "pass");
        assert!(!legacy.starts_with(V2_PREFIX));
        let decoded = BASE64
            .decode(&legacy)
            .expect("legacy blob must be plain base64");
        assert_eq!(decoded.len(), MIN_DECODED_LEN + 1);
        // The test helper writes the same shape as the real v0.2.1 blob.
        assert!(BASE64.decode(LEGACY_BLOB).is_ok());
    }

    #[test]
    fn test_legacy_decrypt_roundtrip() {
        let plaintext = "Привіт 🌍".as_bytes();
        let legacy = encrypt_legacy(plaintext, "пароль🔑");
        let decrypted = decrypt(&legacy, "пароль🔑").expect("legacy decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_legacy_decrypt_empty_plaintext() {
        let legacy = encrypt_legacy(b"", "pass");
        let decrypted = decrypt(&legacy, "pass").expect("legacy decrypt failed");
        assert_eq!(decrypted, b"");
    }

    #[test]
    fn test_legacy_decrypt_large_payload() {
        let plaintext = vec![0xCDu8; 48_000];
        let legacy = encrypt_legacy(&plaintext, "pass");
        let decrypted = decrypt(&legacy, "pass").expect("legacy decrypt failed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_legacy_decrypt_wrong_password() {
        let legacy = encrypt_legacy(b"text", "correct");
        assert_eq!(
            decrypt(&legacy, "wrong").unwrap_err(),
            CryptoError::WrongPassword
        );
    }

    #[test]
    fn test_legacy_decrypt_corrupted_ciphertext_or_tag() {
        let original = BASE64.decode(LEGACY_BLOB).unwrap();
        // First ciphertext byte, then the last byte of the authentication tag.
        for index in [SALT_LEN + NONCE_LEN, original.len() - 1] {
            let mut blob = original.clone();
            blob[index] ^= 0x01;
            let corrupted = BASE64.encode(&blob);
            assert_eq!(
                decrypt(corrupted.as_bytes(), LEGACY_PASSWORD).unwrap_err(),
                CryptoError::WrongPassword
            );
        }
    }

    // --- Telling the formats apart ---

    #[test]
    fn test_is_current_format() {
        assert!(is_current_format(&encrypt(b"data", "pass").unwrap()));
        assert!(is_current_format(V2_BLOB));
        assert!(!is_current_format(LEGACY_BLOB));
        assert!(!is_current_format(&encrypt_legacy(b"data", "pass")));
        assert!(!is_current_format(b""));
    }

    #[test]
    fn test_v2_blob_without_marker_does_not_decrypt_as_legacy() {
        let payload = V2_BLOB.strip_prefix(V2_PREFIX).unwrap();
        assert_eq!(
            decrypt(payload, V2_PASSWORD).unwrap_err(),
            CryptoError::WrongPassword
        );
    }

    #[test]
    fn test_legacy_blob_with_marker_does_not_decrypt_as_v2() {
        let mut marked = V2_PREFIX.to_vec();
        marked.extend_from_slice(LEGACY_BLOB);
        assert_eq!(
            decrypt(&marked, LEGACY_PASSWORD).unwrap_err(),
            CryptoError::WrongPassword
        );
    }

    #[test]
    fn test_v2_marker_is_authenticated() {
        // Right key (600,000 iterations) but the marker was not given to AES-GCM as
        // associated data: the tag check must fail.
        let payload = seal(b"data", "pass", V2_PBKDF2_ITERATIONS, &[]).unwrap();
        let mut blob = V2_PREFIX.to_vec();
        blob.extend_from_slice(payload.as_bytes());
        assert_eq!(
            decrypt(&blob, "pass").unwrap_err(),
            CryptoError::WrongPassword
        );
    }

    #[test]
    fn test_v2_blob_is_invalid_data_for_versions_before_0_3_0() {
        // QuickSnippets 0.1.0 to 0.2.1 base64-decode the whole blob first. For a v2 blob
        // that fails, so those versions answer "Invalid data" and leave the blob untouched.
        assert!(BASE64.decode(V2_BLOB).is_err());
        assert!(BASE64.decode(encrypt(b"data", "pass").unwrap()).is_err());
    }

    #[test]
    fn test_unknown_marker_is_invalid_data() {
        let mut future = b"v3:".to_vec();
        future.extend_from_slice(V2_BLOB.strip_prefix(V2_PREFIX).unwrap());
        assert_eq!(
            decrypt(&future, V2_PASSWORD).unwrap_err(),
            CryptoError::InvalidData
        );
    }

    // --- Invalid v2 data ---

    #[test]
    fn test_decrypt_v2_marker_only() {
        assert_eq!(
            decrypt(b"v2:", "pass").unwrap_err(),
            CryptoError::InvalidData
        );
    }

    #[test]
    fn test_decrypt_v2_invalid_base64() {
        assert_eq!(
            decrypt(b"v2:not-valid-base64!!!", "pass").unwrap_err(),
            CryptoError::InvalidData
        );
    }

    #[test]
    fn test_decrypt_v2_truncated_ciphertext() {
        let mut short = V2_PREFIX.to_vec();
        short.extend_from_slice(BASE64.encode([1u8; MIN_DECODED_LEN - 1]).as_bytes());
        assert_eq!(
            decrypt(&short, "pass").unwrap_err(),
            CryptoError::InvalidData
        );
    }

    #[test]
    fn test_decrypt_v2_corrupted_ciphertext_or_tag() {
        let original = BASE64
            .decode(V2_BLOB.strip_prefix(V2_PREFIX).unwrap())
            .unwrap();
        // First ciphertext byte, then the last byte of the authentication tag.
        for index in [SALT_LEN + NONCE_LEN, original.len() - 1] {
            let mut blob = original.clone();
            blob[index] ^= 0x01;
            let mut corrupted = V2_PREFIX.to_vec();
            corrupted.extend_from_slice(BASE64.encode(&blob).as_bytes());
            assert_eq!(
                decrypt(&corrupted, V2_PASSWORD).unwrap_err(),
                CryptoError::WrongPassword
            );
        }
    }

    // --- Timing report (not run by default) ---

    /// Prints how long one key derivation takes. Run it in the release profile before
    /// choosing a new iteration count:
    /// `cargo test --release --lib timing_report -- --ignored --nocapture`
    #[test]
    #[ignore = "timing report, run by hand in the release profile"]
    fn timing_report_key_derivation() {
        let salt = [0x5Au8; SALT_LEN];
        for iterations in [LEGACY_PBKDF2_ITERATIONS, V2_PBKDF2_ITERATIONS] {
            let mut samples = Vec::new();
            for i in 0..7 {
                let password = format!("correct horse battery staple {i}");
                let mut key = [0u8; KEY_LEN];
                let started = std::time::Instant::now();
                derive_key(std::hint::black_box(&password), &salt, iterations, &mut key);
                samples.push(started.elapsed());
                std::hint::black_box(key);
            }
            samples.sort();
            println!(
                "PBKDF2-HMAC-SHA256, {iterations} iterations: median {:.1} ms (min {:.1}, max {:.1})",
                samples[samples.len() / 2].as_secs_f64() * 1000.0,
                samples[0].as_secs_f64() * 1000.0,
                samples[samples.len() - 1].as_secs_f64() * 1000.0,
            );
        }
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
