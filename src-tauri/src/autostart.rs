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
//
// A change can fail, for example when a policy or security software keeps the user from
// changing the autostart entries. The setting then keeps its previous value and the settings
// dialog says so (`save_settings_inner` in commands.rs), so that it always shows what Windows
// does. Up to 0.3.4 the failure was ignored: the setting was saved as changed.

/// The autostart entries of the current user.
pub const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

/// Task Manager's on/off mark for each entry of [`RUN_KEY`], under the same value name.
pub const TASK_MANAGER_MARK_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

/// Environment variable for tests only. Set to anything but an empty value, it makes every
/// change of the setting fail as if Windows had refused it, and the registry is left alone
/// ([`RefusingRegistry`]). just smoke starts its test copy with it once, to check what a screen
/// reader says after such a failure: every copy of the app shares the real autostart values,
/// so a test must never break them.
pub const TEST_REFUSAL_VAR: &str = "QUICK_SNIPPETS_TEST_AUTOSTART_ERROR";

/// What a change of the setting needs from the registry of the current user. The app uses
/// the plugin and the Windows registry; the tests use a registry in memory.
pub trait AutostartRegistry {
    /// Writes the autostart entry and Task Manager's "enabled" mark.
    fn enable(&self) -> Result<(), String>;
    /// Removes the value `name` of `key`. A value or key that does not exist counts as removed.
    fn remove_value(&self, key: &str, name: &str) -> Result<(), String>;
    /// Whether the value `name` of `key` exists. A value that cannot be read counts as there:
    /// only a value known to be missing counts as gone.
    fn value_exists(&self, key: &str, name: &str) -> bool;
}

/// Applies a change of "Start with Windows" from `was_on` to `now_on`, for the values called
/// `name`. Nothing happens when the setting did not change.
///
/// An error means that Windows still does what it did before: after a failed turn-on it does
/// not start the app, after a failed turn-off it still does.
pub fn apply_change(
    registry: &impl AutostartRegistry,
    name: &str,
    was_on: bool,
    now_on: bool,
) -> Result<(), String> {
    match (was_on, now_on) {
        (false, true) => registry.enable(),
        (true, false) => turn_off(registry, name),
        _ => Ok(()),
    }
}

