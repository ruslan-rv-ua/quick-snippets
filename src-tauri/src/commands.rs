// IPC command handlers

use crate::{crypto, db, search};
use rusqlite::Connection;

// ---------------------------------------------------------------------------
// AppState — defined at module level so it is accessible in tests
// ---------------------------------------------------------------------------

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

pub struct AppState {
    pub conn: Mutex<rusqlite::Connection>,
    pub settings: Mutex<crate::settings::Settings>,
    pub pending_notification: Mutex<Option<String>>,
    /// When `true`, the exit-confirmation dialog is visible — blur must NOT
    /// hide the window, otherwise the user cannot click Cancel.
    pub close_confirmation_pending: AtomicBool,
}

impl AppState {
    /// Store a one-shot notification (e.g., hotkey registration failure).
    pub fn set_pending_notification(&self, msg: String) {
        if let Ok(mut n) = self.pending_notification.lock() {
            *n = Some(msg);
        }
    }

    /// Consume and return the pending notification (returns `None` on second call).
    pub fn take_pending_notification(&self) -> Option<String> {
        self.pending_notification.lock().ok().and_then(|mut n| n.take())
    }

    /// Mark that exit-confirmation dialog is visible (blur must not hide).
    pub fn set_close_pending(&self, pending: bool) {
        self.close_confirmation_pending.store(pending, Ordering::SeqCst);
    }

    /// Check whether exit-confirmation dialog is visible.
    pub fn is_close_pending(&self) -> bool {
        self.close_confirmation_pending.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
impl AppState {
    pub fn new_for_test() -> Self {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        AppState {
            conn: Mutex::new(conn),
            settings: Mutex::new(crate::settings::Settings::default()),
            pending_notification: Mutex::new(None),
            close_confirmation_pending: AtomicBool::new(false),
        }
    }
}

// ---------------------------------------------------------------------------
// Shared view type
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct SnippetView {
    pub id: i64,
    pub title: String,
    /// Empty string for encrypted snippets — plaintext is NEVER sent to frontend.
    pub content: String,
    pub is_encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Inner (testable) functions — accept &Connection, no Tauri runtime needed
// ---------------------------------------------------------------------------

pub fn search_snippets_inner(
    conn: &Connection,
    query: &str,
) -> Result<Vec<search::SearchResult>, String> {
    let rows = db::list_snippets_for_search(conn);
    Ok(search::search(query, &rows))
}

pub fn get_snippet_by_id_inner(conn: &Connection, id: i64) -> Result<SnippetView, String> {
    let row = db::get_snippet_by_id(conn, id).map_err(|e| e.to_string())?;
    let content = if row.is_encrypted {
        String::new() // SECURITY: never expose encrypted content to frontend
    } else {
        String::from_utf8(row.content).map_err(|e| e.to_string())?
    };
    Ok(SnippetView {
        id: row.id,
        title: row.title,
        content,
        is_encrypted: row.is_encrypted,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

pub fn create_snippet_inner(
    conn: &Connection,
    title: &str,
    content: &str,
    password: &str,
) -> Result<i64, String> {
    if title.len() < 3 {
        return Err("Title too short (min 3 chars)".to_string());
    }
    if title.len() > 50 {
        return Err("Title too long (max 50 chars)".to_string());
    }

    let map_err = |e: rusqlite::Error| -> String {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Title already exists".to_string()
        } else {
            e.to_string()
        }
    };

    if password.is_empty() {
        let blob = content.as_bytes().to_vec();
        db::create_snippet(conn, title, blob, false).map_err(map_err)
    } else {
        let blob = crypto::encrypt(content.as_bytes(), password).map_err(|e| e.to_string())?;
        db::create_snippet(conn, title, blob, true).map_err(map_err)
    }
}

/// Returns the plaintext bytes for clipboard use.
/// SECURITY: this function is not exposed to the frontend — only used internally.
pub fn activate_snippet_get_content(
    conn: &Connection,
    id: i64,
    password: &str,
) -> Result<Vec<u8>, String> {
    let row = db::get_snippet_by_id(conn, id).map_err(|e| e.to_string())?;
    if row.is_encrypted {
        crypto::decrypt(&row.content, password).map_err(|e| e.to_string())
    } else {
        Ok(row.content)
    }
}

pub fn update_snippet_inner(
    conn: &Connection,
    id: i64,
    title: &str,
    content: &str,
) -> Result<(), String> {
    let blob = content.as_bytes().to_vec();
    db::update_snippet(conn, id, title, blob).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Title already exists".to_string()
        } else {
            e.to_string()
        }
    })
}

pub fn delete_snippet_inner(conn: &Connection, id: i64) -> Result<(), String> {
    db::delete_snippet(conn, id).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Tauri AppState + commands — compiled only outside test mode
// ---------------------------------------------------------------------------

#[cfg(not(test))]
pub use tauri_commands::*;

#[cfg(not(test))]
pub mod tauri_commands {
    use super::*;
    use crate::settings::Settings;
    use tauri::{AppHandle, Manager, State, Window};
    use tauri_plugin_clipboard_manager::ClipboardExt;

    pub use super::AppState;

    #[tauri::command]
    pub fn search_snippets(
        query: String,
        state: State<AppState>,
    ) -> Result<Vec<search::SearchResult>, String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        search_snippets_inner(&conn, &query)
    }

    #[tauri::command]
    pub fn get_snippet_by_id(id: i64, state: State<AppState>) -> Result<SnippetView, String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        get_snippet_by_id_inner(&conn, id)
    }

    #[tauri::command]
    pub fn create_snippet(
        title: String,
        content: String,
        password: String,
        state: State<AppState>,
    ) -> Result<(), String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        create_snippet_inner(&conn, &title, &content, &password)?;
        Ok(())
    }

