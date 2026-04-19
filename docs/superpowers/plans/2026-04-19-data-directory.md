# Data Directory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `settings.json` and `snippets.db` from exe-adjacent to `quick-snippets-data/` subdirectory.

**Architecture:** New `paths.rs` module provides `get_data_dir()` which returns `exe_dir/quick-snippets-data` (auto-creating it). `db.rs` and `settings.rs` delegate to it instead of computing exe-adjacent paths themselves.

**Tech Stack:** Rust (Tauri 2 backend), Markdown docs, PowerShell (Justfile/gitignore)

**Spec:** `docs/superpowers/specs/2026-04-19-data-directory-design.md`

---

## Chunk 1: Rust core — paths module + integration

### Task 1: Create `paths.rs` module

**Files:**
- Create: `src-tauri/src/paths.rs`
- Modify: `src-tauri/src/lib.rs:1-6` (add module declaration)

- [ ] **Step 1: Create `paths.rs` with `get_data_dir()`**

```rust
// Data directory path helpers

use std::path::PathBuf;

const DATA_DIR_NAME: &str = "quick-snippets-data";

/// Returns the directory containing the running `.exe`.
pub fn get_exe_dir() -> PathBuf {
    std::env::current_exe()
        .expect("Cannot determine exe path")
        .parent()
        .expect("Exe has no parent directory")
        .to_path_buf()
}

/// Returns the path to the data directory (`quick-snippets-data/` next to the `.exe`).
/// Creates the directory if it does not exist.
pub fn get_data_dir() -> PathBuf {
    let dir = get_exe_dir().join(DATA_DIR_NAME);
    std::fs::create_dir_all(&dir).expect("Failed to create data directory");
    dir
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_data_dir_returns_subdir_of_exe() {
        let data_dir = get_data_dir();
        let exe_dir = get_exe_dir();
        assert_eq!(data_dir, exe_dir.join(DATA_DIR_NAME));
        assert!(data_dir.exists(), "data dir must be created");
        assert!(data_dir.is_dir(), "data dir must be a directory");
    }

    #[test]
    fn test_get_data_dir_does_not_contain_appdata() {
        let data_dir = get_data_dir();
        assert!(
            !data_dir.to_string_lossy().contains("AppData"),
            "data dir must not be in AppData"
        );
    }
}
```

- [ ] **Step 2: Add `pub mod paths;` to `lib.rs`**

In `src-tauri/src/lib.rs`, add `pub mod paths;` after `pub mod db;` (line 4) to maintain alphabetical order. The module list becomes:

```rust
pub mod autotype;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod paths;
pub mod search;
pub mod settings;
```

- [ ] **Step 3: Run tests to verify**

Run: `cd src-tauri && cargo test --lib paths -- --test-threads=1`
Expected: 2 tests pass

- [ ] **Step 4: Commit**

```
git add src-tauri/src/paths.rs src-tauri/src/lib.rs
git commit -m "feat: add paths module with get_data_dir()"
```

### Task 2: Update `db.rs` to use `paths::get_data_dir()`

**Files:**
- Modify: `src-tauri/src/db.rs:24-28` (get_db_path function)
- Modify: `src-tauri/src/db.rs:554-568` (test)

- [ ] **Step 1: Update `get_db_path()`**

Replace lines 24-28:
```rust
pub fn get_db_path() -> PathBuf {
    let exe_path = std::env::current_exe().expect("Failed to get current exe path");
    let exe_dir = exe_path.parent().expect("Failed to get exe directory");
    exe_dir.join("snippets.db")
}
```

With:
```rust
pub fn get_db_path() -> PathBuf {
    crate::paths::get_data_dir().join("snippets.db")
}
```

- [ ] **Step 2: Update `test_get_db_path_is_next_to_exe` test**

Replace the test at lines 554-568:
```rust
#[test]
fn test_get_db_path_is_next_to_exe() {
    let db_path = get_db_path();
    let exe_dir = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    assert_eq!(db_path, exe_dir.join("snippets.db"));
    // Must NOT contain "AppData"
    assert!(
        !db_path.to_string_lossy().contains("AppData"),
        "db path must not be in AppData"
    );
}
```

With:
```rust
#[test]
fn test_get_db_path_is_in_data_dir() {
    let db_path = get_db_path();
    let data_dir = crate::paths::get_data_dir();
    assert_eq!(db_path, data_dir.join("snippets.db"));
    assert!(
        !db_path.to_string_lossy().contains("AppData"),
        "db path must not be in AppData"
    );
}
```

