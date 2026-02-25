# Фаза 3 — Backend: шифрування (`crypto.rs`)

## Завдання

1. Функція `encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>>`:
   - Генерація 16-байтового `salt` через `OsRng`
   - KDF: PBKDF2-HMAC-SHA256, 100 000 ітерацій, довжина ключа 32 байти
   - Генерація 12-байтового `nonce` через `OsRng`
   - Шифрування: AES-256-GCM
   - Формат результату: `base64(salt[16] || nonce[12] || ciphertext || GCM-тег[16])`
   - `zeroize` для ключа та будь-яких проміжних буферів після використання
2. Функція `decrypt(ciphertext_b64: &[u8], password: &str) -> Result<Vec<u8>>`:
   - Парсинг base64-блобу: витягти salt, nonce, ciphertext+tag
   - PBKDF2 з тим самим salt → ключ
   - AES-256-GCM decrypt: `AeadError` → повернути `Err(WrongPassword)`
   - `zeroize` для ключа та plaintext-буфера **до** повернення з функції (викликається після копіювання в буфер обміну)
3. Визначити `CryptoError` enum: `WrongPassword`, `InvalidData`, `EncryptionFailed`

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/crypto.rs` → `#[cfg(test)] mod tests`**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // --- Базовий roundtrip ---

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        // encrypt("hello world", "password123") → decrypt(result, "password123") → "hello world"
    }

    #[test]
    fn test_encrypt_decrypt_empty_string() {
        // encrypt("", "pass") → decrypt → ""
    }

    #[test]
    fn test_encrypt_decrypt_unicode_content() {
        // encrypt("Привіт 🌍", "пароль") → decrypt → "Привіт 🌍"
    }

    #[test]
    fn test_encrypt_decrypt_large_payload() {
        // encrypt(48000 байт даних, "pass") → decrypt → оригінал
    }

    // --- Унікальність salt/nonce ---

    #[test]
    fn test_two_encryptions_produce_different_output() {
        // encrypt("test", "pass") двічі → base64 результати РІЗНІ
    }

    // --- Невірний пароль ---

    #[test]
    fn test_decrypt_wrong_password_returns_error() {
        // encrypt("text", "correct") → decrypt(result, "wrong") → Err(WrongPassword)
    }

    #[test]
    fn test_decrypt_wrong_password_is_not_panic() {
        // Явна перевірка що WrongPassword — це Err, а не паніка
    }

    // --- Невалідні дані ---

    #[test]
    fn test_decrypt_invalid_base64() {
        // decrypt(невалідний base64, "pass") → Err(InvalidData)
    }

    #[test]
    fn test_decrypt_truncated_ciphertext() {
        // decrypt(base64 з обрізаними даними, "pass") → Err(InvalidData)
    }

    #[test]
    fn test_decrypt_empty_input() {
        // decrypt(порожній, "pass") → Err(InvalidData)
    }

    // --- Формат ---

    #[test]
    fn test_encrypted_output_is_valid_base64() {
        // encrypt → результат декодується base64 без помилки
    }

    #[test]
    fn test_encrypted_format_salt_nonce_ciphertext_tag() {
        // Декодувати base64 → length >= 16 + 12 + 0 + 16 = 44 байти мінімум
    }

    // --- Різні паролі ---

    #[test]
    fn test_encrypt_with_unicode_password() {
        // encrypt("data", "пароль🔑") → decrypt → "data"
    }

    #[test]
    fn test_encrypt_with_empty_password() {
        // encrypt("data", "") → decrypt("", "") → "data" (порожній пароль валідний)
    }

    #[test]
    fn test_encrypt_with_very_long_password() {
        // encrypt("data", "a".repeat(1000)) → decrypt → "data"
    }
}
```

**Запуск:** `cd src-tauri && cargo test crypto::tests`

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test crypto::tests` — всі тести зелені (≥ 14 тестів)
- [ ] Зашифрувати рядок «test» два рази → base64-результати **відрізняються** (різні salt/nonce)
- [ ] Decrypt з коректним паролем → оригінальний рядок
- [ ] Decrypt з будь-яким неправильним паролем → повертається `Err(WrongPassword)` (не паніка, не інший тип помилки)
