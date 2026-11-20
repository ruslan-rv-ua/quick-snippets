// "Start with Windows": what the app changes in the registry, and when.
//
// Turning the setting on writes two values under HKEY_CURRENT_USER, both named after the app
// ("QuickSnippets", the same for every copy of it): the autostart entry in `RUN_KEY` (the path
// to the exe) and the on/off mark that Task Manager keeps for that entry in
// `TASK_MANAGER_MARK_KEY` ("enabled"). tauri-plugin-autostart writes both. Its `disable()`
// removes only the entry, so up to 0.3.3 the mark stayed behind for good (Windows ignores a
// mark without its entry). Turning the setting off therefore removes both values here.
//
// The registry changes only when the setting itself changes, not at every save of the
// settings (the theme, the sort order, the settings dialog). Every copy of the app uses the
// same value name: up to 0.3.3 a copy with the setting off removed the entry of another copy
// that had it on whenever it saved its settings, a copy with it on pointed the entry at
// itself, and "Disabled" set in Task Manager was undone by the next save.

/// The autostart entries of the current user.
pub const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

/// Task Manager's on/off mark for each entry of [`RUN_KEY`], under the same value name.
pub const TASK_MANAGER_MARK_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

/// What a change of the setting needs from the registry of the current user. The app uses
/// the plugin and the Windows registry; the tests use a registry in memory.
pub trait AutostartRegistry {
    /// Writes the autostart entry and Task Manager's "enabled" mark.
    fn enable(&self) -> Result<(), String>;
    /// Removes the value `name` of `key`. A value or key that does not exist counts as removed.
    fn remove_value(&self, key: &str, name: &str) -> Result<(), String>;
}

/// Applies a change of "Start with Windows" from `was_on` to `now_on`, for the values called
/// `name`. Nothing happens when the setting did not change.
pub fn apply_change(
    registry: &impl AutostartRegistry,
    name: &str,
    was_on: bool,
    now_on: bool,
) -> Result<(), String> {
    match (was_on, now_on) {
        (false, true) => registry.enable(),
        (true, false) => remove_entry_and_mark(registry, name),
        _ => Ok(()),
    }
}

/// Removes the autostart entry and Task Manager's mark. The mark goes also when the entry is
/// already gone or cannot be removed; the first error is returned.
pub fn remove_entry_and_mark(registry: &impl AutostartRegistry, name: &str) -> Result<(), String> {
    let entry = registry.remove_value(RUN_KEY, name);
    let mark = registry.remove_value(TASK_MANAGER_MARK_KEY, name);
    entry.and(mark)
}

/// Removes the value `name` of `HKEY_CURRENT_USER\key` from the Windows registry.
#[cfg(target_os = "windows")]
pub fn remove_current_user_value(key: &str, name: &str) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::{RegDeleteKeyValueW, HKEY_CURRENT_USER};

    let key_w: Vec<u16> = key.encode_utf16().chain(std::iter::once(0)).collect();
    let name_w: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    // SAFETY: both pointers are to null-terminated UTF-16 strings that outlive the call.
    let status = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, key_w.as_ptr(), name_w.as_ptr()) };
    removal_result(status, key, name)
}

