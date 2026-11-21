// How the main window first appears after the app starts.
//
// The window is always created hidden and without focus (`setup` in lib.rs). With "Start in
// tray" it stays so until the user asks for it. Without it the window opens by itself, but only
// once the page has its first list (the `frontend_ready` command): it then appears complete,
// and a screen reader reads it once, not while it is still being built.
//
// With a screen reader running, the first show also waits a moment longer. NVDA reads the
// content of the embedded browser (WebView2) in one of two ways. It takes its usual one only if
// its helper has already attached to the browser's process; otherwise it takes UI Automation,
// reads the window with extra phrases ("web content, region", the document address) and keeps
// Escape for itself, so the first Escape does not hide the window. The helper attaches at the
// first focus event that process raises, which is the event of the page getting the keyboard:
// the very event NVDA then has to read. While the browser's process is still starting up (the
// first second or so) NVDA reads that event before the helper is in; later the helper is in
// first. Up to 0.3.3 a default start gave the keyboard to the page at once and got through
// only by luck; with a new, empty browser profile (the first start of a copy, and under Scoop
// the first start after each update) it did not. So the first show waits until the browser's
// process has settled. A show asked for before that (hotkey, tray, second launch) is
// remembered and happens then.
//
// What does not work, measured in TASK-29: letting the helper attach earlier by giving the
// web content of the hidden window the keyboard for a moment. A newly started process may
// take the foreground, and Windows then makes the hidden window the foreground window: the
// user's keyboard is gone and the screen reader reads a window that is not on screen. A hidden
// window that still holds the keyboard of its own input queue also raises no focus event when
// it is shown later, and the screen reader then says nothing at all. The hidden window must
// never get the keyboard.

use std::sync::Mutex;
use std::time::Instant;

/// The event the page gets when the window is shown.
pub const EVENT_SHOW: &str = "window:show";

/// If the page has not reported that it is ready after this long, the start-up goes on anyway.
pub const READY_TIMEOUT_MS: u64 = 3000;

/// With a screen reader running, the first show waits after the page is ready: this many times
/// as long as the start took up to then, but not less and not more than the two limits.
///
/// Measured in TASK-29 with NVDA 2026.2 on a fast computer, where the page was ready 0.37 s
/// after the start: a window shown 0.2 or 0.4 s later was read the wrong way (4 of 4), one
/// shown 0.6 s or more later the right way (9 of 9, four of them with the computer under
/// load: once with half of the processors kept busy, three times with all of them).
/// A slower computer needs longer for everything, the embedded browser's start included, so
/// the pause grows with the time the start has taken.
pub const SCREEN_READER_PAUSE_FACTOR: u64 = 3;
pub const MIN_SCREEN_READER_PAUSE_MS: u64 = 1000;
pub const MAX_SCREEN_READER_PAUSE_MS: u64 = 4000;

/// How long the first show waits after the page is ready. `startup_ms` is how long the start
/// has taken up to then.
pub fn pause_before_first_show_ms(screen_reader_running: bool, startup_ms: u64) -> u64 {
    if !screen_reader_running {
        return 0;
    }
    startup_ms
        .saturating_mul(SCREEN_READER_PAUSE_FACTOR)
        .clamp(MIN_SCREEN_READER_PAUSE_MS, MAX_SCREEN_READER_PAUSE_MS)
}

#[derive(Debug)]
struct GateState {
    started: bool,
    open: bool,
    pending: Option<&'static str>,
}

/// Holds back every show of the main window until the start-up is over.
#[derive(Debug)]
pub struct StartupGate {
    created: Instant,
    state: Mutex<GateState>,
}

impl StartupGate {
    /// `show_at_start`: the window opens by itself when the start-up is over.
    pub fn new(show_at_start: bool) -> Self {
        StartupGate {
            created: Instant::now(),
            state: Mutex::new(GateState {
                started: false,
                open: false,
                pending: show_at_start.then_some(EVENT_SHOW),
            }),
        }
    }

    /// How long the start has taken so far: the gate is made when the app begins to start.
    pub fn age_ms(&self) -> u64 {
        self.created.elapsed().as_millis() as u64
    }

