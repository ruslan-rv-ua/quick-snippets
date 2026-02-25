pub mod db;
pub mod crypto;
pub mod search;
pub mod settings;

#[cfg(not(test))]
pub mod commands;

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Phase 2: open / init the database at startup
    let db_path = db::get_db_path();
    let conn = db::open_and_init_db(&db_path)
        .expect("Failed to open database");
    // conn is kept alive for the duration of the app in later phases via AppState
    std::mem::forget(conn);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
