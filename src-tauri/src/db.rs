// Database CRUD operations

use crate::error_dialogs::OpenFailure;
use rusqlite::{params, Connection, Result};
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

pub struct SnippetRow {
    pub id: i64,
    pub title: String,
    pub content: Vec<u8>,
    pub is_encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

pub fn get_db_path() -> PathBuf {
    crate::paths::get_data_dir().join("snippets.db")
}

// ---------------------------------------------------------------------------
// Schema init
// ---------------------------------------------------------------------------

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
        conn.execute_batch(
            "ALTER TABLE snippets ADD COLUMN last_used_at TEXT;"
        ).ok(); // .ok() because fresh DBs already have the column from CREATE TABLE
        conn.execute_batch("PRAGMA user_version = 1;")?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Opening at start-up: damaged or unavailable database
// ---------------------------------------------------------------------------

/// Open the database and initialize it, without any dialog.
///
/// If the path is a **directory** (e.g. created by Scoop `persist` before the
/// first run), it is silently removed so SQLite can create a proper file.
pub fn open_and_init_db(db_path: &Path) -> Result<Connection> {
    if db_path.is_dir() {
        // Scoop creates a directory stub when the file doesn't exist in the
        // release archive and `persist` is listed in the manifest.
        std::fs::remove_dir_all(db_path).ok();
    }
    // On an error the connection is dropped inside the closure, so the file is
    // closed again before anyone tries to rename it.
    Connection::open(db_path).and_then(|conn| {
        init_db(&conn)?;
        Ok(conn)
    })
}

/// Tell real damage apart from the other reasons a database cannot be opened.
/// Only damage may lead to setting the file aside; for anything else the file
/// is probably fine and the user can only try again or quit.
pub fn classify_open_error(err: &rusqlite::Error) -> OpenFailure {
    use rusqlite::ErrorCode;
    match err {
        rusqlite::Error::SqliteFailure(e, _) => match e.code {
            ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase => OpenFailure::Damaged,
            ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => OpenFailure::Busy,
            ErrorCode::CannotOpen => OpenFailure::CannotOpen,
            ErrorCode::PermissionDenied | ErrorCode::ReadOnly => OpenFailure::NoAccess,
            ErrorCode::DiskFull => OpenFailure::DiskFull,
            _ => OpenFailure::Other(err.to_string()),
        },
        _ => OpenFailure::Other(err.to_string()),
    }
}

/// The local date and time for the name of a damaged database, e.g.
/// `2026-11-20-14-35`. SQLite's own clock saves a date crate.
pub fn local_timestamp() -> String {
    Connection::open_in_memory()
        .and_then(|c| {
            c.query_row(
                "SELECT strftime('%Y-%m-%d-%H-%M', 'now', 'localtime')",
                [],
                |row| row.get::<_, String>(0),
            )
        })
        .unwrap_or_else(|_| "unknown-time".to_string())
}

/// The name a damaged database gets in `folder`: `snippets-damaged-<stamp>.db`,
/// or with `-2`, `-3`, … when that name (or its journal) is already taken, so an
/// earlier damaged copy is never overwritten.
pub fn damaged_db_name(stamp: &str, folder: &Path) -> String {
    let base = format!("snippets-damaged-{stamp}");
    let mut n = 1;
    loop {
        let name = if n == 1 {
            format!("{base}.db")
        } else {
            format!("{base}-{n}.db")
        };
        let taken = folder.join(&name).exists() || folder.join(format!("{name}-journal")).exists();
        if !taken {
            return name;
        }
        n += 1;
    }
}

fn journal_path(db_path: &Path) -> PathBuf {
    let mut s = db_path.as_os_str().to_os_string();
    s.push("-journal");
    PathBuf::from(s)
}

/// Rename the damaged `db_path` to `kept_name` in the same folder, together
/// with its rollback journal if there is one (the journal may hold the last
/// changes, and left behind it would be applied to the new empty database).
/// The bytes are not touched. Nothing changes when the rename fails.
pub fn keep_damaged_db(db_path: &Path, kept_name: &str) -> std::io::Result<PathBuf> {
    let folder = db_path.parent().unwrap_or(Path::new("."));
    let target = folder.join(kept_name);
    let target_journal = journal_path(&target);
    if target.exists() || target_journal.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            format!("{} already exists", target.display()),
        ));
    }
    let journal = journal_path(db_path);
    let journal_moved = if journal.exists() {
        std::fs::rename(&journal, &target_journal)?;
        true
    } else {
        false
    };
    if let Err(e) = std::fs::rename(db_path, &target) {
        if journal_moved {
            std::fs::rename(&target_journal, &journal).ok();
        }
        return Err(e);
    }
    Ok(target)
}

