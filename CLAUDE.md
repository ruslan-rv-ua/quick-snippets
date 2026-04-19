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
| [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs) | AES-256-GCM + PBKDF2 (100k iterations); keys are `zeroize`d |
| [src-tauri/src/search.rs](src-tauri/src/search.rs) | Fuzzy match: sequential char search, multi-term AND logic |
| [src-tauri/src/paths.rs](src-tauri/src/paths.rs) | Data directory path helpers (`quick-snippets-data/` next to `.exe`) |
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file in data directory (not AppData); includes `autotype_delay_ms`, `sort_mode`, `sort_direction` |
| [src-tauri/src/autotype.rs](src-tauri/src/autotype.rs) | Windows keyboard input simulation (PostMessage primary, SendInput fallback) |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | Tray icon (dynamic 16×16 RGBA), menu labels, plugin registration, window events |
| [src-tauri/src/main.rs](src-tauri/src/main.rs) | App entry, Ctrl+Alt+Space global hotkey |

### Autotype

The autotype module simulates keyboard input to type snippet content into the focused window:
- **Primary method**: `PostMessage(WM_CHAR)` — bypasses keyboard hooks, critical for screen reader compatibility.
- **Fallback**: `SendInput(KEYEVENTF_UNICODE)` — used when target window handle can't be determined.
- Control characters (`\n`, `\r`, `\t`) are sent as virtual key presses (VK_RETURN, VK_TAB).
- Configurable `char_delay_ms` with enforced minimum 50ms in SendInput fallback for screen reader safety.
- Handles UTF-16 surrogate pairs for emoji/non-BMP characters.

### Frontend Testing

- Vitest v3 with jsdom environment, setup in [src/test/setup.ts](src/test/setup.ts).
- Tauri APIs (`invoke`, `listen`, `emit`, `getCurrentWindow`) are mocked globally in setup.
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` enforced.
- Test files follow pattern: `src/**/__tests__/*.test.{ts,tsx}`.

### Release & CI

- GitHub Actions release triggered by version tags (`v*`).
- Uses `npx tauri build --no-bundle` (not `npm run tauri build`) — skips Wix/NSIS installer generation for portability.
- Tags with `-alpha`, `-beta`, `-rc` suffixes are auto-marked as pre-release.
- Non-prerelease triggers `repository_dispatch` to Scoop bucket repo for package manager updates.
- Release profile: `strip = true`, `lto = true`, `codegen-units = 1`, `opt-level = "s"`.

### Key Design Constraints

- **Portable**: No installer, no registry, no AppData — all data stays in `quick-snippets-data/` next to the `.exe`. Handles Scoop `persist` directory stubs.
- **Rust tests must run single-threaded** (`--test-threads=1`) because SQLite connections are not `Send`-safe across threads in the test setup.
- **Screen reader support**: WebView2 accessibility tree is pre-initialized via `--force-renderer-accessibility` browser argument. Keep semantic HTML and ARIA labels on all interactive elements.
- **i18n**: All user-facing strings must be added to [src/i18n/translations.ts](src/i18n/translations.ts) for English (`en`), Ukrainian (`uk`), and German (`de`). Tray menu labels are also localized in Rust.
- **Windows-only target**: The build and some APIs (tray, global hotkey, autostart, autotype) are Windows-specific. Do not abstract for cross-platform unless explicitly requested.
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances.
- **Window behavior**: blur → hide with 200ms delay; move/resize → debounced settings save (500ms); close requires confirmation dialog.
