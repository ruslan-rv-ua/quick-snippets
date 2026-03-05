# Security Policy

## Overview

QuickSnippets prioritizes the security and privacy of your snippets. This document explains our security approach and how to report vulnerabilities responsibly.

### Security Principles

- **No cloud, no telemetry** — all data stays on your device
- **Encrypted by default (optional)** — sensitive snippets can be protected with AES-256-GCM encryption
- **Local storage only** — the database lives next to the executable; no AppData directories
- **Keys never transmitted** — encryption keys are derived locally and never leave your device
- **Portable and auditable** — the application is small and self-contained, making it easy to verify

---

## Security Model

### Data Encryption

Sensitive snippets can be encrypted with AES-256-GCM using PBKDF2-HMAC-SHA256:

- **Cipher**: AES-256 in Galois/Counter Mode (GCM) with 128-bit authentication tag
- **Key derivation**: PBKDF2-HMAC-SHA256 with 100,000 iterations
- **Salt**: 16 random bytes (unique per snippet password)
- **Nonce**: 12 random bytes (unique per encryption)

Each encryption produces a unique ciphertext even with the same plaintext and password, due to random salt and nonce.

### What Is Encrypted

- Snippet **content** is encrypted *if you provide a password*
- Encryption is per-snippet — each snippet has its own password
- You control which snippets are encrypted

### What Is NOT Encrypted

- Snippet **title** — used for indexing and searching, stored as plaintext
- Metadata — creation/modification timestamps are stored in plaintext
- Settings (`settings.json`) — window geometry, language preference, theme

### Data Storage

- **Location**: The database file (`snippets.db`) and settings (`settings.json`) are stored in the same directory as `quick-snippets.exe`
- **No registry**: Unlike traditional Windows applications, QuickSnippets does not use `HKEY_LOCAL_MACHINE` or `HKEY_CURRENT_USER`
- **No AppData**: Data is not stored in `%APPDATA%`, `%LOCALAPPDATA%`, or other system directories
- **Portability**: You can back up, move, or transfer the entire application folder as-is

### Key Management

- Encryption keys are **derived on-demand** when you decrypt a snippet
- Keys are never cached; they are derived fresh each time using the password you provide
- Session keys are held in memory only during decryption and immediately zeroized after use
- The session key (32 bytes) is overwritten with zeros before being released

---

## Known Limitations

### Timing Attacks on Password Verification

The current implementation does not use constant-time password comparison. An attacker with precise timing measurements *could theoretically* determine password length or structure. **Mitigation**: Passwords should be strong and random, not sequential words or patterns.

### Brute-Force at the UI Level

There is no rate limiting on password attempts at the UI level. If an attacker gains access to your device and knows the database exists, they could attempt many passwords in rapid succession. **Mitigation**: Use strong passwords (e.g., 12+ random characters with mixed case, numbers, and symbols).

### Memory Safety

Although Rust provides memory safety guarantees, the application stores decrypted plaintext in memory while it is being worked with. **Mitigation**: Snippets are copied to the clipboard (not displayed on screen) and the plaintext is zeroized after use.

### No Perfect Forward Secrecy

If an attacker gains access to both the encrypted database and learns your password, they can decrypt all past and future snippets encrypted with that password. **Mitigation**: Use unique, strong passwords and keep your device physically secure.

---

## Responsible Disclosure

If you discover a security vulnerability in QuickSnippets, we appreciate your responsible disclosure.

### Reporting a Vulnerability

**Do not** open a public issue or pull request. Instead:

1. **Email**: Send a detailed report to **[security@example.com](mailto:security@example.com)** (replace with actual contact)
   - Include a description of the vulnerability
   - Steps to reproduce (if applicable)
   - Impact assessment
   - Potential fix (if you have one)

2. **PGP/GPG** (optional): If you prefer encrypted communication, include your public key or request ours

3. **Timeline**:
   - We will acknowledge receipt within **3 business days**
   - We will provide an initial assessment within **5 business days**
   - We aim to release a fix within **30 days** of confirmation (depending on severity)
   - Coordinated disclosure: We will notify you before public announcement

### Security Advisory Process

1. **Verification** — we reproduce and confirm the issue
2. **Assessment** — we evaluate severity and scope
3. **Fix** — we develop and test a patch
4. **Coordination** — we agree on a disclosure timeline with you
5. **Release** — we publish the fix and a security advisory
6. **Credit** — with your permission, we acknowledge your contribution

### Vulnerability Severity Levels

- **Critical**: Remote code execution, complete data compromise, cryptographic failure
- **High**: Unauthorized encryption/decryption, privilege escalation, significant data exposure
- **Medium**: Information disclosure, denial of service, UI bypass
- **Low**: Minor usability issues, non-critical data leaks

---

## Security Update Checklist

When a security update is released:

- [ ] Check the [Releases page](https://github.com/ruslan-rv-ua/quick-snippets/releases)
- [ ] Verify the SHA-256 checksum (included with each release)
- [ ] Back up your `snippets.db` and `settings.json` before upgrading
- [ ] Replace your existing `quick-snippets.exe` with the updated version
- [ ] Restart the application

---

## Dependencies

QuickSnippets relies on the following security-critical libraries. Regular audits are performed:

- **`aes-gcm`** — AES-256-GCM encryption (audited)
- **`pbkdf2`** — key derivation (audited)
- **`sha2`** — SHA-256 hashing (audited)
- **`zeroize`** — memory clearing (audited)

All cryptographic dependencies are from the `RustCrypto` ecosystem, which is well-maintained and regularly reviewed.

---

## Compliance and Standards

- **NIST SP 800-38D** — GCM mode specification
- **NIST SP 800-132** — PBKDF2 specification and recommendations
- **OWASP** — secure coding practices applied

---

## Contact

For security inquiries:

- **Email**: [security@example.com](mailto:security@example.com) *(update with actual address)*
- **GitHub**: [ruslan-rv-ua/quick-snippets](https://github.com/ruslan-rv-ua/quick-snippets)

---

## Changelog

### Version 0.1.0 (Initial Release)

- Initial security model with AES-256-GCM encryption
- PBKDF2 key derivation with 100,000 iterations
- Local-only storage with no cloud synchronization
- This Security Policy published

---

## Thank You

Thank you for helping us keep QuickSnippets secure. We take your concerns seriously and will work with you transparently to resolve any issues.
