// Auto-type: simulate keyboard input by posting WM_CHAR messages directly to
// the focused window. This bypasses keyboard hooks (including screen reader
// hooks like NVDA's WH_KEYBOARD_LL) that can intercept and consume
// KEYEVENTF_UNICODE events sent via SendInput.
//
// Fallback: if the focused window cannot be determined, we fall back to
// SendInput with KEYEVENTF_UNICODE (layout-independent, but subject to
// screen reader interference).
//
// Control characters (\n, \r, \t) are sent as virtual key presses.
// This module is Windows-only.

#[cfg(target_os = "windows")]
pub mod win {
    use std::io;
    use std::mem::size_of;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetFocus, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, VK_RETURN, VK_TAB,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, PostMessageW, WM_CHAR, WM_KEYDOWN,
        WM_KEYUP,
    };

    /// Delay between keydown and keyup for a single key press (SendInput fallback).
    const KEY_PRESS_DELAY_MS: u64 = 5;

    /// Delay between characters for screen reader (NVDA/JAWS) compatibility.
    const INTER_CHAR_DELAY_MS: u64 = 50;

    /// Type of key event — used in test output to distinguish Unicode vs VK events.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    #[cfg_attr(test, derive())]
    pub enum KeyEventKind {
        /// KEYEVENTF_UNICODE with wScan = UTF-16 code unit
        Unicode,
        /// Virtual key press (VK_RETURN, VK_TAB, etc.)
        VirtualKey,
    }

    // ════════════════════════════════════════════════════════════════════════
    // PostMessage approach — primary (bypasses keyboard hooks entirely)
    // ════════════════════════════════════════════════════════════════════════

    /// Get the focused window handle in the foreground application.
    /// Returns the innermost focused control, or the foreground window itself.
    fn get_focused_window() -> Result<isize, String> {
        unsafe {
            let foreground = GetForegroundWindow();
            if foreground == 0 {
                return Err("No foreground window found".to_string());
            }

            let target_thread =
                GetWindowThreadProcessId(foreground, std::ptr::null_mut());
            let our_thread = GetCurrentThreadId();

            if target_thread == 0 {
                return Ok(foreground);
            }

            // Attach to the target thread so GetFocus() returns its focused window.
            let attached =
                AttachThreadInput(our_thread, target_thread, 1); // TRUE = attach
            let focus = if attached != 0 { GetFocus() } else { 0 };
            if attached != 0 {
                AttachThreadInput(our_thread, target_thread, 0); // detach
            }

            Ok(if focus != 0 { focus } else { foreground })
        }
    }

    /// Post a WM_CHAR message for one UTF-16 code unit.
    fn post_wm_char(hwnd: isize, code_unit: u16) -> Result<(), String> {
        let ret = unsafe { PostMessageW(hwnd, WM_CHAR, code_unit as usize, 1) };
        if ret == 0 {
            let err = io::Error::last_os_error();
            return Err(format!("PostMessageW(WM_CHAR) failed: {}", err));
        }
        Ok(())
    }

    /// Post WM_KEYDOWN + WM_KEYUP for a virtual key (Enter, Tab).
    fn post_vk_key(hwnd: isize, vk: u16, scan_code: u32) -> Result<(), String> {
        // lParam layout: bits 0-15 = repeat count, bits 16-23 = scan code
        let down_lparam: isize = 1 | ((scan_code as isize) << 16);
        // keyup: bit 30 = previous key state (1), bit 31 = transition (1)
        let up_lparam: isize = down_lparam | (1 << 30) | (1 << 31);

        let ret = unsafe { PostMessageW(hwnd, WM_KEYDOWN, vk as usize, down_lparam) };
        if ret == 0 {
            let err = io::Error::last_os_error();
            return Err(format!("PostMessageW(WM_KEYDOWN) failed: {}", err));
        }
        let ret = unsafe { PostMessageW(hwnd, WM_KEYUP, vk as usize, up_lparam) };
        if ret == 0 {
            let err = io::Error::last_os_error();
            return Err(format!("PostMessageW(WM_KEYUP) failed: {}", err));
        }
        Ok(())
    }

    /// Send text by posting WM_CHAR messages directly to the focused window.
    /// Bypasses all keyboard hooks (NVDA, JAWS, keyloggers, etc.).
    ///
    /// `char_delay_ms = 0` means no delay: PostMessage places messages into the
    /// target window's FIFO queue (capacity ~10 000). A non-zero value adds a
    /// sleep between characters for apps whose message loops can't keep up.
    fn send_text_via_messages(
        hwnd: isize,
        text: &str,
        char_delay_ms: u64,
    ) -> Result<(), String> {
        let delay = if char_delay_ms > 0 {
            Some(Duration::from_millis(char_delay_ms))
        } else {
            None
        };

        let mut chars = text.chars().peekable();
        while let Some(ch) = chars.next() {
            match ch {
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    post_vk_key(hwnd, VK_RETURN, 0x1C)?; // scan code 0x1C = Enter
                }
                '\n' => {
                    post_vk_key(hwnd, VK_RETURN, 0x1C)?;
                }
                '\t' => {
                    post_vk_key(hwnd, VK_TAB, 0x0F)?; // scan code 0x0F = Tab
                }
                other => {
                    let mut buf = [0u16; 2];
                    for &code_unit in other.encode_utf16(&mut buf).iter() {
                        post_wm_char(hwnd, code_unit)?;
                    }
                }
            }
            if let Some(d) = delay {
                thread::sleep(d);
            }
        }
        Ok(())
    }

    // ════════════════════════════════════════════════════════════════════════
    // SendInput approach — fallback (layout-independent but hook-visible)
    // ════════════════════════════════════════════════════════════════════════

    fn make_unicode_input(code_unit: u16, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: code_unit,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    fn make_vk_input(vk: u16, flags: u32) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    fn send_single_input(input: &INPUT) -> Result<(), String> {
        let sent =
            unsafe { SendInput(1, input as *const INPUT, size_of::<INPUT>() as i32) };
        if sent == 0 {
            let last_err = io::Error::last_os_error();
            eprintln!("SendInput returned 0. GetLastError: {}", last_err);
            return Err(
                "Auto-type failed: no events were sent. \
                 This may happen if the target app runs with higher privileges \
                 (run as administrator)."
                    .to_string(),
            );
        }
        Ok(())
    }

    fn send_vk_key_input(vk: u16, press_delay: Duration) -> Result<(), String> {
        let down = make_vk_input(vk, 0);
        let up = make_vk_input(vk, KEYEVENTF_KEYUP);
        send_single_input(&down)?;
        thread::sleep(press_delay);
        send_single_input(&up)?;
        Ok(())
    }

    fn send_unicode_key_input(
        code_unit: u16,
        press_delay: Duration,
    ) -> Result<(), String> {
        let down = make_unicode_input(code_unit, KEYEVENTF_UNICODE);
        let up =
            make_unicode_input(code_unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        send_single_input(&down)?;
        thread::sleep(press_delay);
        send_single_input(&up)?;
        Ok(())
    }

    /// Fallback: send text via SendInput with KEYEVENTF_UNICODE.
    /// Enforces a minimum 50ms inter-character delay for screen reader compatibility.
    fn send_text_via_sendinput(text: &str, char_delay_ms: u64) -> Result<(), String> {
        let press_delay = Duration::from_millis(KEY_PRESS_DELAY_MS);
        let char_delay =
            Duration::from_millis(std::cmp::max(char_delay_ms, INTER_CHAR_DELAY_MS));

        let mut chars = text.chars().peekable();
        while let Some(ch) = chars.next() {
            match ch {
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    send_vk_key_input(VK_RETURN, press_delay)?;
                }
                '\n' => {
                    send_vk_key_input(VK_RETURN, press_delay)?;
                }
                '\t' => {
                    send_vk_key_input(VK_TAB, press_delay)?;
                }
                other => {
                    let mut buf = [0u16; 2];
                    for code_unit in other.encode_utf16(&mut buf).iter() {
                        send_unicode_key_input(*code_unit, press_delay)?;
                    }
                }
            }
            thread::sleep(char_delay);
        }
        Ok(())
    }

    // ════════════════════════════════════════════════════════════════════════
    // Public API
    // ════════════════════════════════════════════════════════════════════════

    /// Send a Unicode string by simulating keyboard input.
    ///
    /// Primary method: posts `WM_CHAR` messages directly to the focused window,
    /// bypassing keyboard hooks. This avoids interference from screen readers
    /// (NVDA, JAWS) whose `WH_KEYBOARD_LL` hooks can consume `SendInput`
    /// events — e.g., NVDA in browse mode intercepts letters like `e`, `t`, `h`
    /// as single-letter navigation keys.
    ///
    /// Fallback: if the focused window cannot be determined, uses `SendInput`
    /// with `KEYEVENTF_UNICODE` (layout-independent but hook-visible).
    pub fn send_unicode_text(text: &str, char_delay_ms: u64) -> Result<(), String> {
        // Primary: PostMessage (bypasses screen reader hooks)
        match get_focused_window() {
            Ok(target) if target != 0 => {
                return send_text_via_messages(target, text, char_delay_ms);
            }
            _ => {}
        }
        // Fallback: SendInput
        send_text_via_sendinput(text, char_delay_ms)
    }

    // ════════════════════════════════════════════════════════════════════════
    // Test helpers
    // ════════════════════════════════════════════════════════════════════════

    /// Describes a single key event produced by `build_input_sequence`.
    #[cfg(test)]
    #[derive(Debug, PartialEq, Eq)]
    pub struct KeyEvent {
        pub kind: KeyEventKind,
        /// For Unicode: UTF-16 code unit. For VK: virtual key code.
        pub code: u16,
        pub down_flags: u32,
        pub up_flags: u32,
    }

    /// Build a sequence of key events for testing (no SendInput calls).
    /// Returns one KeyEvent per logical key press (control chars or Unicode code units).
    #[cfg(test)]
    pub fn build_input_sequence(text: &str) -> Vec<KeyEvent> {
        let mut result = Vec::new();
        let mut chars = text.chars().peekable();
        while let Some(ch) = chars.next() {
            match ch {
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    result.push(KeyEvent {
                        kind: KeyEventKind::VirtualKey,
                        code: VK_RETURN,
                        down_flags: 0,
                        up_flags: KEYEVENTF_KEYUP,
                    });
                }
                '\n' => {
                    result.push(KeyEvent {
                        kind: KeyEventKind::VirtualKey,
                        code: VK_RETURN,
                        down_flags: 0,
                        up_flags: KEYEVENTF_KEYUP,
                    });
                }
                '\t' => {
                    result.push(KeyEvent {
                        kind: KeyEventKind::VirtualKey,
                        code: VK_TAB,
                        down_flags: 0,
                        up_flags: KEYEVENTF_KEYUP,
                    });
                }
                other => {
                    let mut buf = [0u16; 2];
                    for code_unit in other.encode_utf16(&mut buf).iter() {
                        result.push(KeyEvent {
                            kind: KeyEventKind::Unicode,
                            code: *code_unit,
                            down_flags: KEYEVENTF_UNICODE,
                            up_flags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        });
                    }
                }
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::win::*;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, VK_RETURN, VK_TAB,
    };

    // ── Unicode character tests ──────────────────────────────────────────

    #[test]
    fn test_ascii_inputs() {
        let seq = build_input_sequence("Hi");
        assert_eq!(seq.len(), 2);
        assert_eq!(seq[0].kind, KeyEventKind::Unicode);
        assert_eq!(seq[0].code, 0x0048); // 'H'
        assert_eq!(seq[0].down_flags, KEYEVENTF_UNICODE);
        assert_eq!(seq[0].up_flags, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        assert_eq!(seq[1].code, 0x0069); // 'i'
    }

    #[test]
    fn test_cyrillic_inputs() {
        let seq = build_input_sequence("Привіт");
        assert_eq!(seq.len(), 6);
        assert_eq!(seq[0].code, 0x041F); // 'П'
        assert_eq!(seq[1].code, 0x0440); // 'р'
        for ev in &seq {
            assert_eq!(ev.kind, KeyEventKind::Unicode);
            assert_eq!(ev.down_flags, KEYEVENTF_UNICODE);
            assert_eq!(ev.up_flags, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        }
    }

    #[test]
    fn test_emoji_surrogate_pair() {
        let seq = build_input_sequence("😀");
        assert_eq!(seq.len(), 2); // surrogate pair
        assert_eq!(seq[0].kind, KeyEventKind::Unicode);
        assert_eq!(seq[0].code, 0xD83D); // high surrogate
        assert_eq!(seq[1].code, 0xDE00); // low surrogate
    }

    #[test]
    fn test_mixed_text() {
        let seq = build_input_sequence("A Б 😀");
        assert_eq!(seq.len(), 6);
        assert_eq!(seq[0].code, 0x0041); // 'A'
        assert_eq!(seq[1].code, 0x0020); // ' '
        assert_eq!(seq[2].code, 0x0411); // 'Б'
        assert_eq!(seq[3].code, 0x0020); // ' '
        assert_eq!(seq[4].code, 0xD83D); // 😀 high
        assert_eq!(seq[5].code, 0xDE00); // 😀 low
    }

    #[test]
    fn test_empty_string() {
        let seq = build_input_sequence("");
        assert!(seq.is_empty());
    }

    // ── Control character tests ──────────────────────────────────────────

    #[test]
    fn test_newline_produces_vk_return() {
        let seq = build_input_sequence("\n");
        assert_eq!(seq.len(), 1);
        assert_eq!(seq[0].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[0].code, VK_RETURN);
        assert_eq!(seq[0].down_flags, 0); // no KEYEVENTF_UNICODE
        assert_eq!(seq[0].up_flags, KEYEVENTF_KEYUP);
    }

    #[test]
    fn test_cr_produces_vk_return() {
        let seq = build_input_sequence("\r");
        assert_eq!(seq.len(), 1);
        assert_eq!(seq[0].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[0].code, VK_RETURN);
    }

    #[test]
    fn test_crlf_produces_single_vk_return() {
        let seq = build_input_sequence("\r\n");
        assert_eq!(seq.len(), 1); // \r\n → single Enter, not two
        assert_eq!(seq[0].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[0].code, VK_RETURN);
    }

    #[test]
    fn test_tab_produces_vk_tab() {
        let seq = build_input_sequence("\t");
        assert_eq!(seq.len(), 1);
        assert_eq!(seq[0].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[0].code, VK_TAB);
        assert_eq!(seq[0].down_flags, 0);
        assert_eq!(seq[0].up_flags, KEYEVENTF_KEYUP);
    }

    #[test]
    fn test_multiline_text() {
        // "A\nB\r\nC" → A(unicode) + Enter(VK) + B(unicode) + Enter(VK) + C(unicode)
        let seq = build_input_sequence("A\nB\r\nC");
        assert_eq!(seq.len(), 5);
        assert_eq!(seq[0].kind, KeyEventKind::Unicode);
        assert_eq!(seq[0].code, 0x0041); // 'A'
        assert_eq!(seq[1].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[1].code, VK_RETURN); // \n
        assert_eq!(seq[2].kind, KeyEventKind::Unicode);
        assert_eq!(seq[2].code, 0x0042); // 'B'
        assert_eq!(seq[3].kind, KeyEventKind::VirtualKey);
        assert_eq!(seq[3].code, VK_RETURN); // \r\n → single Enter
        assert_eq!(seq[4].kind, KeyEventKind::Unicode);
        assert_eq!(seq[4].code, 0x0043); // 'C'
    }

    #[test]
    fn test_multiple_newlines() {
        let seq = build_input_sequence("\n\n\n");
        assert_eq!(seq.len(), 3);
        for ev in &seq {
            assert_eq!(ev.kind, KeyEventKind::VirtualKey);
            assert_eq!(ev.code, VK_RETURN);
        }
    }

    #[test]
    fn test_mixed_control_and_unicode() {
        let seq = build_input_sequence("Hi\tworld\n");
        assert_eq!(seq.len(), 9); // H, i, TAB, w, o, r, l, d, ENTER
        assert_eq!(seq[0].kind, KeyEventKind::Unicode); // 'H'
        assert_eq!(seq[1].kind, KeyEventKind::Unicode); // 'i'
        assert_eq!(seq[2].kind, KeyEventKind::VirtualKey); // TAB
        assert_eq!(seq[2].code, VK_TAB);
        assert_eq!(seq[3].kind, KeyEventKind::Unicode); // 'w'
        assert_eq!(seq[8].kind, KeyEventKind::VirtualKey); // ENTER
        assert_eq!(seq[8].code, VK_RETURN);
    }
}
