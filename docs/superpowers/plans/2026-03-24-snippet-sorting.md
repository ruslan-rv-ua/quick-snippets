# Snippet Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add snippet list sorting by created date, modified date, alphabetical, and last used — with keyboard shortcuts, persisted preferences, and screen reader support.

**Architecture:** Backend-driven sorting via new IPC command `get_sorted_snippets`. DB migration adds `last_used_at` column via `PRAGMA user_version`. Frontend adds sort keyboard shortcuts to `useKeyboard` hook, sort label to `SearchBox`, and branching logic in `useSearchLogic` to call sorted endpoint when query is empty.

**Tech Stack:** Rust (rusqlite, serde), React 19 (hooks), TypeScript, Vitest, SQLite

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src-tauri/src/db.rs` | Add `last_used_at` to schema, migration, `SnippetRow`, `touch_last_used()`, `list_snippets_sorted()` |
| Modify | `src-tauri/src/settings.rs` | Add `sort_mode`, `sort_direction` fields with defaults |
| Modify | `src-tauri/src/commands.rs` | Add `get_sorted_snippets` IPC command, call `touch_last_used` in `activate_snippet` and `autotype_snippet` |
| Modify | `src-tauri/src/lib.rs` | Register `get_sorted_snippets` in `invoke_handler` |
| Modify | `src/types/index.ts` | Add `sort_mode`, `sort_direction` to `Settings` interface |
| Modify | `src/hooks/useIpc.ts` | Add `getSortedSnippets()` IPC wrapper |
| Modify | `src/hooks/useSearchLogic.ts` | Branch: empty query → `getSortedSnippets`, non-empty → `searchSnippets` |
| Modify | `src/hooks/useKeyboard.ts` | Add `Ctrl+Shift+Digit1–4` sort shortcuts to shortcuts array |
| Modify | `src/components/SearchBox.tsx` | Add sort label element |
| Modify | `src/styles/theme.css` | Style for `.sort-label` |
| Modify | `src/i18n/translations.ts` | Add sort translation keys for en, uk, de |
| Modify | `src/App.tsx` | Wire sort state, pass sort handlers to `useKeyboard`, pass sort props to `SearchBox` |

---

### Task 1: DB Migration & Schema

**Files:**
- Modify: `src-tauri/src/db.rs:10-17` (SnippetRow struct)
- Modify: `src-tauri/src/db.rs:33-53` (init_db + migration)

- [ ] **Step 1: Write failing test for `last_used_at` column existence**

In `src-tauri/src/db.rs` tests section, add:

```rust
#[test]
fn test_schema_has_last_used_at_column() {
    let conn = setup_test_db();
    let mut stmt = conn.prepare("PRAGMA table_info(snippets)").unwrap();
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert!(
        columns.contains(&"last_used_at".to_string()),
        "last_used_at column not found; found: {:?}",
        columns
    );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rust`
Expected: FAIL — column `last_used_at` not found

- [ ] **Step 3: Add `last_used_at` to SnippetRow and CREATE TABLE**

In `src-tauri/src/db.rs`, update `SnippetRow`:

```rust
pub struct SnippetRow {
    pub id: i64,
    pub title: String,
    pub content: Vec<u8>,
    pub is_encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}
```

Update `init_db` — add `last_used_at TEXT` to the CREATE TABLE and add migration:

```rust
pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=DELETE;")?;
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS snippets (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT    NOT NULL,
            content      BLOB    NOT NULL,
            is_encrypted INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT    NOT NULL,
            updated_at   TEXT    NOT NULL,
            last_used_at TEXT,
            CHECK (length(title) >= 3 AND length(title) <= 50),
            CHECK (length(content) <= 65536)
        );
        CREATE INDEX IF NOT EXISTS idx_snippets_updated_at
            ON snippets (updated_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_title
            ON snippets (title);",
    )?;

    // Schema migrations via user_version
    let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        // For existing DBs: add last_used_at column (no-op on fresh DBs since CREATE TABLE already has it,
        // but ALTER TABLE ADD COLUMN is safe — SQLite ignores if column already exists? NO it errors.
        // We need to check if column exists first, or rely on user_version being 0 only for old DBs).
        // Since fresh DBs get user_version=1 below, this only runs on pre-migration DBs.
        conn.execute_batch(
            "ALTER TABLE snippets ADD COLUMN last_used_at TEXT;"
        ).ok(); // .ok() because fresh DBs already have the column from CREATE TABLE
        conn.execute_batch("PRAGMA user_version = 1;")?;
    }

    Ok(())
}
```

**Important:** Use `.ok()` on the ALTER TABLE because for fresh databases the column already exists in CREATE TABLE, so it would error. The `PRAGMA user_version = 1` still runs to mark the schema as current. For existing databases (user_version=0), the ALTER TABLE adds the column successfully.

Also update `get_snippet_by_id` to read the new column:

```rust
pub fn get_snippet_by_id(conn: &Connection, id: i64) -> Result<SnippetRow> {
    conn.query_row(
        "SELECT id, title, content, is_encrypted, created_at, updated_at, last_used_at
         FROM snippets WHERE id = ?1",
        params![id],
        |row| {
            Ok(SnippetRow {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_encrypted: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                last_used_at: row.get(6)?,
            })
        },
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:rust`
Expected: ALL PASS (including new test and existing tests)

- [ ] **Step 5: Update `test_open_and_init_db_schema_has_correct_columns` to include `last_used_at`**

In `src-tauri/src/db.rs` tests, update the existing test at line ~574:

```rust
for expected in &["id", "title", "content", "is_encrypted", "created_at", "updated_at", "last_used_at"] {
```

- [ ] **Step 6: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat(db): add last_used_at column with migration via PRAGMA user_version"
```

---

### Task 2: `touch_last_used` and `list_snippets_sorted`

**Files:**
- Modify: `src-tauri/src/db.rs` (add two new functions + tests)

- [ ] **Step 1: Write failing test for `touch_last_used`**

```rust
#[test]
fn test_touch_last_used_sets_timestamp() {
    let conn = setup_test_db();
    let id = create_snippet(&conn, "test snip", b"data".to_vec(), false).unwrap();
    let row = get_snippet_by_id(&conn, id).unwrap();
    assert!(row.last_used_at.is_none(), "last_used_at should be None initially");

    touch_last_used(&conn, id).unwrap();
    let row = get_snippet_by_id(&conn, id).unwrap();
    assert!(row.last_used_at.is_some(), "last_used_at should be set after touch");
}

#[test]
fn test_touch_last_used_updates_on_second_call() {
    let conn = setup_test_db();
    let id = create_snippet(&conn, "test snip", b"data".to_vec(), false).unwrap();
    touch_last_used(&conn, id).unwrap();
    let first = get_snippet_by_id(&conn, id).unwrap().last_used_at.unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    touch_last_used(&conn, id).unwrap();
    let second = get_snippet_by_id(&conn, id).unwrap().last_used_at.unwrap();
    assert!(second > first, "second touch should have a later timestamp");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rust`
Expected: FAIL — `touch_last_used` not found

- [ ] **Step 3: Implement `touch_last_used`**

Add to `src-tauri/src/db.rs` after the `delete_snippet` function (before the Search list section):

```rust
// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

pub fn touch_last_used(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "UPDATE snippets SET last_used_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 5: Write failing test for `list_snippets_sorted`**

```rust
#[test]
fn test_list_snippets_sorted_by_title_asc() {
    let conn = setup_test_db();
    create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();

    let list = list_snippets_sorted(&conn, "alphabetical", "asc");
    assert_eq!(list.len(), 3);
    assert_eq!(list[0].1, "Alpha");
    assert_eq!(list[1].1, "Bravo");
    assert_eq!(list[2].1, "Charlie");
}

#[test]
fn test_list_snippets_sorted_by_title_desc() {
    let conn = setup_test_db();
    create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
    create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();
    create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();

    let list = list_snippets_sorted(&conn, "alphabetical", "desc");
    assert_eq!(list[0].1, "Charlie");
    assert_eq!(list[1].1, "Bravo");
    assert_eq!(list[2].1, "Alpha");
}

#[test]
fn test_list_snippets_sorted_by_created_desc() {
    let conn = setup_test_db();
    let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

    let list = list_snippets_sorted(&conn, "created", "desc");
    assert_eq!(list[0].0, id_b);
    assert_eq!(list[1].0, id_a);
}

#[test]
fn test_list_snippets_sorted_by_created_asc() {
    let conn = setup_test_db();
    let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

    let list = list_snippets_sorted(&conn, "created", "asc");
    assert_eq!(list[0].0, id_a);
    assert_eq!(list[1].0, id_b);
}

#[test]
fn test_list_snippets_sorted_by_last_used_nulls_last() {
    let conn = setup_test_db();
    let id_a = create_snippet(&conn, "Never used", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_b = create_snippet(&conn, "Used once", b"b".to_vec(), false).unwrap();
    touch_last_used(&conn, id_b).unwrap();

    let list = list_snippets_sorted(&conn, "last_used", "desc");
    assert_eq!(list[0].0, id_b, "used snippet should be first");
    assert_eq!(list[1].0, id_a, "never-used snippet should be last");
}

#[test]
fn test_list_snippets_sorted_by_last_used_asc_nulls_last() {
    let conn = setup_test_db();
    let id_a = create_snippet(&conn, "Never used", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_b = create_snippet(&conn, "Used first", b"b".to_vec(), false).unwrap();
    touch_last_used(&conn, id_b).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_c = create_snippet(&conn, "Used second", b"c".to_vec(), false).unwrap();
    touch_last_used(&conn, id_c).unwrap();

    let list = list_snippets_sorted(&conn, "last_used", "asc");
    assert_eq!(list[0].0, id_b, "oldest usage first");
    assert_eq!(list[1].0, id_c, "newest usage second");
    assert_eq!(list[2].0, id_a, "never-used last");
}

#[test]
fn test_list_snippets_sorted_unknown_mode_falls_back() {
    let conn = setup_test_db();
    let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

    // Unknown mode should fall back to "modified" desc
    let list = list_snippets_sorted(&conn, "unknown", "xyz");
    assert_eq!(list[0].0, id_b);
    assert_eq!(list[1].0, id_a);
}
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm run test:rust`
Expected: FAIL — `list_snippets_sorted` not found

- [ ] **Step 7: Implement `list_snippets_sorted`**

Add to `src-tauri/src/db.rs` after `list_snippets_for_search`:

```rust
/// List all snippets sorted by the given mode and direction.
/// Unknown mode/direction falls back to "modified" / "desc".
pub fn list_snippets_sorted(
    conn: &Connection,
    sort_mode: &str,
    sort_direction: &str,
) -> Vec<(i64, String, bool)> {
    let dir = match sort_direction {
        "asc" => "ASC",
        "desc" => "DESC",
        _ => "DESC",
    };

    let order_clause = match sort_mode {
        "created" => format!("created_at {dir}"),
        "modified" => format!("updated_at {dir}"),
        "alphabetical" => format!("title COLLATE NOCASE {dir}"),
        "last_used" => format!("last_used_at IS NULL, last_used_at {dir}"),
        _ => format!("updated_at {dir}"),
    };

    let sql = format!(
        "SELECT id, title, is_encrypted FROM snippets ORDER BY {order_clause}"
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)? != 0,
        ))
    })
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}
```

- [ ] **Step 8: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat(db): add touch_last_used and list_snippets_sorted functions"
```

---

### Task 3: Settings — `sort_mode` and `sort_direction`

**Files:**
- Modify: `src-tauri/src/settings.rs:29-54` (Settings struct + Default)
- Modify: `src/types/index.ts:52-62` (Settings interface)

- [ ] **Step 1: Write failing test for new settings fields**

In `src-tauri/src/settings.rs` tests, add:

```rust
#[test]
fn test_default_settings_sort_fields() {
    let s = Settings::default();
    assert_eq!(s.sort_mode, "modified");
    assert_eq!(s.sort_direction, "desc");
}

#[test]
fn test_settings_missing_sort_fields_uses_defaults() {
    let json = r#"{"theme": "dark"}"#;
    let s: Settings = serde_json::from_str(json).unwrap();
    assert_eq!(s.sort_mode, "modified");
    assert_eq!(s.sort_direction, "desc");
}

#[test]
fn test_settings_roundtrip_with_sort_fields() {
    let mut s = Settings::default();
    s.sort_mode = "alphabetical".to_string();
    s.sort_direction = "asc".to_string();
    let json = serde_json::to_string(&s).unwrap();
    let loaded: Settings = serde_json::from_str(&json).unwrap();
    assert_eq!(loaded.sort_mode, "alphabetical");
    assert_eq!(loaded.sort_direction, "asc");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:rust`
Expected: FAIL — `sort_mode` field not found

- [ ] **Step 3: Add fields to Settings struct**

In `src-tauri/src/settings.rs`, add to the `Settings` struct after `autotype_delay_ms`:

```rust
pub sort_mode: String,
pub sort_direction: String,
```

Update `Default` impl to add:

```rust
sort_mode: "modified".to_string(),
sort_direction: "desc".to_string(),
```

- [ ] **Step 4: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 5: Update TypeScript Settings interface**

In `src/types/index.ts`, add to the `Settings` interface after `autotype_delay_ms`:

```typescript
/** Sort mode: "created" | "modified" | "alphabetical" | "last_used" */
sort_mode: string;
/** Sort direction: "asc" | "desc" */
sort_direction: string;
```

- [ ] **Step 6: Run frontend tests to check nothing breaks**

Run: `npm run test`
Expected: ALL PASS (or fix any tests that construct Settings objects without new fields)

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/settings.rs src/types/index.ts
git commit -m "feat(settings): add sort_mode and sort_direction with defaults"
```

---

### Task 4: IPC — `get_sorted_snippets` command + `touch_last_used` calls

**Files:**
- Modify: `src-tauri/src/commands.rs` (add command + testable inner + touch calls)
- Modify: `src-tauri/src/lib.rs:324-337` (register command)

- [ ] **Step 1: Write failing test for `get_sorted_snippets_inner`**

In `src-tauri/src/commands.rs` tests section, add:

```rust
#[test]
fn test_get_sorted_snippets_inner_alphabetical_asc() {
    let conn = setup();
    db::create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();
    db::create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
    db::create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();

    let results = get_sorted_snippets_inner(&conn, "alphabetical", "asc").unwrap();
    assert_eq!(results.len(), 3);
    assert_eq!(results[0].title, "Alpha");
    assert_eq!(results[1].title, "Bravo");
    assert_eq!(results[2].title, "Charlie");
    assert_eq!(results[0].score, 0);
    assert!(results[0].matched_positions.is_empty());
}

#[test]
fn test_get_sorted_snippets_inner_returns_search_result_type() {
    let conn = setup();
    db::create_snippet(&conn, "Test item", b"data".to_vec(), true).unwrap();

    let results = get_sorted_snippets_inner(&conn, "modified", "desc").unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].is_encrypted, true);
    assert_eq!(results[0].score, 0);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:rust`
Expected: FAIL — `get_sorted_snippets_inner` not found

- [ ] **Step 3: Implement `get_sorted_snippets_inner` and `touch_last_used_inner`**

In `src-tauri/src/commands.rs`, add after `delete_snippet_inner`:

```rust
pub fn get_sorted_snippets_inner(
    conn: &Connection,
    sort_mode: &str,
    sort_direction: &str,
) -> Result<Vec<search::SearchResult>, String> {
    let rows = db::list_snippets_sorted(conn, sort_mode, sort_direction);
    Ok(rows
        .into_iter()
        .map(|(id, title, is_encrypted)| search::SearchResult {
            id,
            title,
            score: 0,
            matched_positions: vec![],
            is_encrypted,
        })
        .collect())
}

