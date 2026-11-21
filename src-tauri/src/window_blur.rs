// What to do after the web content loses the keyboard.
//
// On Windows, Tauri reports `Focused(false)` when the WebView2 control loses focus. That
// happens when the user switches to another window, and the window then hides. It also
// happens when the keyboard only moves to another part of this window: an action performed
// through an accessibility interface (UI Automation Invoke or Toggle, used by assistive and
// automation tools) makes WebView2 move it between its internal windows, and now and then
// it does not come back. Hiding then would hide the active window together with an open
// dialog and its unsaved changes. So the window hides only once it is no longer the active
// window; while it is still active, the keyboard is given back to the web content.
//
// Both happen only after the same delay: nothing is done before the moment the window used
// to hide. WebView2 moves the keyboard between its internal windows by itself (when the app
// starts, when the window is shown, during such an action) and settles within that delay.

/// The window hides this long after it stopped being the active window. An active window
/// gets the keyboard back this long after its web content lost it.
pub const HIDE_DELAY_MS: u64 = 200;
/// Pause between two attempts to give the keyboard back.
pub const RESTORE_RETRY_MS: u64 = 100;
/// After this many attempts the window is only watched until the user leaves it.
pub const MAX_RESTORE_ATTEMPTS: u32 = 5;
/// How often the state is checked while the web content is without the keyboard.
pub const POLL_MS: u64 = 10;
/// The same, once that has lasted longer than `SLOW_POLL_AFTER_MS` (an open menu).
pub const SLOW_POLL_MS: u64 = 100;
pub const SLOW_POLL_AFTER_MS: u64 = 1000;

/// What is known at one check after the web content lost the keyboard.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlurState {
    /// Time since the web content lost the keyboard.
    pub since_blur_ms: u64,
    /// For how long the app window has not been the active window; `None` while it is active.
    pub inactive_ms: Option<u64>,
    /// The keyboard is in a window that is not part of the app window (an owned popup).
    pub keyboard_elsewhere: bool,
    /// A menu of the window is open, or the window is being moved or resized.
    pub menu_or_move: bool,
    /// False while the exit confirmation is showing: the window must stay.
    pub hide_allowed: bool,
    /// How many times the keyboard has been given back to the web content.
    pub restore_attempts: u32,
    /// Time since the last such attempt.
    pub since_restore_ms: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlurStep {
    /// Check again a moment later.
    Wait,
    /// The window is still active: give the keyboard back to the web content.
    RestoreFocus,
    /// The user left the window: hide it and stop watching.
    Hide,
    /// The user left the window, but it must stay: stop watching.
    Stop,
}

pub fn next_blur_step(state: BlurState) -> BlurStep {
    match state.inactive_ms {
        Some(ms) if ms < HIDE_DELAY_MS => BlurStep::Wait,
        Some(_) if state.hide_allowed => BlurStep::Hide,
        Some(_) => BlurStep::Stop,
        None => {
            if state.menu_or_move
                || state.keyboard_elsewhere
                || state.since_blur_ms < HIDE_DELAY_MS
                || state.restore_attempts >= MAX_RESTORE_ATTEMPTS
            {
                return BlurStep::Wait;
            }
            match state.since_restore_ms {
                Some(ms) if ms < RESTORE_RETRY_MS => BlurStep::Wait,
                _ => BlurStep::RestoreFocus,
            }
        }
    }
}

/// How long to sleep before the next check.
pub fn poll_interval_ms(since_blur_ms: u64) -> u64 {
    if since_blur_ms >= SLOW_POLL_AFTER_MS {
        SLOW_POLL_MS
    } else {
        POLL_MS
    }
}

/// Where the app window and the keyboard are right now.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowProbe {
    /// The app window is visible and is the foreground window.
    pub active: bool,
    pub keyboard_elsewhere: bool,
    pub menu_or_move: bool,
}

#[cfg(target_os = "windows")]
pub fn probe_window(hwnd: isize) -> WindowProbe {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetGUIThreadInfo, IsChild, IsWindowVisible, GUITHREADINFO,
        GUI_INMENUMODE, GUI_INMOVESIZE, GUI_POPUPMENUMODE, GUI_SYSTEMMENUMODE,
    };

    let mut probe = WindowProbe {
        active: false,
        keyboard_elsewhere: false,
        menu_or_move: false,
    };
    if hwnd == 0 {
        return probe;
    }
    unsafe {
        probe.active = IsWindowVisible(hwnd) != 0 && GetForegroundWindow() == hwnd;
        if !probe.active {
            return probe;
        }
        // Thread 0 is the thread of the foreground window: this window's own thread here.
        let mut info: GUITHREADINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(0, &mut info) != 0 {
            let focus = info.hwndFocus;
            probe.keyboard_elsewhere = focus != 0 && focus != hwnd && IsChild(hwnd, focus) == 0;
            let modal = GUI_INMENUMODE | GUI_INMOVESIZE | GUI_POPUPMENUMODE | GUI_SYSTEMMENUMODE;
            probe.menu_or_move = (info.flags & modal) != 0;
        }
    }
    probe
}

