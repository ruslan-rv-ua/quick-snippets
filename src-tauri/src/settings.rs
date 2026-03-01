// Settings load/save
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ------------------------------------------------------------------
// Structs
// ------------------------------------------------------------------

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Default for WindowState {
    fn default() -> Self {
        WindowState {
            x: 100,
            y: 100,
            width: 680,
            height: 520,
        }
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
#[serde(default)]
pub struct Settings {
    pub theme: String,
    pub start_in_tray: bool,
    pub autostart: bool,
    pub confirm_on_close: bool,
    pub language: String,
    pub window_state: WindowState,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: "dark".to_string(),
            start_in_tray: false,
            autostart: false,
            confirm_on_close: true,
            language: "".to_string(),
            window_state: WindowState::default(),
        }
    }
}

// ------------------------------------------------------------------
// Path helpers
// ------------------------------------------------------------------

/// Returns the path to `settings.json` next to the running `.exe`.
pub fn get_settings_path() -> PathBuf {
    let exe = std::env::current_exe().expect("Cannot determine exe path");
    exe.parent()
        .expect("Exe has no parent directory")
        .join("settings.json")
}

// ------------------------------------------------------------------
// Pure (testable) load / save
// ------------------------------------------------------------------

/// Load settings from an explicit path.
///
/// * Path is a directory (e.g. Scoop `persist` stub) → remove it, then treat as absent.
/// * File absent → create it with defaults and return `Ok(Settings::default())`.
/// * File present but invalid JSON → return `Err`.
pub fn load_settings_from_path(path: &Path) -> Result<Settings> {
    if path.is_dir() {
        // Scoop creates a directory stub when the file doesn't exist in the
        // release archive and `persist` is listed in the manifest.
        std::fs::remove_dir_all(path)?;
    }
    if !path.exists() {
        let defaults = Settings::default();
        save_settings_to_path(&defaults, path)?;
        return Ok(defaults);
    }
    let content = std::fs::read_to_string(path)?;
    // Strip UTF-8 BOM (EF BB BF / U+FEFF) that PowerShell 5.x `Set-Content
    // -Encoding UTF8` silently prepends. Without this serde_json rejects the
    // file even though the payload (e.g. `{}`) is otherwise valid JSON.
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
    let settings: Settings = serde_json::from_str(content)?;
    Ok(settings)
}

/// Serialize `settings` as pretty JSON and write to `path` (overwrites).
pub fn save_settings_to_path(settings: &Settings, path: &Path) -> Result<()> {
    let json = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, json)?;
    Ok(())
}

// ------------------------------------------------------------------
// Validate window state (pure, testable)
// ------------------------------------------------------------------

/// Guard against off-screen positions and sizes below the minimum.
pub fn validate_window_state(state: &WindowState) -> WindowState {
    let mut result = state.clone();

    // Position sanity check
    if state.x < -1000 || state.y < -1000 || state.x > 10000 || state.y > 10000 {
        result.x = 100;
        result.y = 100;
    }

    // Minimum size
    if state.width < 480 || state.height < 320 {
        result.width = 680;
        result.height = 520;
    }

    result
}

// ------------------------------------------------------------------
// Language detection
// ------------------------------------------------------------------

/// Detect system language: `"uk"` for Ukrainian locales, `"en"` otherwise.
pub fn detect_language() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Some(lang) = detect_language_windows() {
            if lang.to_lowercase().starts_with("uk") {
                return "uk".to_string();
            }
        }
    }

    // Fallback: LANG / LANGUAGE env vars (Linux / macOS / some Windows setups)
    for var in &["LANG", "LANGUAGE", "LC_ALL"] {
        if let Ok(val) = std::env::var(var) {
            if val.to_lowercase().starts_with("uk") {
                return "uk".to_string();
            }
        }
    }

    "en".to_string()
}

#[cfg(target_os = "windows")]
fn detect_language_windows() -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    extern "system" {
        fn GetUserDefaultLocaleName(lpLocaleName: *mut u16, cchLocaleName: i32) -> i32;
    }

    let mut buf = [0u16; 85];
    let len = unsafe { GetUserDefaultLocaleName(buf.as_mut_ptr(), buf.len() as i32) };
    if len > 0 {
        let end = (len as usize).saturating_sub(1); // strip null terminator
        let name = OsString::from_wide(&buf[..end])
            .to_string_lossy()
            .to_string();
        return Some(name);
    }
    None
}

// ------------------------------------------------------------------
// Tauri-runtime helpers (not compiled during tests)
// ------------------------------------------------------------------

#[cfg(not(test))]
pub fn load_settings() -> Settings {
    let path = get_settings_path();
    match load_settings_from_path(&path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to load settings: {e}");
            let reset = rfd::MessageDialog::new()
                .set_title("QuickSnippets — Помилка")
                .set_description(
                    "Файл settings.json пошкоджений.\nСкинути до стандартних налаштувань?",
                )
                .set_buttons(rfd::MessageButtons::YesNo)
                .show()
                == rfd::MessageDialogResult::Yes;

            if reset {
                let defaults = Settings::default();
                let _ = save_settings_to_path(&defaults, &path);
                defaults
            } else {
                std::process::exit(1);
            }
        }
    }
}

#[cfg(not(test))]
pub fn save_settings(settings: &Settings, window: &tauri::Window) {
    let mut s = settings.clone();

    if let Ok(pos) = window.outer_position() {
        s.window_state.x = pos.x;
        s.window_state.y = pos.y;
    }
    if let Ok(size) = window.outer_size() {
        s.window_state.width = size.width;
        s.window_state.height = size.height;
    }

    let path = get_settings_path();
    if let Err(e) = save_settings_to_path(&s, &path) {
        eprintln!("Failed to save settings: {e}");
    }
}