- [ ] **Step 3: Remove unused `use std::path::PathBuf;`? — No, it's still used by `get_db_path` return type. Verify no unused import warnings.**

Run: `cd src-tauri && cargo test --lib db -- --test-threads=1`
Expected: All db tests pass

- [ ] **Step 4: Commit**

```
git add src-tauri/src/db.rs
git commit -m "refactor: db.rs uses paths::get_data_dir() for snippets.db"
```

### Task 3: Update `settings.rs` to use `paths::get_data_dir()`

**Files:**
- Modify: `src-tauri/src/settings.rs:64-70` (get_settings_path function)

- [ ] **Step 1: Update `get_settings_path()`**

Replace lines 64-70:
```rust
/// Returns the path to `settings.json` next to the running `.exe`.
pub fn get_settings_path() -> PathBuf {
    let exe = std::env::current_exe().expect("Cannot determine exe path");
    exe.parent()
        .expect("Exe has no parent directory")
        .join("settings.json")
}
```

With:
```rust
/// Returns the path to `settings.json` in the data directory.
pub fn get_settings_path() -> PathBuf {
    crate::paths::get_data_dir().join("settings.json")
}
```

- [ ] **Step 2: Run settings tests**

Run: `cd src-tauri && cargo test --lib settings -- --test-threads=1`
Expected: All settings tests pass (they use explicit temp paths, not `get_settings_path()`)

- [ ] **Step 3: Run full Rust test suite**

Run: `npm run test:rust`
Expected: All tests pass

- [ ] **Step 4: Run lint**

Run: `cd src-tauri && cargo clippy -- -D warnings`
Expected: No warnings

- [ ] **Step 5: Commit**

```
git add src-tauri/src/settings.rs
git commit -m "refactor: settings.rs uses paths::get_data_dir() for settings.json"
```

## Chunk 2: DevOps and documentation

### Task 4: Update `.gitignore` files

**Files:**
- Modify: `.gitignore:31-34`
- Modify: `src-tauri/.gitignore:8-11`

- [ ] **Step 1: Update root `.gitignore`**

Replace lines 31-34:
```
# QuickSnippets generated/local files
# Database files and settings are generated at runtime
*.db
settings.json
```

With:
```
# QuickSnippets data directory (database + settings, generated at runtime)
quick-snippets-data/
```

- [ ] **Step 2: Update `src-tauri/.gitignore`**

Replace lines 8-11:
```
# QuickSnippets: exclude database and settings files
# (safety net: these may exist in target/release/ or adjacent)
*.db
settings.json
```

With:
```
# QuickSnippets data directory (safety net)
quick-snippets-data/
```

- [ ] **Step 3: Commit**

```
git add .gitignore src-tauri/.gitignore
git commit -m "chore: update .gitignore for quick-snippets-data directory"
```

### Task 5: Update Justfile

**Files:**
- Modify: `Justfile:130-133`

- [ ] **Step 1: Update `db-reset` recipe**

Replace lines 130-133:
```
# Delete dev snippets.db to reset local database
db-reset:
    Remove-Item -Force snippets.db -ErrorAction SilentlyContinue
    @Write-Host "[OK] snippets.db removed" -ForegroundColor Yellow
```

With:
```
# Delete dev snippets.db to reset local database
db-reset:
    Remove-Item -Force quick-snippets-data\snippets.db -ErrorAction SilentlyContinue
    @Write-Host "[OK] snippets.db removed" -ForegroundColor Yellow
```

- [ ] **Step 2: Commit**

```
git add Justfile
git commit -m "chore: update Justfile db-reset for data directory"
```

### Task 6: Update documentation (all markdown files)

**Files:**
- Modify: `README.md:65, 106`
- Modify: `README_UK.md:59`
- Modify: `README_DE.md:59`
- Modify: `SECURITY.md:11, 44, 124-125`
- Modify: `CLAUDE.md:66, 97`

- [ ] **Step 1: Update `README.md` line 65**

Replace:
```
Your snippets database (`snippets.db`) and settings (`settings.json`) are saved in the same folder as the executable. To move or back up the app, copy the entire folder.
```
With:
```
Your snippets database (`snippets.db`) and settings (`settings.json`) are saved in the `quick-snippets-data` folder next to the executable. To move or back up the app, copy the entire folder.
```

