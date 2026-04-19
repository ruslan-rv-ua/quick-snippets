// Data directory path helpers

use std::path::PathBuf;

const DATA_DIR_NAME: &str = "quick-snippets-data";

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

#[cfg(test)]
mod tests {
    use super::*;

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
