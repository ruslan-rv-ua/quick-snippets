# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

- OS: Windows (Native, not WSL)
- Shell: PowerShell / CMD
- Use PowerShell-compatible commands, not bash

## Project Overview

QuickSnippets is a portable Windows desktop app (Tauri 2 + React 19 + Rust) for managing and quickly accessing text snippets with optional AES-256-GCM encryption.

## Commands

```bash
# Development
npm run dev              # Vite dev server (frontend only)
npm run tauri dev        # Full Tauri dev build with hot reload

# Build
npm run build            # Frontend production build
npx tauri build --no-bundle  # Portable build (no installer); used in CI release

# Build (fast — larger exe, quick compile; uses release-fast Cargo profile)
just build-fast          # or: npm run tauri build -- -- --profile release-fast

# Testing
npm run test             # Frontend: Vitest (single run)
npm run test:watch       # Frontend: Vitest watch mode
npm run test:coverage    # Frontend: Vitest with v8 coverage
npm run test:rust        # Backend: cargo test --lib (single-threaded, required for SQLite)
npm run test:all         # Both frontend and backend tests

# Run a single frontend test file
npx vitest run src/hooks/__tests__/useSearchLogic.test.ts

# NVDA smoke test of the built release exe (~2.5 min, hands off; NVDA log level "input/output";
# leave a minute between two runs, see DEVELOPMENT.md)
just smoke               # scripts/smoke-nvda.ps1; report also in %TEMP%\quick-snippets-smoke-report.txt

# Lint
npm run lint             # TypeScript strict noEmit + cargo clippy -D warnings
```

## Architecture

### Frontend → Backend Communication

All IPC calls go through [src/hooks/useIpc.ts](src/hooks/useIpc.ts), which wraps `invoke()` with typed signatures. Never call `invoke()` directly from components — add new commands to `useIpc.ts` first.

Key invariant: **plaintext for encrypted snippets never leaves the Rust backend**. When a snippet is encrypted, the frontend receives an empty `content` string. Decryption and clipboard copy happen atomically in `activate_snippet` on the Rust side.

### State Flow

```
SearchBox → useSearchLogic (100ms debounce) → IPC searchSnippets → Rust fuzzy_match
SearchBox (empty query) → useSearchLogic → IPC getSortedSnippets → Rust list_snippets_sorted
SnippetItem click → activateSnippet IPC → Rust decrypts + copies to clipboard
```

App-level state lives in [src/App.tsx](src/App.tsx) via `useSnippets`, `useSearchLogic`, `useAppModals`, `useKeyboard`, `useWindowHiding`, and `useToast` hooks. Context providers (`ThemeContext`, `LanguageContext`) wrap the app for theme and i18n.

### Backend Modules

| File | Responsibility |
|------|---------------|
| [src-tauri/src/commands.rs](src-tauri/src/commands.rs) | `AppState` definition + all `#[tauri::command]` IPC handlers |
| [src-tauri/src/db.rs](src-tauri/src/db.rs) | SQLite CRUD (`snippets` table; `title` has UNIQUE constraint); `last_used_at` column with migration via `PRAGMA user_version` |
| [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs) | AES-256-GCM + PBKDF2-HMAC-SHA256; writes the `v2:` format (600k iterations), still reads the legacy format of 0.1.0–0.2.1 (100k, no marker); keys are `zeroize`d |
| [src-tauri/src/search.rs](src-tauri/src/search.rs) | Fuzzy match: sequential char search, multi-term AND logic |
| [src-tauri/src/paths.rs](src-tauri/src/paths.rs) | Data directory path helpers (`quick-snippets-data/` next to `.exe`) |
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file in data directory (not AppData); includes `autotype_delay_ms`, `sort_mode`, `sort_direction` |
| [src-tauri/src/autotype.rs](src-tauri/src/autotype.rs) | Windows keyboard input simulation (PostMessage primary, SendInput fallback) |
| [src-tauri/src/window_blur.rs](src-tauri/src/window_blur.rs) | Decides what happens after the web content loses the keyboard: hide once the window is no longer the active one, or give the keyboard back while it still is |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | Tray icon (dynamic 16×16 RGBA), menu labels, plugin registration, window events, Ctrl+Alt+Space global hotkey (shows the window; it never hides it) |
| [src-tauri/src/main.rs](src-tauri/src/main.rs) | App entry (calls `quick_snippets_lib::run`) |

### Autotype