- [ ] **Step 2: Update `README.md` line 106**

Replace:
```
- **Local storage only** — your database (`snippets.db`) and settings (`settings.json`) live in the application folder; no cloud, no telemetry, no sync
```
With:
```
- **Local storage only** — your database (`snippets.db`) and settings (`settings.json`) live in the `quick-snippets-data` folder next to the executable; no cloud, no telemetry, no sync
```

- [ ] **Step 3: Update `README_UK.md` line 59**

Replace:
```
Ваша база даних сніпетів (`snippets.db`) і налаштування (`settings.json`) зберігаються в тій самій папці, що й виконуваний файл. Щоб перемістити або створити резервну копію програми, скопіюйте всю папку.
```
With:
```
Ваша база даних сніпетів (`snippets.db`) і налаштування (`settings.json`) зберігаються в папці `quick-snippets-data` поряд з виконуваним файлом. Щоб перемістити або створити резервну копію програми, скопіюйте всю папку.
```

- [ ] **Step 4: Update `README_DE.md` line 59**

Replace:
```
Ihre Schnipsel-Datenbank (`snippets.db`) und Einstellungen (`settings.json`) werden im selben Ordner wie die ausführbare Datei gespeichert. Um die App zu verschieben oder zu sichern, kopieren Sie den gesamten Ordner.
```
With:
```
Ihre Schnipsel-Datenbank (`snippets.db`) und Einstellungen (`settings.json`) werden im Ordner `quick-snippets-data` neben der ausführbaren Datei gespeichert. Um die App zu verschieben oder zu sichern, kopieren Sie den gesamten Ordner.
```

- [ ] **Step 5: Update `SECURITY.md` line 11**

Replace:
```
- **Local storage only** — the database lives next to the executable; no AppData directories
```
With:
```
- **Local storage only** — the database lives in the `quick-snippets-data` folder next to the executable; no AppData directories
```

- [ ] **Step 6: Update `SECURITY.md` line 44**

Replace:
```
- **Location**: The database file (`snippets.db`) and settings (`settings.json`) are stored in the same directory as `quick-snippets.exe`
```
With:
```
- **Location**: The database file (`snippets.db`) and settings (`settings.json`) are stored in the `quick-snippets-data` folder next to `quick-snippets.exe`
```

- [ ] **Step 7: Update `SECURITY.md` lines 124-125**

Replace:
```
- [ ] Back up your `snippets.db` and `settings.json` before upgrading
- [ ] Replace your existing `quick-snippets.exe` with the updated version
```
With:
```
- [ ] Back up your `quick-snippets-data` folder before upgrading
- [ ] Replace your existing `quick-snippets.exe` with the updated version
```

- [ ] **Step 8: Update `CLAUDE.md` line 66**

Replace:
```
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file next to `.exe` (not AppData); includes `autotype_delay_ms`, `sort_mode`, `sort_direction` |
```
With:
```
| [src-tauri/src/paths.rs](src-tauri/src/paths.rs) | Data directory path helpers (`quick-snippets-data/` next to `.exe`) |
| [src-tauri/src/settings.rs](src-tauri/src/settings.rs) | JSON settings file in data directory (not AppData); includes `autotype_delay_ms`, `sort_mode`, `sort_direction` |
```

- [ ] **Step 9: Update `CLAUDE.md` line 97**

Replace:
```
- **Portable**: No installer, no registry, no AppData — all data stays in the app folder. Settings file lives next to the `.exe`. Handles Scoop `persist` directory stubs.
```
With:
```
- **Portable**: No installer, no registry, no AppData — all data stays in `quick-snippets-data/` next to the `.exe`. Handles Scoop `persist` directory stubs.
```

- [ ] **Step 10: Commit**

```
git add README.md README_UK.md README_DE.md SECURITY.md CLAUDE.md
git commit -m "docs: update data file location to quick-snippets-data directory"
```

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test:all`
Expected: All frontend and backend tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Note for Scoop manifest (external)**

The Scoop manifest at `ruslan-rv-ua/scoop-bucket/bucket/quick-snippets.json` needs a separate PR:
- Change `"persist"` from `["settings.json", "snippets.db"]` to `["quick-snippets-data"]`
- Simplify `"pre_install"` to create the directory if missing
- Update `"notes"` text

This is in a separate repository and should be done when this release ships.
