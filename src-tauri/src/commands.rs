// IPC command handlers

use crate::{crypto, db, search};
use rusqlite::Connection;
use zeroize::Zeroizing;

// Constants for validation

/// Most content a plain snippet may hold, in bytes of UTF-8: the limit of the content
/// column (`CHECK (length(content) <= 65536)` in db.rs).
const MAX_CONTENT_LENGTH: usize = 65536;

/// Most content an encrypted snippet may hold, in bytes of UTF-8.
///
/// The snippet is stored as its v2 blob: `v2:` and the base64 of salt (16 bytes), nonce
/// (12 bytes), ciphertext and tag (16 bytes). For this much content the blob is 65,535 bytes,
/// the last size that fits the content column; one byte more makes it 65,539 bytes.
const MAX_ENCRYPTED_CONTENT_LENGTH: usize = 49_105;

/// Shortest and longest title, in characters (Unicode code points): the limits of the title
/// column (`CHECK (length(title) >= 3 AND length(title) <= 50)` in db.rs), where SQLite's
/// `length()` counts characters, not bytes. The dialogs count the same way
/// (src/utils/title.ts): change them together.
const TITLE_MIN_CHARS: usize = 3;
const TITLE_MAX_CHARS: usize = 50;

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

/// A list for the main window, and whether damage of the database cut it short (the window then
/// says so instead of claiming that there are no more snippets).
#[derive(serde::Serialize, Clone, Debug, Default)]
pub struct SnippetListView {
    pub items: Vec<search::SearchResult>,
    pub damaged: bool,
}

pub fn search_snippets_inner(conn: &Connection, query: &str) -> Result<SnippetListView, String> {
    let listing = db::list_snippets_for_search(conn);
    Ok(SnippetListView {
        items: search::search(query, &listing.rows),
        damaged: listing.damaged,
    })
}

/// The error for content over its size limit; `size` and `max` are bytes of UTF-8.
///
/// The create and edit dialogs recognise this text and show a translated message with both
/// numbers instead (`parseContentTooLong` in src/utils/errors.ts): change the two together.
fn content_too_long(size: usize, max: usize, encrypted: bool) -> String {
    let kind = if encrypted { " for an encrypted snippet" } else { "" };
    format!("Content too long{kind} ({size} bytes, max {max} bytes)")
}

/// Refuses a title the database would refuse, before anything is stored.
///
/// Counts characters (Unicode code points) as SQLite's `length()` does on the TEXT column:
/// neither bytes of UTF-8 nor UTF-16 units. The dialogs recognise the error text and show a
/// translated message with the count instead (`parseTitleLength` in src/utils/errors.ts):
/// change the two together.
fn check_title(title: &str) -> Result<(), String> {
    let count = title.chars().count();
    if (TITLE_MIN_CHARS..=TITLE_MAX_CHARS).contains(&count) {
        Ok(())
    } else {
        Err(format!(
            "Title must be {TITLE_MIN_CHARS} to {TITLE_MAX_CHARS} characters ({count} characters)"
        ))
    }
}

/// Maps a rusqlite error to the text the frontend gets. Damage becomes one of the fixed texts the
/// frontend recognises and says in the language of the app (`db::DATABASE_DAMAGED`,
/// `db::SNIPPET_DAMAGED`); a duplicate title becomes "Title already exists"; anything else is
/// SQLite's own message.
fn db_err(e: rusqlite::Error) -> String {
    match db::damage_of(&e) {
        Some(db::Damage::Database) => db::DATABASE_DAMAGED.to_string(),
        Some(db::Damage::Snippet) => db::SNIPPET_DAMAGED.to_string(),
        None if e.to_string().contains("UNIQUE constraint failed") => {
            "Title already exists".to_string()
        }
        None => e.to_string(),
    }
}

pub fn get_snippet_by_id_inner(conn: &Connection, id: i64) -> Result<SnippetView, String> {
    let row = db::get_snippet_by_id(conn, id).map_err(db_err)?;
    let content = if row.is_encrypted {
        String::new() // SECURITY: never expose encrypted content to frontend
    } else {
        // The app stores the text of a plain snippet as UTF-8: anything else is damage.
        String::from_utf8(row.content).map_err(|_| db::SNIPPET_DAMAGED.to_string())?
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
    check_title(title)?;

    // Checked before anything is stored: the database would refuse a longer blob with a raw
    // CHECK error.
    let content_bytes = content.as_bytes();
    let encrypted = !password.is_empty();
    let max = if encrypted { MAX_ENCRYPTED_CONTENT_LENGTH } else { MAX_CONTENT_LENGTH };
    if content_bytes.len() > max {
        return Err(content_too_long(content_bytes.len(), max, encrypted));
    }

    if password.is_empty() {
        let blob = content_bytes.to_vec();
        db::create_snippet(conn, title, blob, false).map_err(db_err)
    } else {
        let blob = crypto::encrypt(content_bytes, password).map_err(|e| e.to_string())?;
        db::create_snippet(conn, title, blob, true).map_err(db_err)
    }
}

/// Returns the plaintext bytes for clipboard use, wrapped in Zeroizing for secure memory erasure.
/// SECURITY: this function is not exposed to the frontend — only used internally.
///
/// A snippet still stored in the legacy encryption format is re-encrypted in the current
/// one here, because this is the only moment the password is known.
pub fn activate_snippet_get_content(
    conn: &Connection,
    id: i64,
    password: &str,
) -> Result<Zeroizing<Vec<u8>>, String> {
    let row = db::get_snippet_by_id(conn, id).map_err(db_err)?;
    if !row.is_encrypted {
        return Ok(Zeroizing::new(row.content));
    }

    let plaintext =
        Zeroizing::new(crypto::decrypt(&row.content, password).map_err(|e| e.to_string())?);
    if !crypto::is_current_format(&row.content) {
        // Best effort: the snippet is already decrypted, and the old blob stays valid.
        upgrade_encrypted_blob(conn, id, &row.content, &plaintext, password);
    }
    Ok(plaintext)
}

/// Re-encrypts a snippet from the legacy format in the current one and stores it.
///
/// On any failure the old blob stays in place and `false` is returned; the snippet then
/// keeps working as before.
fn upgrade_encrypted_blob(
    conn: &Connection,
    id: i64,
    old_blob: &[u8],
    plaintext: &[u8],
    password: &str,
) -> bool {
    match crypto::encrypt(plaintext, password) {
        Ok(new_blob) => {
            replace_blob_if_it_decrypts(conn, id, old_blob, &new_blob, plaintext, password)
        }
        Err(_) => false,
    }
}

/// Stores `new_blob` in place of `old_blob`, but only if `new_blob` decrypts with
/// `password` to exactly `plaintext`.
///
/// The stored blob is the only copy of the user's data, so nothing is written before the
/// replacement has been proven readable. Returns whether the row was changed.
fn replace_blob_if_it_decrypts(
    conn: &Connection,
    id: i64,
    old_blob: &[u8],
    new_blob: &[u8],
    plaintext: &[u8],
    password: &str,
) -> bool {
    let verified = match crypto::decrypt(new_blob, password) {
        Ok(check) => Zeroizing::new(check).as_slice() == plaintext,
        Err(_) => false,
    };
    verified && db::replace_encrypted_blob(conn, id, old_blob, new_blob).unwrap_or(false)
}

pub fn update_snippet_inner(
    conn: &Connection,
    id: i64,
    title: &str,
    content: &str,
) -> Result<(), String> {
    check_title(title)?;

    let content_bytes = content.as_bytes();
    if content_bytes.len() > MAX_CONTENT_LENGTH {
        return Err(content_too_long(content_bytes.len(), MAX_CONTENT_LENGTH, false));
    }

    let blob = content_bytes.to_vec();
    db::update_snippet(conn, id, title, blob).map_err(db_err)
}

pub fn delete_snippet_inner(conn: &Connection, id: i64) -> Result<(), String> {
    db::delete_snippet(conn, id).map_err(db_err)
}

pub fn get_sorted_snippets_inner(
    conn: &Connection,
    sort_mode: &str,
    sort_direction: &str,
) -> Result<SnippetListView, String> {
    let listing = db::list_snippets_sorted(conn, sort_mode, sort_direction);
    Ok(SnippetListView {
        items: listing
            .rows
            .into_iter()
            .map(|(id, title, is_encrypted)| search::SearchResult {
                id,
                title,
                score: 0,
                matched_positions: vec![],
                is_encrypted,
            })
            .collect(),
        damaged: listing.damaged,
    })
}

pub fn touch_last_used_inner(conn: &Connection, id: i64) -> Result<(), String> {
    db::touch_last_used(conn, id).map_err(db_err)
}

/// The text of a snippet as the clipboard or auto-type gets it. The app stores text as UTF-8,
/// so anything else is damage (`db::SNIPPET_DAMAGED`); the bytes are erased either way, and the
/// error never holds any of them.
fn plaintext_to_string(plaintext: &[u8]) -> Result<Zeroizing<String>, String> {
    use zeroize::Zeroize;
    match String::from_utf8(plaintext.to_vec()) {
        Ok(s) => Ok(Zeroizing::new(s)),
        Err(e) => {
            let mut bytes = e.into_bytes();
            bytes.zeroize();
            Err(db::SNIPPET_DAMAGED.to_string())
        }
    }
}

/// Auto-type of one snippet, apart from the Tauri command so that it can be tested. Reads the
/// snippet (`password` decrypts an encrypted one), then calls `hide` (the app window hides, and the
/// program to type into gets the keyboard back), then `type_text` types the text.
///
/// A failure before `hide` (the database, a wrong password, damage) is shown in the window, which
/// is still on screen. A failure of the typing comes after the window has hidden, where a message
/// is neither seen nor read by a screen reader: `alert` (the Windows error sound) then tells the
/// user (TASK-42). The error is returned as it is either way. The text is erased from memory
/// before returning, and no error holds any of it.
pub fn autotype_snippet_inner(
    conn: &Mutex<Connection>,
    id: i64,
    password: &str,
    hide: impl FnOnce(),
    type_text: impl FnOnce(&str) -> Result<(), String>,
    alert: impl FnOnce(),
) -> Result<(), String> {
    use zeroize::Zeroize;

    let plaintext = {
        let conn = conn.lock().map_err(|e| e.to_string())?;
        let content = activate_snippet_get_content(&conn, id, password)?;
        db::touch_last_used(&conn, id).ok();
        content
    };
    // Plaintext (Zeroizing<Vec<u8>>) is erased when it drops at the end.
    let mut text = plaintext_to_string(&plaintext)?;

    hide();
    let result = type_text(&text);
    // Erased before returning; dropping it would erase it too, but be explicit.
    text.zeroize();
    if result.is_err() {
        alert();
    }
    result
}

/// Which change of "Start with Windows" Windows refused.
#[derive(serde::Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AutostartError {
    /// Turning it on failed: Windows does not start the app.
    CannotTurnOn,
    /// Turning it off failed: Windows still starts the app.
    CannotTurnOff,
}