The autotype module simulates keyboard input to type snippet content into the focused window:
- **Primary method**: `PostMessage(WM_CHAR)` — bypasses keyboard hooks, critical for screen reader compatibility.
- **Fallback**: `SendInput(KEYEVENTF_UNICODE)` — used when target window handle can't be determined.
- Control characters (`\n`, `\r`, `\t`) are sent as virtual key presses (VK_RETURN, VK_TAB).
- Configurable `char_delay_ms` with enforced minimum 50ms in SendInput fallback for screen reader safety.
- Handles UTF-16 surrogate pairs for emoji/non-BMP characters.

### Frontend Testing

- Vitest v5 with jsdom environment (Vite 8), setup in [src/test/setup.ts](src/test/setup.ts).
- Tauri APIs (`invoke`, `listen`, `emit`, `getCurrentWindow`) are mocked globally in setup.
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` enforced.
- Test files follow pattern: `src/**/__tests__/*.test.{ts,tsx}`.

### Release & CI

- GitHub Actions release triggered manually via `workflow_dispatch` (version specified in UI).
- Workflow auto-creates git tag `v{version}` and pushes it.
- Uses `npx tauri build --no-bundle` — skips Wix/NSIS installer generation for portability.
- ZIP contains `.exe`, `LICENSE`, `README.md`.
- CI (`ci.yml`) runs build, lint, and both test suites on push to `develop`/`main` and on pull requests.
- Scoop: the manifest lives in the `ruslan-rv-ua/scoop-bucket` repo and is updated there by its Excavator workflow (`checkver` + `autoupdate` from the `.sha256` asset). Keep release asset names `quick-snippets-{version}-windows-x64.zip[.sha256]` unchanged.
- Release exe size: keep `removeUnusedCommands` in `tauri.conf.json`, generate `icons/icon.ico` with `npx tauri icon` (PNG-compressed layers), and check for unused crates with `cargo machete`.
- Release profile: `strip = true`, `lto = true`, `codegen-units = 1`, `opt-level = "z"`, `panic = "abort"`. Only the `sha2` crate is built with `opt-level = 3`: it halves the PBKDF2 wait on every use of an encrypted snippet.
- CHANGELOG.md is for users: list only changes a user can notice (features, fixes, behaviour, security impact, upgrade and downgrade notes). Tooling and dependency upgrades, tests, `just smoke`, CI, build settings and other internal details go to commit messages, Backlog task notes or DEVELOPMENT.md instead.

### Key Design Constraints

- **Portable**: No installer, no registry, no AppData — all data stays in `quick-snippets-data/` next to the `.exe`. Handles Scoop `persist` directory stubs.
- **Encrypted blob formats are permanent**: users' snippets exist in both the legacy and the `v2:` format, so the iteration constants, the marker and the blob layout in `crypto.rs` must never change. A new key derivation setting needs a new marker (`v3:`) and the old ones must stay readable. Legacy blobs are re-encrypted in `activate_snippet_get_content` after a successful decrypt (the only place the password is known); versions before 0.3.0 cannot read `v2:` blobs.
- **Rust tests must run single-threaded** (`--test-threads=1`) because SQLite connections are not `Send`-safe across threads in the test setup.
- **Screen reader support**: WebView2 accessibility tree is pre-initialized via `--force-renderer-accessibility` browser argument. Keep semantic HTML and ARIA labels on all interactive elements. After changes to capabilities, focus handling, dialogs or announcements, rebuild and run `just smoke` (drives the real exe and checks what NVDA says).
- **i18n**: All user-facing strings must be added to [src/i18n/translations.ts](src/i18n/translations.ts) for English (`en`), Ukrainian (`uk`), and German (`de`). Tray menu labels are also localized in Rust.
- **Windows-only target**: The build and some APIs (tray, global hotkey, autostart, autotype) are Windows-specific. Do not abstract for cross-platform unless explicitly requested.
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances.
- **Window behavior**: blur → hide with 200ms delay, but only once the window is no longer the foreground window; move/resize → debounced settings save (500ms); close requires confirmation dialog. On Windows, Tauri's `Focused(false)` means "the WebView2 control lost focus", which also happens while the window stays active (a UI Automation Invoke or Toggle moves the keyboard between WebView2's internal windows); the window then stays and the keyboard is given back to the web content. The frontend clears the search and closes the password dialog only on the `window:hidden` event the backend emits right before such a hide, never on a DOM `blur`.
