// "Start with Windows": what the app changes in the registry, and when.
//
// Turning the setting on writes two values under HKEY_CURRENT_USER, both named after the app
// ("QuickSnippets", the same for every copy of it): the autostart entry in `RUN_KEY`, the
// command line Windows runs at sign-in, and the on/off mark that Task Manager keeps for that
// entry in `TASK_MANAGER_MARK_KEY` ("enabled"). Turning it off removes both.
//
// The entry is the path to the exe in quotes (`command_line`). Up to 0.3.4 tauri-plugin-autostart
// wrote it without quotes: with a space in the path such a command line is ambiguous, and
// Windows first tries the shorter names it can read from it (for a copy in `C:\Portable Apps`
// first `C:\Portable.exe`) and starts a program it finds there. No released
// version of the plugin quotes the path, so the app writes both values itself. Its `disable()`
// also removed only the entry, so up to 0.3.3 the mark stayed behind for good (Windows ignores a
// mark without its entry).
//
// The registry changes only when the setting itself changes, not at every save of the
// settings (the theme, the sort order, the settings dialog). Every copy of the app uses the
// same value name: up to 0.3.3 a copy with the setting off removed the entry of another copy
// that had it on whenever it saved its settings, a copy with it on pointed the entry at
// itself, and "Disabled" set in Task Manager was undone by the next save. So an entry without
// quotes written by 0.3.4 or older also stays as it is until the setting is turned off and on.
//
// A change can fail, for example when a policy or security software keeps the user from
// changing the autostart entries. The setting then keeps its previous value and the settings
// dialog says so (`save_settings_inner` in commands.rs), so that it always shows what Windows
// does. Up to 0.3.4 the failure was ignored: the setting was saved as changed.

use std::path::Path;

/// The autostart entries of the current user.
pub const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

/// Task Manager's on/off mark for each entry of [`RUN_KEY`], under the same value name.
pub const TASK_MANAGER_MARK_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

/// Task Manager's mark for an entry it lists as enabled (REG_BINARY). "Disabled" is
/// `03 00 00 00` followed by the time it was set.
pub const MARK_ENABLED: [u8; 12] = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/// Environment variable for tests only. Set to anything but an empty value, it makes every
/// change of the setting fail as if Windows had refused it, and the registry is left alone
/// ([`RefusingRegistry`]). just smoke starts its test copy with it once, to check what a screen
/// reader says after such a failure: every copy of the app shares the real autostart values,
/// so a test must never break them.
pub const TEST_REFUSAL_VAR: &str = "QUICK_SNIPPETS_TEST_AUTOSTART_ERROR";

/// What a change of the setting needs from the registry of the current user. The app uses
/// the Windows registry ([`WindowsRegistry`]); the tests use a registry in memory.
pub trait AutostartRegistry {
    /// Writes the string value (REG_SZ) `name` of `key`.
    fn write_string(&self, key: &str, name: &str, data: &str) -> Result<(), String>;
    /// Writes the binary value (REG_BINARY) `name` of `key` if `key` exists. A missing key stays
    /// missing, and that is no error.
    fn write_binary_in_existing_key(
        &self,
        key: &str,
        name: &str,
        data: &[u8],
    ) -> Result<(), String>;
    /// Removes the value `name` of `key`. A value or key that does not exist counts as removed.
    fn remove_value(&self, key: &str, name: &str) -> Result<(), String>;
    /// Whether the value `name` of `key` exists. A value that cannot be read counts as there:
    /// only a value known to be missing counts as gone.
    fn value_exists(&self, key: &str, name: &str) -> bool;
}

/// Applies a change of "Start with Windows" from `was_on` to `now_on`, for the values called
/// `name` and the exe at `exe`. Nothing happens when the setting did not change.
///
/// An error means that Windows still does what it did before: after a failed turn-on it does
/// not start the app, after a failed turn-off it still does.
pub fn apply_change(
    registry: &impl AutostartRegistry,
    name: &str,
    exe: &Path,
    was_on: bool,
    now_on: bool,
) -> Result<(), String> {
    match (was_on, now_on) {
        (false, true) => turn_on(registry, name, exe),
        (true, false) => turn_off(registry, name),
        _ => Ok(()),
    }
}

