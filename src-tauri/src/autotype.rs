// Auto-type: simulate keyboard input via Win32 SendInput with KEYEVENTF_UNICODE.
// This module is Windows-only.

#[cfg(target_os = "windows")]
pub mod win {
    use std::io;
    use std::thread;
    use std::time::Duration;

    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        KEYEVENTF_UNICODE,
    };

    /// Delay between characters for screen reader (NVDA/JAWS) compatibility.
    const INTER_CHAR_DELAY_MS: u64 = 25;

    /// Build a pair of INPUT structs (keydown + keyup) for one UTF-16 code unit.
    fn make_unicode_key_pair(code_unit: u16) -> [INPUT; 2] {
        let base = KEYBDINPUT {
            wVk: 0,
            wScan: code_unit,
            dwFlags: KEYEVENTF_UNICODE,
            time: 0,
            dwExtraInfo: 0,
        };
        let keydown = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki: base },
        };
        let keyup = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    ..base
                },
            },
        };
        [keydown, keyup]
    }

    /// Send a Unicode string by simulating keyboard input.
    ///
    /// Each UTF-16 code unit is sent as a separate `SendInput` call with
    /// `KEYEVENTF_UNICODE` (keydown + keyup), followed by an inter-character
    /// delay for screen reader compatibility.
    ///
    /// Surrogate pairs (emoji, supplementary characters) are handled automatically
    /// by iterating `str::encode_utf16()`.
    pub fn send_unicode_text(text: &str) -> Result<(), String> {
        let delay = Duration::from_millis(INTER_CHAR_DELAY_MS);

        for code_unit in text.encode_utf16() {
            let inputs = make_unicode_key_pair(code_unit);
            let sent = unsafe {
                SendInput(
                    inputs.len() as u32,
                    inputs.as_ptr(),
                    std::mem::size_of::<INPUT>() as i32,
                )
            };
            if sent == 0 {
                // UIPI or other failure — SendInput returned 0 events sent.
                // GetLastError is logged as diagnostic but is NOT reliable for
                // determining UIPI as the cause (per Microsoft docs).
                let last_err = io::Error::last_os_error();
                eprintln!(
                    "SendInput returned 0 for code unit U+{:04X}. GetLastError: {}",
                    code_unit, last_err
                );
                return Err(
                    "Auto-type failed: no events were sent. \
                     This may happen if the target app runs with higher privileges \
                     (run as administrator)."
                        .to_string(),
                );
            }
            thread::sleep(delay);
        }
        Ok(())
    }

    /// Build INPUT structs for testing purposes (no SendInput call).
    /// Returns a Vec of (code_unit, keydown_flags, keyup_flags) tuples.
    #[cfg(test)]
    pub fn build_input_pairs(text: &str) -> Vec<(u16, u32, u32)> {
        text.encode_utf16()
            .map(|cu| {
                let pair = make_unicode_key_pair(cu);
                let down_flags = unsafe { pair[0].Anonymous.ki.dwFlags };
                let up_flags = unsafe { pair[1].Anonymous.ki.dwFlags };
                (cu, down_flags, up_flags)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::win::*;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{KEYEVENTF_KEYUP, KEYEVENTF_UNICODE};

    #[test]
    fn test_ascii_inputs() {
        let pairs = build_input_pairs("Hi");
        assert_eq!(pairs.len(), 2);
        // 'H' = 0x0048
        assert_eq!(pairs[0].0, 0x0048);
        assert_eq!(pairs[0].1, KEYEVENTF_UNICODE); // keydown
        assert_eq!(pairs[0].2, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP); // keyup
        // 'i' = 0x0069
        assert_eq!(pairs[1].0, 0x0069);
    }

    #[test]
    fn test_cyrillic_inputs() {
        // "Привіт" — Ukrainian Cyrillic (BMP, one code unit per char)
        let pairs = build_input_pairs("Привіт");
        assert_eq!(pairs.len(), 6);
        // 'П' = U+041F
        assert_eq!(pairs[0].0, 0x041F);
        // 'р' = U+0440
        assert_eq!(pairs[1].0, 0x0440);
        // All should have KEYEVENTF_UNICODE
        for (_, down, up) in &pairs {
            assert_eq!(*down, KEYEVENTF_UNICODE);
            assert_eq!(*up, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP);
        }
    }

    #[test]
    fn test_emoji_surrogate_pair() {
        // 😀 U+1F600 → UTF-16 surrogate pair: high=0xD83D, low=0xDE00
        let pairs = build_input_pairs("😀");
        assert_eq!(pairs.len(), 2); // two code units (surrogate pair)
        assert_eq!(pairs[0].0, 0xD83D); // high surrogate
        assert_eq!(pairs[1].0, 0xDE00); // low surrogate
    }

    #[test]
    fn test_mixed_text() {
        // "A Б 😀" — ASCII + Cyrillic + space + emoji
        let pairs = build_input_pairs("A Б 😀");
        // A(1) + space(1) + Б(1) + space(1) + 😀(2) = 6
        assert_eq!(pairs.len(), 6);
        assert_eq!(pairs[0].0, 0x0041); // 'A'
        assert_eq!(pairs[1].0, 0x0020); // ' '
        assert_eq!(pairs[2].0, 0x0411); // 'Б'
        assert_eq!(pairs[3].0, 0x0020); // ' '
        assert_eq!(pairs[4].0, 0xD83D); // 😀 high
        assert_eq!(pairs[5].0, 0xDE00); // 😀 low
    }

    #[test]
    fn test_empty_string() {
        let pairs = build_input_pairs("");
        assert!(pairs.is_empty());
    }

    #[test]
    fn test_newline_and_tab() {
        let pairs = build_input_pairs("\n\t");
        assert_eq!(pairs.len(), 2);
        assert_eq!(pairs[0].0, 0x000A); // LF
        assert_eq!(pairs[1].0, 0x0009); // TAB
    }
}