pub fn touch_last_used_inner(conn: &Connection, id: i64) -> Result<(), String> {
    db::touch_last_used(conn, id).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 5: Write test for `touch_last_used_inner` via activate flow**

```rust
#[test]
fn test_touch_last_used_inner_updates_timestamp() {
    let conn = setup();
    let id = db::create_snippet(&conn, "test snip", b"data".to_vec(), false).unwrap();
    let before = db::get_snippet_by_id(&conn, id).unwrap();
    assert!(before.last_used_at.is_none());

    touch_last_used_inner(&conn, id).unwrap();
    let after = db::get_snippet_by_id(&conn, id).unwrap();
    assert!(after.last_used_at.is_some());
}
```

- [ ] **Step 6: Run tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 7: Add Tauri command and `touch_last_used` calls**

In `src-tauri/src/commands.rs` inside the `tauri_commands` module, add:

```rust
#[tauri::command]
pub fn get_sorted_snippets(
    sort_mode: String,
    sort_direction: String,
    state: State<AppState>,
) -> Result<Vec<search::SearchResult>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_sorted_snippets_inner(&conn, &sort_mode, &sort_direction)
}
```

In `activate_snippet`, add `touch_last_used` call. After line `activate_snippet_get_content(&conn, id, &password)?`, but still inside the block where `conn` is locked, add:

```rust
let plaintext = {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let content = activate_snippet_get_content(&conn, id, &password)?;
    db::touch_last_used(&conn, id).ok();
    content
};
```

In `autotype_snippet`, same pattern. Replace the existing `plaintext` block (lines 371-374) with:

```rust
let plaintext = {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let content = activate_snippet_get_content(&conn, id, &password)?;
    db::touch_last_used(&conn, id).ok();
    content
};
```

- [ ] **Step 8: Register command in lib.rs**

In `src-tauri/src/lib.rs`, add to the `invoke_handler` array (line ~336):

```rust
commands::tauri_commands::get_sorted_snippets,
```

- [ ] **Step 9: Run all Rust tests**

Run: `npm run test:rust`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(ipc): add get_sorted_snippets command and touch_last_used on activate/autotype"
```

---

### Task 5: i18n — Sort translation keys

**Files:**
- Modify: `src/i18n/translations.ts`

- [ ] **Step 1: Add sort keys to `TranslationMap` interface**

In `src/i18n/translations.ts`, add after the `// ── Settings` section's last key (`appVersion`):

```typescript
// ── Sorting ─────────────────────────────────────────────────────────────
sortCreatedDesc: string;
sortCreatedAsc: string;
sortModifiedDesc: string;
sortModifiedAsc: string;
sortAlphaAsc: string;
sortAlphaDesc: string;
sortLastUsedDesc: string;
sortLastUsedAsc: string;
sortToast: (label: string) => string;
```

- [ ] **Step 2: Add English translations**

In the `en` object:

```typescript
// Sorting
sortCreatedDesc: 'Newest',
sortCreatedAsc: 'Oldest',
sortModifiedDesc: 'Modified ↓',
sortModifiedAsc: 'Modified ↑',
sortAlphaAsc: 'A–Z',
sortAlphaDesc: 'Z–A',
sortLastUsedDesc: 'Recent',
sortLastUsedAsc: 'Least used',
sortToast: (label) => `Sorted: ${label}`,
```

- [ ] **Step 3: Add Ukrainian translations**

In the `uk` object:

```typescript
// Sorting
sortCreatedDesc: 'Найновіші',
sortCreatedAsc: 'Найстаріші',
sortModifiedDesc: 'Змінені ↓',
sortModifiedAsc: 'Змінені ↑',
sortAlphaAsc: 'А–Я',
sortAlphaDesc: 'Я–А',
sortLastUsedDesc: 'Нещодавні',
sortLastUsedAsc: 'Найдавніші',
sortToast: (label) => `Сортування: ${label}`,
```

- [ ] **Step 4: Add German translations**

In the `de` object:

```typescript
// Sorting
sortCreatedDesc: 'Neueste',
sortCreatedAsc: 'Älteste',
sortModifiedDesc: 'Geändert ↓',
sortModifiedAsc: 'Geändert ↑',
sortAlphaAsc: 'A–Z',
sortAlphaDesc: 'Z–A',
sortLastUsedDesc: 'Zuletzt',
sortLastUsedAsc: 'Älteste Nutzung',
sortToast: (label) => `Sortiert: ${label}`,
```

- [ ] **Step 5: Run frontend tests**

Run: `npm run test`
Expected: ALL PASS (translations test checks all locales have same keys)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(i18n): add sort label translations for en, uk, de"
```

---

### Task 6: Frontend IPC wrapper + `useSearchLogic` branching

**Files:**
- Modify: `src/hooks/useIpc.ts`
- Modify: `src/hooks/useSearchLogic.ts`

- [ ] **Step 1: Add `getSortedSnippets` to useIpc.ts**

In `src/hooks/useIpc.ts`, add after `searchSnippets`:

```typescript
export function getSortedSnippets(
  sortMode: string,
  sortDirection: string,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('get_sorted_snippets', {
    sortMode,
    sortDirection,
  });
}
```

- [ ] **Step 2: Update `useSearchLogic` to accept sort params and branch**

Replace `src/hooks/useSearchLogic.ts` with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { searchSnippets, getSortedSnippets } from './useIpc';
import type { SearchResult } from '../types';

export interface SearchLogicState {
  query: string;
  setQuery: (query: string) => void;
  snippets: SearchResult[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  refreshTick: number;
  setRefreshTick: (tick: number | ((prev: number) => number)) => void;
  reset: () => void;
}

export interface SortConfig {
  sortMode: string;
  sortDirection: string;
}

export function useSearchLogic(sortConfig?: SortConfig): SearchLogicState {
  const [query, setQuery] = useState<string>('');
  const [snippets, setSnippets] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const debouncedQuery = useDebounce(query, 100);

  const sortMode = sortConfig?.sortMode ?? 'modified';
  const sortDirection = sortConfig?.sortDirection ?? 'desc';

  // ── Fetch snippets on debounced query change OR window show ────────────
  useEffect(() => {
    const fetch = debouncedQuery.trim()
      ? searchSnippets(debouncedQuery)
      : getSortedSnippets(sortMode, sortDirection);

    fetch
      .then((results) => {
        const safeResults = Array.isArray(results) ? results : [];
        setSnippets(safeResults);
        setActiveIndex(safeResults.length > 0 ? 0 : -1);
      })
      .catch(() => void 0);
  }, [debouncedQuery, refreshTick, sortMode, sortDirection]);

  // ── Reset search logic ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQuery('');
    setSnippets([]);
    setActiveIndex(-1);
  }, []);

  return {
    query,
    setQuery,
    snippets,
    activeIndex,
    setActiveIndex,
    refreshTick,
    setRefreshTick,
    reset,
  };
}
```

- [ ] **Step 3: Update `useSearchLogic.test.ts`**

Add mock for `getSortedSnippets` and update tests:

In the mock section at top:

```typescript
vi.mock('../useIpc', () => ({
  searchSnippets: vi.fn(),
  getSortedSnippets: vi.fn(),
}));
```

In `beforeEach`:

```typescript
vi.mocked(useIpc.getSortedSnippets).mockResolvedValue([]);
```

Add new test:

```typescript
it('calls getSortedSnippets when query is empty', async () => {
  const mockResults = [
    { id: 1, title: 'Test', is_encrypted: false, score: 0, matched_positions: [] },
  ];
  vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(mockResults);

  vi.useFakeTimers();
  try {
    const { result } = renderHook(() =>
      useSearchLogic({ sortMode: 'alphabetical', sortDirection: 'asc' }),
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });

    expect(useIpc.getSortedSnippets).toHaveBeenCalledWith('alphabetical', 'asc');
    expect(result.current.snippets).toEqual(mockResults);
  } finally {
    vi.useRealTimers();
  }
});

it('calls searchSnippets when query is non-empty', async () => {
  const mockResults = [
    { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
  ];
  vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

  vi.useFakeTimers();
  try {
    const { result } = renderHook(() =>
      useSearchLogic({ sortMode: 'alphabetical', sortDirection: 'asc' }),
    );

    // Initial render calls getSortedSnippets (empty query). Clear mocks before setting query.
    await act(async () => {
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });
    vi.mocked(useIpc.getSortedSnippets).mockClear();
    vi.mocked(useIpc.searchSnippets).mockClear();
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

    act(() => {
      result.current.setQuery('test');
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
    });

    expect(useIpc.searchSnippets).toHaveBeenCalledWith('test');
    expect(useIpc.getSortedSnippets).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
```

- [ ] **Step 4: Run frontend tests**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIpc.ts src/hooks/useSearchLogic.ts src/hooks/__tests__/useSearchLogic.test.ts
git commit -m "feat(frontend): branch useSearchLogic to call getSortedSnippets when query is empty"
```

---

### Task 7: Keyboard shortcuts in `useKeyboard`

**Files:**
- Modify: `src/hooks/useKeyboard.ts:4-16` (KeyboardHandlers interface)
- Modify: `src/hooks/useKeyboard.ts:61-163` (shortcuts array)

- [ ] **Step 1: Add sort handler to `KeyboardHandlers` interface**

In `src/hooks/useKeyboard.ts`, add to the `KeyboardHandlers` interface:

```typescript
onSort?: (mode: string) => void;
```

- [ ] **Step 2: Add sort shortcuts to the shortcuts array**

In `src/hooks/useKeyboard.ts`, add four entries to the `shortcuts` array before the closing `]`:

```typescript
// Ctrl+Shift+1 → sort by created
{
  ctrl: true,
  shift: true,
  code: 'Digit1',
  handler: () => handlers.onSort?.('created'),
},

