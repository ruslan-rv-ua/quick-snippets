# CHANGELOG

## [Unreleased]

### Added
- **Snippet sorting**: sort the snippet list by creation date, modification date, alphabetical order, or last used time. Switch modes with `Ctrl+Shift+1`–`Ctrl+Shift+4`; pressing the same shortcut again toggles ascending/descending order. The active sort mode is shown as a label next to the search field. Sort preference is saved and restored on app restart.
- Snippets that have never been used appear at the bottom of the list when sorting by "last used", regardless of sort direction.
- **Auto-type**: press `Shift+Enter` on any selected snippet to type its content directly into the previously active window — no clipboard involved. Works for both plain and encrypted snippets.
- **Autotype delay** setting (0–1000 ms, default: 1 ms) — configurable inter-character delay for auto-type. Increase to 10–50 ms if characters are dropped or appear out of order in the target application.
- Screen reader compatibility for auto-type: primary method uses `PostMessage(WM_CHAR)`, bypassing `WH_KEYBOARD_LL` hooks used by NVDA and JAWS. The `SendInput` fallback enforces a minimum 50 ms inter-character delay.
- Tabs (`\t`) and all newline variants (`\n`, `\r`, `\r\n`) in auto-typed text are sent as real `VK_TAB` / `VK_RETURN` key events.
- Emoji and non-BMP characters are auto-typed correctly via UTF-16 surrogate pairs.

### Known Limitations
- Auto-type does not work into applications running with elevated privileges (UAC / Run as administrator) unless QuickSnippets is also elevated.

### Changed
- `just final-checks` now verifies version sync across `package.json`, `tauri.conf.json`, and `Cargo.toml` before running other checks.
- Added `just build-fast` recipe (alias `bf`) for quick builds using `release-fast` Cargo profile.
- Release workflow: `workflow_dispatch` only (removed automatic `push tag` trigger), auto-creates git tag.
- Release ZIP now includes `LICENSE` and `README.md` alongside the `.exe`.
- Scoop bucket update is now a separate manual workflow (`update-scoop.yml`) with SHA256 verification.
- Removed `notify-scoop-bucket.yml` (replaced by `update-scoop.yml`).

---

## v0.1.2 - 2026-03-05

### Security
- Comprehensive hardening: eliminated plaintext heap leaks with Zeroizing buffers for clipboard operations
- Refactored key derivation to use reference-based output parameters, preventing uncertain copy-on-return of sensitive data
- Added explicit content length validation (max 65,536 bytes) for all snippet content with readable error messages
- Removed unnecessary dialog permissions from capabilities configuration
- Implemented Content Security Policy (CSP) in both Tauri configuration and HTML meta tags to prevent XSS attacks
- Added comprehensive security documentation: Security.md with responsible disclosure process and Security Model section in README

---

## v0.1.1 - 2026-03-02

**Added**
- `Ctrl+D` as an alternative shortcut for deleting the selected snippet (in addition to
  the existing `Delete` key). Like all letter shortcuts, it is layout-independent.
- German (Deutsch) localization — complete translation of all UI strings and parametrized messages.
- Language selector in Settings now includes Deutsch as a third option.
- Auto-detect falls back to German when the system locale is `de`.
- `README.uk.md` — Ukrainian version of the readme.
- `README.de.md` — German version of the readme.
- Language links in `README.md`.

**Fixed**
- Keyboard shortcuts (Ctrl+N, Ctrl+E, Ctrl+F, Ctrl+,, Ctrl+Shift+T, /) now work
  regardless of the active OS keyboard layout (e.g. Ukrainian). Root cause: switched
  from `event.key` (layout-dependent) to `event.code` (physical key position) for all
  letter and symbol shortcuts.
- `Ctrl+Enter` in the Exit Confirmation dialog now always quits the app, even when the
  Cancel button is focused (previously bare Enter was blocked by the Cancel focus guard).
- `Ctrl+Enter` in the Delete Confirmation dialog now confirms deletion, consistent with
  all other modal dialogs.

---

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
