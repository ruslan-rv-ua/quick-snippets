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
# see DEVELOPMENT.md)
just smoke               # scripts/smoke-nvda.ps1; report also in %TEMP%\quick-snippets-smoke-report.txt
just smoke-tray          # the same with the test copy started in the tray: the window must not appear
                         # at startup, and NVDA must read the first Ctrl+Alt+Space show

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
| [src-tauri/src/db.rs](src-tauri/src/db.rs) | SQLite CRUD (`snippets` table; `title` has UNIQUE constraint); `last_used_at` column with migration via `PRAGMA user_version`; opening at start-up (`open_db_or_ask`): a damaged file is renamed to `snippets-damaged-<date-time>.db` next to it, never deleted; any other error only offers to try again |
| [src-tauri/src/error_dialogs.rs](src-tauri/src/error_dialogs.rs) | Texts (en, uk, de) of the native start-up dialogs for unreadable settings and an unopenable database, shown before the web interface exists; their language: the settings language, else the Windows display language. Settings are read before the database for this |
| [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs) | AES-256-GCM + PBKDF2-HMAC-SHA256; writes the `v2:` format (600k iterations), still reads the legacy format of 0.1.0–0.2.1 (100k, no marker); keys are `zeroize`d |
| [src-tauri/src/search.rs](src-tauri/src/search.rs) | Fuzzy match: sequential char search, multi-term AND logic |
| [src-tauri/src/paths.rs](src-tauri/src/paths.rs) | Path helpers: `quick-snippets-data/` (snippets, settings) and `quick-snippets-webview/` (WebView2 profile), both next to `.exe` |
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file in data directory (not AppData); includes `autotype_delay_ms`, `sort_mode`, `sort_direction` |
| [src-tauri/src/autostart.rs](src-tauri/src/autostart.rs) | "Start with Windows" in the registry (HKCU, value name `QuickSnippets`, the same for every copy): changed only when the setting itself changes (`save_settings` compares with the settings in memory, after writing the file); on → tauri-plugin-autostart writes the `...\CurrentVersion\Run` entry and Task Manager's `...\Explorer\StartupApproved\Run` mark; off → the app removes both itself (the plugin's `disable()` leaves the mark), a missing value counting as removed. A change Windows refuses (`enable()` fails, or the entry is still there after turning off; a mark left alone does not count) keeps the previous value in settings.json and in memory, and `save_settings` reports it (`save_settings_inner` in commands.rs), so the settings dialog stays open and says so. `QUICK_SNIPPETS_TEST_AUTOSTART_ERROR` makes every change fail without touching the registry: only for `just smoke`, never break the real values for a test |
| [src-tauri/src/autotype.rs](src-tauri/src/autotype.rs) | Windows keyboard input simulation (PostMessage primary, SendInput fallback) |
| [src-tauri/src/window_blur.rs](src-tauri/src/window_blur.rs) | Decides what happens after the web content loses the keyboard: hide once the window is no longer the active one, or give the keyboard back while it still is |
| [src-tauri/src/startup.rs](src-tauri/src/startup.rs) | How the main window first appears after a start: the pause before the first show while a screen reader runs, and the gate that holds back every show until the start-up is over |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | Creates the main window in `setup` (always hidden and without focus; WebView2 data in `quick-snippets-webview/` next to the exe), shows it (`show_main_window`, `finish_startup`), tray icon (dynamic 16×16 RGBA), menu labels, plugin registration, window events, Ctrl+Alt+Space global hotkey (shows the window; it never hides it) |
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
- Release runs `npm run build`, `npm run lint`, `npm run test` and `npm run test:rust` before the Tauri build; a failing check stops it before any tag or release exists. Only then does it create and push tag `v{version}` and publish the release.
- The `dry_run` input runs checks, build and packaging but skips the tag and the release. Check changes to `release.yml` only this way (see DEVELOPMENT.md): never create a real release or tag as a test, because the Scoop Excavator would ship it.
- Uses `npx tauri build --no-bundle` — skips Wix/NSIS installer generation for portability.
- ZIP contains `.exe`, `LICENSE`, `README.md`.
- CI (`ci.yml`) runs build, lint, and both test suites only on pull requests and when started by hand, not on push; the release procedure does not wait for CI on develop.
- Scoop: the manifest lives in the `ruslan-rv-ua/scoop-bucket` repo and is updated there by its Excavator workflow (`checkver` + `autoupdate` from the `.sha256` asset). Keep release asset names `quick-snippets-{version}-windows-x64.zip[.sha256]` unchanged.
- Release exe size: keep `removeUnusedCommands` in `tauri.conf.json`, generate `icons/icon.ico` with `npx tauri icon` (PNG-compressed layers), and check for unused crates with `cargo machete`.
- Release profile: `strip = true`, `lto = true`, `codegen-units = 1`, `opt-level = "z"`, `panic = "abort"`. Only the `sha2` crate is built with `opt-level = 3`: it halves the PBKDF2 wait on every use of an encrypted snippet.
- CHANGELOG.md is for users: list only changes a user can notice (features, fixes, behaviour, security impact, upgrade and downgrade notes). Tooling and dependency upgrades, tests, `just smoke`, CI, build settings and other internal details go to commit messages, Backlog task notes or DEVELOPMENT.md instead.

### Key Design Constraints