// Ctrl+Shift+2 → sort by modified
{
  ctrl: true,
  shift: true,
  code: 'Digit2',
  handler: () => handlers.onSort?.('modified'),
},

// Ctrl+Shift+3 → sort by alphabetical
{
  ctrl: true,
  shift: true,
  code: 'Digit3',
  handler: () => handlers.onSort?.('alphabetical'),
},

// Ctrl+Shift+4 → sort by last_used
{
  ctrl: true,
  shift: true,
  code: 'Digit4',
  handler: () => handlers.onSort?.('last_used'),
},
```

- [ ] **Step 3: Add test for sort shortcuts**

In `src/hooks/__tests__/useKeyboard.test.ts`, add:

```typescript
it('fires onSort with "alphabetical" on Ctrl+Shift+3', () => {
  const onSort = vi.fn();
  renderKeyboardHook({ onSort });

  fireEvent.keyDown(window, {
    ctrlKey: true,
    shiftKey: true,
    code: 'Digit3',
    key: '3',
  });

  expect(onSort).toHaveBeenCalledWith('alphabetical');
});

it('fires onSort with "created" on Ctrl+Shift+1', () => {
  const onSort = vi.fn();
  renderKeyboardHook({ onSort });

  fireEvent.keyDown(window, {
    ctrlKey: true,
    shiftKey: true,
    code: 'Digit1',
    key: '1',
  });

  expect(onSort).toHaveBeenCalledWith('created');
});
```

Note: Check existing `useKeyboard.test.ts` for the `renderKeyboardHook` helper pattern and adapt accordingly.

- [ ] **Step 4: Run frontend tests**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboard.ts src/hooks/__tests__/useKeyboard.test.ts
git commit -m "feat(keyboard): add Ctrl+Shift+1-4 sort shortcuts"
```