/// What a save of the settings could not do. The settings dialog tells the user.
#[derive(serde::Serialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SaveSettingsOutcome {
    /// Set when "Start with Windows" could not be changed. The setting then keeps its previous
    /// value; the other settings are saved.
    pub autostart_error: Option<AutostartError>,
}

/// Saves `new_settings` to `path` and in `current`, then applies a change of "Start with
/// Windows" through `registry`, for the values called `name` and the exe at `exe`: only after
/// the file is written, and only if that setting itself changed (other copies of the app write
/// values of the same name, see `crate::autostart`).
///
/// When Windows refuses the change, the setting keeps its previous value, in the file and in
/// memory, so that it shows what Windows does; the other settings stay saved, and the result
/// says which change failed. An error means that the settings file could not be written.
pub fn save_settings_inner(
    new_settings: crate::settings::Settings,
    current: &Mutex<crate::settings::Settings>,
    path: &std::path::Path,
    registry: &impl crate::autostart::AutostartRegistry,
    name: &str,
    exe: &std::path::Path,
) -> Result<SaveSettingsOutcome, String> {
    use crate::settings::save_settings_to_path;

    save_settings_to_path(&new_settings, path).map_err(|e| e.to_string())?;
    let was_on = {
        let mut s = current.lock().map_err(|e| e.to_string())?;
        std::mem::replace(&mut *s, new_settings.clone()).autostart
    };
    let now_on = new_settings.autostart;
    if crate::autostart::apply_change(registry, name, exe, was_on, now_on).is_ok() {
        return Ok(SaveSettingsOutcome::default());
    }

    let kept = crate::settings::Settings {
        autostart: was_on,
        ..new_settings
    };
    save_settings_to_path(&kept, path).map_err(|e| e.to_string())?;
    current.lock().map_err(|e| e.to_string())?.autostart = was_on;
    Ok(SaveSettingsOutcome {
        autostart_error: Some(if now_on {
            AutostartError::CannotTurnOn
        } else {
            AutostartError::CannotTurnOff
        }),
    })
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
    ) -> Result<SnippetListView, String> {
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
        // Get plaintext in a limited scope so it is dropped before we return
        let plaintext = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let content = activate_snippet_get_content(&conn, id, &password)?;
            db::touch_last_used(&conn, id).ok();
            content
        };
        // SECURITY: only clipboard call here — plaintext never enters IPC response.
        // plaintext is already Zeroizing<Vec<u8>>, so it will be securely erased on drop.
        // Create a new Zeroizing<String> for clipboard write to ensure proper cleanup.
        let text = plaintext_to_string(&plaintext)?;
        let result = app.clipboard().write_text(text.as_str()).map_err(|e| e.to_string());
        result?;
        // Both plaintext and text are Zeroizing; automatically zeroed on drop at end of scope
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
    pub fn get_sorted_snippets(
        sort_mode: String,
        sort_direction: String,
        state: State<AppState>,
    ) -> Result<SnippetListView, String> {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        get_sorted_snippets_inner(&conn, &sort_mode, &sort_direction)
    }

    #[tauri::command]
    pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        Ok(s.clone())
    }

    /// The language "Same as Windows" stands for (`"en"`, `"uk"` or `"de"`).
    /// The window uses it so that it matches the tray menu.
    #[tauri::command]
    pub fn get_system_language() -> String {
        crate::settings::detect_language()
    }

    /// Rebuild the tray context menu with labels matching `lang`.
    fn rebuild_tray_menu(app: &AppHandle, lang: &str) -> Result<(), String> {
        use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
        let labels = crate::get_tray_menu_labels(lang);
        if let Some(tray) = app.tray_by_id("main") {
            let show = MenuItem::with_id(app, "show", labels.show, true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let new_snippet =
                MenuItem::with_id(app, "new_snippet", labels.new_snippet, true, None::<&str>)
                    .map_err(|e| e.to_string())?;
            let settings_item =
                MenuItem::with_id(app, "settings_item", labels.settings, true, None::<&str>)
                    .map_err(|e| e.to_string())?;
            let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
            let quit = MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)
                .map_err(|e| e.to_string())?;
            if let Ok(menu) =
                Menu::with_items(app, &[&show, &new_snippet, &settings_item, &sep, &quit])
            {
                let _ = tray.set_menu(Some(menu));
            }
        }
        Ok(())
    }

    /// Saves the settings and applies a change of "Start with Windows"; the result says when
    /// Windows refused that change (see `save_settings_inner`).
    #[tauri::command]
    pub fn save_settings(
        settings: Settings,
        state: State<AppState>,
        window: Window,
    ) -> Result<SaveSettingsOutcome, String> {
        let mut new_settings = settings;
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            new_settings.window_state = crate::settings::WindowState {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
            };
        }

        let app = window.app_handle();
        let effective_lang = if new_settings.language.is_empty() {
            crate::settings::detect_language()
        } else {
            new_settings.language.clone()
        };

        let path = crate::settings::get_settings_path();
        // The value name of the autostart values: the product name, "QuickSnippets", the one
        // tauri-plugin-autostart used up to 0.3.4.
        let name = &app.package_info().name;
        // An unknown path makes turning on fail instead of writing a wrong entry
        // (`crate::autostart::command_line`).
        let exe = std::env::current_exe().unwrap_or_default();
        let outcome = if crate::autostart::test_refusal_requested() {
            let registry = crate::autostart::RefusingRegistry;
            save_settings_inner(new_settings, &state.settings, &path, &registry, name, &exe)?
        } else {
            let registry = crate::autostart::WindowsRegistry;
            save_settings_inner(new_settings, &state.settings, &path, &registry, name, &exe)?
        };

        rebuild_tray_menu(app, &effective_lang)?;

        Ok(outcome)
    }

    #[tauri::command]
    pub fn get_pending_notification(state: State<AppState>) -> Option<String> {
        state
            .pending_notification
            .lock()
            .ok()
            .and_then(|mut n| n.take())
    }

    /// Delay before typing to let the target app regain focus after window.hide().
    const FOCUS_DELAY_MS: u64 = 150;

    #[cfg(target_os = "windows")]
    #[tauri::command]
    pub fn autotype_snippet(
        id: i64,
        password: String,
        window: Window,
        state: State<AppState>,
    ) -> Result<(), String> {
        autotype_snippet_inner(
            &state.conn,
            id,
            &password,
            || {
                // Hide window so the target app receives focus.
                let _ = window.hide();
                std::thread::sleep(std::time::Duration::from_millis(FOCUS_DELAY_MS));
            },
            |text| {
                // Read user-configured inter-character delay.
                let delay_ms = state
                    .settings
                    .lock()
                    .map(|s| s.autotype_delay_ms)
                    .unwrap_or(0);
                // Type the text via PostMessage (primary) or SendInput (fallback).
                crate::autotype::win::send_unicode_text(text, delay_ms)
            },
            crate::autotype::win::error_sound,
        )
        // IPC response: Ok(()) or Err(...) — plaintext NEVER in the response.
    }

    #[tauri::command]
    pub fn quit_app(app: AppHandle) {
        app.exit(0);
    }

    #[tauri::command]
    pub fn cancel_close(state: State<AppState>) {
        state.set_close_pending(false);
    }

    /// The page has its first list on screen. The start-up goes on from here: with "Start in
    /// tray" off, this is when the window opens (see `startup`).
    #[tauri::command]
    pub fn frontend_ready(app: AppHandle) {
        crate::finish_startup(app);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::test_vectors::{
        LEGACY_BLOB, LEGACY_PASSWORD, LEGACY_PLAINTEXT, V2_BLOB, V2_PASSWORD, V2_PLAINTEXT,
    };
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
        let results = search_snippets_inner(&conn, "").unwrap().items;
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_snippets_filters_by_query() {
        let conn = setup();
        db::create_snippet(&conn, "alpha", b"c1".to_vec(), false).unwrap();
        db::create_snippet(&conn, "beta", b"c2".to_vec(), false).unwrap();
        let results = search_snippets_inner(&conn, "alp").unwrap().items;
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
        assert_eq!(*content, b"clipboard text");
    }

    #[test]
    fn test_activate_encrypted_correct_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", encrypted, true).unwrap();
        let content = activate_snippet_get_content(&conn, id, "mypass").unwrap();
        assert_eq!(*content, b"secret data");
    }

    #[test]
    fn test_activate_encrypted_wrong_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", encrypted, true).unwrap();
        let result = activate_snippet_get_content(&conn, id, "wrongpass");
        // Exactly this text: the password dialog says "wrong password" only for it.
        assert_eq!(result.unwrap_err(), crypto::WRONG_PASSWORD);
    }

    #[test]
    fn test_activate_damaged_encrypted_content_is_not_a_wrong_password() {
        let conn = setup();
        let id = db::create_snippet(&conn, "damaged", b"v2:not base64 at all".to_vec(), true).unwrap();
        let err = activate_snippet_get_content(&conn, id, "mypass").unwrap_err();
        assert_eq!(err, "Invalid data");
        assert_ne!(err, crypto::WRONG_PASSWORD);
    }

    #[test]
    fn test_activate_missing_snippet_is_not_a_wrong_password() {
        let conn = setup();
        let err = activate_snippet_get_content(&conn, 99999, "mypass").unwrap_err();
        assert_ne!(err, crypto::WRONG_PASSWORD);
    }

    /// A database file locked by another connection, as when another program holds it: every
    /// change and every read fails with SQLite's "database is locked". The app's connection
    /// gives up at once here instead of after its busy timeout of 5 s.
    fn locked_database() -> (tempfile::TempDir, Connection, Connection, i64, i64) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snippets.db");
        let conn = db::open_and_init_db(&path).unwrap();
        let plain = db::create_snippet(&conn, "plain", b"plain text".to_vec(), false).unwrap();
        let secret = crypto::encrypt(b"secret data", "mypass").unwrap();
        let encrypted = db::create_snippet(&conn, "encrypted", secret, true).unwrap();
        conn.busy_timeout(std::time::Duration::ZERO).unwrap();
        let other = Connection::open(&path).unwrap();
        other.execute_batch("BEGIN EXCLUSIVE;").unwrap();
        (dir, conn, other, plain, encrypted)
    }

    #[test]
    fn test_locked_database_fails_delete_create_and_update_with_the_reason() {
        let (_dir, conn, _other, plain, _) = locked_database();
        assert_eq!(delete_snippet_inner(&conn, plain).unwrap_err(), "database is locked");
        assert_eq!(
            create_snippet_inner(&conn, "new one", "text", "").unwrap_err(),
            "database is locked"
        );
        assert_eq!(
            update_snippet_inner(&conn, plain, "renamed", "text").unwrap_err(),
            "database is locked"
        );
    }

    #[test]
    fn test_locked_database_with_the_right_password_is_not_a_wrong_password() {
        let (_dir, conn, _other, _, encrypted) = locked_database();
        let err = activate_snippet_get_content(&conn, encrypted, "mypass").unwrap_err();
        assert_eq!(err, "database is locked");
        assert_ne!(err, crypto::WRONG_PASSWORD);
    }

    /// The error goes to the frontend: it never holds the password or the decrypted text.
    #[test]
    fn test_activate_errors_never_hold_the_password_or_the_content() {
        let conn = setup();
        let secret = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", secret, true).unwrap();
        let damaged = db::create_snippet(&conn, "damaged", b"v2:@@@".to_vec(), true).unwrap();
        let errors = [
            activate_snippet_get_content(&conn, id, "wrong mypass").unwrap_err(),
            activate_snippet_get_content(&conn, damaged, "mypass").unwrap_err(),
            activate_snippet_get_content(&conn, 99999, "mypass").unwrap_err(),
        ];
        for err in errors {
            assert!(!err.contains("mypass"), "{err}");
            assert!(!err.contains("secret data"), "{err}");
        }
    }

    // === activate_snippet: snippets in the legacy encryption format (0.1.0 to 0.2.1) ===

    #[test]
    fn test_activate_legacy_blob_made_by_v0_2_1_returns_content() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();
        let content = activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
        assert_eq!(*content, LEGACY_PLAINTEXT.as_bytes());
    }

    #[test]
    fn test_activate_legacy_blob_reencrypts_in_current_format() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();

        activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();

        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(row.is_encrypted);
        assert_ne!(row.content, LEGACY_BLOB, "the stored blob must have been replaced");
        assert!(crypto::is_current_format(&row.content));
        let decrypted = crypto::decrypt(&row.content, LEGACY_PASSWORD).unwrap();
        assert_eq!(decrypted, LEGACY_PLAINTEXT.as_bytes());
    }

    #[test]
    fn test_activate_reencrypted_snippet_again_keeps_blob_and_content() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();

        activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
        let after_first = db::get_snippet_by_id(&conn, id).unwrap().content;
        let content = activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
        let after_second = db::get_snippet_by_id(&conn, id).unwrap().content;

        assert_eq!(*content, LEGACY_PLAINTEXT.as_bytes());
        assert_eq!(after_first, after_second, "a current-format blob is not rewritten");
    }

    #[test]
    fn test_activate_legacy_blob_wrong_password_leaves_blob_unchanged() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();

        let result = activate_snippet_get_content(&conn, id, "wrong password");

        assert_eq!(result.unwrap_err(), "Wrong password");
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, LEGACY_BLOB);
        // The right password still works afterwards.
        let content = activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
        assert_eq!(*content, LEGACY_PLAINTEXT.as_bytes());
    }

    #[test]
    fn test_activate_legacy_blob_reencryption_keeps_other_columns() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();
        let other = db::create_snippet(&conn, "other old", LEGACY_BLOB.to_vec(), true).unwrap();
        conn.execute(
            "UPDATE snippets SET created_at = '2026-01-02T03:04:05.000',
                                 updated_at = '2026-02-03T04:05:06.000'",
            [],
        )
        .unwrap();
        let before = db::get_snippet_by_id(&conn, id).unwrap();

        activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();

        let after = db::get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(after.title, before.title);
        assert_eq!(after.created_at, before.created_at);
        assert_eq!(after.updated_at, before.updated_at, "re-encryption is not an edit");
        assert!(after.is_encrypted);
        // Only the activated snippet is re-encrypted.
        assert_eq!(db::get_snippet_by_id(&conn, other).unwrap().content, LEGACY_BLOB);
    }

    #[test]
    fn test_activate_current_format_blob_is_not_rewritten() {
        let conn = setup();
        let id = db::create_snippet(&conn, "new secret", V2_BLOB.to_vec(), true).unwrap();

        let content = activate_snippet_get_content(&conn, id, V2_PASSWORD).unwrap();

        assert_eq!(*content, V2_PLAINTEXT.as_bytes());
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, V2_BLOB);
    }

    #[test]
    fn test_activate_legacy_blob_survives_failed_reencryption() {
        // The largest plaintext the legacy format could store: its base64 text is exactly
        // 65,536 bytes, the limit of the content column. The current format is three bytes
        // longer, so the database refuses the new blob. The snippet must still be returned
        // and must stay readable in the legacy format.
        let conn = setup();
        let plaintext = vec![b'x'; 49_108];
        let legacy = crypto::encrypt_legacy(&plaintext, "pass");
        assert_eq!(legacy.len(), 65_536);
        let id = db::create_snippet(&conn, "largest old", legacy.clone(), true).unwrap();

        let content = activate_snippet_get_content(&conn, id, "pass").unwrap();

        assert_eq!(*content, plaintext);
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, legacy);
        let again = activate_snippet_get_content(&conn, id, "pass").unwrap();
        assert_eq!(*again, plaintext);
    }

    #[test]
    fn test_upgrade_encrypted_blob_refuses_when_stored_blob_differs() {
        // The stored blob is no longer the one that was decrypted: nothing may be overwritten.
        let conn = setup();
        let id = db::create_snippet(&conn, "new secret", V2_BLOB.to_vec(), true).unwrap();

        let upgraded = upgrade_encrypted_blob(
            &conn,
            id,
            LEGACY_BLOB,
            LEGACY_PLAINTEXT.as_bytes(),
            LEGACY_PASSWORD,
        );

        assert!(!upgraded);
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, V2_BLOB);
    }

    #[test]
    fn test_replace_blob_if_it_decrypts_stores_a_verified_blob() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();
        let new_blob = crypto::encrypt(LEGACY_PLAINTEXT.as_bytes(), LEGACY_PASSWORD).unwrap();

        let replaced = replace_blob_if_it_decrypts(
            &conn,
            id,
            LEGACY_BLOB,
            &new_blob,
            LEGACY_PLAINTEXT.as_bytes(),
            LEGACY_PASSWORD,
        );

        assert!(replaced);
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, new_blob);
    }

    #[test]
    fn test_replace_blob_if_it_decrypts_refuses_blob_with_other_content() {
        // The new blob decrypts with the password, but not to the snippet's content.
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();
        let other = crypto::encrypt(b"something else", LEGACY_PASSWORD).unwrap();

        let replaced = replace_blob_if_it_decrypts(
            &conn,
            id,
            LEGACY_BLOB,
            &other,
            LEGACY_PLAINTEXT.as_bytes(),
            LEGACY_PASSWORD,
        );

        assert!(!replaced);
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, LEGACY_BLOB);
    }

    #[test]
    fn test_replace_blob_if_it_decrypts_refuses_blob_that_does_not_decrypt() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();

        // V2_BLOB is a valid blob, but for another password; the second one is damaged.
        for unreadable in [V2_BLOB, b"v2:not-a-real-blob".as_slice()] {
            let replaced = replace_blob_if_it_decrypts(
                &conn,
                id,
                LEGACY_BLOB,
                unreadable,
                LEGACY_PLAINTEXT.as_bytes(),
                LEGACY_PASSWORD,
            );
            assert!(!replaced);
            assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, LEGACY_BLOB);
        }
    }

    #[test]
    fn test_activate_reencrypts_largest_snippet_that_fits_current_format() {
        // 49,105 bytes of content: 65,532 bytes stored in the legacy format and 65,535 in
        // the current one, just inside the 65,536-byte limit of the content column.
        let conn = setup();
        let plaintext = vec![b'x'; 49_105];
        let legacy = crypto::encrypt_legacy(&plaintext, "pass");
        assert_eq!(legacy.len(), 65_532);
        let id = db::create_snippet(&conn, "large old", legacy, true).unwrap();

        let content = activate_snippet_get_content(&conn, id, "pass").unwrap();

        assert_eq!(*content, plaintext);
        let stored = db::get_snippet_by_id(&conn, id).unwrap().content;
        assert_eq!(stored.len(), 65_535);
        assert!(crypto::is_current_format(&stored));
        assert_eq!(crypto::decrypt(&stored, "pass").unwrap(), plaintext);
    }

    #[test]
    fn test_activate_legacy_blob_in_database_file_survives_reopen() {
        // Same flow against a database file on disk, closed and opened again between the
        // steps, as it happens when the app is updated and restarted. The schema is the one
        // QuickSnippets 0.2.1 creates (db.rs did not change it).
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snippets.db");

        let id = {
            let conn = Connection::open(&path).unwrap();
            db::init_db(&conn).unwrap();
            db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap()
        };
        {
            let conn = Connection::open(&path).unwrap();
            db::init_db(&conn).unwrap();
            let content = activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
            assert_eq!(*content, LEGACY_PLAINTEXT.as_bytes());
        }
        let conn = Connection::open(&path).unwrap();
        db::init_db(&conn).unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(row.is_encrypted);
        assert!(crypto::is_current_format(&row.content));
        let content = activate_snippet_get_content(&conn, id, LEGACY_PASSWORD).unwrap();
        assert_eq!(*content, LEGACY_PLAINTEXT.as_bytes());
        assert!(activate_snippet_get_content(&conn, id, "wrong password").is_err());
    }

    #[test]
    fn test_create_encrypted_snippet_uses_current_format() {
        let conn = setup();
        let id = create_snippet_inner(&conn, "my secret", "secret data", "password123").unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(crypto::is_current_format(&row.content));
        let content = activate_snippet_get_content(&conn, id, "password123").unwrap();
        assert_eq!(*content, b"secret data");
    }

    #[test]
    fn test_update_legacy_encrypted_preserves_content_blob() {
        // Renaming does not know the password, so it must not touch the blob.
        let conn = setup();
        let id = db::create_snippet(&conn, "old secret", LEGACY_BLOB.to_vec(), true).unwrap();
        update_snippet_inner(&conn, id, "renamed secret", "ignored content").unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "renamed secret");
        assert_eq!(row.content, LEGACY_BLOB);
    }

    #[test]
    fn test_activate_nonexistent_snippet() {
        let conn = setup();
        let result = activate_snippet_get_content(&conn, 99999, "");
        assert!(result.is_err());
    }

    #[test]
    fn test_activate_snippet_get_content_returns_zeroizing() {
        // SECURITY: Verify that activate_snippet_get_content returns Zeroizing<Vec<u8>>
        // so that plaintext is securely erased from memory when out of scope.
        let conn = setup();
        let id = db::create_snippet(&conn, "test snip", b"secret text".to_vec(), false).unwrap();
        let zeroizing_content = activate_snippet_get_content(&conn, id, "").unwrap();
        // Verify content is correct
        assert_eq!(*zeroizing_content, b"secret text");
        // Verify we can convert to Vec<u8> safely
        assert_eq!(zeroizing_content.to_vec(), b"secret text");
        // The zeroizing_content will be securely erased when this scope ends
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

    // === content length validation ===
    //
    // The content column holds at most 65,536 bytes. A plain snippet is stored as it is. An
    // encrypted snippet is stored as its v2 blob, which is longer than the content: 49,105
    // bytes of content give a 65,535-byte blob, one byte more gives 65,539 bytes. Both limits
    // are checked before anything is written, so the user never gets a database error.

    /// Text that is `bytes` long in UTF-8, written in Cyrillic: two bytes per letter, with
    /// one "x" in front when `bytes` is odd.
    fn cyrillic_content(bytes: usize) -> String {
        let mut text = "x".repeat(bytes % 2);
        text.push_str(&"я".repeat(bytes / 2));
        assert_eq!(text.len(), bytes);
        text
    }

    #[test]
    fn test_create_snippet_content_too_long() {
        let conn = setup();
        let oversized = "x".repeat(MAX_CONTENT_LENGTH + 1);
        let result = create_snippet_inner(&conn, "title", &oversized, "");
        assert_eq!(result.unwrap_err(), "Content too long (65537 bytes, max 65536 bytes)");
        assert!(search_snippets_inner(&conn, "").unwrap().items.is_empty(), "nothing is stored");
    }

    #[test]
    fn test_create_snippet_content_max_length_ok() {
        let conn = setup();
        let max_content = "x".repeat(MAX_CONTENT_LENGTH);
        let result = create_snippet_inner(&conn, "title", &max_content, "");
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_snippet_limit_counts_bytes_not_letters() {
        // 32,768 Cyrillic letters are 65,536 bytes: the largest plain snippet.
        let conn = setup();
        let largest = cyrillic_content(MAX_CONTENT_LENGTH);
        let id = create_snippet_inner(&conn, "largest plain", &largest, "").unwrap();
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, largest.as_bytes());

        // One letter more is 65,538 bytes.
        let result = create_snippet_inner(&conn, "too large", &"я".repeat(32_769), "");
        assert_eq!(result.unwrap_err(), "Content too long (65538 bytes, max 65536 bytes)");
    }

    #[test]
    fn test_create_encrypted_snippet_largest_content_that_fits() {
        let conn = setup();
        let largest = cyrillic_content(MAX_ENCRYPTED_CONTENT_LENGTH);

        let id = create_snippet_inner(&conn, "largest secret", &largest, "pass").unwrap();

        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(row.is_encrypted);
        assert_eq!(row.content.len(), 65_535, "the v2 blob just fits the content column");
        let content = activate_snippet_get_content(&conn, id, "pass").unwrap();
        assert_eq!(*content, largest.as_bytes());
    }

    #[test]
    fn test_create_encrypted_snippet_one_byte_over_the_limit_gets_a_clear_error() {
        let conn = setup();
        let oversized = cyrillic_content(MAX_ENCRYPTED_CONTENT_LENGTH + 1);

        let result = create_snippet_inner(&conn, "too large secret", &oversized, "pass");

        assert_eq!(
            result.unwrap_err(),
            "Content too long for an encrypted snippet (49106 bytes, max 49105 bytes)"
        );
        assert!(search_snippets_inner(&conn, "").unwrap().items.is_empty(), "nothing is stored");
    }

    #[test]
    fn test_create_encrypted_snippet_far_over_the_limit_gets_a_clear_error() {
        // The most a plain snippet may hold is still too much for an encrypted one.
        let conn = setup();
        let plain_limit = "x".repeat(MAX_CONTENT_LENGTH);
        let result = create_snippet_inner(&conn, "large secret", &plain_limit, "pass");
        assert_eq!(
            result.unwrap_err(),
            "Content too long for an encrypted snippet (65536 bytes, max 49105 bytes)"
        );
    }

    #[test]
    fn test_max_encrypted_content_length_is_the_most_the_database_stores() {
        // Pins the limit to the blob format and the content column: the limit itself is
        // stored, one byte more is refused by the database. Neither too strict nor too loose.
        assert_eq!(MAX_ENCRYPTED_CONTENT_LENGTH, 49_105);
        let conn = setup();
        let fits = crypto::encrypt(&vec![b'x'; MAX_ENCRYPTED_CONTENT_LENGTH], "pass").unwrap();
        assert_eq!(fits.len(), 65_535);
        assert!(db::create_snippet(&conn, "fits", fits, true).is_ok());

        let over = crypto::encrypt(&vec![b'x'; MAX_ENCRYPTED_CONTENT_LENGTH + 1], "pass").unwrap();
        assert_eq!(over.len(), 65_539);
        let err = db::create_snippet(&conn, "over", over, true).unwrap_err();
        assert!(err.to_string().contains("CHECK constraint failed"), "{err}");
    }

    #[test]
    fn test_update_snippet_content_too_long() {
        let conn = setup();
        let id = db::create_snippet(&conn, "title", b"old content".to_vec(), false).unwrap();
        let oversized = cyrillic_content(MAX_CONTENT_LENGTH + 1);
        let result = update_snippet_inner(&conn, id, "title", &oversized);
        assert_eq!(result.unwrap_err(), "Content too long (65537 bytes, max 65536 bytes)");
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().content, b"old content");
    }

    #[test]
    fn test_update_snippet_content_max_length_ok() {
        let conn = setup();
        let id = db::create_snippet(&conn, "title", b"old content".to_vec(), false).unwrap();
        let max_content = "x".repeat(MAX_CONTENT_LENGTH);
        let result = update_snippet_inner(&conn, id, "title", &max_content);
        assert!(result.is_ok());
    }

    // === Title length: counted in characters, as the database counts them ===

    /// `count` characters of Cyrillic: 2 bytes and 1 UTF-16 unit each.
    fn cyrillic_title(count: usize) -> String {
        "Ж".repeat(count)
    }

    /// `count` emoji outside the BMP: 4 bytes and 2 UTF-16 units each.
    fn emoji_title(count: usize) -> String {
        "😀".repeat(count)
    }

    #[test]
    fn test_create_snippet_title_of_50_cyrillic_letters_is_stored() {
        let conn = setup();
        let title = cyrillic_title(TITLE_MAX_CHARS);
        let id = create_snippet_inner(&conn, &title, "content", "").unwrap();
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().title, title);
    }

    #[test]
    fn test_create_snippet_title_of_50_emoji_is_stored() {
        let conn = setup();
        let title = emoji_title(TITLE_MAX_CHARS);
        let id = create_snippet_inner(&conn, &title, "content", "pass").unwrap();
        assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().title, title);
    }

    #[test]
    fn test_create_snippet_title_of_51_characters_gets_a_clear_error() {
        for title in [cyrillic_title(51), emoji_title(51)] {
            let conn = setup();
            let result = create_snippet_inner(&conn, &title, "content", "");
            assert_eq!(result.unwrap_err(), "Title must be 3 to 50 characters (51 characters)");
            assert!(search_snippets_inner(&conn, "").unwrap().items.is_empty(), "nothing is stored");
        }
    }

    #[test]
    fn test_create_snippet_title_of_two_emoji_gets_a_clear_error_not_a_database_one() {
        // 8 bytes, 4 UTF-16 units, but 2 characters for the database.
        let conn = setup();
        let result = create_snippet_inner(&conn, &emoji_title(2), "content", "");
        assert_eq!(result.unwrap_err(), "Title must be 3 to 50 characters (2 characters)");
    }

    #[test]
    fn test_create_snippet_title_of_three_emoji_is_stored() {
        let conn = setup();
        assert!(create_snippet_inner(&conn, &emoji_title(3), "content", "").is_ok());
    }

    #[test]
    fn test_update_snippet_title_of_50_characters_is_stored() {
        for title in [cyrillic_title(50), emoji_title(50)] {
            let conn = setup();
            let id = db::create_snippet(&conn, "old title", b"content".to_vec(), false).unwrap();
            update_snippet_inner(&conn, id, &title, "content").unwrap();
            assert_eq!(db::get_snippet_by_id(&conn, id).unwrap().title, title);
        }
    }

    #[test]
    fn test_update_snippet_title_of_51_characters_gets_a_clear_error() {
        for title in [cyrillic_title(51), emoji_title(51)] {
            let conn = setup();
            let id = db::create_snippet(&conn, "old title", b"content".to_vec(), false).unwrap();
            let result = update_snippet_inner(&conn, id, &title, "new content");
            assert_eq!(result.unwrap_err(), "Title must be 3 to 50 characters (51 characters)");
            let row = db::get_snippet_by_id(&conn, id).unwrap();
            assert_eq!(row.title, "old title", "the old title stays");
            assert_eq!(row.content, b"content", "the old content stays");
        }
    }

    #[test]
    fn test_update_snippet_title_too_short_gets_a_clear_error() {
        let conn = setup();
        let id = db::create_snippet(&conn, "old title", b"content".to_vec(), false).unwrap();
        let result = update_snippet_inner(&conn, id, &emoji_title(2), "content");
        assert_eq!(result.unwrap_err(), "Title must be 3 to 50 characters (2 characters)");
    }

    #[test]
    fn test_update_encrypted_snippet_title_is_checked_too() {
        let conn = setup();
        let id = create_snippet_inner(&conn, "secret", "data", "pass").unwrap();
        let result = update_snippet_inner(&conn, id, &emoji_title(51), "");
        assert_eq!(result.unwrap_err(), "Title must be 3 to 50 characters (51 characters)");
    }

    #[test]
    fn test_title_limits_are_the_ones_the_database_stores() {
        // Pins the check to the CHECK of the title column, which counts characters
        // (code points), not bytes or UTF-16 units. Neither too strict nor too loose.
        assert_eq!((TITLE_MIN_CHARS, TITLE_MAX_CHARS), (3, 50));
        let conn = setup();
        for title in [emoji_title(3), emoji_title(50), cyrillic_title(50)] {
            assert!(db::create_snippet(&conn, &title, b"c".to_vec(), false).is_ok(), "{title}");
        }
        for title in [emoji_title(2), emoji_title(51), cyrillic_title(51)] {
            let err = db::create_snippet(&conn, &title, b"c".to_vec(), false).unwrap_err();
            assert!(err.to_string().contains("CHECK constraint failed"), "{err}");
        }
    }

    // === delete_snippet ===

    #[test]
    fn test_delete_snippet_removes_from_search() {
        let conn = setup();
        let id = db::create_snippet(&conn, "to delete", b"data".to_vec(), false).unwrap();
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap().items;
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

    // === get_sorted_snippets ===

    #[test]
    fn test_get_sorted_snippets_inner_alphabetical_asc() {
        let conn = setup();
        db::create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();
        db::create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
        db::create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();

        let results = get_sorted_snippets_inner(&conn, "alphabetical", "asc").unwrap().items;
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

        let results = get_sorted_snippets_inner(&conn, "modified", "desc").unwrap().items;
        assert_eq!(results.len(), 1);
        assert!(results[0].is_encrypted);
        assert_eq!(results[0].score, 0);
    }

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

    // === save_settings: a change of "Start with Windows" that Windows refuses ===
    // Only the registry in memory of crate::autostart: the real autostart values are shared by
    // every copy of the app, so no test touches them.

    use crate::autostart::memory::{exe, MemoryRegistry, Value, EXE, NAME};
    use crate::autostart::{RUN_KEY, TASK_MANAGER_MARK_KEY};
    use crate::settings::{load_settings_from_path, Settings};

    /// The saved settings, with "Start with Windows" `was_on`, and what the settings dialog
    /// saves over them: another theme, language and delay, and "Start with Windows" `now_on`.
    fn saved_and_changed(was_on: bool, now_on: bool) -> (Settings, Settings) {
        let saved = Settings {
            autostart: was_on,
            ..Settings::default()
        };
        let changed = Settings {
            theme: "light".into(),
            language: "de".into(),
            autotype_delay_ms: 30,
            autostart: now_on,
            ..saved.clone()
        };
        (saved, changed)
    }

    #[test]
    fn test_save_settings_refused_turn_on_keeps_it_off_and_saves_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let (saved, changed) = saved_and_changed(false, true);
        let current = Mutex::new(saved);
        // The entry in quotes cannot be written.
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::default()
        };

        let outcome = save_settings_inner(changed.clone(), &current, &path, &registry, NAME, exe());

        let kept = Settings {
            autostart: false,
            ..changed
        };
        assert_eq!(
            outcome,
            Ok(SaveSettingsOutcome {
                autostart_error: Some(AutostartError::CannotTurnOn)
            })
        );
        assert_eq!(load_settings_from_path(&path).unwrap(), kept);
        assert_eq!(*current.lock().unwrap(), kept);
        assert!(registry.is_empty());
    }

    #[test]
    fn test_save_settings_refused_turn_off_keeps_it_on_and_saves_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let (saved, changed) = saved_and_changed(true, false);
        let current = Mutex::new(saved);
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };

        let outcome = save_settings_inner(changed.clone(), &current, &path, &registry, NAME, exe());

        let kept = Settings {
            autostart: true,
            ..changed
        };
        assert_eq!(
            outcome,
            Ok(SaveSettingsOutcome {
                autostart_error: Some(AutostartError::CannotTurnOff)
            })
        );
        assert_eq!(load_settings_from_path(&path).unwrap(), kept);
        assert_eq!(*current.lock().unwrap(), kept);
        // Windows still starts the app, as the setting says.
        assert!(registry.has(RUN_KEY, NAME));
    }

    #[test]
    fn test_save_settings_test_registry_refuses_without_touching_anything() {
        // What QUICK_SNIPPETS_TEST_AUTOSTART_ERROR makes the app use.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let (saved, changed) = saved_and_changed(false, true);
        let current = Mutex::new(saved);
        let registry = crate::autostart::RefusingRegistry;

        let outcome = save_settings_inner(changed, &current, &path, &registry, NAME, exe()).unwrap();

        assert_eq!(outcome.autostart_error, Some(AutostartError::CannotTurnOn));
        assert!(!load_settings_from_path(&path).unwrap().autostart);
    }

    #[test]
    fn test_save_settings_turning_on_and_off_reports_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let (saved, changed) = saved_and_changed(false, true);
        let current = Mutex::new(saved);
        let registry = MemoryRegistry::default();

        let outcome = save_settings_inner(changed.clone(), &current, &path, &registry, NAME, exe());
        assert_eq!(outcome, Ok(SaveSettingsOutcome::default()));
        assert_eq!(load_settings_from_path(&path).unwrap(), changed);
        // The path of this exe, in quotes.
        assert_eq!(
            registry.value(RUN_KEY, NAME),
            Some(Value::String(format!("\"{EXE}\"")))
        );

        let off = Settings {
            autostart: false,
            ..changed
        };
        let outcome = save_settings_inner(off.clone(), &current, &path, &registry, NAME, exe());
        assert_eq!(outcome, Ok(SaveSettingsOutcome::default()));
        assert_eq!(*current.lock().unwrap(), off);
        assert!(registry.is_empty());
    }

    #[test]
    fn test_save_settings_without_a_change_of_autostart_does_not_ask_windows() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let (saved, changed) = saved_and_changed(true, true);
        let current = Mutex::new(saved);
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::default()
        };

        let outcome = save_settings_inner(changed.clone(), &current, &path, &registry, NAME, exe());

        assert_eq!(outcome, Ok(SaveSettingsOutcome::default()));
        assert_eq!(load_settings_from_path(&path).unwrap(), changed);
        assert!(registry.calls().is_empty());
    }

    #[test]
    fn test_save_settings_unwritable_file_changes_neither_memory_nor_registry() {
        // A directory where the file should be: it cannot be written.
        let dir = tempfile::tempdir().unwrap();
        let (saved, changed) = saved_and_changed(false, true);
        let current = Mutex::new(saved.clone());
        let registry = MemoryRegistry::default();

        let outcome = save_settings_inner(changed, &current, dir.path(), &registry, NAME, exe());

        assert!(outcome.is_err());
        assert_eq!(*current.lock().unwrap(), saved);
        assert!(registry.calls().is_empty());
    }

    #[test]
    fn test_save_settings_outcome_reaches_the_page_in_snake_case() {
        // src/types/index.ts reads these names: change the two together.
        let refused = SaveSettingsOutcome {
            autostart_error: Some(AutostartError::CannotTurnOff),
        };
        assert_eq!(
            serde_json::to_value(refused).unwrap(),
            serde_json::json!({ "autostart_error": "cannot_turn_off" })
        );
        assert_eq!(
            serde_json::to_value(SaveSettingsOutcome::default()).unwrap(),
            serde_json::json!({ "autostart_error": null })
        );
    }

    // === end-to-end command integration ===

    #[test]
    fn test_full_flow_create_search_activate_delete() {
        let conn = setup();
        let id = create_snippet_inner(&conn, "my test", "hello world", "").unwrap();
        let results = search_snippets_inner(&conn, "test").unwrap().items;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, id);
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(String::from_utf8(content.to_vec()).unwrap(), "hello world");
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap().items;
        assert_eq!(results.len(), 0);
    }

    // === damage met while the app works (TASK-33) ===

    use crate::db::test_damage::{build_db, content_of, damage_middle_leaf, damage_page, overwrite_after, pages_of};

    const COUNT: i64 = 90;

    #[test]
    fn test_lists_report_damage() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let healthy = db::open_and_init_db(&path).unwrap();
        assert!(!get_sorted_snippets_inner(&healthy, "modified", "desc").unwrap().damaged);
        assert!(!search_snippets_inner(&healthy, "сніпет").unwrap().damaged);
        drop(healthy);

        damage_middle_leaf(&path, COUNT);
        let conn = db::open_and_init_db(&path).unwrap();
        let sorted = get_sorted_snippets_inner(&conn, "modified", "desc").unwrap();
        assert!(sorted.damaged);
        assert!(!sorted.items.is_empty(), "the snippets before the damaged page are still listed");
        assert!(get_sorted_snippets_inner(&conn, "alphabetical", "asc").unwrap().damaged);
        let found = search_snippets_inner(&conn, "сніпет").unwrap();
        assert!(found.damaged);
        assert_eq!(found.items.len(), sorted.items.len());
    }

    /// The list reaches the frontend as { items, damaged } (src/types/index.ts reads these names).
    #[test]
    fn test_snippet_list_view_names_for_the_frontend() {
        let view = SnippetListView { items: vec![], damaged: true };
        assert_eq!(
            serde_json::to_value(view).unwrap(),
            serde_json::json!({ "items": [], "damaged": true })
        );
    }

    /// Up to 0.3.5 every command passed SQLite's English "database disk image is malformed" on.
    #[test]
    fn test_commands_report_a_damaged_page_as_database_damaged() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        let id = unreadable[0];
        let conn = db::open_and_init_db(&path).unwrap();

        assert_eq!(get_snippet_by_id_inner(&conn, id).err().unwrap(), db::DATABASE_DAMAGED);
        assert_eq!(activate_snippet_get_content(&conn, id, "").err().unwrap(), db::DATABASE_DAMAGED);
        assert_eq!(update_snippet_inner(&conn, id, "New title", "x").unwrap_err(), db::DATABASE_DAMAGED);
        assert_eq!(delete_snippet_inner(&conn, id).unwrap_err(), db::DATABASE_DAMAGED);
    }

    /// Damage in an index stops every change of the table, also of snippets that read fine.
    #[test]
    fn test_saving_with_a_damaged_index_reports_database_damaged() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, pages_of(&path, "idx_snippets_title", "leaf")[0]);
        let conn = db::open_and_init_db(&path).unwrap();

        assert_eq!(create_snippet_inner(&conn, "Brand new", "text", "").unwrap_err(), db::DATABASE_DAMAGED);
        assert_eq!(
            create_snippet_inner(&conn, "Brand new secret", "text", "pass").unwrap_err(),
            db::DATABASE_DAMAGED
        );
        assert_eq!(update_snippet_inner(&conn, 1, "Renamed", "x").unwrap_err(), db::DATABASE_DAMAGED);
    }

    /// A plain snippet whose text is no longer UTF-8: SNIPPET_DAMAGED, never any of its bytes
    /// (up to 0.3.5 "Invalid UTF-8 content", or "invalid utf-8 sequence ..." when opening it).
    #[test]
    fn test_damaged_text_of_one_snippet_reports_snippet_damaged() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        overwrite_after(&path, content_of(40).as_bytes(), None, 10, &[0xFF, 0xFF]);
        let conn = db::open_and_init_db(&path).unwrap();

        assert_eq!(get_snippet_by_id_inner(&conn, 40).err().unwrap(), db::SNIPPET_DAMAGED);
        let bytes = activate_snippet_get_content(&conn, 40, "").unwrap();
        let err = plaintext_to_string(&bytes).unwrap_err();
        assert_eq!(err, db::SNIPPET_DAMAGED);
        assert!(get_snippet_by_id_inner(&conn, 41).is_ok(), "the other snippets are fine");
    }

    #[test]
    fn test_plaintext_to_string_keeps_text_and_never_shows_bytes() {
        assert_eq!(plaintext_to_string("Привіт".as_bytes()).unwrap().as_str(), "Привіт");
        let err = plaintext_to_string(&[b's', b'e', 0xFF, b'c']).unwrap_err();
        assert_eq!(err, db::SNIPPET_DAMAGED);
        assert!(!err.contains("se"), "{err}");
    }

    /// A title that is not UTF-8 makes opening the snippet report SNIPPET_DAMAGED, and editing or
    /// deleting it DATABASE_DAMAGED (SQLite finds the index out of step).
    #[test]
    fn test_damaged_title_reports_damage() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        overwrite_after(&path, crate::db::test_damage::title_of(41).as_bytes(), Some(&leaves), 2, &[0xFF, 0xFE]);
        let conn = db::open_and_init_db(&path).unwrap();

        assert_eq!(get_snippet_by_id_inner(&conn, 41).err().unwrap(), db::SNIPPET_DAMAGED);
        let deleted = delete_snippet_inner(&conn, 41).unwrap_err();
        assert!(deleted == db::DATABASE_DAMAGED || deleted == db::SNIPPET_DAMAGED, "{deleted}");
    }

    // ── Auto-type: the window hides first; a failure after that plays the error sound (TASK-42) ──

    /// What `autotype_snippet_inner` did, in order: "hide", "type:<text>", "alert".
    fn run_autotype(
        state: &AppState,
        id: i64,
        password: &str,
        typing: Result<(), String>,
    ) -> (Result<(), String>, Vec<String>) {
        let steps = std::cell::RefCell::new(Vec::new());
        let result = autotype_snippet_inner(
            &state.conn,
            id,
            password,
            || steps.borrow_mut().push("hide".to_string()),
            |text: &str| {
                steps.borrow_mut().push(format!("type:{text}"));
                typing
            },
            || steps.borrow_mut().push("alert".to_string()),
        );
        (result, steps.into_inner())
    }

    /// One of the errors of the typing itself (autotype.rs), after the window has hidden.
    const TYPING_FAILED: &str = "PostMessageW(WM_CHAR) failed: Invalid window handle. (os error 1400)";

    #[test]
    fn test_autotype_hides_the_window_then_types_without_a_sound() {
        let state = AppState::new_for_test();
        let id = create_snippet_inner(&state.conn.lock().unwrap(), "Привітання", "Привіт", "").unwrap();
        let (result, steps) = run_autotype(&state, id, "", Ok(()));
        assert_eq!(result, Ok(()));
        assert_eq!(steps, ["hide", "type:Привіт"]);
    }

    #[test]
    fn test_autotype_typing_failure_after_hiding_plays_the_error_sound_once() {
        let state = AppState::new_for_test();
        let id = create_snippet_inner(&state.conn.lock().unwrap(), "Привітання", "Привіт", "").unwrap();
        let (result, steps) = run_autotype(&state, id, "", Err(TYPING_FAILED.to_string()));
        assert_eq!(result.unwrap_err(), TYPING_FAILED, "the error goes to the frontend as it is");
        assert_eq!(steps, ["hide", "type:Привіт", "alert"]);
    }

    /// An encrypted snippet: the right password types the decrypted text; a typing failure sounds,
    /// and the error never holds the text or the password.
    #[test]
    fn test_autotype_of_an_encrypted_snippet() {
        let state = AppState::new_for_test();
        let id = create_snippet_inner(&state.conn.lock().unwrap(), "Таємниця", "секрет 456", "pass-42").unwrap();
        let (result, steps) = run_autotype(&state, id, "pass-42", Ok(()));
        assert_eq!(result, Ok(()));
        assert_eq!(steps, ["hide", "type:секрет 456"]);

        let (result, steps) = run_autotype(&state, id, "pass-42", Err(TYPING_FAILED.to_string()));
        let err = result.unwrap_err();
        assert!(!err.contains("секрет") && !err.contains("pass-42"), "{err}");
        assert_eq!(steps.last().map(String::as_str), Some("alert"));
    }

    /// Failures before the window hides are shown in the window, which is still on screen: no
    /// hiding, no typing, no sound.
    #[test]
    fn test_autotype_failure_before_hiding_keeps_the_window_and_plays_no_sound() {
        let state = AppState::new_for_test();
        let (plain, secret, damaged) = {
            let conn = state.conn.lock().unwrap();
            let plain = create_snippet_inner(&conn, "Привітання", "Привіт", "").unwrap();
            let secret = create_snippet_inner(&conn, "Таємниця", "секрет 456", "pass-42").unwrap();
            // A text the app never writes: not UTF-8.
            let damaged = db::create_snippet(&conn, "Пошкоджений", vec![b's', 0xFF, 0xFE], false).unwrap();
            (plain, secret, damaged)
        };

        let missing = plain + 100;
        let (result, steps) = run_autotype(&state, missing, "", Ok(()));
        assert_eq!(result.unwrap_err(), "Query returned no rows");
        assert!(steps.is_empty(), "{steps:?}");

        let (result, steps) = run_autotype(&state, secret, "wrong", Ok(()));
        assert_eq!(result.unwrap_err(), crypto::WRONG_PASSWORD);
        assert!(steps.is_empty(), "{steps:?}");

        let (result, steps) = run_autotype(&state, damaged, "", Ok(()));
        assert_eq!(result.unwrap_err(), db::SNIPPET_DAMAGED);
        assert!(steps.is_empty(), "{steps:?}");
    }

    /// Another program holds the database: the read fails ("database is locked") before the
    /// window hides, so there is no sound; the window shows the message.
    #[test]
    fn test_autotype_with_a_locked_database_fails_before_hiding() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snippets.db");
        let conn = db::open_and_init_db(&path).unwrap();
        let id = create_snippet_inner(&conn, "Привітання", "Привіт", "").unwrap();
        // Waiting SQLite's busy timeout of 5 s would only slow the test down.
        conn.busy_timeout(std::time::Duration::ZERO).unwrap();
        let state = AppState {
            conn: Mutex::new(conn),
            ..AppState::new_for_test()
        };
        let other = Connection::open(&path).unwrap();
        other.execute_batch("BEGIN EXCLUSIVE;").unwrap();

        let (result, steps) = run_autotype(&state, id, "", Ok(()));
        assert_eq!(result.unwrap_err(), "database is locked");
        assert!(steps.is_empty(), "{steps:?}");

        other.execute_batch("COMMIT;").unwrap();
        let (result, steps) = run_autotype(&state, id, "", Ok(()));
        assert_eq!(result, Ok(()));
        assert_eq!(steps, ["hide", "type:Привіт"]);
    }
}
