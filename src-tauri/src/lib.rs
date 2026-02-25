pub mod commands;
pub mod crypto;
pub mod db;
pub mod search;
pub mod settings;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use commands::tauri_commands::AppState;
    use std::sync::Mutex;

    let db_path = db::get_db_path();
    let conn = db::open_and_init_db(&db_path).expect("Failed to open database");

    let settings_path = settings::get_settings_path();
    let app_settings = settings::load_settings_from_path(&settings_path)
        .unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .manage(AppState {
            conn: Mutex::new(conn),
            settings: Mutex::new(app_settings),
            pending_notification: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::tauri_commands::search_snippets,
            commands::tauri_commands::get_snippet_by_id,
            commands::tauri_commands::create_snippet,
            commands::tauri_commands::activate_snippet,
            commands::tauri_commands::update_snippet,
            commands::tauri_commands::delete_snippet,
            commands::tauri_commands::get_settings,
            commands::tauri_commands::save_settings,
            commands::tauri_commands::get_pending_notification,
            commands::tauri_commands::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