---

### Task 8: Sort label in SearchBox + CSS

**Files:**
- Modify: `src/components/SearchBox.tsx`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Add sort label props to SearchBox**

In `src/components/SearchBox.tsx`, add to `SearchBoxProps`:

```typescript
sortLabel?: string;
sortAriaLabel?: string;
```

- [ ] **Step 2: Add sort label element to JSX**

In the `return` JSX, add after the `<input>` and before the closing `</div>`:

```tsx
{sortLabel && (
  <span
    className="sort-label"
    role="status"
    aria-live="polite"
    aria-label={sortAriaLabel}
  >
    {sortLabel}
  </span>
)}
```

- [ ] **Step 3: Add CSS for `.sort-label`**

In `src/styles/theme.css`, add after the `.search-input:focus` rule (~line 312):

```css
.sort-label {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  user-select: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-bg-hover);
}
```

- [ ] **Step 4: Run frontend tests**

Run: `npm run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBox.tsx src/styles/theme.css
git commit -m "feat(ui): add sort label to SearchBox with aria-live status"
```

---

### Task 9: Wire everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add sort state and handlers**

In `src/App.tsx`, add imports:

```typescript
import { getSettings, saveSettings } from './hooks/useIpc';
```

Add sort state after the `useSearchLogic` call. Replace the existing `useSearchLogic()` call with one that receives sort config, and add sort state management:

