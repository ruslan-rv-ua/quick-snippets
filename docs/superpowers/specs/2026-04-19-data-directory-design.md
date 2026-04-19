# Move Data Files to `quick-snippets-data` Subdirectory

**Date**: 2026-04-19
**Status**: Approved
**Breaking change**: Yes (no migration)

## Problem

`settings.json` and `snippets.db` currently live next to `quick-snippets.exe`. This clutters the app directory and makes it harder to manage data files separately from the binary.

## Solution

Move both files into a `quick-snippets-data/` subdirectory next to the exe. The app auto-creates this directory on first launch.

```
before:                          after:
quick-snippets/                  quick-snippets/
├── quick-snippets.exe           ├── quick-snippets.exe
├── settings.json                └── quick-snippets-data/
└── snippets.db                      ├── settings.json
                                     └── snippets.db
```

## Design

### New module: `src-tauri/src/paths.rs`

```rust
pub fn get_exe_dir() -> PathBuf {
    std::env::current_exe()
        .expect("Cannot determine exe path")
        .parent()
        .expect("Exe has no parent directory")
        .to_path_buf()
}

pub fn get_data_dir() -> PathBuf {
    let dir = get_exe_dir().join("quick-snippets-data");
    std::fs::create_dir_all(&dir).expect("Failed to create data directory");
    dir
}
```

### Changes to existing modules

**`db.rs`** — `get_db_path()` changes from `exe_dir.join("snippets.db")` to `paths::get_data_dir().join("snippets.db")`. Scoop directory-stub handling in `open_and_init_db()` remains unchanged.

**`settings.rs`** — `get_settings_path()` changes from `exe.parent().join("settings.json")` to `paths::get_data_dir().join("settings.json")`. Scoop directory-stub handling in `load_settings_from_path()` remains unchanged.

**`lib.rs`** — Add `pub mod paths;` declaration. No other changes needed; it calls `get_db_path()` and `get_settings_path()` which are updated internally.

**`commands.rs`** — No changes needed; it calls `get_settings_path()`.

### Tests

- Existing tests in `db.rs` and `settings.rs` use `dir.path().join("snippets.db")` / `dir.path().join("settings.json")` with explicit temp paths — no changes needed for those.
- `test_get_db_path_is_next_to_exe` needs updating to expect the `quick-snippets-data` subdirectory.
- New unit test in `paths.rs`: verify `get_data_dir()` creates the directory and returns correct path.

### Scoop manifest (external repo: `ruslan-rv-ua/scoop-bucket`)

```json
{
  "persist": ["quick-snippets-data"],
  "pre_install": [
    "if (!(Test-Path \"$dir\\quick-snippets-data\")) { New-Item -ItemType Directory -Path \"$dir\\quick-snippets-data\" | Out-Null }"
  ],
  "notes": [
    "QuickSnippets is a portable app — your data files (snippets.db, settings.json)",
    "are stored in the quick-snippets-data folder next to the executable and",
    "preserved across Scoop updates.",
    "Use Ctrl+Shift+Space (default) to toggle the snippet window."
  ]
}
```

### Documentation updates

| File | What changes |
|------|-------------|
| `README.md:65, 106` | "saved in the `quick-snippets-data` folder next to the executable" |
| `README_UK.md:59` | Same in Ukrainian |
| `README_DE.md:59` | Same in German |
| `SECURITY.md:11, 44, 124-125` | "Local storage only" line, location description, backup instructions |
| `CLAUDE.md:66, 97` | Module description, portable design constraint |

### DevOps updates

| File | What changes |
|------|-------------|
| `.gitignore` (root) | Replace `*.db` + `settings.json` with `quick-snippets-data/` |
| `src-tauri/.gitignore` | Replace `*.db` + `settings.json` with `quick-snippets-data/` |
| `Justfile:db-reset` | Delete `quick-snippets-data/snippets.db` instead of `snippets.db` |

### What does NOT change

- Release ZIP packaging (only contains `quick-snippets.exe`; data dir is created at runtime)
- CI workflows (`release.yml`, `notify-scoop-bucket.yml`, `update-scoop.yml`)
- Frontend code (no path awareness)
- Encryption, search, autotype modules