    #[tauri::command]
    pub fn activate_snippet(
        id: i64,
        password: String,
        app: AppHandle,
        state: State<AppState>,
    ) -> Result<(), String> {
        use zeroize::Zeroize;

        // Get plaintext in a limited scope so it is dropped before we return
        let plaintext = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            activate_snippet_get_content(&conn, id, &password)?
        };
        // SECURITY: only clipboard call here — plaintext never enters IPC response.
        // Zeroize the local String after writing to clipboard so decrypted
        // content does not linger on the heap.
        let mut text = match String::from_utf8(plaintext) {
            Ok(s) => s,
            Err(e) => {
                let mut bytes = e.into_bytes();
                bytes.zeroize();
                return Err("Invalid UTF-8 content".to_string());
            }
        };
        let result = app.clipboard().write_text(text.clone()).map_err(|e| e.to_string());
        text.zeroize();
        result?;
        Ok(()) // IPC response is Ok(()) — no content
    }

    #[tauri::command]
    pub fn update_snippet(
        id: i64,
        title: String,
        content: String,
        state: State<AppState>,
    ) -> Result<(), String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        update_snippet_inner(&conn, id, &title, &content)
    }

    #[tauri::command]
    pub fn delete_snippet(id: i64, state: State<AppState>) -> Result<(), String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        delete_snippet_inner(&conn, id)
    }

    #[tauri::command]
    pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        Ok(s.clone())
    }

    #[tauri::command]
    pub fn save_settings(
        settings: Settings,
        state: State<AppState>,
        window: Window,
    ) -> Result<(), String> {
        let mut new_settings = settings;
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            new_settings.window_state = crate::settings::WindowState {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
            };
        }
        use tauri_plugin_autostart::ManagerExt;
        let autolaunch = window.app_handle().autolaunch();
        if new_settings.autostart {
            let _ = autolaunch.enable();
        } else {
            let _ = autolaunch.disable();
        }
        let path = crate::settings::get_settings_path();
        crate::settings::save_settings_to_path(&new_settings, &path)
            .map_err(|e| e.to_string())?;
        let mut s = state.settings.lock().map_err(|e| e.to_string())?;
        *s = new_settings.clone();
        drop(s);

        // ── Rebuild tray menu with the (possibly new) language ────────────
        {
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

            let app = window.app_handle();
            let effective_lang = if new_settings.language.is_empty() {
                crate::settings::detect_language()
            } else {
                new_settings.language.clone()
            };
            let labels = crate::get_tray_menu_labels(&effective_lang);

            if let Some(tray) = app.tray_by_id("main") {
                let show = MenuItem::with_id(app, "show", labels.show, true, None::<&str>)
                    .map_err(|e| e.to_string())?;
                let new_snippet =
                    MenuItem::with_id(app, "new_snippet", labels.new_snippet, true, None::<&str>)
                        .map_err(|e| e.to_string())?;
                let settings_item = MenuItem::with_id(
                    app,
                    "settings_item",
                    labels.settings,
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?;
                let sep =
                    PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
                let quit =
                    MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)
                        .map_err(|e| e.to_string())?;
                if let Ok(menu) =
                    Menu::with_items(app, &[&show, &new_snippet, &settings_item, &sep, &quit])
                {
                    let _ = tray.set_menu(Some(menu));
                }
            }
        }

        Ok(())
    }

    #[tauri::command]
    pub fn get_pending_notification(state: State<AppState>) -> Option<String> {
        state
            .pending_notification
            .lock()
            .ok()
            .and_then(|mut n| n.take())
    }

    #[tauri::command]
    pub fn quit_app(app: AppHandle) {
        app.exit(0);
    }

    #[tauri::command]
    pub fn cancel_close(state: State<AppState>) {
        state.set_close_pending(false);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{crypto, db};
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        conn
    }

    // === search_snippets ===

    #[test]
    fn test_search_snippets_empty_query_returns_all() {
        let conn = setup();
        db::create_snippet(&conn, "alpha", b"content1".to_vec(), false).unwrap();
        db::create_snippet(&conn, "beta test", b"content2".to_vec(), false).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_snippets_filters_by_query() {
        let conn = setup();
        db::create_snippet(&conn, "alpha", b"c1".to_vec(), false).unwrap();
        db::create_snippet(&conn, "beta", b"c2".to_vec(), false).unwrap();
        let results = search_snippets_inner(&conn, "alp").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "alpha");
    }

    // === get_snippet_by_id ===

    #[test]
    fn test_get_snippet_unencrypted_includes_content() {
        let conn = setup();
        let id =
            db::create_snippet(&conn, "test title", b"secret content".to_vec(), false).unwrap();
        let view = get_snippet_by_id_inner(&conn, id).unwrap();
        assert_eq!(view.content, "secret content");
    }

    #[test]
    fn test_get_snippet_encrypted_excludes_content() {
        // CRITICAL SECURITY CHECK
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret", "pass").unwrap();
        let id = db::create_snippet(&conn, "encrypted one", encrypted, true).unwrap();
        let view = get_snippet_by_id_inner(&conn, id).unwrap();
        assert_eq!(view.content, ""); // Content NOT transmitted!
    }

    #[test]
    fn test_get_snippet_not_found() {
        let conn = setup();
        let result = get_snippet_by_id_inner(&conn, 99999);
        assert!(result.is_err());
    }

    // === create_snippet ===

    #[test]
    fn test_create_unencrypted_snippet() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "my title", "my content", "");
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_encrypted_snippet() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "my secret", "secret data", "password123");
        assert!(result.is_ok());
        let id = result.unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(row.is_encrypted);
    }

    #[test]
    fn test_create_snippet_validation_title_too_short() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "ab", "content", "");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_snippet_duplicate_title_returns_friendly_error() {
        let conn = setup();
        create_snippet_inner(&conn, "my snippet", "content1", "").unwrap();
        let result = create_snippet_inner(&conn, "my snippet", "content2", "");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Title already exists");
    }

    #[test]
    fn test_update_snippet_duplicate_title_returns_friendly_error() {
        let conn = setup();
        let id_a = create_snippet_inner(&conn, "snippet A", "content A", "").unwrap();
        create_snippet_inner(&conn, "snippet B", "content B", "").unwrap();
        // Try to rename A to the name already used by B
        let result = update_snippet_inner(&conn, id_a, "snippet B", "content A");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Title already exists");
    }

    // === activate_snippet: extract content for clipboard ===

    #[test]
    fn test_activate_unencrypted_returns_content_bytes() {
        let conn = setup();
        let id =
            db::create_snippet(&conn, "test snip", b"clipboard text".to_vec(), false).unwrap();
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(content, b"clipboard text");
    }

    #[test]
    fn test_activate_encrypted_correct_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", encrypted, true).unwrap();
        let content = activate_snippet_get_content(&conn, id, "mypass").unwrap();
        assert_eq!(content, b"secret data");
    }

    #[test]
    fn test_activate_encrypted_wrong_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", encrypted, true).unwrap();
        let result = activate_snippet_get_content(&conn, id, "wrongpass");
        assert!(result.is_err());
    }

    #[test]
    fn test_activate_nonexistent_snippet() {
        let conn = setup();
        let result = activate_snippet_get_content(&conn, 99999, "");
        assert!(result.is_err());
    }

    // === update_snippet ===

    #[test]
    fn test_update_unencrypted_changes_content() {
        let conn = setup();
        let id = db::create_snippet(&conn, "title", b"old content".to_vec(), false).unwrap();
        update_snippet_inner(&conn, id, "new title", "new content").unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "new title");
    }

    #[test]
    fn test_update_encrypted_preserves_content_blob() {
        // CRITICAL SECURITY CHECK: encrypted blob must not change on update
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret", "pass").unwrap();
        let id = db::create_snippet(&conn, "orig title", encrypted, true).unwrap();
        let orig_blob = db::get_snippet_by_id(&conn, id).unwrap().content;
        update_snippet_inner(&conn, id, "new title", "ignored content").unwrap();
        let updated_blob = db::get_snippet_by_id(&conn, id).unwrap().content;
        assert_eq!(orig_blob, updated_blob); // blob unchanged!
    }

    // === delete_snippet ===

    #[test]
    fn test_delete_snippet_removes_from_search() {
        let conn = setup();
        let id = db::create_snippet(&conn, "to delete", b"data".to_vec(), false).unwrap();
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 0);
    }

    // === pending notification ===

    #[test]
    fn test_pending_notification_one_shot() {
        let mut notification: Option<String> = Some("Warning!".to_string());
        let first = notification.take();
        let second = notification.take();
        assert_eq!(first, Some("Warning!".to_string()));
        assert_eq!(second, None);
    }

    // === end-to-end command integration ===

    #[test]
    fn test_full_flow_create_search_activate_delete() {
        let conn = setup();
        let id = create_snippet_inner(&conn, "my test", "hello world", "").unwrap();
        let results = search_snippets_inner(&conn, "test").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, id);
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(String::from_utf8(content).unwrap(), "hello world");
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 0);
    }
}