```typescript
const [sortMode, setSortMode] = useState('modified');
const [sortDirection, setSortDirection] = useState('desc');

const {
  query,
  setQuery,
  snippets,
  activeIndex,
  setActiveIndex,
  setRefreshTick,
  reset,
} = useSearchLogic({ sortMode, sortDirection });
```

Add settings load on mount (after the pending notification useEffect):

```typescript
useEffect(() => {
  getSettings()
    .then((s) => {
      setSortMode(s.sort_mode || 'modified');
      setSortDirection(s.sort_direction || 'desc');
    })
    .catch(() => void 0);
}, []);
```

Add a helper function for sort label key mapping (define outside the component, e.g. at module top):

```typescript
function getSortLabelKey(mode: string, direction: string): string {
  const map: Record<string, string> = {
    'created_desc': 'sortCreatedDesc',
    'created_asc': 'sortCreatedAsc',
    'modified_desc': 'sortModifiedDesc',
    'modified_asc': 'sortModifiedAsc',
    'alphabetical_asc': 'sortAlphaAsc',
    'alphabetical_desc': 'sortAlphaDesc',
    'last_used_desc': 'sortLastUsedDesc',
    'last_used_asc': 'sortLastUsedAsc',
  };
  return map[`${mode}_${direction}`] ?? 'sortModifiedDesc';
}

const DEFAULT_DIRECTIONS: Record<string, string> = {
  created: 'desc',
  modified: 'desc',
  alphabetical: 'asc',
  last_used: 'desc',
};
```

