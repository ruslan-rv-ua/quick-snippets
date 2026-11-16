---
id: TASK-20
title: >-
  Keep the search and the password dialog when the keyboard only moves inside
  the window
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T21:47:00Z'
updated_date: '2026-11-16T22:46:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-3
dependencies: []
references:
  - src/hooks/useWindowHiding.ts
  - src/App.tsx
  - src-tauri/src/window_blur.rs
  - src-tauri/src/lib.rs
  - scripts/smoke-nvda.ps1
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the web content loses the keyboard, the frontend at once clears the search and closes the password dialog (the partial reset on blur in src/hooks/useWindowHiding.ts, which also turns off auto-type mode). Before TASK-18 this went together with hiding the window. Since TASK-18 (src-tauri/src/window_blur.rs) the window hides only after it has not been the foreground window for 200 ms, and while it is still the foreground window the keyboard is given back to the content. The frontend still reacts at once, though: when an action through UI Automation (screen readers, voice control, automation tools) moves the keyboard to an internal WebView2 window for a moment, the window stays open, but the typed search is gone and an open password dialog has closed. TASK-18 found this.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A change in existing code where the timing with the Rust side matters, checked with unit tests and just smoke.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the keyboard only moves inside the window and the window stays the foreground window, the search text, the selection and an open password dialog stay as they were
- [x] #2 When the window really hides because another window became active, the search is cleared and the password dialog closes, as today
- [x] #3 Unit tests cover both cases, and just smoke has a step that moves the keyboard to the internal WebView2 window with a query typed and with the password dialog open, and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lib.rs: when the blur watcher hides the window because another window became active, emit "window:hidden" to the web content just before hiding it.
2. useWindowEvents/useWindowHiding: the partial reset (query, selection, password dialog, auto-type mode, list focus) runs on "window:hidden" instead of on the DOM blur event. Escape and the other full resets stay as they are.
3. Unit tests: a DOM blur keeps the query, the selection and the password dialog; "window:hidden" clears them.
4. scripts/smoke-nvda.ps1: two steps that put the keyboard on the internal WebView2 window, one with a query typed, one with the password dialog open and the password typed (Enter afterwards still copies).
5. CHANGELOG [Unreleased] Fixed; npm run test:all, npm run lint, release build, just smoke (with the user's permission), copy to real_db, git flow bugfix finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Fix and verification (2026-11-17)

- 4985ee6: lib.rs emits "window:hidden" right before the blur watcher hides the window (the step that runs only once another window has been active for 200 ms). useWindowEvents listens to it instead of the DOM blur event; useWindowHiding runs the partial reset (query, selection, list focus, password dialog, auto-type mode) on it. A DOM blur alone now resets nothing. Escape on an empty query and the hide after copy/auto-type still do the full reset in the frontend. The auto-type hide from Rust also ends in this watcher, so the partial reset still follows it.
- When the exit confirmation is showing the window does not hide, so the search is no longer cleared then either.
- Unit tests (App.test.tsx): a DOM blur keeps the query and selection, and keeps the password dialog with the typed password; "window:hidden" clears the query and brings the full list back, and closes the password dialog. The two blur tests fail when the old DOM blur reset is put back. The old "blur triggers partial reset" smoke-free test was removed; "window shown again is back in the search box" now uses "window:hidden".
- just smoke: step 42 puts the keyboard on the internal WebView2 window with the query "звич" typed: the query and the found snippet stay, NVDA reads the search box again with "звич". Step 45 opens the password dialog on the secret snippet, types the password, moves the keyboard to the internal window: the dialog stays, focus is back in the password field (NVDA reads 13 dots), Enter copies the decrypted text.
- npm run test:all: 432 frontend, 230 Rust (1 ignored). npm run lint passes.
- just smoke on the release build of 4985ee6: first run stopped at step 45 because of a mistake in the new step itself (it waited for the secret snippet to be focused; after Escape the keyboard is in the search box and the snippet is only selected), fixed in 7e3221f. Second run (more than a minute later): 70 of 70 steps, 181 of 181 NVDA checks. The known NVDA error of its own Enter script (script_caret_newLine, IndentNav) appeared once, as in TASK-18.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-20-4985ee6.exe (7e3221f changes only the smoke script).
- No new user-facing strings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The search text, the selected snippet and an open password dialog (with the typed password) now stay when the keyboard only moves inside the window, for example after an action through UI Automation. They are still cleared when the window really hides because another window became active.

Cause: the frontend reset them on every DOM blur, while since TASK-18 the window hides only once it is no longer the active window. Fix: the Rust blur watcher emits "window:hidden" right before that hide, and the frontend resets only on this event.

Verified: 4 new frontend tests (2 fail with the old behaviour); npm run test:all (432 frontend, 230 Rust) and npm run lint pass; just smoke on the release build of 4985ee6: 70 of 70 steps, 181 of 181 NVDA checks, with two new steps that move the keyboard to the internal WebView2 window with a query typed and with the password dialog open. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-20-4985ee6.exe.

Changed on the way: while the exit confirmation is showing, switching to another window no longer clears the search (the window does not hide then).
<!-- SECTION:FINAL_SUMMARY:END -->
