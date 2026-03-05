// Database CRUD operations

use rusqlite::{params, Connection, Result};
use std::path::PathBuf;

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
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

pub fn get_db_path() -> PathBuf {
    let exe_path = std::env::current_exe().expect("Failed to get current exe path");
    let exe_dir = exe_path.parent().expect("Failed to get exe directory");
    exe_dir.join("snippets.db")
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
            CHECK (length(title) >= 3 AND length(title) <= 50),
            CHECK (length(content) <= 65536)
        );
        CREATE INDEX IF NOT EXISTS idx_snippets_updated_at
            ON snippets (updated_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_title
            ON snippets (title);",
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Corruption handler
// ---------------------------------------------------------------------------

/// Open the database and initialize it; show a native corruption dialog if
/// SQLite reports any error (open *or* first query / pragma execution).
///
/// If the path is a **directory** (e.g. created by Scoop `persist` before the
/// first run), it is silently removed so SQLite can create a proper file.
pub fn open_and_init_db(db_path: &std::path::Path) -> Result<Connection> {
    if db_path.is_dir() {
        // Scoop creates a directory stub when the file doesn't exist in the
        // release archive and `persist` is listed in the manifest.
        std::fs::remove_dir_all(db_path).ok();
    }
    let conn_result = Connection::open(db_path).and_then(|conn| {
        init_db(&conn)?;
        Ok(conn)
    });
    handle_db_corruption(conn_result, db_path)
}

pub fn handle_db_corruption(
    conn_result: Result<Connection>,
    db_path: &std::path::Path,
) -> Result<Connection> {
    match conn_result {
        Ok(conn) => Ok(conn),
        Err(_) => {
            let answer = rfd::MessageDialog::new()
                .set_title("Database Error")
                .set_description(
                    "File snippets.db is corrupted and cannot be opened.\n\
                     Reset to empty database? (All snippets will be permanently lost)",
                )
                .set_buttons(rfd::MessageButtons::YesNo)
                .show();

            if answer == rfd::MessageDialogResult::Yes {
                // Remove whether it's a file *or* a directory
                if db_path.is_dir() {
                    std::fs::remove_dir_all(db_path).ok();
                } else {
                    std::fs::remove_file(db_path).ok();
                }
                let conn = Connection::open(db_path)?;
                init_db(&conn)?;
                Ok(conn)
            } else {
                std::process::exit(0);
            }
        }
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
        "SELECT id, title, content, is_encrypted, created_at, updated_at
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

pub fn delete_snippet(conn: &Connection, id: i64) -> Result<()> {
    let affected = conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
    if affected == 0 {
        Err(rusqlite::Error::QueryReturnedNoRows)
    } else {
        Ok(())
    }
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

        for expected in &["id", "title", "content", "is_encrypted", "created_at", "updated_at"] {
            assert!(
                columns.iter().any(|c| c == expected),
                "column '{}' not found in snippets table; found: {:?}",
                expected,
                columns
            );
        }
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

    // --- handle_db_corruption ---

    /// When given Ok(conn), handle_db_corruption must pass the connection
    /// through unchanged. This is the only path that can be tested without an
    /// rfd dialog mock.
    ///
    /// NOTE: The Err(_) branch invokes `rfd::MessageDialog::new().show()` which
    /// opens a native OS dialog — it cannot be exercised in an automated test
    /// environment without a headless dialog mock (rfd provides none as of
    /// 0.14). That branch is therefore covered only by manual / integration
    /// testing.
    #[test]
    fn test_handle_db_corruption_ok_passes_through() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");

        let conn = Connection::open(&db_path).unwrap();
        init_db(&conn).unwrap();

        // Wrap in Ok and pass through the corruption handler
        let result = handle_db_corruption(Ok(conn), &db_path);
        assert!(result.is_ok(), "Ok(conn) must be returned unchanged");

        // The returned connection must still be functional
        let conn_out = result.unwrap();
        let count: i64 = conn_out
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snippets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "returned connection must have the snippets schema");
    }
}