Add sort handler callback inside the component:

```typescript
const handleSort = useCallback(
  (mode: string) => {
    let newDirection: string;
    if (mode === sortMode) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      newDirection = DEFAULT_DIRECTIONS[mode] ?? 'desc';
    }
    setSortMode(mode);
    setSortDirection(newDirection);

    // Persist to settings
    getSettings()
      .then((s) => saveSettings({ ...s, sort_mode: mode, sort_direction: newDirection }))
      .catch(() => void 0);

    // Toast with translated label
    const labelKey = getSortLabelKey(mode, newDirection);
    const label = t(labelKey as keyof TranslationMap) as string;
    addToast(t('sortToast')(label), 'info', 2000);
  },
  [sortMode, sortDirection, t, addToast],
);
```

Note: Import `TranslationMap` from `../i18n/translations` for the type cast. The `t()` function is typed to return `string` for simple keys and `(...args) => string` for parametrized keys like `sortToast`. Cast `sortToast` result call appropriately.

- [ ] **Step 2: Pass `onSort` to `useKeyboard`**

Update the `useKeyboard` call to add `onSort`:

```typescript
useKeyboard({
  activeIndex,
  disabled: anyModalOpen,
  onOpenCreate: () => setShowCreate(true),
  onOpenEdit: openEdit,
  onOpenDelete: openDelete,
  onOpenSettings: () => setShowSettings(true),
  onFocusSearch: () => searchRef.current?.focus(),
  onAnnounce: handleAnnounce,
  onSelectFirst: () => setActiveIndex(snippets.length > 0 ? 0 : -1),
  onSelectLast: () => setActiveIndex(snippets.length > 0 ? snippets.length - 1 : -1),
  onSort: handleSort,
});
```

