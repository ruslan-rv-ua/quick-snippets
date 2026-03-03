pub mod commands;
pub mod crypto;
pub mod db;
pub mod search;
pub mod settings;

// ---------------------------------------------------------------------------
// Tray helper types — public and testable (no Tauri runtime needed)
// ---------------------------------------------------------------------------

pub struct TrayMenuLabels {
    pub show: &'static str,
    pub new_snippet: &'static str,
    pub settings: &'static str,
    pub quit: &'static str,
}

pub fn get_tray_menu_labels(lang: &str) -> TrayMenuLabels {
    match lang {
        "uk" => TrayMenuLabels {
            show: "Показати",
            new_snippet: "Новий сніпет",
            settings: "Налаштування",
            quit: "Вихід",
        },
        "de" => TrayMenuLabels {
            show: "Anzeigen",
            new_snippet: "Neues Snippet",
            settings: "Einstellungen",
            quit: "Beenden",
        },
        _ => TrayMenuLabels {
            show: "Show",
            new_snippet: "New Snippet",
            settings: "Settings",
            quit: "Quit",
        },
    }
}

/// Generate a 16×16 RGBA tray icon as a flat `Vec<u8>` (1 024 bytes total).
///
/// The icon is a minimalist document outline (white border + grey text lines)
/// on a fully transparent background.
pub fn generate_tray_icon_rgba() -> Vec<u8> {
    let mut data = vec![0u8; 16 * 16 * 4];

    let mut px = |x: usize, y: usize, r: u8, g: u8, b: u8| {
        let i = (y * 16 + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    };

    // Document border — white/light grey
    for x in 2..=13usize {
        px(x, 1, 220, 220, 220);
        px(x, 14, 220, 220, 220);
    }
    for y in 2..=13usize {
        px(2, y, 220, 220, 220);
        px(13, y, 220, 220, 220);
    }

    // Horizontal "text" lines — medium grey
    for x in 4..=11usize {
        px(x, 4, 170, 170, 170);
        px(x, 6, 170, 170, 170);
        px(x, 8, 170, 170, 170);
    }
    for x in 4..=8usize {
        px(x, 10, 170, 170, 170);
    }

    data
}

// ---------------------------------------------------------------------------
// Tauri application entry point
// ---------------------------------------------------------------------------

/// Build the system-tray icon, menu, and event handlers.
#[cfg(not(test))]
fn setup_tray(app: &mut tauri::App, lang: &str) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
    use tauri::{Emitter, Manager};

    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
        .expect("Failed to decode embedded tray icon");

    let labels = get_tray_menu_labels(lang);
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", labels.show, true, None::<&str>)?,
            &MenuItem::with_id(app, "new_snippet", labels.new_snippet, true, None::<&str>)?,
            &MenuItem::with_id(app, "settings_item", labels.settings, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", labels.quit, true, None::<&str>)?,
        ],
    )?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("QuickSnippets")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let Some(win) = app.get_webview_window("main") else {
                return;
            };
            let show_focus = || {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            };
            match event.id().as_ref() {
                "show" => {
                    show_focus();
                    let _ = win.emit("window:show", ());
                }
                "new_snippet" => {
                    show_focus();
                    let _ = win.emit("tray:create-snippet", ());
                }
                "settings_item" => {
                    show_focus();
                    let _ = win.emit("tray:open-settings", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                if let Some(win) = tray.app_handle().get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                    let _ = win.emit("window:show", ());
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Register the global hotkey Ctrl+Alt+Space that shows the main window.
#[cfg(not(test))]
fn setup_hotkey(app: &mut tauri::App, win: tauri::WebviewWindow) {
    use commands::AppState;
    use tauri::{Emitter, Manager};
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutState};

    let shortcut = tauri_plugin_global_shortcut::Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::ALT),
        Code::Space,
    );
    let result = app
        .global_shortcut()
        .on_shortcut(shortcut, move |_app, _s, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
                let _ = win.emit("window:show", ());
            }
        });
    if result.is_err() {
        let state: tauri::State<AppState> = app.state();
        state.set_pending_notification(
            "Failed to register global hotkey Ctrl+Alt+Space".to_string(),
        );
    }
}