/// A question the start-up asks when the database cannot be opened.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DbDialog {
    /// The file is damaged: keep it as `kept_name` and start with an empty one?
    Damaged { kept_name: String },
    /// It cannot be opened for another reason: try again?
    CannotOpen(OpenFailure),
}

/// Open the database at start-up. On an error, `ask` gets the question for the
/// user and returns true for Yes. Returns `None` when the user said No: then
/// no file has been changed by this function.
///
/// * Damage: Yes renames the damaged file (see [`keep_damaged_db`]) and opens a
///   new empty database. If the rename fails, the user is asked to try again.
/// * Any other error: Yes tries again.
pub fn open_db_or_ask(
    db_path: &Path,
    stamp: &str,
    ask: &mut dyn FnMut(&DbDialog) -> bool,
) -> Option<Connection> {
    let folder = db_path.parent().unwrap_or(Path::new("."));
    loop {
        let err = match open_and_init_db(db_path) {
            Ok(conn) => return Some(conn),
            Err(e) => e,
        };
        eprintln!("Failed to open the database: {err}");
        match classify_open_error(&err) {
            OpenFailure::Damaged => {
                let kept_name = damaged_db_name(stamp, folder);
                if !ask(&DbDialog::Damaged { kept_name: kept_name.clone() }) {
                    return None;
                }
                if let Err(e) = keep_damaged_db(db_path, &kept_name) {
                    let failure = OpenFailure::KeepFailed(e.to_string());
                    if !ask(&DbDialog::CannotOpen(failure)) {
                        return None;
                    }
                }
            }
            failure => {
                if !ask(&DbDialog::CannotOpen(failure)) {
                    return None;
                }
            }
        }
    }
}