- **Portable**: No installer, no registry (except the two autostart values while "Start with Windows" is on, see `autostart.rs`), no AppData — the user's data stays in `quick-snippets-data/` next to the `.exe`. Handles Scoop `persist` directory stubs. The embedded browser's profile (WebView2 cache and its own state) goes to `quick-snippets-webview/`, also next to the `.exe` but outside the data folder, so Scoop does not persist it and backups of the data folder skip it: `setup` in `lib.rs` passes `paths::get_webview_data_dir()` to `data_directory`. Never drop that call and never use the `dataDirectory` config option (Tauri resolves it inside `%LOCALAPPDATA%`): without it Tauri puts the profile in `%LOCALAPPDATA%\com.quicksnippets.app`, shared by every copy of the app. Versions up to 0.3.3 did so; the app never reads, changes or deletes that folder (older copies may still use it; removing it is the user's call). `just smoke` checks both in its last step.
- **Encrypted blob formats are permanent**: users' snippets exist in both the legacy and the `v2:` format, so the iteration constants, the marker and the blob layout in `crypto.rs` must never change. A new key derivation setting needs a new marker (`v3:`) and the old ones must stay readable. Legacy blobs are re-encrypted in `activate_snippet_get_content` after a successful decrypt (the only place the password is known); versions before 0.3.0 cannot read `v2:` blobs.
- **Rust tests must run single-threaded** (`--test-threads=1`) because SQLite connections are not `Send`-safe across threads in the test setup.
- **Screen reader support**: WebView2 accessibility tree is pre-initialized via `--force-renderer-accessibility` browser argument. Keep semantic HTML and ARIA labels on all interactive elements. After changes to capabilities, focus handling, dialogs or announcements, rebuild and run `just smoke` (drives the real exe and checks what NVDA says). After changes to how the window is created, started in the tray or shown, also run `just smoke-tray`. Each test copy starts with an empty browser profile, the hardest case for the first show of the window (see "Window at start" below); `-BrowserProfileFrom` runs it with an existing one (see DEVELOPMENT.md).
- **i18n**: All user-facing strings must be added to [src/i18n/translations.ts](src/i18n/translations.ts) for English (`en`), Ukrainian (`uk`), and German (`de`). Tray menu labels and the start-up error dialogs (`error_dialogs.rs`) are localized in Rust.
- **Windows-only target**: The build and some APIs (tray, global hotkey, autostart, autotype) are Windows-specific. Do not abstract for cross-platform unless explicitly requested.
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances.
- **Window at start**: Tauri does not create the main window itself (`"create": false` in `tauri.conf.json`); `setup` in `lib.rs` builds it from that config, always hidden and without focus. With `start_in_tray` on it stays so until the user asks for it. Otherwise `finish_startup` shows it once the page has reported that it is ready (the `frontend_ready` command, sent by `App.tsx` when the list is loaded with the saved theme, language and sort order; after 3 s without a report the start-up goes on anyway). With a screen reader running (Windows flag `SPI_GETSCREENREADER`) the first show also waits: three times as long as the start took up to then, between 1 and 4 s (`startup.rs`). Every way to show the window goes through `show_main_window`, which remembers a show asked for before the start-up is over and makes it then.
  - Why the wait: NVDA reads WebView2 content the usual way (IAccessible2) only if its helper has already attached to the browser's process, and the helper attaches at the first focus event that process raises, the very event of the page getting the keyboard. While the browser's process is still starting up, NVDA reads that event first and takes UI Automation instead: it says "web content, region" or the document address, reads the search box twice or without its states, and keeps the first Escape for itself. Up to 0.3.3 a default start showed the window at once and got through only with an existing browser profile. Measured in TASK-29: a show 0.4 s after the page was ready was read the wrong way, 0.6 s after it the right way.
  - Never give the hidden window or its web content the keyboard, not even for a moment. A newly started process may take the foreground, so the hidden window becomes the foreground window and the screen reader reads a window that is not on screen. A hidden window that keeps the keyboard of its own input queue also raises no focus event when it is shown, and the screen reader then says nothing. Hidden alone is not enough either: WebView2 focuses itself when it is created, hence also "without focus".
  - Never create the window visible and hide it afterwards: up to 0.3.3 that put it on screen for a quarter of a second at every start in the tray and took the keyboard from the active program.
  - A window created without focus is shown without being activated, so `show_main_window_now` also calls `set_focus()`.
  - Until the window has been shown for the first time, no snippet is marked as selected (`markedIndex` in `App.tsx`), although the first list is loaded and its first snippet selected while the window is still hidden. A screen reader in the search box reads the first snippet only when it becomes the selected one, and that has to happen with the show, as on every later show (hiding clears the selection). Do not rely on the order in which the page gets its answers during the start, and do not unselect and select again at the show: within a few milliseconds that does not count as newly selected.
- **Window behavior**: blur → hide with 200ms delay, but only once the window is no longer the foreground window; move/resize → debounced settings save (500ms); close requires confirmation dialog. On Windows, Tauri's `Focused(false)` means "the WebView2 control lost focus", which also happens while the window stays active (a UI Automation Invoke or Toggle moves the keyboard between WebView2's internal windows); the window then stays and the keyboard is given back to the web content. The frontend clears the search and closes the password dialog only on the `window:hidden` event the backend emits right before such a hide, never on a DOM `blur`.