/// Turning the setting off. It fails only while the autostart entry is still there, since
/// Windows then still starts the app. A mark that cannot be removed stays behind, as with
/// 0.3.3 and older: Windows ignores a mark without its entry. An entry that cannot be removed
/// because the key is locked, but that is not there anyway, does not fail either.
fn turn_off(registry: &impl AutostartRegistry, name: &str) -> Result<(), String> {
    match remove_entry_and_mark(registry, name) {
        Err(error) if registry.value_exists(RUN_KEY, name) => Err(error),
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

/// Whether [`TEST_REFUSAL_VAR`] asks for refused changes.
pub fn test_refusal_requested() -> bool {
    refusal_requested(std::env::var_os(TEST_REFUSAL_VAR))
}

fn refusal_requested(value: Option<std::ffi::OsString>) -> bool {
    value.is_some_and(|v| !v.is_empty())
}

/// The registry of [`TEST_REFUSAL_VAR`]: every change is refused, nothing is written or
/// removed, and every value counts as there.
pub struct RefusingRegistry;

impl RefusingRegistry {
    fn refusal() -> String {
        format!("refused for a test ({TEST_REFUSAL_VAR} is set)")
    }
}

impl AutostartRegistry for RefusingRegistry {
    fn enable(&self) -> Result<(), String> {
        Err(Self::refusal())
    }

    fn remove_value(&self, _key: &str, _name: &str) -> Result<(), String> {
        Err(Self::refusal())
    }

    fn value_exists(&self, _key: &str, _name: &str) -> bool {
        true
    }
}

/// `text` as a null-terminated UTF-16 string, for the Windows API.
#[cfg(target_os = "windows")]
fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Removes the value `name` of `HKEY_CURRENT_USER\key` from the Windows registry.
#[cfg(target_os = "windows")]
pub fn remove_current_user_value(key: &str, name: &str) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::{RegDeleteKeyValueW, HKEY_CURRENT_USER};

    let key_w = wide(key);
    let name_w = wide(name);
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

/// Whether the value `name` of `HKEY_CURRENT_USER\key` exists in the Windows registry.
#[cfg(target_os = "windows")]
pub fn current_user_value_exists(key: &str, name: &str) -> bool {
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY_CURRENT_USER, RRF_NOEXPAND, RRF_RT_ANY,
    };

    let key_w = wide(key);
    let name_w = wide(name);
    // SAFETY: both strings are null-terminated UTF-16 that outlive the call. The type, data and
    // size pointers are null: only whether the value exists is asked for.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            key_w.as_ptr(),
            name_w.as_ptr(),
            RRF_RT_ANY | RRF_NOEXPAND,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    exists_after(status)
}

/// What a status code of `RegGetValueW` says about the value: only a missing value or key
/// (`ERROR_FILE_NOT_FOUND`) counts as gone, a value that cannot be read counts as there.
#[cfg(target_os = "windows")]
fn exists_after(status: u32) -> bool {
    status != windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND
}

/// A registry of the current user in memory, for the tests here and in commands.rs.
#[cfg(test)]
pub(crate) mod memory {
    use super::*;
    use std::cell::RefCell;
    use std::collections::BTreeSet;

    /// The value name of the app.
    pub const NAME: &str = "QuickSnippets";

    /// Which (key, value name) pairs exist, and every call the code under test made. All fields
    /// are public, so that a test can set the failures with `..MemoryRegistry::with(...)`.
    #[derive(Default)]
    pub struct MemoryRegistry {
        pub values: RefCell<BTreeSet<(String, String)>>,
        pub calls: RefCell<Vec<String>>,
        /// Removing a value of this key fails, as with "access denied".
        pub failing_key: Option<&'static str>,
        /// `enable()` fails before it writes anything, as the plugin does when the user may
        /// not change the autostart entries.
        pub failing_enable: bool,
        /// No value can be read.
        pub unreadable: bool,
    }

    impl MemoryRegistry {
        pub fn with(values: &[(&str, &str)]) -> Self {
            let registry = Self::default();
            for (key, name) in values {
                registry.values.borrow_mut().insert((key.to_string(), name.to_string()));
            }
            registry
        }

        pub fn has(&self, key: &str, name: &str) -> bool {
            self.values.borrow().contains(&(key.to_string(), name.to_string()))
        }

        pub fn is_empty(&self) -> bool {
            self.values.borrow().is_empty()
        }

        pub fn calls(&self) -> Vec<String> {
            self.calls.borrow().clone()
        }
    }

    impl AutostartRegistry for MemoryRegistry {
        /// What tauri-plugin-autostart does: the entry and the "enabled" mark.
        fn enable(&self) -> Result<(), String> {
            self.calls.borrow_mut().push("enable".into());
            if self.failing_enable {
                return Err("access denied".into());
            }
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

        fn value_exists(&self, key: &str, name: &str) -> bool {
            self.calls.borrow_mut().push(format!(r"read {key}\{name}"));
            self.unreadable || self.has(key, name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::memory::{MemoryRegistry, NAME};
    use super::*;

    const OTHER: &str = "SomeOtherApp";

    #[test]
    fn turning_on_writes_the_entry_and_the_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, false, true).unwrap();
        assert!(registry.has(RUN_KEY, NAME));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert_eq!(registry.calls(), vec!["enable"]);
    }

    #[test]
    fn turning_on_fails_when_the_entry_cannot_be_written() {
        let registry = MemoryRegistry {
            failing_enable: true,
            ..MemoryRegistry::default()
        };
        let result = apply_change(&registry, NAME, false, true);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(registry.is_empty());
    }

    #[test]
    fn turning_off_removes_the_entry_and_the_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, false, true).unwrap();
        apply_change(&registry, NAME, true, false).unwrap();
        assert!(!registry.has(RUN_KEY, NAME));
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert!(registry.is_empty());
    }

    #[test]
    fn turning_off_removes_a_mark_left_without_its_entry() {
        // What 0.3.3 and older left behind after the setting was turned off.
        let registry = MemoryRegistry::with(&[(TASK_MANAGER_MARK_KEY, NAME)]);
        apply_change(&registry, NAME, true, false).unwrap();
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_off_fails_while_the_entry_cannot_be_removed_but_removes_the_mark() {
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };
        let result = apply_change(&registry, NAME, true, false);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(registry.has(RUN_KEY, NAME));
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_off_succeeds_when_only_the_mark_cannot_be_removed() {
        // Without its entry Windows starts nothing; the mark stays, as with 0.3.3 and older.
        let registry = MemoryRegistry {
            failing_key: Some(TASK_MANAGER_MARK_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };
        apply_change(&registry, NAME, true, false).unwrap();
        assert!(!registry.has(RUN_KEY, NAME));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_off_succeeds_when_a_locked_key_holds_no_entry() {
        // For example settings copied from a computer where the setting was on.
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::default()
        };
        apply_change(&registry, NAME, true, false).unwrap();
        assert_eq!(
            registry.calls(),
            vec![
                format!(r"remove {RUN_KEY}\{NAME}"),
                format!(r"remove {TASK_MANAGER_MARK_KEY}\{NAME}"),
                format!(r"read {RUN_KEY}\{NAME}"),
            ]
        );
    }

    #[test]
    fn turning_off_fails_when_the_entry_cannot_be_read_after_a_failed_removal() {
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            unreadable: true,
            ..MemoryRegistry::default()
        };
        assert!(apply_change(&registry, NAME, true, false).is_err());
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

    #[test]
    fn the_test_registry_refuses_both_changes() {
        assert!(apply_change(&RefusingRegistry, NAME, false, true).is_err());
        let error = apply_change(&RefusingRegistry, NAME, true, false).unwrap_err();
        assert!(error.contains(TEST_REFUSAL_VAR), "{error}");
    }

    #[test]
    fn only_a_non_empty_test_variable_asks_for_refusals() {
        assert!(!refusal_requested(None));
        assert!(!refusal_requested(Some("".into())));
        assert!(refusal_requested(Some("1".into())));
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

    #[cfg(target_os = "windows")]
    #[test]
    fn only_a_missing_value_or_key_counts_as_gone() {
        use windows_sys::Win32::Foundation::{
            ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_SUCCESS,
        };
        assert!(exists_after(ERROR_SUCCESS));
        assert!(!exists_after(ERROR_FILE_NOT_FOUND));
        assert!(exists_after(ERROR_ACCESS_DENIED));
    }
}