/// [`open_db_or_ask`] with the native dialogs in `lang`; No quits the app.
#[cfg(not(test))]
pub fn open_db_at_startup(db_path: &Path, lang: &str) -> Connection {
    use crate::error_dialogs;
    let folder = db_path.parent().unwrap_or(Path::new("."));
    let stamp = local_timestamp();
    let conn = open_db_or_ask(db_path, &stamp, &mut |dialog| {
        let text = match dialog {
            DbDialog::Damaged { kept_name } => error_dialogs::db_damaged(lang, kept_name, folder),
            DbDialog::CannotOpen(failure) => error_dialogs::db_cannot_open(lang, failure, folder),
        };
        error_dialogs::ask_yes_no(&text)
    });
    match conn {
        Some(conn) => conn,
        None => std::process::exit(0),
    }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

pub fn create_snippet(
    conn: &Connection,
    title: &str,
    content_blob: Vec<u8>,
    is_encrypted: bool,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO snippets (title, content, is_encrypted, created_at, updated_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%f', 'now'), strftime('%Y-%m-%dT%H:%M:%f', 'now'))",
        params![title, content_blob, is_encrypted as i64],
    )?;
    Ok(conn.last_insert_rowid())
}

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

/// For encrypted snippets the `content_blob` parameter is ignored;
/// the existing encrypted blob is preserved in the database.
pub fn update_snippet(
    conn: &Connection,
    id: i64,
    title: &str,
    content_blob: Vec<u8>,
) -> Result<()> {
    let is_encrypted: bool = conn.query_row(
        "SELECT is_encrypted FROM snippets WHERE id = ?1",
        params![id],
        |row| Ok(row.get::<_, i64>(0)? != 0),
    )?;

    if is_encrypted {
        conn.execute(
            "UPDATE snippets SET title = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?2",
            params![title, id],
        )?;
    } else {
        conn.execute(
            "UPDATE snippets SET title = ?1, content = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?3",
            params![title, content_blob, id],
        )?;
    }
    Ok(())
}

/// Replace the stored blob of an encrypted snippet with the same content re-encrypted
/// in a newer format.
///
/// The row changes only if it still holds exactly `old_blob`; returns whether it changed.
/// `updated_at` is left alone: re-encryption is not an edit by the user.
pub fn replace_encrypted_blob(
    conn: &Connection,
    id: i64,
    old_blob: &[u8],
    new_blob: &[u8],
) -> Result<bool> {
    let affected = conn.execute(
        "UPDATE snippets SET content = ?1 WHERE id = ?2 AND is_encrypted = 1 AND content = ?3",
        params![new_blob, id, old_blob],
    )?;
    Ok(affected == 1)
}

pub fn delete_snippet(conn: &Connection, id: i64) -> Result<()> {
    let affected = conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
    if affected == 0 {
        Err(rusqlite::Error::QueryReturnedNoRows)
    } else {
        Ok(())
    }
}

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

// ---------------------------------------------------------------------------
// Search list
// ---------------------------------------------------------------------------

pub fn list_snippets_for_search(conn: &Connection) -> Vec<(i64, String, bool)> {
    let mut stmt = match conn.prepare(
        "SELECT id, title, is_encrypted FROM snippets ORDER BY updated_at DESC",
    ) {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    // --- Schema ---

    #[test]
    fn test_init_db_creates_snippets_table() {
        let conn = setup_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snippets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_init_db_sets_delete_journal_mode() {
        let conn = setup_test_db();
        // In-memory DBs always report "memory" for journal_mode, so we verify
        // that init_db executes without error and the PRAGMA is accepted.
        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        // Acceptable values: "delete" (file) or "memory" (in-memory)
        assert!(mode == "delete" || mode == "memory");
    }

    #[test]
    fn test_init_db_sets_busy_timeout() {
        let conn = setup_test_db();
        let timeout: i64 = conn
            .query_row("PRAGMA busy_timeout;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(timeout, 5000);
    }

    #[test]
    fn test_init_db_is_idempotent() {
        let conn = setup_test_db();
        // Second call must not fail
        init_db(&conn).unwrap();
    }

    #[test]
    fn test_index_exists_on_updated_at() {
        let conn = setup_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type='index' AND name='idx_snippets_updated_at'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    // --- CHECK constraints ---

    #[test]
    fn test_check_title_min_length_3() {
        let conn = setup_test_db();
        let result = create_snippet(&conn, "ab", b"content".to_vec(), false);
        assert!(result.is_err(), "title with 2 chars should fail");
    }

    #[test]
    fn test_check_title_max_length_50() {
        let conn = setup_test_db();
        let long_title = "a".repeat(51);
        let result = create_snippet(&conn, &long_title, b"content".to_vec(), false);
        assert!(result.is_err(), "title with 51 chars should fail");
    }

    #[test]
    fn test_check_title_boundary_3_chars_ok() {
        let conn = setup_test_db();
        let result = create_snippet(&conn, "abc", b"content".to_vec(), false);
        assert!(result.is_ok(), "title with 3 chars should be ok");
    }

    #[test]
    fn test_check_title_boundary_50_chars_ok() {
        let conn = setup_test_db();
        let title = "a".repeat(50);
        let result = create_snippet(&conn, &title, b"content".to_vec(), false);
        assert!(result.is_ok(), "title with 50 chars should be ok");
    }

    #[test]
    fn test_check_content_max_65536_bytes() {
        let conn = setup_test_db();
        let big = vec![0u8; 65537];
        let result = create_snippet(&conn, "title-ok", big, false);
        assert!(result.is_err(), "content > 65536 bytes should fail");
    }

    #[test]
    fn test_check_content_boundary_65536_bytes_ok() {
        let conn = setup_test_db();
        let exact = vec![0u8; 65536];
        let result = create_snippet(&conn, "title-ok", exact, false);
        assert!(result.is_ok(), "content of exactly 65536 bytes should be ok");
    }

    #[test]
    fn test_duplicate_title_fails() {
        let conn = setup_test_db();
        create_snippet(&conn, "same title", b"content1".to_vec(), false).unwrap();
        let result = create_snippet(&conn, "same title", b"content2".to_vec(), false);
        assert!(result.is_err(), "duplicate title should fail");
    }

    #[test]
    fn test_unique_titles_both_ok() {
        let conn = setup_test_db();
        create_snippet(&conn, "title A", b"content1".to_vec(), false).unwrap();
        let result = create_snippet(&conn, "title B", b"content2".to_vec(), false);
        assert!(result.is_ok(), "two snippets with different titles should be ok");
    }

    // --- CRUD ---

    #[test]
    fn test_create_snippet_returns_id() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        assert!(id > 0);
    }

    #[test]
    fn test_create_snippet_sets_timestamps() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert!(!row.created_at.is_empty());
        assert!(!row.updated_at.is_empty());
    }

    #[test]
    fn test_get_snippet_by_id_found() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello world".to_vec(), false).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.id, id);
        assert_eq!(row.title, "My snippet");
        assert_eq!(row.content, b"hello world");
        assert!(!row.is_encrypted);
    }

    #[test]
    fn test_get_snippet_by_id_not_found() {
        let conn = setup_test_db();
        let result = get_snippet_by_id(&conn, 9999);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_snippet_changes_title_and_content() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Old title", b"old content".to_vec(), false).unwrap();
        update_snippet(&conn, id, "New title", b"new content".to_vec()).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "New title");
        assert_eq!(row.content, b"new content");
    }

    #[test]
    fn test_update_snippet_preserves_encrypted_content() {
        let conn = setup_test_db();
        let original_blob = b"encrypted-blob".to_vec();
        let id = create_snippet(&conn, "Enc title", original_blob.clone(), true).unwrap();
        // update with different blob — should be ignored for encrypted snippets
        update_snippet(&conn, id, "New title", b"should-be-ignored".to_vec()).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "New title");
        assert_eq!(row.content, original_blob, "encrypted content must not change");
    }

    // --- replace_encrypted_blob ---

    #[test]
    fn test_replace_encrypted_blob_swaps_matching_blob() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"old-blob".to_vec(), true).unwrap();
        conn.execute(
            "UPDATE snippets SET updated_at = '2026-02-03T04:05:06.000' WHERE id = ?1",
            params![id],
        )
        .unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"old-blob", b"new-blob").unwrap();

        assert!(replaced);
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.content, b"new-blob");
        assert!(row.is_encrypted);
        assert_eq!(row.title, "Enc title");
        assert_eq!(row.updated_at, "2026-02-03T04:05:06.000", "updated_at must not change");
    }

    #[test]
    fn test_replace_encrypted_blob_refuses_when_stored_blob_differs() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"current-blob".to_vec(), true).unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"stale-blob", b"new-blob").unwrap();

        assert!(!replaced);
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"current-blob");
    }

    #[test]
    fn test_replace_encrypted_blob_ignores_plain_snippets() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Plain title", b"plain text".to_vec(), false).unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"plain text", b"new-blob").unwrap();

        assert!(!replaced);
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"plain text");
    }

    #[test]
    fn test_replace_encrypted_blob_touches_only_the_given_snippet() {
        let conn = setup_test_db();
        let first = create_snippet(&conn, "First enc", b"same-blob".to_vec(), true).unwrap();
        let second = create_snippet(&conn, "Second enc", b"same-blob".to_vec(), true).unwrap();

        assert!(replace_encrypted_blob(&conn, first, b"same-blob", b"new-blob").unwrap());

        assert_eq!(get_snippet_by_id(&conn, first).unwrap().content, b"new-blob");
        assert_eq!(get_snippet_by_id(&conn, second).unwrap().content, b"same-blob");
        assert!(!replace_encrypted_blob(&conn, 9999, b"same-blob", b"new-blob").unwrap());
    }

    #[test]
    fn test_replace_encrypted_blob_too_long_is_an_error_and_keeps_old_blob() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"old-blob".to_vec(), true).unwrap();
        let too_long = vec![b'A'; 65_537];

        let result = replace_encrypted_blob(&conn, id, b"old-blob", &too_long);

        assert!(result.is_err(), "the content length CHECK must reject the new blob");
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"old-blob");
    }

    #[test]
    fn test_update_snippet_updates_updated_at() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        let before = get_snippet_by_id(&conn, id).unwrap().updated_at;
        // Small sleep to guarantee timestamp difference
        std::thread::sleep(std::time::Duration::from_millis(5));
        update_snippet(&conn, id, "My snippet", b"hello".to_vec()).unwrap();
        let after = get_snippet_by_id(&conn, id).unwrap().updated_at;
        assert!(after > before, "updated_at should increase after update");
    }

    #[test]
    fn test_delete_snippet_removes_record() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "To delete", b"bye".to_vec(), false).unwrap();
        delete_snippet(&conn, id).unwrap();
        assert!(get_snippet_by_id(&conn, id).is_err());
    }

    #[test]
    fn test_delete_nonexistent_snippet() {
        let conn = setup_test_db();
        let result = delete_snippet(&conn, 9999);
        assert!(result.is_err(), "deleting non-existent snippet should return Err");
    }

    // --- List ---

    #[test]
    fn test_list_snippets_sorted_by_updated_at_desc() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "AAA snippet", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "BBB snippet", b"b".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_c = create_snippet(&conn, "CCC snippet", b"c".to_vec(), false).unwrap();

        let list = list_snippets_for_search(&conn);
        assert_eq!(list.len(), 3);
        assert_eq!(list[0].0, id_c);
        assert_eq!(list[1].0, id_b);
        assert_eq!(list[2].0, id_a);
    }

    #[test]
    fn test_list_snippets_returns_id_title_encrypted() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"data".to_vec(), true).unwrap();
        let list = list_snippets_for_search(&conn);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].0, id);
        assert_eq!(list[0].1, "My snippet");
        assert!(list[0].2, "is_encrypted should be true");
    }

    #[test]
    fn test_list_snippets_empty_db() {
        let conn = setup_test_db();
        let list = list_snippets_for_search(&conn);
        assert!(list.is_empty());
    }

    // --- Verification helpers ---

    #[test]
    fn test_open_and_init_db_when_path_is_directory() {
        // Scoop creates a directory stub for persisted files that don't exist
        // in the release archive.  The app must delete it and open a real DB.
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::create_dir_all(&db_path).unwrap();
        assert!(db_path.is_dir(), "precondition: path is a directory");

        let conn = open_and_init_db(&db_path).unwrap();
        assert!(
            !db_path.is_dir(),
            "directory should have been replaced by a file"
        );
        // DB must be functional
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snippets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

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

    #[test]
    fn test_init_db_delete_journal_on_real_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        init_db(&conn).unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "delete", "DELETE journal mode must be enabled on a real file DB");
    }

    #[test]
    fn test_full_crud_cycle() {
        let conn = setup_test_db();

        // Create
        let id = create_snippet(&conn, "Cycle test", b"initial".to_vec(), false).unwrap();
        assert!(id > 0);

        // Read
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "Cycle test");
        assert_eq!(row.content, b"initial");

        // Update
        std::thread::sleep(std::time::Duration::from_millis(5));
        update_snippet(&conn, id, "Updated title", b"updated content".to_vec()).unwrap();
        let updated = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(updated.title, "Updated title");
        assert_eq!(updated.content, b"updated content");
        assert!(updated.updated_at > row.updated_at);

        // Delete
        delete_snippet(&conn, id).unwrap();
        assert!(get_snippet_by_id(&conn, id).is_err());
    }

    // --- open_and_init_db ---

    /// Opening a non-existent path creates the DB file on disk.
    #[test]
    fn test_open_and_init_db_creates_db_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");

        assert!(!db_path.exists(), "precondition: file must not exist yet");
        let _conn = open_and_init_db(&db_path).unwrap();
        assert!(db_path.is_file(), "open_and_init_db must create the db file");
    }

    /// The snippets table contains all six expected columns.
    #[test]
    fn test_open_and_init_db_schema_has_correct_columns() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let mut stmt = conn
            .prepare("PRAGMA table_info(snippets)")
            .unwrap();

        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        for expected in &["id", "title", "content", "is_encrypted", "created_at", "updated_at", "last_used_at"] {
            assert!(
                columns.iter().any(|c| c == expected),
                "column '{}' not found in snippets table; found: {:?}",
                expected,
                columns
            );
        }
    }

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

    /// The unique index on `title` is created by open_and_init_db.
    #[test]
    fn test_open_and_init_db_creates_unique_title_index() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master \
                 WHERE type='index' AND name='idx_snippets_title'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "unique index on title must exist");
    }

    /// The resulting connection is fully usable (INSERT + SELECT round-trip).
    #[test]
    fn test_open_and_init_db_connection_is_functional() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let id = create_snippet(&conn, "Functional test", b"data".to_vec(), false)
            .expect("insert should succeed");
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "Functional test");
        assert_eq!(row.content, b"data");
    }

    /// Calling open_and_init_db on an already-initialised file succeeds
    /// (idempotent) and preserves existing data.
    #[test]
    fn test_open_and_init_db_idempotent_on_existing_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");

        // First open — create and insert one snippet
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Persist me", b"content".to_vec(), false).unwrap();
        }

        // Second open — must succeed and data must still be there
        let conn2 = open_and_init_db(&db_path).unwrap();
        let list = list_snippets_for_search(&conn2);
        assert_eq!(list.len(), 1, "existing snippet must survive re-open");
        assert_eq!(list[0].1, "Persist me");
    }

    /// The journal_mode is DELETE when opening a real file (not in-memory).
    #[test]
    fn test_open_and_init_db_journal_mode_is_delete() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "delete", "journal_mode must be DELETE on a real file");
    }

    // --- touch_last_used ---

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

    // --- list_snippets_sorted ---

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

    // --- opening at start-up: damaged or unavailable database ---

    const STAMP: &str = "2026-11-20-14-35";
    /// Not a SQLite file: SQLite answers "file is not a database".
    const GARBAGE: &[u8] = b"this is not a sqlite database, just some damaged bytes........\
                              ................................................................";

    fn sqlite_failure(code: i32) -> rusqlite::Error {
        rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(code), None)
    }

    fn snippet_count(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM snippets", [], |row| row.get(0)).unwrap()
    }

    fn file_names(dir: &std::path::Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        names
    }

    /// A healthy database opens without any question.
    #[test]
    fn test_open_db_or_ask_healthy_db_asks_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let mut asked = Vec::new();
        let conn = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            true
        })
        .expect("a healthy database must open");
        assert!(asked.is_empty(), "no question for a healthy database: {asked:?}");
        assert_eq!(snippet_count(&conn), 1);
    }

    #[test]
    fn test_classify_open_error_damage() {
        assert_eq!(classify_open_error(&sqlite_failure(11)), OpenFailure::Damaged); // SQLITE_CORRUPT
        assert_eq!(classify_open_error(&sqlite_failure(26)), OpenFailure::Damaged); // SQLITE_NOTADB
    }

    #[test]
    fn test_classify_open_error_other_reasons_are_not_damage() {
        assert_eq!(classify_open_error(&sqlite_failure(5)), OpenFailure::Busy); // SQLITE_BUSY
        assert_eq!(classify_open_error(&sqlite_failure(6)), OpenFailure::Busy); // SQLITE_LOCKED
        assert_eq!(classify_open_error(&sqlite_failure(14)), OpenFailure::CannotOpen); // SQLITE_CANTOPEN
        assert_eq!(classify_open_error(&sqlite_failure(3)), OpenFailure::NoAccess); // SQLITE_PERM
        assert_eq!(classify_open_error(&sqlite_failure(8)), OpenFailure::NoAccess); // SQLITE_READONLY
        assert_eq!(classify_open_error(&sqlite_failure(13)), OpenFailure::DiskFull); // SQLITE_FULL
        assert!(matches!(
            classify_open_error(&sqlite_failure(10)), // SQLITE_IOERR
            OpenFailure::Other(_)
        ));
        assert!(matches!(
            classify_open_error(&rusqlite::Error::QueryReturnedNoRows),
            OpenFailure::Other(_)
        ));
    }

    /// A file that is not a database is reported as damage by the real open.
    #[test]
    fn test_classify_open_error_on_a_garbage_file_is_damage() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        let err = open_and_init_db(&db_path).expect_err("garbage must not open");
        assert_eq!(classify_open_error(&err), OpenFailure::Damaged, "{err}");
    }

    /// A database whose header is intact but whose first page is overwritten.
    #[test]
    fn test_classify_open_error_on_a_damaged_schema_is_damage() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Some title", b"x".to_vec(), false).unwrap();
        }
        let mut bytes = std::fs::read(&db_path).unwrap();
        for b in bytes.iter_mut().take(4096).skip(100) {
            *b = 0xA5;
        }
        std::fs::write(&db_path, &bytes).unwrap();
        let err = open_and_init_db(&db_path).expect_err("a damaged schema must not open");
        assert_eq!(classify_open_error(&err), OpenFailure::Damaged, "{err}");
    }

    #[test]
    fn test_local_timestamp_format() {
        let stamp = local_timestamp();
        // YYYY-MM-DD-HH-MM
        assert_eq!(stamp.len(), 16, "{stamp}");
        let parts: Vec<&str> = stamp.split('-').collect();
        assert_eq!(parts.len(), 5, "{stamp}");
        assert!(parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())), "{stamp}");
    }

    #[test]
    fn test_damaged_db_name_says_what_it_is() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35.db"
        );
    }

    #[test]
    fn test_damaged_db_name_never_reuses_a_taken_name() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("snippets-damaged-2026-11-20-14-35.db"), b"1").unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35-2.db"
        );
        // A leftover journal alone also takes the name.
        std::fs::write(dir.path().join("snippets-damaged-2026-11-20-14-35-2.db-journal"), b"j").unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35-3.db"
        );
    }

    #[test]
    fn test_keep_damaged_db_renames_file_and_journal_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        std::fs::write(dir.path().join("snippets.db-journal"), b"journal bytes").unwrap();

        let kept = keep_damaged_db(&db_path, "snippets-damaged-x.db").unwrap();

        assert_eq!(kept, dir.path().join("snippets-damaged-x.db"));
        assert_eq!(std::fs::read(&kept).unwrap(), GARBAGE, "bytes must be kept as they were");
        assert_eq!(
            std::fs::read(dir.path().join("snippets-damaged-x.db-journal")).unwrap(),
            b"journal bytes"
        );
        assert!(!db_path.exists());
        assert!(!dir.path().join("snippets.db-journal").exists());
    }

    #[test]
    fn test_keep_damaged_db_never_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        std::fs::write(dir.path().join("snippets-damaged-x.db"), b"older copy").unwrap();

        assert!(keep_damaged_db(&db_path, "snippets-damaged-x.db").is_err());
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
        assert_eq!(
            std::fs::read(dir.path().join("snippets-damaged-x.db")).unwrap(),
            b"older copy"
        );
    }

    /// Yes in the damage dialog keeps the damaged file under the name the
    /// dialog showed and starts with an empty, working database.
    #[test]
    fn test_open_db_or_ask_damaged_yes_keeps_file_and_starts_empty() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        let mut asked = Vec::new();
        let conn = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            true
        })
        .expect("Yes must give a working database");

        assert_eq!(
            asked,
            vec![DbDialog::Damaged {
                kept_name: "snippets-damaged-2026-11-20-14-35.db".to_string()
            }]
        );
        let kept = dir.path().join("snippets-damaged-2026-11-20-14-35.db");
        assert_eq!(std::fs::read(&kept).unwrap(), GARBAGE, "the damaged file must be kept as it was");
        assert_eq!(snippet_count(&conn), 0);
        create_snippet(&conn, "New snippet", b"y".to_vec(), false).unwrap();
        assert_eq!(snippet_count(&conn), 1);
    }

    /// A second damaged file on the same minute gets its own name; the first
    /// copy stays.
    #[test]
    fn test_open_db_or_ask_damaged_twice_keeps_both_copies() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        for _ in 0..2 {
            std::fs::write(&db_path, GARBAGE).unwrap();
            let conn = open_db_or_ask(&db_path, STAMP, &mut |_| true).unwrap();
            drop(conn);
        }
        assert_eq!(
            file_names(dir.path()),
            vec![
                "snippets-damaged-2026-11-20-14-35-2.db",
                "snippets-damaged-2026-11-20-14-35.db",
                "snippets.db",
            ]
        );
    }

    /// No in the damage dialog changes no file.
    ///
    /// (A rollback journal next to it is SQLite's own business: on every open,
    /// before any dialog, SQLite discards a journal it finds invalid and plays
    /// back a valid one. This was so before the dialog changed, too.)
    #[test]
    fn test_open_db_or_ask_damaged_no_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        let mut asked = 0;
        let result = open_db_or_ask(&db_path, STAMP, &mut |_| {
            asked += 1;
            false
        });

        assert!(result.is_none());
        assert_eq!(asked, 1);
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
    }

    /// A file another program holds open without sharing is not damage: the
    /// user is asked to try again, and No changes nothing.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_file_in_use_asks_to_try_again() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let before = std::fs::read(&db_path).unwrap();

        // Share mode 0: nobody else may open the file while this handle lives.
        let holder = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&db_path)
            .unwrap();
        let mut asked = Vec::new();
        let result = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            false
        });
        drop(holder);

        assert!(result.is_none());
        assert_eq!(asked.len(), 1);
        assert!(
            matches!(asked[0], DbDialog::CannotOpen(ref f) if *f != OpenFailure::Damaged),
            "{asked:?}"
        );
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), before);
    }

    /// Yes in the "try again" dialog tries again: once the other program has
    /// let go, the user's own database opens with their snippets.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_try_again_opens_the_same_database() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let mut holder = Some(
            std::fs::OpenOptions::new()
                .read(true)
                .share_mode(0)
                .open(&db_path)
                .unwrap(),
        );
        let mut asked = 0;
        let conn = open_db_or_ask(&db_path, STAMP, &mut |_| {
            asked += 1;
            holder.take(); // the other program closes the file
            true
        })
        .expect("the second try must open");
        assert_eq!(asked, 1);
        assert_eq!(snippet_count(&conn), 1, "the user's snippets must still be there");
    }

    /// When the damaged file cannot be renamed, the user is told so and nothing
    /// changes.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_rename_failure_is_reported_and_changes_nothing() {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_SHARE_READ: u32 = 0x1;
        const FILE_SHARE_WRITE: u32 = 0x2;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        // SQLite can still open the file (read and write are shared), but it
        // cannot be renamed (delete is not shared).
        let holder = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .open(&db_path)
            .unwrap();
        let mut asked = Vec::new();
        let result = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            // Yes to keeping the damaged file, then No to trying again.
            matches!(d, DbDialog::Damaged { .. })
        });
        drop(holder);

        assert!(result.is_none());
        assert_eq!(asked.len(), 2, "{asked:?}");
        assert!(matches!(asked[0], DbDialog::Damaged { .. }));
        assert!(
            matches!(asked[1], DbDialog::CannotOpen(OpenFailure::KeepFailed(_))),
            "{asked:?}"
        );
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
    }
}