    /// The last part of the start-up begins. False if it already has: it runs once.
    pub fn begin(&self) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        !std::mem::replace(&mut state.started, true)
    }

    /// A show is asked for, with the event the page gets for it. True: show now. False: the
    /// start-up is not over, and the show will happen when it is. A plain show does not
    /// replace a remembered request that says more ("new snippet", "settings").
    pub fn ask(&self, event: &'static str) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.open {
            return true;
        }
        if event != EVENT_SHOW || state.pending.is_none() {
            state.pending = Some(event);
        }
        false
    }

    /// The start-up is over: from now on every show happens at once. Returns the event of the
    /// show that is due, if any.
    pub fn open(&self) -> Option<&'static str> {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.open = true;
        state.pending.take()
    }
}

/// True while a screen reader says it is running (NVDA, JAWS and Narrator set this Windows flag).
#[cfg(target_os = "windows")]
pub fn screen_reader_running() -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETSCREENREADER};

    let mut on: i32 = 0;
    let ok =
        unsafe { SystemParametersInfoW(SPI_GETSCREENREADER, 0, &mut on as *mut i32 as *mut _, 0) };
    ok != 0 && on != 0
}

#[cfg(not(target_os = "windows"))]
pub fn screen_reader_running() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    // === Pause before the first show ===

    #[test]
    fn test_without_screen_reader_the_window_shows_at_once() {
        assert_eq!(pause_before_first_show_ms(false, 0), 0);
        assert_eq!(pause_before_first_show_ms(false, 370), 0);
        assert_eq!(pause_before_first_show_ms(false, 60_000), 0);
    }

    #[test]
    fn test_with_screen_reader_a_fast_start_waits_the_least_pause() {
        assert_eq!(
            pause_before_first_show_ms(true, 0),
            MIN_SCREEN_READER_PAUSE_MS
        );
        assert_eq!(
            pause_before_first_show_ms(true, 200),
            MIN_SCREEN_READER_PAUSE_MS
        );
    }

    #[test]
    fn test_with_screen_reader_the_pause_grows_with_the_start() {
        // The computer of the TASK-29 measurements: ready after 0.37 s.
        assert_eq!(pause_before_first_show_ms(true, 370), 1110);
        assert_eq!(pause_before_first_show_ms(true, 1000), 3000);
    }

    #[test]
    fn test_with_screen_reader_the_pause_has_an_upper_limit() {
        assert_eq!(
            pause_before_first_show_ms(true, 2000),
            MAX_SCREEN_READER_PAUSE_MS
        );
        assert_eq!(
            pause_before_first_show_ms(true, u64::MAX),
            MAX_SCREEN_READER_PAUSE_MS
        );
    }

    #[test]
    fn test_least_pause_is_past_what_was_measured_as_too_short() {
        // 0.4 s after the page was ready was too early, 0.6 s was enough. The fastest start
        // gets the least pause.
        assert!(pause_before_first_show_ms(true, 0) >= 600);
    }

    // === Gate ===

    #[test]
    fn test_gate_default_start_shows_when_opened() {
        let gate = StartupGate::new(true);
        assert_eq!(gate.open(), Some(EVENT_SHOW));
    }

    #[test]
    fn test_gate_tray_start_shows_nothing_when_opened() {
        let gate = StartupGate::new(false);
        assert_eq!(gate.open(), None);
    }

    #[test]
    fn test_gate_show_during_start_is_remembered_not_done() {
        let gate = StartupGate::new(false);
        assert!(!gate.ask(EVENT_SHOW));
        assert_eq!(gate.open(), Some(EVENT_SHOW));
    }

    #[test]
    fn test_gate_show_after_start_happens_at_once() {
        let gate = StartupGate::new(false);
        gate.open();
        assert!(gate.ask(EVENT_SHOW));
        assert!(gate.ask("tray:create-snippet"));
    }

    #[test]
    fn test_gate_opened_show_is_handed_out_once() {
        let gate = StartupGate::new(true);
        assert_eq!(gate.open(), Some(EVENT_SHOW));
        assert_eq!(gate.open(), None);
    }

    #[test]
    fn test_gate_request_with_more_detail_replaces_plain_show() {
        let gate = StartupGate::new(true);
        assert!(!gate.ask("tray:create-snippet"));
        assert_eq!(gate.open(), Some("tray:create-snippet"));
    }

    #[test]
    fn test_gate_plain_show_keeps_request_with_more_detail() {
        let gate = StartupGate::new(false);
        assert!(!gate.ask("tray:open-settings"));
        assert!(!gate.ask(EVENT_SHOW));
        assert_eq!(gate.open(), Some("tray:open-settings"));
    }

    #[test]
    fn test_gate_start_up_begins_once() {
        let gate = StartupGate::new(true);
        assert!(gate.begin());
        assert!(!gate.begin());
    }
}
