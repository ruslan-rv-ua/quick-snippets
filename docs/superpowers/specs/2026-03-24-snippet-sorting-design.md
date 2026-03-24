# Snippet List Sorting

## Summary

Add sorting capability to the snippet list. Sorting applies only when the search field is empty; during search, results remain ordered by fuzzy-match score. Four sort modes are available: created date, modified date, alphabetical, and last used. Users switch modes via keyboard shortcuts (`Ctrl+Shift+1–4`); a small label next to the search input shows the active mode.

## Database

### New column

Add `last_used_at TEXT` (nullable) to the `snippets` table. `NULL` means "never used."

### Migration mechanism

Introduce schema versioning via SQLite `PRAGMA user_version`.

In `init_db()`, after the existing `CREATE TABLE IF NOT EXISTS`:

```rust
let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

if version < 1 {
    conn.execute_batch(
        "ALTER TABLE snippets ADD COLUMN last_used_at TEXT;
         PRAGMA user_version = 1;"
    )?;
}
```

For fresh databases the `CREATE TABLE` statement must also include the `last_used_at TEXT` column, and `user_version` must be set to `1` after table creation so the migration is skipped.

### Updating last_used_at

Both `activate_snippet` and `autotype_snippet` in `commands.rs` must call a new `db::touch_last_used(conn, id)` function that runs:

```sql
UPDATE snippets SET last_used_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?1
```

This uses the same timestamp format as `created_at` and `updated_at` (ISO-8601 with millisecond precision).

This call happens after the content has been successfully retrieved (decrypted if needed), right before the clipboard write or autotype dispatch.

## Sorting

### Sort modes and default directions

| Mode | Key | Default direction | SQL `ORDER BY` |
|------|-----|-------------------|----------------|
| Created | `Ctrl+Shift+1` | desc (newest first) | `created_at DESC` |
| Modified | `Ctrl+Shift+2` | desc (newest first) | `updated_at DESC` |
| Alphabetical | `Ctrl+Shift+3` | asc (A→Z) | `title ASC COLLATE NOCASE` |
| Last used | `Ctrl+Shift+4` | desc (newest first) | `last_used_at IS NULL, last_used_at DESC` |

Pressing the same shortcut again toggles the direction (asc ↔ desc).

### Default sort

Modified / descending — matches current behavior (`ORDER BY updated_at DESC`).

### NULL handling

When sorting by `last_used_at`, snippets with `NULL` (never used) always appear at the end of the list, regardless of sort direction. This is achieved via `ORDER BY last_used_at IS NULL, last_used_at [ASC|DESC]` — SQLite does not support `NULLS LAST` syntax.

### Backend implementation

Add a new `db::list_snippets_sorted(conn, sort_mode, sort_direction)` function and a corresponding IPC command `get_sorted_snippets(sort_mode, sort_direction)`. Returns `Vec<SearchResult>` (reusing the existing type with `score: 0` and `matched_positions: []`). This keeps the frontend rendering path identical for both search and browse states.

The command validates `sort_mode` and `sort_direction` parameters; unrecognized values fall back to `"modified"` / `"desc"`.

The frontend calls `searchSnippets(query)` when query is non-empty (existing behavior) and `get_sorted_snippets(mode, direction)` when query is empty (new behavior).

### SnippetRow struct

Add `last_used_at: Option<String>` to the `SnippetRow` struct in `db.rs`. This field is used internally for sorting and for the `touch_last_used` update. It is NOT exposed to the frontend via `SnippetView` or `SearchResult` — sorting is purely a backend concern.

### App startup

On launch, the initial snippet list fetch uses `sort_mode` and `sort_direction` from the persisted `settings.json`, ensuring the sort preference survives app restarts.

## Settings

### New fields in `Settings` struct

```rust
pub sort_mode: String,       // "created" | "modified" | "alphabetical" | "last_used"
pub sort_direction: String,  // "asc" | "desc"
```

Defaults: `sort_mode: "modified"`, `sort_direction: "desc"`.

`#[serde(default)]` on the struct ensures existing `settings.json` files without these fields deserialize correctly using defaults.

### TypeScript mirror

Add matching fields to the `Settings` interface in `src/types/index.ts`.

## Frontend

### Keyboard shortcuts

Register `Ctrl+Shift+1` through `Ctrl+Shift+4` as global `window`-level keyboard shortcuts. Use a new `useSortKeyboard` hook or extend the existing `useKeyboard` hook (which handles window-level events). Do NOT use `useSearchBoxKeyboard` — that hook only handles events scoped to the search input element.

Shortcuts must match on `event.code` (`Digit1`–`Digit4`) rather than `event.key` to work correctly on non-Latin keyboard layouts (e.g., Ukrainian). This is consistent with the existing keyboard handling pattern.

These shortcuts must use modifier keys to pass through screen reader browse mode.

When a shortcut is pressed:
1. If the current `sort_mode` matches the pressed key's mode → toggle `sort_direction`
2. Otherwise → set `sort_mode` to the new mode with its default direction
3. Save updated settings via IPC
4. Re-fetch the sorted snippet list
5. Show a toast and announce via `aria-live`

### Sort label

A small text label displayed to the right of the search input inside the `.search-box` flex container. Examples:

| State | Label |
|-------|-------|
| Created desc | `↕ Newest` |
| Created asc | `↕ Oldest` |
| Modified desc | `↕ Modified ↓` |
| Modified asc | `↕ Modified ↑` |
| Alphabetical asc | `↕ A–Z` |
| Alphabetical desc | `↕ Z–A` |
| Last used desc | `↕ Recent` |
| Last used asc | `↕ Least used` |

The label is hidden when a search query is active (list is sorted by score).

The label has `role="status"` and `aria-live="polite"` so screen readers announce changes. The `↕` symbol is decorative — the label also carries an `aria-label` with a screen-reader-friendly description (e.g., "Sort: A to Z") that omits the symbol.

### Toast on sort change

Use the existing `useToast` hook to show a brief toast when the sort mode or direction changes, e.g. "Sorted: A–Z" / "Сортування: А–Я".

## i18n

New translation keys for all three locales (en, uk, de):

```typescript
// Sort labels (for the inline label and toast)
sortCreatedDesc: string;   // "Newest" / "Найновіші" / "Neueste"
sortCreatedAsc: string;    // "Oldest" / "Найстаріші" / "Älteste"
sortModifiedDesc: string;  // "Modified ↓" / "Змінені ↓" / "Geändert ↓"
sortModifiedAsc: string;   // "Modified ↑" / "Змінені ↑" / "Geändert ↑"
sortAlphaAsc: string;      // "A–Z"
sortAlphaDesc: string;     // "Z–A"
sortLastUsedDesc: string;  // "Recent" / "Нещодавні" / "Zuletzt"
sortLastUsedAsc: string;   // "Least used" / "Найдавніші" / "Älteste Nutzung"
sortToast: (label: string) => string;  // "Sorted: {label}" / "Сортування: {label}" / "Sortiert: {label}"
```

## Accessibility

- Keyboard shortcuts use `Ctrl+Shift+N` pattern which passes through screen reader browse mode
- Sort label uses `role="status"` + `aria-live="polite"` for automatic announcements
- Toast provides additional confirmation of sort change
- No interactive controls that require forms mode

## Scoop update safety

- `snippets.db`: persisted by Scoop → migration adds `last_used_at` column on first launch of new version
- `settings.json`: persisted by Scoop → `#[serde(default)]` ensures missing `sort_mode`/`sort_direction` fields default to `"modified"`/`"desc"`
- No breaking changes to existing data