/// The autostart entry for the exe at `exe`: its path in quotes and nothing after it, so that
/// Windows takes the whole path as the program also when it has spaces. A path that is empty,
/// not valid Unicode or holds a quote (no Windows path does) gives an error instead of an
/// entry that could start something else.
pub fn command_line(exe: &Path) -> Result<String, String> {
    let path = exe.to_str().ok_or_else(|| {
        format!(
            "the path of the exe is not valid Unicode: {}",
            exe.display()
        )
    })?;
    if path.is_empty() || path.contains(['"', '\0']) {
        return Err(format!(
            "the path of the exe cannot be used for autostart: {path:?}"
        ));
    }
    Ok(format!("\"{path}\""))
}

/// Turning the setting on: the entry, then Task Manager's "enabled" mark (only where Windows
/// keeps such marks already: without the key, Task Manager counts the entry as enabled).
///
/// When the mark cannot be written, the entry is taken back and turning on fails: an old
/// "Disabled" mark could otherwise keep Windows from starting the app while the setting says
/// it does. Only the value this call has just written is removed.
fn turn_on(registry: &impl AutostartRegistry, name: &str, exe: &Path) -> Result<(), String> {
    let entry = command_line(exe)?;
    registry.write_string(RUN_KEY, name, &entry)?;
    if let Err(error) =
        registry.write_binary_in_existing_key(TASK_MANAGER_MARK_KEY, name, &MARK_ENABLED)
    {
        let _ = registry.remove_value(RUN_KEY, name);
        return Err(error);
    }
    Ok(())
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
fn remove_entry_and_mark(registry: &impl AutostartRegistry, name: &str) -> Result<(), String> {
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
    fn write_string(&self, _key: &str, _name: &str, _data: &str) -> Result<(), String> {
        Err(Self::refusal())
    }

    fn write_binary_in_existing_key(
        &self,
        _key: &str,
        _name: &str,
        _data: &[u8],
    ) -> Result<(), String> {
        Err(Self::refusal())
    }

    fn remove_value(&self, _key: &str, _name: &str) -> Result<(), String> {
        Err(Self::refusal())
    }

    fn value_exists(&self, _key: &str, _name: &str) -> bool {
        true
    }
}

/// The registry of the current user in Windows.
#[cfg(target_os = "windows")]
pub struct WindowsRegistry;

#[cfg(target_os = "windows")]
impl AutostartRegistry for WindowsRegistry {
    fn write_string(&self, key: &str, name: &str, data: &str) -> Result<(), String> {
        write_current_user_string(key, name, data)
    }

    fn write_binary_in_existing_key(
        &self,
        key: &str,
        name: &str,
        data: &[u8],
    ) -> Result<(), String> {
        write_current_user_binary_in_existing_key(key, name, data)
    }

    fn remove_value(&self, key: &str, name: &str) -> Result<(), String> {
        remove_current_user_value(key, name)
    }

    fn value_exists(&self, key: &str, name: &str) -> bool {
        current_user_value_exists(key, name)
    }
}

/// `text` as a null-terminated UTF-16 string, for the Windows API.
#[cfg(target_os = "windows")]
fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Writes `data` as the string value (REG_SZ) `name` of `HKEY_CURRENT_USER\key`.
#[cfg(target_os = "windows")]
fn write_current_user_string(key: &str, name: &str, data: &str) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::{RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ};

    let key_w = wide(key);
    let name_w = wide(name);
    let data_w = wide(data);
    // The size in bytes, with the terminating null, as REG_SZ wants it.
    let size = u32::try_from(std::mem::size_of_val(data_w.as_slice()))
        .map_err(|_| format!(r"the value HKEY_CURRENT_USER\{key}\{name} is too long"))?;
    // SAFETY: the strings are null-terminated UTF-16 and, like the data, outlive the call;
    // `size` is the size of the data in bytes.
    let status = unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            key_w.as_ptr(),
            name_w.as_ptr(),
            REG_SZ,
            data_w.as_ptr().cast(),
            size,
        )
    };
    write_result(status, key, name)
}