- [ ] **Step 3: Pass sort label to SearchBox**

Compute the sort label and pass it:

```typescript
const sortLabelKey = getSortLabelKey(sortMode, sortDirection);
const sortLabelText = query ? undefined : `↕ ${t(sortLabelKey as keyof TranslationMap)}`;
const sortAriaLabel = query ? undefined : `Sort: ${t(sortLabelKey as keyof TranslationMap)}`;
```

Update `<SearchBox>`:

```tsx
<SearchBox
  ref={searchRef}
  value={query}
  onChange={setQuery}
  snippets={snippets}
  activeIndex={activeIndex}
  onActiveIndexChange={setActiveIndex}
  onActivate={handleActivate}
  onAutotype={handleAutotype}
  sortLabel={sortLabelText}
  sortAriaLabel={sortAriaLabel}
/>
```

- [ ] **Step 4: Run all tests**

Run: `npm run test`
Expected: ALL PASS (may need to update App.test.tsx mocks for `getSettings`)

- [ ] **Step 5: Run Rust tests too**

Run: `npm run test:all`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire sort state, keyboard shortcuts, and sort label in App"
```

---

### Task 10: Lint + Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npm run test:all`
Expected: ALL PASS

- [ ] **Step 3: Manual smoke test**

Run: `npm run tauri dev`

Verify:
1. App starts — snippet list shows sorted by modified (default)
2. `Ctrl+Shift+3` → list sorts alphabetically, label shows "↕ A–Z", toast shows "Sorted: A–Z"
3. `Ctrl+Shift+3` again → sorts Z–A, label updates
4. `Ctrl+Shift+1` → sorts by created date
5. `Ctrl+Shift+4` → sorts by last used (never-used at bottom)
6. Activate a snippet → use `Ctrl+Shift+4` → activated snippet moves to top
7. Type in search → label disappears, results sorted by score
8. Clear search → sort label reappears, previous sort mode restored
9. Close and reopen app → sort preference persists

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint and smoke test issues"
```
