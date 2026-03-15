// Auto-type: simulate keyboard input via Win32 SendInput with KEYEVENTF_UNICODE.
// Control characters (\n, \r, \t) are sent as virtual key presses (VK_RETURN, VK_TAB).
// This module is Windows-only.

#[cfg(target_os = "windows")]
pub mod win {
    use std::io;
    use std::mem::size_of;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE, VK_RETURN, VK_TAB,
    };

    /// Delay between keydown and keyup for a single key press.
    /// Gives NVDA's WH_KEYBOARD_LL hook time to process each event.
    const KEY_PRESS_DELAY_MS: u64 = 5;

    /// Delay between characters for screen reader (NVDA/JAWS) compatibility.
    /// 50ms is sufficient for NVDA with "speak typed characters" enabled.
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

    // ── INPUT builders ───────────────────────────────────────────────────

    /// Build a single INPUT struct for a KEYEVENTF_UNICODE event.
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

    /// Build a single INPUT struct for a virtual key event (VK_RETURN, VK_TAB, etc.).
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

    // ── Single-event sender ──────────────────────────────────────────────

    /// Send a single INPUT event via SendInput. Returns Err on UIPI/failure.
    fn send_single_input(input: &INPUT) -> Result<(), String> {
        let sent = unsafe { SendInput(1, input as *const INPUT, size_of::<INPUT>() as i32) };
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

    // ── Key press helpers (keydown → delay → keyup) ──────────────────────

    /// Send a virtual key press (keydown → delay → keyup).
    fn send_vk_key(vk: u16, press_delay: Duration) -> Result<(), String> {
        let down = make_vk_input(vk, 0);
        let up = make_vk_input(vk, KEYEVENTF_KEYUP);
        send_single_input(&down)?;
        thread::sleep(press_delay);
        send_single_input(&up)?;
        Ok(())
    }

    /// Send a KEYEVENTF_UNICODE key press for one UTF-16 code unit (keydown → delay → keyup).
    fn send_unicode_key(code_unit: u16, press_delay: Duration) -> Result<(), String> {
        let down = make_unicode_input(code_unit, KEYEVENTF_UNICODE);
        let up = make_unicode_input(code_unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        send_single_input(&down)?;
        thread::sleep(press_delay);
        send_single_input(&up)?;
        Ok(())
    }

    // ── Public API ───────────────────────────────────────────────────────

    /// Send a Unicode string by simulating keyboard input.
    ///
    /// - Control characters (`\r`, `\n`, `\r\n`, `\t`) → virtual key presses
    ///   (VK_RETURN, VK_TAB) because KEYEVENTF_UNICODE with raw LF/CR is not
    ///   interpreted as Enter by Windows text controls.
    /// - All other characters → KEYEVENTF_UNICODE per UTF-16 code unit.
    /// - Surrogate pairs (emoji) are handled via `char::encode_utf16()`.
    /// - Keydown and keyup are sent as **separate** SendInput calls with a
    ///   small delay between them, to avoid character drops when NVDA's
    ///   WH_KEYBOARD_LL hook is active.
    pub fn send_unicode_text(text: &str) -> Result<(), String> {
        let press_delay = Duration::from_millis(KEY_PRESS_DELAY_MS);
        let char_delay = Duration::from_millis(INTER_CHAR_DELAY_MS);

        let mut chars = text.chars().peekable();
        while let Some(ch) = chars.next() {
            match ch {
                '\r' => {
                    // \r\n → single Enter; standalone \r → Enter
                    if chars.peek() == Some(&'\n') {
                        chars.next(); // consume the \n
                    }
                    send_vk_key(VK_RETURN, press_delay)?;
                }
                '\n' => {
                    send_vk_key(VK_RETURN, press_delay)?;
                }
                '\t' => {
                    send_vk_key(VK_TAB, press_delay)?;
                }
                other => {
                    let mut buf = [0u16; 2];
                    for code_unit in other.encode_utf16(&mut buf).iter() {
                        send_unicode_key(*code_unit, press_delay)?;
                    }
                }
            }
            thread::sleep(char_delay);
        }
        Ok(())
    }

    // ── Test helpers ─────────────────────────────────────────────────────

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
        assert_eq!(seq.len(), 10); // H, i, TAB, w, o, r, l, d, ENTER
        assert_eq!(seq[0].kind, KeyEventKind::Unicode); // 'H'
        assert_eq!(seq[1].kind, KeyEventKind::Unicode); // 'i'
        assert_eq!(seq[2].kind, KeyEventKind::VirtualKey); // TAB
        assert_eq!(seq[2].code, VK_TAB);
        assert_eq!(seq[3].kind, KeyEventKind::Unicode); // 'w'
        assert_eq!(seq[9].kind, KeyEventKind::VirtualKey); // ENTER
        assert_eq!(seq[9].code, VK_RETURN);
    }
}