/// Writes `data` as the binary value (REG_BINARY) `name` of `HKEY_CURRENT_USER\key`, if that key
/// exists.
#[cfg(target_os = "windows")]
fn write_current_user_binary_in_existing_key(
    key: &str,
    name: &str,
    data: &[u8],
) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_BINARY,
    };

    let key_w = wide(key);
    let mut handle: HKEY = 0;
    // SAFETY: `key_w` is a null-terminated UTF-16 string that outlives the call, and `handle`
    // is where Windows puts the opened key.
    let status = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            key_w.as_ptr(),
            0,
            KEY_SET_VALUE,
            &mut handle,
        )
    };
    if !opened_for_writing(status, key, name)? {
        return Ok(());
    }

    let name_w = wide(name);
    let status = match u32::try_from(data.len()) {
        // SAFETY: `handle` is the key opened above, `name_w` is null-terminated UTF-16, and
        // `data` is `size` bytes long; all outlive the call.
        Ok(size) => unsafe {
            RegSetValueExW(handle, name_w.as_ptr(), 0, REG_BINARY, data.as_ptr(), size)
        },
        Err(_) => windows_sys::Win32::Foundation::ERROR_INVALID_PARAMETER,
    };
    // SAFETY: `handle` was opened above and is closed once.
    unsafe { RegCloseKey(handle) };
    write_result(status, key, name)
}

/// What a status code of `RegOpenKeyExW` means for writing a value of that key: `Ok(true)` when
/// it is open, `Ok(false)` when the key does not exist (`ERROR_FILE_NOT_FOUND`).
#[cfg(target_os = "windows")]
fn opened_for_writing(status: u32, key: &str, name: &str) -> Result<bool, String> {
    match status {
        windows_sys::Win32::Foundation::ERROR_FILE_NOT_FOUND => Ok(false),
        _ => write_result(status, key, name).map(|()| true),
    }
}

/// What a status code of a registry write means.
#[cfg(target_os = "windows")]
fn write_result(status: u32, key: &str, name: &str) -> Result<(), String> {
    match status {
        windows_sys::Win32::Foundation::ERROR_SUCCESS => Ok(()),
        code => Err(format!(
            r"cannot write HKEY_CURRENT_USER\{key}\{name}: Windows error {code}"
        )),
    }
}