/// Without the Windows calls the window is treated as left: it hides after the delay.
#[cfg(not(target_os = "windows"))]
pub fn probe_window(_hwnd: isize) -> WindowProbe {
    WindowProbe {
        active: false,
        keyboard_elsewhere: false,
        menu_or_move: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The web content lost the keyboard `since_blur_ms` ago and the window is still active.
    fn active(since_blur_ms: u64) -> BlurState {
        BlurState {
            since_blur_ms,
            inactive_ms: None,
            keyboard_elsewhere: false,
            menu_or_move: false,
            hide_allowed: true,
            restore_attempts: 0,
            since_restore_ms: None,
        }
    }

    /// The user switched to another window `inactive_ms` ago.
    fn left(inactive_ms: u64) -> BlurState {
        BlurState {
            inactive_ms: Some(inactive_ms),
            ..active(inactive_ms)
        }
    }

    // === The user left the window ===

    #[test]
    fn test_left_window_waits_for_the_hide_delay() {
        assert_eq!(next_blur_step(left(0)), BlurStep::Wait);
        assert_eq!(next_blur_step(left(HIDE_DELAY_MS - 1)), BlurStep::Wait);
    }

    #[test]
    fn test_left_window_hides_after_the_hide_delay() {
        assert_eq!(next_blur_step(left(HIDE_DELAY_MS)), BlurStep::Hide);
        assert_eq!(next_blur_step(left(HIDE_DELAY_MS + 500)), BlurStep::Hide);
    }

    #[test]
    fn test_left_window_stays_while_exit_confirmation_is_showing() {
        let state = BlurState {
            hide_allowed: false,
            ..left(HIDE_DELAY_MS)
        };
        assert_eq!(next_blur_step(state), BlurStep::Stop);
    }

    #[test]
    fn test_hide_delay_counts_from_leaving_not_from_the_blur() {
        // The keyboard sat on another part of the window for a second, then the user left.
        let state = BlurState {
            since_blur_ms: 1000,
            inactive_ms: Some(50),
            restore_attempts: MAX_RESTORE_ATTEMPTS,
            ..active(1000)
        };
        assert_eq!(next_blur_step(state), BlurStep::Wait);
    }

    // === The window is still the active window ===

    #[test]
    fn test_active_window_never_hides() {
        for since_blur_ms in [0, HIDE_DELAY_MS, 10 * HIDE_DELAY_MS, 60_000] {
            let state = BlurState {
                restore_attempts: MAX_RESTORE_ATTEMPTS,
                ..active(since_blur_ms)
            };
            assert_eq!(
                next_blur_step(state),
                BlurStep::Wait,
                "after {since_blur_ms} ms"
            );
        }
    }

    #[test]
    fn test_active_window_lets_webview_take_the_keyboard_back_first() {
        // Nothing happens before the moment the window used to hide.
        for since_blur_ms in [0, 30, HIDE_DELAY_MS - 1] {
            assert_eq!(
                next_blur_step(active(since_blur_ms)),
                BlurStep::Wait,
                "after {since_blur_ms} ms"
            );
        }
    }

    #[test]
    fn test_active_window_gets_the_keyboard_back() {
        assert_eq!(
            next_blur_step(active(HIDE_DELAY_MS)),
            BlurStep::RestoreFocus
        );
    }

    #[test]
    fn test_restore_is_repeated_only_after_a_pause() {
        let just_tried = BlurState {
            restore_attempts: 1,
            since_restore_ms: Some(RESTORE_RETRY_MS - 1),
            ..active(HIDE_DELAY_MS + 50)
        };
        assert_eq!(next_blur_step(just_tried), BlurStep::Wait);

        let tried_a_while_ago = BlurState {
            since_restore_ms: Some(RESTORE_RETRY_MS),
            ..just_tried
        };
        assert_eq!(next_blur_step(tried_a_while_ago), BlurStep::RestoreFocus);
    }

    #[test]
    fn test_restore_stops_after_the_last_attempt() {
        let state = BlurState {
            restore_attempts: MAX_RESTORE_ATTEMPTS,
            since_restore_ms: Some(10 * RESTORE_RETRY_MS),
            ..active(2000)
        };
        assert_eq!(next_blur_step(state), BlurStep::Wait);
    }

    #[test]
    fn test_open_menu_or_move_is_left_alone() {
        let state = BlurState {
            menu_or_move: true,
            ..active(5000)
        };
        assert_eq!(next_blur_step(state), BlurStep::Wait);
    }

    #[test]
    fn test_keyboard_in_an_owned_popup_is_left_alone() {
        let state = BlurState {
            keyboard_elsewhere: true,
            ..active(5000)
        };
        assert_eq!(next_blur_step(state), BlurStep::Wait);
    }

    // === Polling ===

    #[test]
    fn test_poll_interval_slows_down_after_a_while() {
        assert_eq!(poll_interval_ms(0), POLL_MS);
        assert_eq!(poll_interval_ms(SLOW_POLL_AFTER_MS - 1), POLL_MS);
        assert_eq!(poll_interval_ms(SLOW_POLL_AFTER_MS), SLOW_POLL_MS);
    }

    // === Probe ===

    #[test]
    fn test_probe_without_a_window_is_not_active() {
        let probe = probe_window(0);
        assert!(!probe.active);
        assert!(!probe.keyboard_elsewhere);
        assert!(!probe.menu_or_move);
    }
}