#[cfg(not(test))]
pub fn apply_window_state(window: &tauri::WebviewWindow, state: &WindowState) {
    use tauri::PhysicalPosition;
    use tauri::PhysicalSize;

    let validated = validate_window_state(state);
    let _ = window.set_position(PhysicalPosition::new(validated.x, validated.y));
    let _ = window.set_size(PhysicalSize::new(validated.width, validated.height));
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // === Settings::default ===

    #[test]
    fn test_default_settings() {
        let s = Settings::default();
        assert_eq!(s.theme, "dark");
        assert_eq!(s.start_in_tray, false);
        assert_eq!(s.autostart, false);
        assert_eq!(s.confirm_on_close, true);
        assert_eq!(s.language, "");
        assert_eq!(s.window_state.x, 100);
        assert_eq!(s.window_state.y, 100);
        assert_eq!(s.window_state.width, 680);
        assert_eq!(s.window_state.height, 520);
    }

    // === Serialisation / deserialisation ===

    #[test]
    fn test_settings_serialize_deserialize_roundtrip() {
        let original = Settings::default();
        let json = serde_json::to_string_pretty(&original).unwrap();
        let deserialized: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(original, deserialized);
    }

    #[test]
    fn test_settings_serialize_contains_all_fields() {
        let json = serde_json::to_string(&Settings::default()).unwrap();
        assert!(json.contains("theme"));
        assert!(json.contains("start_in_tray"));
        assert!(json.contains("autostart"));
        assert!(json.contains("confirm_on_close"));
        assert!(json.contains("language"));
        assert!(json.contains("window_state"));
    }

    #[test]
    fn test_settings_partial_json_uses_defaults_for_missing() {
        let json = r#"{"theme": "light"}"#;
        let result: Result<Settings, _> = serde_json::from_str(json);
        assert!(result.is_ok());
        let s = result.unwrap();
        assert_eq!(s.theme, "light");
        assert_eq!(s.start_in_tray, false);
    }

    // === File operations (via tempfile) ===

    #[test]
    fn test_load_settings_file_not_exists_creates_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        let settings = load_settings_from_path(&path).unwrap();
        assert_eq!(settings, Settings::default());
        assert!(path.exists());
    }

    #[test]
    fn test_load_settings_file_not_exists_creates_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        load_settings_from_path(&path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        let parsed: Settings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed, Settings::default());
    }

    #[test]
    fn test_load_settings_with_utf8_bom() {
        // PowerShell 5.x `Set-Content -Encoding UTF8` writes a UTF-8 BOM
        // (U+FEFF) before the JSON payload.  The loader must strip it.
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        let bom_json = "\u{FEFF}{}";
        std::fs::write(&path, bom_json.as_bytes()).unwrap();
        let result = load_settings_from_path(&path).unwrap();
        assert_eq!(result, Settings::default());
    }

    #[test]
    fn test_load_settings_when_path_is_directory() {
        // Scoop creates a directory stub for persisted files that don't exist
        // in the release archive.  The app must delete it and return defaults.
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::create_dir_all(&path).unwrap();
        assert!(path.is_dir(), "precondition: path is a directory");

        let result = load_settings_from_path(&path).unwrap();
        assert_eq!(result, Settings::default());
        assert!(
            path.is_file(),
            "directory should have been replaced by a JSON file"
        );
    }

    #[test]
    fn test_load_settings_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.theme = "light".to_string();
        std::fs::write(&path, serde_json::to_string_pretty(&s).unwrap()).unwrap();
        let loaded = load_settings_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
    }

    #[test]
    fn test_load_settings_invalid_json_returns_error() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "not json at all {{{").unwrap();
        let result = load_settings_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_settings_creates_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn test_save_settings_produces_pretty_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains('\n'));
    }

    #[test]
    fn test_save_settings_overwrites_existing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        let mut s = Settings::default();
        s.theme = "light".to_string();
        save_settings_to_path(&s, &path).unwrap();
        let loaded = load_settings_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
    }

    // === validate_window_state (pure function) ===

    #[test]
    fn test_validate_window_state_normal() {
        let state = WindowState { x: 200, y: 150, width: 700, height: 550 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 200);
        assert_eq!(result.y, 150);
        assert_eq!(result.width, 700);
        assert_eq!(result.height, 550);
    }

    #[test]
    fn test_validate_window_state_x_too_low() {
        let state = WindowState { x: -1001, y: 100, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_y_too_low() {
        let state = WindowState { x: 100, y: -1001, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_x_too_high() {
        let state = WindowState { x: 10001, y: 100, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_y_too_high() {
        let state = WindowState { x: 100, y: 10001, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_boundary_minus_1000_ok() {
        let state = WindowState { x: -1000, y: -1000, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, -1000);
    }

    #[test]
    fn test_validate_window_state_boundary_10000_ok() {
        let state = WindowState { x: 10000, y: 10000, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 10000);
    }

    #[test]
    fn test_validate_window_state_width_too_small() {
        let state = WindowState { x: 100, y: 100, width: 479, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 680);
        assert_eq!(result.height, 520);
    }

    #[test]
    fn test_validate_window_state_height_too_small() {
        let state = WindowState { x: 100, y: 100, width: 680, height: 319 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 680);
        assert_eq!(result.height, 520);
    }

    #[test]
    fn test_validate_window_state_min_size_boundary_ok() {
        let state = WindowState { x: 100, y: 100, width: 480, height: 320 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 480);
        assert_eq!(result.height, 320);
    }

    // === detect_language ===

    #[test]
    fn test_detect_language_returns_valid_code() {
        let lang = detect_language();
        assert!(lang == "en" || lang == "uk");
    }
}