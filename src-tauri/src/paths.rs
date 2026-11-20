// Data directory path helpers

use std::path::PathBuf;

const DATA_DIR_NAME: &str = "quick-snippets-data";
const WEBVIEW_DIR_NAME: &str = "quick-snippets-webview";

/// Returns the directory containing the running `.exe`.
pub fn get_exe_dir() -> PathBuf {
    std::env::current_exe()
        .expect("Cannot determine exe path")
        .parent()
        .expect("Exe has no parent directory")
        .to_path_buf()
}

/// Returns the path to the data directory (`quick-snippets-data/` next to the `.exe`).
/// Creates the directory if it does not exist.
pub fn get_data_dir() -> PathBuf {
    let dir = get_exe_dir().join(DATA_DIR_NAME);
    std::fs::create_dir_all(&dir).expect("Failed to create data directory");
    dir
}

/// Returns the folder for the embedded browser's own data (`quick-snippets-webview/` next to
/// the `.exe`). WebView2 keeps its profile there, in an `EBWebView` subfolder: caches and its
/// own state, nothing the user typed or set. Without it Tauri puts that profile in
/// `%LOCALAPPDATA%\com.quicksnippets.app`, shared by every copy of the app on the computer.
///
/// It lies outside `quick-snippets-data`, so that the user's data folder (and its backups, and
/// the folder Scoop keeps across updates) holds only snippets and settings. The name does not
/// depend on the exe name: several exes in one folder share it, as they share the data folder.
/// Not created here: Tauri creates it when it builds the window.
pub fn get_webview_data_dir() -> PathBuf {
    get_exe_dir().join(WEBVIEW_DIR_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webview_data_dir_is_next_to_exe() {
        assert_eq!(get_webview_data_dir(), get_exe_dir().join(WEBVIEW_DIR_NAME));
    }

    #[test]
    fn test_webview_data_dir_is_outside_data_dir() {
        let webview_dir = get_webview_data_dir();
        assert!(
            !webview_dir.starts_with(get_data_dir()),
            "browser data must not be inside quick-snippets-data"
        );
    }

    #[test]
    fn test_webview_data_dir_does_not_contain_appdata() {
        assert!(
            !get_webview_data_dir().to_string_lossy().contains("AppData"),
            "browser data must not be in AppData"
        );
    }

    #[test]
    fn test_get_data_dir_returns_subdir_of_exe() {
        let data_dir = get_data_dir();
        let exe_dir = get_exe_dir();
        assert_eq!(data_dir, exe_dir.join(DATA_DIR_NAME));
        assert!(data_dir.exists(), "data dir must be created");
        assert!(data_dir.is_dir(), "data dir must be a directory");
    }

    #[test]
    fn test_get_data_dir_does_not_contain_appdata() {
        let data_dir = get_data_dir();
        assert!(
            !data_dir.to_string_lossy().contains("AppData"),
            "data dir must not be in AppData"
        );
    }
}
