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
npm run tauri build      # Full Tauri production build (creates installer/portable)

# Testing
npm run test             # Frontend: Vitest (single run)
npm run test:watch       # Frontend: Vitest watch mode
npm run test:coverage    # Frontend: Vitest with v8 coverage
npm run test:rust        # Backend: cargo test --lib (single-threaded, required for SQLite)
npm run test:all         # Both frontend and backend tests

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
SnippetItem click → activateSnippet IPC → Rust decrypts + copies to clipboard
```

App-level state lives in [src/App.tsx](src/App.tsx) via `useSnippets`, `useSearchLogic`, `useAppModals`, `useKeyboard`, `useWindowHiding`, and `useToast` hooks. Context providers (`ThemeContext`, `LanguageContext`) wrap the app for theme and i18n.

### Backend Modules

| File | Responsibility |
|------|---------------|
| [src-tauri/src/commands.rs](src-tauri/src/commands.rs) | `AppState` definition + all `#[tauri::command]` IPC handlers |
| [src-tauri/src/db.rs](src-tauri/src/db.rs) | SQLite CRUD (`snippets` table; `title` has UNIQUE constraint) |
| [src-tauri/src/crypto.rs](src-tauri/src/crypto.rs) | AES-256-GCM + PBKDF2 (100k iterations); keys are `zeroize`d |
| [src-tauri/src/search.rs](src-tauri/src/search.rs) | Fuzzy match: sequential char search, multi-term AND logic |
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file (window state, theme, language, autostart) |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) | Tray icon setup, tray menu labels, plugin registration |
| [src-tauri/src/main.rs](src-tauri/src/main.rs) | App entry, window events, Ctrl+Alt+Space global hotkey |

### Key Design Constraints

- **Portable**: No installer, no registry, no AppData — all data stays in the app folder.
- **Rust tests must run single-threaded** (`--test-threads=1`) because SQLite connections are not `Send`-safe across threads in the test setup.
- **Screen reader support**: WebView2 accessibility tree is pre-initialized at startup for NVDA/JAWS/Narrator compatibility. Keep semantic HTML and ARIA labels on all interactive elements.
- **i18n**: All user-facing strings must be added to [src/i18n/translations.ts](src/i18n/translations.ts) for English (`en`), Ukrainian (`uk`), and German (`de`).
- **Windows-only target**: The build and some APIs (tray, global hotkey, autostart) are Windows-specific. Do not abstract for cross-platform unless explicitly requested.
