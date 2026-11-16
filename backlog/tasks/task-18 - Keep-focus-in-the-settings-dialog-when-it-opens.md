---
id: TASK-18
title: Keep focus in the settings dialog when it opens
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T19:17:00Z'
updated_date: '2026-11-16T21:39:00Z'
labels:
  - bug
  - investigation
  - accessibility
  - frontend
  - model-fable
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/SettingsModal.tsx
  - src/components/ModalOverlay.tsx
  - src/hooks/useWindowHiding.ts
  - src-tauri/src/lib.rs
  - scripts/smoke-nvda.ps1
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Right after the settings dialog opens, focus sometimes leaves the window content for a moment: NVDA says "порожньо", then "додаток | додаток" and the dialog again. Twice focus did not come back, the settings were not saved and the just smoke autostart step failed (TASK-16: the first baseline run on the 0.3.0 code and the first run on new code). Both times Ctrl+Alt+Space had been pressed while the window was already open, just before Ctrl+, opened the dialog. A user who opens the settings this way may lose their changes without noticing. The just smoke autostart step now reports where the window, the dialog and the keyboard were when it fails.

This is an investigation first: no code change until the failure is reproduced. Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Fable 5.2 (`/model fable`), effort medium (`/effort medium`). An intermittent focus problem across the window show events, WebView2 and the dialog code: describe the outcome, not the steps. If Fable usage is limited, Claude Opus 5.5 at effort xhigh is the alternative.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The failure is reproduced or ruled out through just smoke runs, and the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [x] #2 If reproduced: after Ctrl+Alt+Space with the window already open, the settings dialog keeps focus when it opens, and Ctrl+Enter saves the changes
- [x] #3 just smoke has a step for this sequence and passes in several runs in a row
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
1. src-tauri/src/window_blur.rs: the decision after the web content loses the keyboard as a pure function with unit tests. Hide only once the app window has not been the foreground window for 200 ms. While it is still the foreground window and 200 ms have passed, give the keyboard back to the web content (not while a menu is open, the window is moved or resized, or an owned popup has the keyboard).
2. lib.rs: a blur watcher that polls the window state and follows that decision; a generation counter instead of the shared flag, so an old timer cannot act on a newer blur.
3. scripts/smoke-nvda.ps1: a step that repeats "window open, Ctrl+Alt+Space, Ctrl+comma, toggle a setting through UI Automation, Ctrl+Enter" six times; a step that puts the keyboard on the internal WebView2 window with the settings open (the failure made to happen every time); two steps that check the window still hides when another window becomes active; Set-Toggle waits until the keyboard is back in the content.
4. CHANGELOG [Unreleased] Fixed; DEVELOPMENT.md and CLAUDE.md.
5. npm run test:all, npm run lint, release build, reproduction and probe runs, three just smoke runs in a row (with the user's permission), copy to real_db, git flow bugfix finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-16, before any code change)

Reproduced. Method: the helpers of just smoke in a temporary copy of the script outside the repo (it reads only what NVDA wrote during the run), on the release build of 587ad7c (same app code as develop). One run with 49 repeats of "open Settings with Ctrl+comma, change «Запускати згорнутим у трей», Ctrl+Enter, check settings.json": 7 variants, 7 rounds each. A sampler outside the app recorded every 2 ms which window had the keyboard, which window was active and whether the app window was visible. (An earlier start of the script stopped at once because of a wrong exe path, before it touched the keyboard.)

Results by variant:
- Ctrl+Alt+Space with the window open, then Ctrl+comma, check box toggled through UI Automation (what the autostart step of just smoke does): 7 repeats, 2 not saved, in a third NVDA spoke the extra phrases but the setting was saved.
- Ctrl+comma and the UI Automation toggle, no Ctrl+Alt+Space: 7 repeats, all saved.
- A sort shortcut (toast and list reload) a second before, then the UI Automation toggle: 7 repeats, all saved.
- Keyboard only, as a user does it (Tab, Tab, Tab, Space), with and without Ctrl+Alt+Space, with and without UI Automation reads while waiting: 28 repeats, all saved, the keyboard never left the window content, NVDA said nothing unusual.

What happens in a failed repeat (the same both times):
- The settings dialog opens normally and NVDA reads it: "Налаштування, діалог, QuickSnippets версія 0.3.0 | Вигляд і мова, групування | Тема, комбінований список, Темна, згорнуто".
- The UI Automation Toggle call moves the keyboard from the window that shows the content (Chrome_WidgetWin_1) to another internal WebView2 window (Chrome_RenderWidgetHostHWND). The app window is still the active window.
- Normally WebView2 moves the keyboard back within 10 to 20 ms (seen in all 21 repeats with a UI Automation toggle, never in the 28 keyboard-only repeats). In the failed repeats it stayed on the internal window.
- 207 and 214 ms later the app window was hidden: WebView2 had reported that it lost focus, and the blur handler in lib.rs hides the window 200 ms after that, although the window was still the active one.
- The dialog stays open in the hidden window, Ctrl+Enter goes nowhere, nothing is saved. NVDA said "порожньо | додаток | додаток | Налаштування, діалог, QuickSnippets версія 0.3.0 | Запуск і закриття, групування | Запускати згорнутим у трей, прапорець, позначено" and, after the test brought the window back, "список | smoke звичайний".
- In the repeat that was saved, the keyboard was away for 16 ms and NVDA still said "порожньо | додаток | додаток" and read the dialog a second time.

Cause: the app treats "the web content lost the keyboard" as "the user left the window". An action performed through an accessibility interface (here the test's UI Automation Toggle; screen readers, voice control and automation tools use the same calls) makes WebView2 move the keyboard between its own internal windows. When it does not come back, the window hides itself with the dialog open, while it is still the active window.

Ruled out: the hint from TASK-16 that the two show events (window focus and window:show) take focus from the dialog. With the window already open, Ctrl+Alt+Space does nothing natively (tao skips show, unminimize and set_focus for a visible foreground window), and in 14 keyboard-only repeats after Ctrl+Alt+Space focus stayed in the dialog. Whether Ctrl+Alt+Space makes the failure more likely is not proven: 3 of 7 repeats with it against 0 of 14 without it showed the problem, and step 58 of the last TASK-16 run showed the NVDA phrases without Ctrl+Alt+Space.

## Fix and what the probes showed (2026-11-16)

- a7f0da7: new module src-tauri/src/window_blur.rs with the decision as a pure function (13 unit tests) and a blur watcher in lib.rs. The window hides only after it has not been the foreground window for 200 ms. While it is still the foreground window, the keyboard is given back to the web content (not while a menu is open, the window is moved or resized, or an owned popup has the keyboard). A generation counter replaces the shared flag, so a timer from an earlier blur cannot act on a later one.
- A way to make the failure happen every time: put the keyboard on the internal WebView2 window that holds the accessibility tree (class Chrome_RenderWidgetHostHWND) with SetFocus from the test. Build before the fix (587ad7c): 3 of 3 times the window hid itself 201 to 223 ms later while it was still the foreground window. Build a7f0da7: 3 of 3 times the keyboard was back in the content after 35 to 37 ms, the window stayed, and a letter pasted afterwards arrived in the search box.
- Reproduction script on a7f0da7: 28 repeats with a UI Automation toggle (14 of them after Ctrl+Alt+Space), all saved, the window never hid. In that run WebView2 always took the keyboard back by itself within 14 ms, so the repeats alone did not exercise the new code; the SetFocus probe above did.
- Alt+Space (system menu of the window): same on both builds. The window stays, two Escapes leave the menu. While the menu is active, UI Automation queries into the web content block (one probe waited 60 s and NVDA reported a 15 s freeze); the probe was changed to make no such queries while the menu is active.
- ebb02a2: the keyboard is given back only after the same 200 ms, not after 30 ms: the app now acts only at the moment where it used to hide an active window, and leaves alone everything WebView2 settles by itself before that.

## Found on the way, not part of this task

When a test copy is started within about 30 s after the previous copy was killed, NVDA now and then reads the new window through UI Automation instead of IAccessible2 ("QuickSnippets - Snippet Manager – веб-вміст, регіон | ... документ, http://tauri.localhost/ | за кліком, додаток"), and Escape then does not hide the window: the keyboard is in the web content, NVDA takes the key. 24 starts 1.5 s apart, three builds in turn: 4 of 8 for the build before the fix, 4 of 8 for a7f0da7, 4 of 8 for the 200 ms build; every failed start was a UI Automation start and every UI Automation start failed. So it is not caused by this fix. It made two test runs stop at step 1 (both started less than 30 s after the previous run). Starts after a longer pause, and the restart inside just smoke (after a normal exit), were always read normally. Whether killing the previous copy matters, or only the short pause, is not established. Until this is looked at, leave a minute or more between two just smoke runs.

## Verification (2026-11-16)

- just smoke on the release build of ebb02a2, three runs in a row with 75 s between them (all with the user's permission): each 68 of 68 steps and 178 of 178 NVDA checks, 141 s (before this task: 64 steps, 171 checks). Step 37 repeats "window open, Ctrl+Alt+Space, Ctrl+comma, toggle through UI Automation, Ctrl+Enter" six times, so 18 repeats, all saved. Step 38 puts the keyboard on the internal WebView2 window with the settings open, twice per run: the window stayed and Ctrl+Enter saved every time. Steps 39 and 40: the window hides when another window becomes active, also with the settings open, and the dialog has focus again after Ctrl+Alt+Space. One more full run earlier on a7f0da7: 67 of 67 steps, 176 of 176 checks.
- npm run test:all: 429 frontend tests, 230 Rust tests (1 ignored). npm run lint passes.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-18-ebb02a2.exe. b66715f after it changes only documents and texts of the smoke script.
- No new user-facing strings.

What still happens after the fix: a UI Automation action still makes WebView2 move the keyboard away from the content, usually for up to 20 ms, now and then until the app takes it back after 0.2 s. NVDA may then say "порожньо | додаток | додаток" and read the dialog again, and keys pressed in those 0.2 s go nowhere. The app cannot prevent the move itself; with the keyboard only (Tab, Space) it does not happen.

Noticed, not looked into: in each of the four full just smoke runs of today the NVDA log holds one error of NVDA's own script for Enter in a text field ("error executing script ... script_caret_newLine ... IndentNav ... with gesture 'ентер'"). The speech checks are not affected. The report of the last TASK-16 run did not list it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The app no longer hides its window while that window is still the active one, and takes the keyboard back to its content.

Cause (reproduced before any code change): on Windows the app treated "the web content lost the keyboard" as "the user left the window" and hid 200 ms later. An action performed through UI Automation (the check box toggle in the autostart step of just smoke; assistive and automation tools use the same calls) makes WebView2 move the keyboard between its internal windows, and now and then it stays on one of them. The window then hid itself with the settings dialog open, and Ctrl+Enter went nowhere: 2 of 7 repeats after Ctrl+Alt+Space, 3 of 3 times when the test put the keyboard on that internal window itself. With the keyboard only (Tab, Space) it never happened in 28 repeats. The hint from TASK-16 (the two show events take focus from the dialog) was ruled out.

Fix: src-tauri/src/window_blur.rs decides what happens after the web content loses the keyboard. The window hides only once it has not been the foreground window for 200 ms. While it still is the foreground window, the keyboard is given back to the web content after the same 200 ms. lib.rs runs this as a watcher with a generation counter instead of the old shared flag.

Verified: 13 new Rust unit tests; npm run test:all (429 frontend, 230 Rust tests) and npm run lint pass; just smoke passes three runs in a row on the release build of ebb02a2 (68 of 68 steps, 178 of 178 NVDA checks), with four new steps: the sequence repeated six times, the keyboard put on the internal window with the settings open, and hiding when another window becomes active, with and without the settings open. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-18-ebb02a2.exe.

Left as it is: a UI Automation action still moves the keyboard away for up to 0.2 s, NVDA may then read the dialog a second time, and keys pressed in that time go nowhere.

Follow-up candidates, no tasks created: (1) a test copy started within about half a minute after the previous one was killed is now and then read by NVDA through UI Automation, and Escape then does not hide the window; the build before the fix does the same (4 of 8 quick starts for each of three builds). Leave a minute between two just smoke runs. (2) On window blur the frontend clears the search and closes the password dialog at once, also when the keyboard only moved inside the window. (3) NVDA logs an error of its own Enter script once per just smoke run.
<!-- SECTION:FINAL_SUMMARY:END -->