/// Removes the value `name` of `HKEY_CURRENT_USER\key` from the Windows registry.
#[cfg(target_os = "windows")]
fn remove_current_user_value(key: &str, name: &str) -> Result<(), String> {
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
fn current_user_value_exists(key: &str, name: &str) -> bool {
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
    use std::collections::BTreeMap;

    /// The value name of the app.
    pub const NAME: &str = "QuickSnippets";

    /// The exe of the tests: a portable copy in a folder whose path has spaces.
    pub const EXE: &str = r"C:\Users\Test User\Portable Apps\QuickSnippets\quick-snippets.exe";

    /// [`EXE`] as a path.
    pub fn exe() -> &'static Path {
        Path::new(EXE)
    }

    /// The kind and the data of a value.
    #[derive(Clone, Debug, PartialEq, Eq)]
    pub enum Value {
        String(String),
        Binary(Vec<u8>),
    }

    /// Which values exist, and every call the code under test made. All fields are public, so
    /// that a test can set the failures with `..MemoryRegistry::with(...)`.
    #[derive(Default)]
    pub struct MemoryRegistry {
        pub values: RefCell<BTreeMap<(String, String), Value>>,
        pub calls: RefCell<Vec<String>>,
        /// Writing or removing a value of this key fails, as with "access denied".
        pub failing_key: Option<&'static str>,
        /// This key does not exist, as Task Manager's key on a system where nothing has made it
        /// yet: a value written only into an existing key is not written there.
        pub missing_key: Option<&'static str>,
        /// No value can be read.
        pub unreadable: bool,
    }

    impl MemoryRegistry {
        /// A registry that already holds the values `values`, with data of their own.
        pub fn with(values: &[(&str, &str)]) -> Self {
            let registry = Self::default();
            for (key, name) in values {
                registry.set(key, name, Value::String(format!("there before: {key}")));
            }
            registry
        }

        pub fn set(&self, key: &str, name: &str, value: Value) {
            self.values
                .borrow_mut()
                .insert((key.to_string(), name.to_string()), value);
        }

        pub fn value(&self, key: &str, name: &str) -> Option<Value> {
            self.values
                .borrow()
                .get(&(key.to_string(), name.to_string()))
                .cloned()
        }

        pub fn has(&self, key: &str, name: &str) -> bool {
            self.value(key, name).is_some()
        }

        pub fn is_empty(&self) -> bool {
            self.values.borrow().is_empty()
        }

        pub fn calls(&self) -> Vec<String> {
            self.calls.borrow().clone()
        }

        fn log(&self, call: String) {
            self.calls.borrow_mut().push(call);
        }

        fn refuse(&self, key: &str) -> Result<(), String> {
            if self.failing_key == Some(key) {
                return Err("access denied".into());
            }
            Ok(())
        }
    }

    impl AutostartRegistry for MemoryRegistry {
        fn write_string(&self, key: &str, name: &str, data: &str) -> Result<(), String> {
            self.log(format!(r"write {key}\{name}"));
            self.refuse(key)?;
            self.set(key, name, Value::String(data.into()));
            Ok(())
        }

        fn write_binary_in_existing_key(
            &self,
            key: &str,
            name: &str,
            data: &[u8],
        ) -> Result<(), String> {
            self.log(format!(r"write {key}\{name}"));
            if self.missing_key == Some(key) {
                return Ok(());
            }
            self.refuse(key)?;
            self.set(key, name, Value::Binary(data.to_vec()));
            Ok(())
        }

        fn remove_value(&self, key: &str, name: &str) -> Result<(), String> {
            self.log(format!(r"remove {key}\{name}"));
            self.refuse(key)?;
            self.values
                .borrow_mut()
                .remove(&(key.to_string(), name.to_string()));
            Ok(())
        }

        fn value_exists(&self, key: &str, name: &str) -> bool {
            self.log(format!(r"read {key}\{name}"));
            self.unreadable || self.has(key, name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::memory::{exe, MemoryRegistry, Value, EXE, NAME};
    use super::*;

    const OTHER: &str = "SomeOtherApp";

    /// What Windows reads from the entry of [`EXE`]: the whole path, in quotes.
    const QUOTED_EXE: &str =
        r#""C:\Users\Test User\Portable Apps\QuickSnippets\quick-snippets.exe""#;

    fn write(key: &str) -> String {
        format!(r"write {key}\{NAME}")
    }

    fn remove(key: &str) -> String {
        format!(r"remove {key}\{NAME}")
    }

    #[test]
    fn the_entry_is_the_path_in_quotes_with_nothing_after_it() {
        assert_eq!(command_line(exe()), Ok(QUOTED_EXE.to_string()));
        // Also without spaces: up to 0.3.4 the plugin wrote the path and a space after it.
        assert_eq!(
            command_line(Path::new(
                r"C:\scoop\apps\quick-snippets\current\quick-snippets.exe"
            )),
            Ok(r#""C:\scoop\apps\quick-snippets\current\quick-snippets.exe""#.to_string())
        );
    }

    #[test]
    fn a_path_that_could_start_something_else_gives_no_entry() {
        assert!(command_line(Path::new("")).is_err());
        assert!(command_line(Path::new(r#"C:\a" "b\quick-snippets.exe"#)).is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn a_path_that_is_not_valid_unicode_gives_no_entry() {
        use std::os::windows::ffi::OsStringExt;
        // An unpaired surrogate: a Windows file name may hold one, UTF-8 cannot.
        let path = std::ffi::OsString::from_wide(&[0x43, 0x3A, 0x5C, 0xD800, 0x2E, 0x65]);
        assert!(command_line(Path::new(&path)).is_err());
    }

    #[test]
    fn turning_on_writes_the_quoted_path_and_the_enabled_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, exe(), false, true).unwrap();
        assert_eq!(
            registry.value(RUN_KEY, NAME),
            Some(Value::String(QUOTED_EXE.into()))
        );
        assert_eq!(
            registry.value(TASK_MANAGER_MARK_KEY, NAME),
            Some(Value::Binary(MARK_ENABLED.to_vec()))
        );
        assert_eq!(
            registry.calls(),
            vec![write(RUN_KEY), write(TASK_MANAGER_MARK_KEY)]
        );
    }

    #[test]
    fn turning_on_replaces_an_old_entry_and_a_disabled_mark() {
        // Turned on in the settings: the entry of this exe (also in place of an entry without
        // quotes, or of another copy) and "enabled", as up to 0.3.4.
        let registry = MemoryRegistry::default();
        registry.set(RUN_KEY, NAME, Value::String(format!("{EXE} ")));
        let disabled = vec![3, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8];
        registry.set(TASK_MANAGER_MARK_KEY, NAME, Value::Binary(disabled));
        apply_change(&registry, NAME, exe(), false, true).unwrap();
        assert_eq!(
            registry.value(RUN_KEY, NAME),
            Some(Value::String(QUOTED_EXE.into()))
        );
        assert_eq!(
            registry.value(TASK_MANAGER_MARK_KEY, NAME),
            Some(Value::Binary(MARK_ENABLED.to_vec()))
        );
    }

    #[test]
    fn turning_on_without_task_managers_key_writes_only_the_entry() {
        let registry = MemoryRegistry {
            missing_key: Some(TASK_MANAGER_MARK_KEY),
            ..MemoryRegistry::default()
        };
        apply_change(&registry, NAME, exe(), false, true).unwrap();
        assert_eq!(
            registry.value(RUN_KEY, NAME),
            Some(Value::String(QUOTED_EXE.into()))
        );
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_on_fails_when_the_entry_cannot_be_written() {
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::default()
        };
        let result = apply_change(&registry, NAME, exe(), false, true);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(registry.is_empty());
        assert_eq!(registry.calls(), vec![write(RUN_KEY)]);
    }

    #[test]
    fn turning_on_takes_the_entry_back_when_the_mark_cannot_be_written() {
        // An old "Disabled" that stays would keep Windows from starting the app.
        let disabled = Value::Binary(vec![3, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
        let registry = MemoryRegistry {
            failing_key: Some(TASK_MANAGER_MARK_KEY),
            ..MemoryRegistry::default()
        };
        registry.set(TASK_MANAGER_MARK_KEY, NAME, disabled.clone());
        let result = apply_change(&registry, NAME, exe(), false, true);
        assert_eq!(result, Err("access denied".to_string()));
        assert!(!registry.has(RUN_KEY, NAME));
        assert_eq!(registry.value(TASK_MANAGER_MARK_KEY, NAME), Some(disabled));
        assert_eq!(
            registry.calls(),
            vec![
                write(RUN_KEY),
                write(TASK_MANAGER_MARK_KEY),
                remove(RUN_KEY)
            ]
        );
    }

    #[test]
    fn turning_on_with_an_unusable_exe_path_writes_nothing() {
        let registry = MemoryRegistry::default();
        assert!(apply_change(&registry, NAME, Path::new(""), false, true).is_err());
        assert!(registry.calls().is_empty());
    }

    #[test]
    fn turning_off_removes_the_entry_and_the_mark() {
        let registry = MemoryRegistry::default();
        apply_change(&registry, NAME, exe(), false, true).unwrap();
        apply_change(&registry, NAME, exe(), true, false).unwrap();
        assert!(!registry.has(RUN_KEY, NAME));
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
        assert!(registry.is_empty());
    }

    #[test]
    fn turning_off_removes_an_entry_without_quotes() {
        // What 0.3.4 and older wrote: the path and a space.
        let registry = MemoryRegistry::default();
        registry.set(RUN_KEY, NAME, Value::String(format!("{EXE} ")));
        registry.set(
            TASK_MANAGER_MARK_KEY,
            NAME,
            Value::Binary(MARK_ENABLED.to_vec()),
        );
        apply_change(&registry, NAME, exe(), true, false).unwrap();
        assert!(registry.is_empty());
    }

    #[test]
    fn turning_off_removes_a_mark_left_without_its_entry() {
        // What 0.3.3 and older left behind after the setting was turned off.
        let registry = MemoryRegistry::with(&[(TASK_MANAGER_MARK_KEY, NAME)]);
        apply_change(&registry, NAME, exe(), true, false).unwrap();
        assert!(!registry.has(TASK_MANAGER_MARK_KEY, NAME));
    }

    #[test]
    fn turning_off_fails_while_the_entry_cannot_be_removed_but_removes_the_mark() {
        let registry = MemoryRegistry {
            failing_key: Some(RUN_KEY),
            ..MemoryRegistry::with(&[(RUN_KEY, NAME), (TASK_MANAGER_MARK_KEY, NAME)])
        };
        let result = apply_change(&registry, NAME, exe(), true, false);
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
        apply_change(&registry, NAME, exe(), true, false).unwrap();
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
        apply_change(&registry, NAME, exe(), true, false).unwrap();
        assert_eq!(
            registry.calls(),
            vec![
                remove(RUN_KEY),
                remove(TASK_MANAGER_MARK_KEY),
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
        assert!(apply_change(&registry, NAME, exe(), true, false).is_err());
    }

    #[test]
    fn turning_off_removes_only_the_values_of_this_name() {
        let registry = MemoryRegistry::with(&[
            (RUN_KEY, NAME),
            (TASK_MANAGER_MARK_KEY, NAME),
            (RUN_KEY, OTHER),
            (TASK_MANAGER_MARK_KEY, OTHER),
        ]);
        apply_change(&registry, NAME, exe(), true, false).unwrap();
        assert_eq!(
            registry.calls(),
            vec![remove(RUN_KEY), remove(TASK_MANAGER_MARK_KEY)]
        );
        assert!(registry.has(RUN_KEY, OTHER));
        assert!(registry.has(TASK_MANAGER_MARK_KEY, OTHER));
    }

    #[test]
    fn saving_with_the_setting_unchanged_leaves_the_registry_alone() {
        // Another copy's values, an entry without quotes from 0.3.4 or older, or a mark set to
        // "Disabled" in Task Manager: a save of other settings must not remove or rewrite them.
        let registry = MemoryRegistry::default();
        let unquoted = Value::String(format!("{EXE} "));
        let disabled = Value::Binary(vec![3, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
        registry.set(RUN_KEY, NAME, unquoted.clone());
        registry.set(TASK_MANAGER_MARK_KEY, NAME, disabled.clone());
        apply_change(&registry, NAME, exe(), true, true).unwrap();
        apply_change(&registry, NAME, exe(), false, false).unwrap();
        assert!(registry.calls().is_empty());
        assert_eq!(registry.value(RUN_KEY, NAME), Some(unquoted));
        assert_eq!(registry.value(TASK_MANAGER_MARK_KEY, NAME), Some(disabled));
    }

    #[test]
    fn the_test_registry_refuses_both_changes() {
        assert!(apply_change(&RefusingRegistry, NAME, exe(), false, true).is_err());
        let error = apply_change(&RefusingRegistry, NAME, exe(), true, false).unwrap_err();
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
        assert!(
            error.contains(r"Explorer\StartupApproved\Run\QuickSnippets"),
            "{error}"
        );
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

    #[cfg(target_os = "windows")]
    #[test]
    fn a_missing_key_is_not_written_and_other_errors_name_the_value() {
        use windows_sys::Win32::Foundation::{
            ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_SUCCESS,
        };
        assert_eq!(
            opened_for_writing(ERROR_SUCCESS, TASK_MANAGER_MARK_KEY, NAME),
            Ok(true)
        );
        assert_eq!(
            opened_for_writing(ERROR_FILE_NOT_FOUND, TASK_MANAGER_MARK_KEY, NAME),
            Ok(false)
        );
        let error =
            opened_for_writing(ERROR_ACCESS_DENIED, TASK_MANAGER_MARK_KEY, NAME).unwrap_err();
        assert!(
            error.contains(r"cannot write HKEY_CURRENT_USER\Software"),
            "{error}"
        );
        assert!(
            error.contains(r"StartupApproved\Run\QuickSnippets"),
            "{error}"
        );
        assert!(error.contains("Windows error 5"), "{error}");
        assert!(write_result(ERROR_SUCCESS, RUN_KEY, NAME).is_ok());
    }
}