/// What a status code of `RegDeleteKeyValueW` means for the removal: a missing value or key
/// (`ERROR_FILE_NOT_FOUND`) counts as removed.
#[cfg(target_os = "windows")]
fn removal_result(status: u32, key: &str, name: &str) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};

    match status {
        ERROR_SUCCESS | ERROR_FILE_NOT_FOUND => Ok(()),
        code => Err(format!(
            r"cannot remove HKEY_CURRENT_USER\{key}\{name}: Windows error {code}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::BTreeSet;

    const NAME: &str = "QuickSnippets";
    const OTHER: &str = "SomeOtherApp";

    /// A registry of the current user in memory: which (key, value name) pairs exist, and
    /// every call the code under test made.
    #[derive(Default)]
    struct MemoryRegistry {
        values: RefCell<BTreeSet<(String, String)>>,
        calls: RefCell<Vec<String>>,
        /// Removing a value of this key fails, as with "access denied".
        failing_key: Option<&'static str>,
    }

    impl MemoryRegistry {
        fn with(values: &[(&str, &str)]) -> Self {
            let registry = Self::default();
            for (key, name) in values {
                registry.values.borrow_mut().insert((key.to_string(), name.to_string()));
            }
            registry
        }

        fn has(&self, key: &str, name: &str) -> bool {
            self.values.borrow().contains(&(key.to_string(), name.to_string()))
        }

        fn calls(&self) -> Vec<String> {
            self.calls.borrow().clone()
        }
    }

    impl AutostartRegistry for MemoryRegistry {
        /// What tauri-plugin-autostart does: the entry and the "enabled" mark.
        fn enable(&self) -> Result<(), String> {
            self.calls.borrow_mut().push("enable".into());
            let mut values = self.values.borrow_mut();
            values.insert((RUN_KEY.into(), NAME.into()));
            values.insert((TASK_MANAGER_MARK_KEY.into(), NAME.into()));
            Ok(())
        }

        fn remove_value(&self, key: &str, name: &str) -> Result<(), String> {
            self.calls.borrow_mut().push(format!(r"remove {key}\{name}"));
            if self.failing_key == Some(key) {
                return Err("access denied".into());
            }
            self.values.borrow_mut().remove(&(key.to_string(), name.to_string()));
            Ok(())
        }
    }

    #[test]
    fn turning_on_writes_the_entry_and_the_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, false, true).unwrap();
        assert!(registry.has(RUN_KEY, NAME));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert_eq!(registry.calls(), vec!["enable"]);
    }

    #[test]
    fn turning_off_removes_the_entry_and_the_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, false, true).unwrap();
        apply_change(&registry, NAME, true, false).unwrap();
        assert!(!registry.has(RUN_KEY, NAME));
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert!(registry.values.borrow().is_empty());
    }

    #[test]
    fn turning_off_removes_a_mark_left_without_its_entry() {
        // What 0.3.3 and older left behind after the setting was turned off.
        let registry = MemoryRegistry::with(&[(TASK_MANAGER_MARK_KEY, NAME)]);
        apply_change(&registry, NAME, true, false).unwrap();
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_off_removes_the_mark_even_when_the_entry_cannot_be_removed() {
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };
        let result = apply_change(&registry, NAME, true, false);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert!(registry.has(RUN_KEY, NAME));
    }

    #[test]
    fn turning_off_reports_a_mark_that_cannot_be_removed() {
        let registry = MemoryRegistry {
            failing_key: Some(TASK_MANAGER_MARK_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };
        let result = apply_change(&registry, NAME, true, false);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(!registry.has(RUN_KEY, NAME));
    }

    #[test]
    fn turning_off_removes_only_the_values_of_this_name() {
        let registry = MemoryRegistry::with(&[
            (RUN_KEY, NAME),
            (TASK_MANAGER_MARK_KEY, NAME),
            (RUN_KEY, OTHER),
            (TASK_MANAGER_MARK_KEY, OTHER),
        ]);
        apply_change(&registry, NAME, true, false).unwrap();
        assert_eq!(
            registry.calls(),
            vec![
                format!(r"remove {RUN_KEY}\{NAME}"),
                format!(r"remove {TASK_MANAGER_MARK_KEY}\{NAME}"),
            ]
        );
        assert!(registry.has(RUN_KEY, OTHER));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, OTHER));
    }

    #[test]
    fn saving_with_the_setting_unchanged_leaves_the_registry_alone() {
        // Another copy's values, or a mark set to "Disabled" in Task Manager: a save of other
        // settings must not remove or rewrite them.
        let registry = MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)]);
        apply_change(&registry, NAME, true, true).unwrap();
        apply_change(&registry, NAME, false, false).unwrap();
        assert!(registry.calls().is_empty());
        assert!(registry.has(RUN_KEY, NAME));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn a_missing_value_or_key_counts_as_removed() {
        use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
        assert_eq!(removal_result(ERROR_SUCCESS, RUN_KEY, NAME), Ok(()));
        assert_eq!(removal_result(ERROR_FILE_NOT_FOUND, RUN_KEY, NAME), Ok(()));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn other_errors_name_the_value() {
        use windows_sys::Win32::Foundation::ERROR_ACCESS_DENIED;
        let error = removal_result(ERROR_ACCESS_DENIED, TASK_MANAGER_MARK_KEY, NAME).unwrap_err();
        assert!(error.contains(r"Explorer\StartupApproved\Run\QuickSnippets"), "{error}");
        assert!(error.contains("Windows error 5"), "{error}");
    }
}
