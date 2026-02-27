# CHANGELOG

## v0.1.0 - 2026-02-27

Summary: Initial public MVP release of QuickSnippets — a portable Windows launcher for secure text snippets with local encryption, search, and a basic set of UI/UX features.

**Added**
- Portable desktop application for Windows (Tauri + React + TypeScript).
- Local encrypted snippets storage (AES-256-GCM) with key derivation PBKDF2‑HMAC‑SHA256.
- UI: create, edit, delete snippets, modal dialogs (CreateSnippetModal, EditSnippetModal, DeleteConfirmModal, SettingsModal, PasswordModal).
- Search and filtering of snippets (fuzzy search) and snippet list components (SnippetList, SnippetItem).
- Interactive hints/toasts (Toast, ToastContainer) and accessibility/localization (English and Ukrainian).
- Launcher behavior: single‑instance (relaunch focuses the already open window) and automatic hide on blur (blur → hide).
- Tray, global hotkeys and other Tauri integrations (initialization in main.rs).

**Security**
- Cryptography: AES‑256‑GCM + PBKDF2‑HMAC‑SHA256 (100000 iterations), unique salt and nonce for each encryption.
- Critical security invariant: decrypted snippet content is NEVER sent to the frontend. All clipboard operations are performed exclusively in the Rust process.
- Sensitive buffers (keys, plaintext) must be zeroized after use.
- IPC responses for critical commands return only `Ok(())` or `Err(...)`, without plaintext.