/// Attach window event handlers: close-request, focus/blur hide, move/resize save.
#[cfg(not(test))]
fn setup_window_events(win: tauri::WebviewWindow, app_handle: tauri::AppHandle) {
    use commands::AppState;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use tauri::{Emitter, Manager};

    // Debounce tracker for Moved / Resized saves.
    let last_save: Arc<Mutex<Option<std::time::Instant>>> = Arc::new(Mutex::new(None));
    // Debounce flag for blur→hide: when the window briefly loses
    // focus (resize grab, Alt+Space system menu) we must NOT hide
    // immediately — schedule a delayed hide, cancelled if focus returns.
    let hide_scheduled: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    let win_ev = win.clone();

    win.on_window_event(move |event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            let confirm = app_handle
                .try_state::<AppState>()
                .and_then(|s| s.settings.lock().ok().map(|st| st.confirm_on_close))
                .unwrap_or(true);
            if confirm {
                api.prevent_close();
                // Mark that exit-confirmation dialog is visible so
                // the Focused(false) handler does NOT hide the window.
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.set_close_pending(true);
                }
                let _ = win_ev.emit("window:close-request", ());
            } else {
                app_handle.exit(0);
            }
        }
        tauri::WindowEvent::Focused(focused) => {
            if *focused {
                // Window regained focus — cancel any pending hide.
                hide_scheduled.store(false, Ordering::SeqCst);
            } else {
                // If the exit-confirmation dialog is showing, do NOT hide.
                let pending = app_handle
                    .try_state::<AppState>()
                    .map(|s| s.is_close_pending())
                    .unwrap_or(false);
                if !pending {
                    hide_scheduled.store(true, Ordering::SeqCst);
                    let flag = hide_scheduled.clone();
                    let w = win_ev.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        if flag.load(Ordering::SeqCst) {
                            let _ = w.hide();
                        }
                    });
                }
            }
        }
        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
            // Debounce: save at most once per 500 ms
            let should_save = {
                let mut last = last_save.lock().unwrap_or_else(|e| e.into_inner());
                let now = std::time::Instant::now();
                let save = last.is_none_or(|t| now.duration_since(t).as_millis() >= 500);
                if save {
                    *last = Some(now);
                }
                save
            };
            if should_save {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Ok(mut guard) = state.settings.lock() {
                        if let Ok(pos) = win_ev.outer_position() {
                            guard.window_state.x = pos.x;
                            guard.window_state.y = pos.y;
                        }
                        if let Ok(size) = win_ev.outer_size() {
                            guard.window_state.width = size.width;
                            guard.window_state.height = size.height;
                        }
                        let path = settings::get_settings_path();
                        let _ = settings::save_settings_to_path(&guard, &path);
                    }
                }
            }
        }
        _ => {}
    });
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use commands::AppState;
    use std::sync::atomic::AtomicBool;
    use std::sync::Mutex;
    use tauri::{Emitter, Manager};

    // Force WebView2/Chromium to always initialise the accessibility
    // (UIA) tree.  Without this flag the renderer delays accessibility
    // activation until a screen reader is detected **while the window
    // is visible**.  When `start_in_tray` is true the window is hidden
    // at launch, so the detection never happens and the UIA provider
    // stays dormant — the screen reader sees nothing even after the
    // window is shown later.
    //
    // The env-var must be set *before* the WebView2 runtime is created.
    // Called before any threads are spawned (single-threaded main).
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--force-renderer-accessibility",
    );

    let db_path = db::get_db_path();
    let conn = db::open_and_init_db(&db_path).expect("Failed to open database");

    let app_settings = settings::load_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
                let _ = win.emit("window:show", ());
            }
        }))
        .manage(AppState {
            conn: Mutex::new(conn),
            settings: Mutex::new(app_settings),
            pending_notification: Mutex::new(None),
            close_confirmation_pending: AtomicBool::new(false),
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
            commands::tauri_commands::cancel_close,
        ])
        .setup(|app| {
            let win = app
                .get_webview_window("main")
                .expect("main window not found");

            // ── Apply saved window state ──────────────────────────────────
            {
                let state: tauri::State<AppState> = app.state();
                let s = state.settings.lock().unwrap_or_else(|e| e.into_inner());
                settings::apply_window_state(&win, &s.window_state);
            }

            // ── start_in_tray ─────────────────────────────────────────────
            {
                let state: tauri::State<AppState> = app.state();
                let start_in_tray = state
                    .settings
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .start_in_tray;
                if start_in_tray {
                    let _ = win.hide();
                }
            }

            // ── Resolve display language ──────────────────────────────────
            let lang = {
                let state: tauri::State<AppState> = app.state();
                let configured = state
                    .settings
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .language
                    .clone();
                if configured.is_empty() {
                    settings::detect_language()
                } else {
                    configured
                }
            };

            setup_tray(app, &lang)?;
            setup_hotkey(app, win.clone());
            setup_window_events(win, app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ---------------------------------------------------------------------------
// Tests — tray helpers and AppState
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::AppState;

    // === Tray icon ===

    #[test]
    fn test_generate_tray_icon_is_16x16() {
        let icon_data = generate_tray_icon_rgba();
        assert_eq!(icon_data.len(), 16 * 16 * 4);
    }

    #[test]
    fn test_generate_tray_icon_not_all_transparent() {
        let icon_data = generate_tray_icon_rgba();
        let has_visible = icon_data.chunks(4).any(|pixel| pixel[3] > 0);
        assert!(has_visible);
    }

    // === Tray menu labels ===

    #[test]
    fn test_tray_menu_labels_en() {
        let labels = get_tray_menu_labels("en");
        assert_eq!(labels.show, "Show");
        assert_eq!(labels.new_snippet, "New Snippet");
        assert_eq!(labels.settings, "Settings");
        assert_eq!(labels.quit, "Quit");
    }

    #[test]
    fn test_tray_menu_labels_uk() {
        let labels = get_tray_menu_labels("uk");
        assert_eq!(labels.show, "Показати");
        assert_eq!(labels.new_snippet, "Новий сніпет");
        assert_eq!(labels.settings, "Налаштування");
        assert_eq!(labels.quit, "Вихід");
    }

    #[test]
    fn test_tray_menu_labels_unknown_defaults_to_en() {
        let labels = get_tray_menu_labels("xx");
        assert_eq!(labels.show, "Show");
    }

    // === AppState pending notification ===

    #[test]
    fn test_pending_notification_set_and_clear() {
        let state = AppState::new_for_test();
        state.set_pending_notification("Warning message".to_string());
        assert_eq!(
            state.take_pending_notification(),
            Some("Warning message".to_string())
        );
        assert_eq!(state.take_pending_notification(), None); // one-shot
    }

    // === Close confirmation pending flag ===

    #[test]
    fn test_close_pending_default_false() {
        let state = AppState::new_for_test();
        assert!(!state.is_close_pending());
    }

    #[test]
    fn test_close_pending_set_and_cancel() {
        let state = AppState::new_for_test();
        state.set_close_pending(true);
        assert!(state.is_close_pending());
        state.set_close_pending(false);
        assert!(!state.is_close_pending());
    }
}
