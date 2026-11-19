---
id: TASK-29
title: Investigate how NVDA reads the window right after a start
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T16:42:00Z'
updated_date: '2026-11-19T23:02:00Z'
labels:
  - accessibility
  - investigation
  - model-fable
  - effort-medium
milestone: m-6
dependencies:
  - TASK-27
references:
  - scripts/smoke-nvda.ps1
  - src-tauri/src/lib.rs
  - DEVELOPMENT.md
priority: low
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-5, on its fixed build. Two things NVDA does on the first show of the window after QuickSnippets starts, seen in just smoke and just smoke-tray runs:

- After the window and the search box, NVDA does not read the first snippet of the list (step 80 of the tray run only hopes for it: it was not said in either run). On every later show it is read. The window opened by a default start behaves the same.
- A default start (without "Start in tray") is read with repeated phrases, as in 0.3.3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | QuickSnippets - Snippet Manager, документ | додаток, пробіл | додаток | додаток | Пошук, ...". NVDA seems to get the window while the page is still loading. TASK-5 left the default start as it was on purpose.

Related and still unexplained: the reading with "веб-вміст, регіон" after a quick restart of a default start (TASK-18). TASK-5 showed that it does not depend on the time since the previous copy, as DEVELOPMENT.md once said; details are in the notes of the archived TASK-5 and TASK-18.

This is an investigation first: no code change until the behaviour is reproduced and its suspected cause is recorded in the notes, and the app changes only after the user agrees. Use just smoke and just smoke-tray runs, and ask the user before every run, since the keyboard and mouse must stay untouched for about two and a half minutes. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days. Starts after TASK-27, because a new place for the browser data can change what happens at the first start.

Recommended setup: Claude Fable 5.2 (`/model fable`), effort medium (`/effort medium`). Timing between WebView2, the page and NVDA, the kind of ambiguous work Fable is meant for: describe the outcome, not the steps. If Fable usage is limited, Claude Opus 5.5 at effort xhigh is the alternative.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both behaviours reproduced or ruled out through just smoke runs, with a default start and with a start in the tray; the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [x] #2 If the cause is in the app and the user agrees to a fix: on the first show after a start NVDA reads the window, the search box and the first snippet, each once, as on later shows
- [x] #3 If fixed: just smoke and just smoke-tray require the first snippet on the first show, and both pass
- [x] #4 A default start with an empty browser profile (the first start of a new copy, and under Scoop the first start after each update) is read normally by NVDA and Escape hides the window: a default `just smoke` passes with an empty profile, and the Known Limitations entry about it is gone from CHANGELOG.md
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
1. Investigation without code changes: done, recorded in the notes (2026-11-19).
2. Prototype of the quiet attach on a feature branch: measured and dropped (the hidden window took the foreground). The plain pause the user had agreed to as the fallback took its place.
3. Final solution: the main window is always created hidden and without focus; the page reports when its list is loaded with the saved settings (frontend_ready); a default start shows the window then, and with a screen reader running (SPI_GETSCREENREADER) only after a pause of three times the start time, between 1 and 4 s; a show asked for earlier waits for that moment (src-tauri/src/startup.rs, lib.rs).
4. First snippet: no snippet is marked as selected until the window has been shown for the first time (src/App.tsx).
5. Unit tests: Rust for the pause and the gate, frontend for the ready signal and the mark.
6. scripts/smoke-nvda.ps1: the first show after a start checked as strictly as later shows, the first snippet required after the restart in both modes.
7. CHANGELOG [Unreleased], DEVELOPMENT.md, CLAUDE.md.
8. npm run test:all, npm run lint; release build; just smoke (empty profile) and just smoke-tray; build copied to C:\5-quicksnippets\real_db; git flow feature finish --no-ff; Done, not archived; nothing pushed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Found by TASK-27 (2026-11-19): an empty browser profile and the default start

Since TASK-27 the WebView2 profile lies in quick-snippets-webview next to the exe. Every new copy, every test copy of just smoke and, under Scoop, the first start after every update (the folder lies in the version folder) therefore begin with an empty profile. Up to 0.3.3 all copies shared one old profile in AppData.

- Default start with an empty profile: just smoke stopped at step 1 in 2 of 2 runs on the release build of 226183c (19:25, and 19:36, ten minutes after any other copy). NVDA said "QuickSnippets | QuickSnippets - Snippet Manager – веб-вміст, регіон | QuickSnippets - Snippet Manager, документ, http://tauri.localhost/ | за кліком, додаток, ...", and Escape went to NVDA, so the window did not hide.
- The same build with an existing profile (copied next to the test exe with the new -BrowserProfileFrom switch of scripts/smoke-nvda.ps1): 81 of 81 steps, 284 of 284 checks; step 1 read the normal way, with the usual noise of a default start.
- Start in the tray with an empty profile (just smoke-tray): 82 of 82 steps, 293 of 293 checks; the first show read normally.
- Suspected cause: with an empty profile WebView2 needs longer before the page is ready, and NVDA meets the visible, focused window first. It may also be what lies behind the "веб-вміст, регіон" reading after a quick restart (TASK-18).
- The user decided on 2026-11-19 that this is fixed here, before the release. A likely fix: show the window of a default start only once the page is ready. CHANGELOG [Unreleased] lists the problem under Known Limitations; remove that entry with the fix. Until then a default just smoke stops at step 1; for a run with an existing profile see DEVELOPMENT.md (-BrowserProfileFrom). Details: notes of TASK-27.

## Investigation (2026-11-19, before any code change)

Build under test: the release exe of 226183c (built 19:17, same app code as develop). NVDA 2026.2. Tools: a temporary script outside the repo, one start of a throwaway copy per fresh Windows PowerShell process. It uses Win32 only (no UI Automation): a listener for foreground and focus events, a watcher for the app's windows, the foreground window and the window with the keyboard, and a poll for NVDA's helper DLL (nvdaHelperRemote.dll) in the app process and in the embedded browser's process. NVDA's log is read only for the bytes written during each start, with a window of the script holding the keyboard before and after. Each test copy had a database with two plain snippets. After 3.5 s the script pressed Escape, and once more if the window stayed. Every hands-off run was allowed by the user through the question dialog and ended with two beeps.

Two runs, 18 starts with NVDA; 4 more hidden starts without keys or speech (one to make a browser profile and a database, three to ask the browser windows a question, see below).

### What NVDA said

Default start (the window opens at once):
- Empty browser profile, 3 of 3: "QuickSnippets | QuickSnippets - Snippet Manager – веб-вміст, регіон | QuickSnippets - Snippet Manager, документ, http://tauri.localhost/ | за кліком, додаток | додаток | додаток | Пошук, комбінований список, розгорнуто". The search box without its states. The first Escape went to NVDA and the window stayed; the second Escape hid it. This is the TASK-27 failure.
- Existing browser profile, 2 of 2: "QuickSnippets | QuickSnippets - Snippet Manager, документ | QuickSnippets - Snippet Manager, документ | додаток, пробіл | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо". The normal way, with the repeated phrases of the task description; the first Escape hid the window.

Start in the tray, first show by Ctrl+Alt+Space some time after the hidden copy was ready (hotkey registered, about 0.35 s after the process started):
- Empty profile: after 0 ms and after 300 ms read badly (2 of 2); after 700, 1500, 3000 and 5000 ms read the normal way and cleanly (4 of 4): "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо".
- Existing profile: after 0 ms read badly (1 of 1), after 1000 ms cleanly (1 of 1).
- Read badly here means: "QuickSnippets | ... – веб-вміст, регіон | ... – веб-вміст, регіон | ..., документ | додаток | додаток | Пошук, комбінований список, розгорнуто" and the last five once more; Escape needed twice. It is the reading TASK-5 saw in 0.3.3.

So the bad reading does not need an empty profile. It happens whenever the web content first gets the keyboard while the embedded browser's process is young: up to about 0.7 s after the start here. A default start gives the keyboard to the content at once, so it is always in that time; the empty profile only decides which way it goes.

The first snippet: not said in any of the 18 first shows (default or tray, good or bad reading), although the list had two snippets.

### Suspected cause

1. NVDA has two ways to read Chromium content: its older in-process way (IAccessible2) and UI Automation. Its rule (NVDA 2026.2, source/UIAHandler/__init__.py, _isUIAWindowHelper): for a window of class Chrome_RenderWidgetHostHWND it uses the older way only if its helper has already registered for the process that owns the window; otherwise, when the window offers UI Automation, it treats it as a UI Automation window. The answer is kept for 0.5 s per window, and NVDA's focus object stays what it was created as until the next focus event.
2. NVDA puts its helper into a process only at the first focus or foreground event raised by a thread of that process (nvdaHelper/remote/injection.cpp), and applies the registration on its main thread at the end of a core cycle, after the focus events of that cycle (core.py: IAccessibleHandler.pumpAll() before queueHandler.pumpAll()).
3. In this app the content window belongs to the embedded browser's process (msedgewebview2.exe), not to the app. Measured in every show: the first focus event that process raises is the focus event of the page itself; nvdaHelperRemote.dll appeared in it 3 to 7 ms after that event (the events on Chrome_WidgetWin_0 and Chrome_WidgetWin_1 before it do not load it). So NVDA has to read the very event that makes its helper attach. It reads the content the normal way only when it is still busy with something else until the registration is in; otherwise it takes UI Automation.
4. Asked directly (UiaHasServerSideProvider, hidden copy, no NVDA involved), both browser windows offer UI Automation 0.46 s after the start with an empty profile, 0.48 s with an existing one, and 5.5 s with an empty one: the browser does not change. What changes is who wins. With the page already loaded and the browser older than about 0.7 s, NVDA was still busy with the app's foreground event and the helper registered in time (5 of 5 here, 10 of 10 in TASK-5). In a default start with an existing profile the keyboard reaches the browser while the page is still loading; NVDA waits for the busy browser and the helper registers meanwhile (2 of 2, and every earlier just smoke run). With an empty profile, or with a show right after the start, NVDA was free and read the event first (6 of 6).
5. In the UI Automation reading NVDA's focus is in a UI Automation browse-mode document: it says the browser pane, the document address and "за кліком", reads the search box without states, and Escape switches NVDA from focus mode to browse mode instead of reaching the app. The second Escape reaches the app. NVDA also logged errors of its own there (api.setFocusObject: Error updating tree interceptor; gainFocus on ChromiumUIADocument...).

The repeated phrases of a default start with an existing profile ("документ" twice, "додаток, пробіл") come from the same early focus: the browser raises focus events on the document while the page is still being built (first event 347 ms after the start, the search box at 402 ms). A window shown only after the page is ready is read once, as after a start in the tray.

The first snippet (from the code): the search box does not point at the snippet when the window opens, so NVDA reads it only as the newly selected option of the list the search box controls. On the first show the list was loaded and its first snippet selected during the start, before NVDA was in the search box; the reload on show selects the same snippet again, so nothing changes and nothing is read. On later shows the selection is cleared when the window hides (reset, partialReset) and set again after the show. The cause is in the app.

### An idea tried from outside, without changing the app

If NVDA's helper is in the browser process before the first show, NVDA's rule gives the normal reading whatever the timing. Tried in 5 starts: the script put the keyboard of the hidden copy's own input queue into the web content (SetFocus from a background thread). The browser raised its page focus event, nvdaHelperRemote.dll was loaded into it, NVDA said nothing, and the real foreground window and keyboard stayed where they were. But Windows also raised a foreground event for the hidden window (NVDA logged "Foreground took too long to change"), and the later Ctrl+Alt+Space raised no foreground or focus event at all, because the hidden window already held the focus of its queue: NVDA said nothing about the window in 5 of 5, while the keyboard was in it (Escape hid it). This is the silent first show of TASK-5. So the focus must be taken out of the hidden window again before it is shown; whether the app can do both cleanly has to be measured on a build.

Not a fix by itself: showing the window of a default start as soon as the page is ready. A tray start shown 0 or 300 ms after the copy was ready is exactly that, and it was read badly in 3 of 3.

## Decision (user, 2026-11-19, question dialog)

Shown: the cause in plain words and three options. (1) Create the window of a default start hidden, let NVDA's helper attach to the embedded browser quietly, then show the window; with a screen reader running about 1 to 1.5 s after the start, without one as soon as the page is ready. (2) The same wait for everyone. (3) Switch UI Automation off in the embedded browser (no wait, but worse for Narrator and other UI Automation tools, and just smoke relies on it).

- The user chose option 1. The quiet attach has to be measured on a build first; if it does not work cleanly, a plain pause before the show takes its place (5 of 5 here, but it depends on the computer's speed).
- The user also agreed to fix the first snippet on the first show.
- The format of snippets.db and settings.json does not change.

## Prototypes on the feature branch (2026-11-19, after the user's choice)

Run 3 (13 starts, fast-profile build): the quiet attach done by the app itself. It gave the web content of the hidden window the keyboard (WebView2 MoveFocus), took it out 150 ms later (SetFocus with no window) and showed the window 800 ms after that.
- 4 of 4 default starts: at the attach the hidden window became the foreground window (a newly started process may take the foreground), NVDA read the window that was not on screen, the UI Automation way, and once the keyboard had been taken out nothing held it: the show raised no event, and neither the first nor the second Escape reached the app. In 2 of 2 starts in the tray NVDA read the hidden window during the start. This is the flash of 0.3.3 again, and worse, so the quiet attach was dropped.
- Controls in the same run: a show as soon as the page is ready, with no pause, was read the wrong way in 2 of 2; a plain pause of 1000 ms after the page is ready was read the right way in 2 of 2.

Run 4 (13 starts, the plain pause): pause after the page is ready 200 ms: wrong 2 of 2 (window on screen 0.56 to 0.59 s after the start); 400 ms: wrong 2 of 2 (0.77 s); 600 ms: right 2 of 2 (0.97 s); 1000 ms: right 3 of 3 (default start with an empty and with an existing profile, and a start in the tray with Ctrl+Alt+Space pressed at once, which the app held back until 1.37 s). With 10 of the 20 logical processors kept busy: right 1 of 1. With all 20 busy: right 3 of 3 (pauses of 1000 and 2500 ms; the window then appeared 8 to 12 s after the start).

The plain pause therefore takes the place of the quiet attach, as agreed with the user beforehand.

## Fix

- 9306025 (src-tauri/src/startup.rs new, lib.rs, commands.rs, src/App.tsx, src/hooks/useIpc.ts). The window is always created hidden and without focus. The page reports when its list is loaded with the saved theme, language and sort order (command frontend_ready); without "Start in tray" the window is shown then. With a screen reader running (Windows flag SPI_GETSCREENREADER) the first show waits three times as long as the start has taken up to then, between 1 and 4 s. Here the page is ready after about 0.4 s, the pause is about 1.2 s, and the release build's window was on screen 1.4 to 1.6 s after the start. The pause grows with the start time because a slower computer needs longer for everything; the boundary measured here lay between 0.4 and 0.6 s after the page was ready. A show asked for earlier (hotkey, tray, second launch) is remembered and made then; every show goes through show_main_window. If the page does not report within 3 s, the start-up goes on without it.
- e783810: the first snippet. The first version (in 9306025) cleared the selection after the last list load of the start. It worked in run 4 (read in 9 of 9 good starts) but not in just smoke, where the test copy has a saved sort order other than the default: the answers to the page's requests do not have to come back in the order they were sent, a later one selected the snippet again before the show, and NVDA said nothing (step 79 of just smoke, step 80 of just smoke-tray; then 2 of 2 measured starts with the sort order "last used"). Second version: the selection is kept, but no snippet is marked as selected until the window has been shown for the first time (markedIndex in App.tsx). Read in 4 of 4 measured starts, with either sort order.
- A wrong lead on the way: the failed check looked like an effect of the test's own UI Automation queries during the first show. Keeping them out for 1.5 s (Wait-ShownQuietly in scripts/smoke-nvda.ps1) changed nothing; the wait stays as a precaution.
- scripts/smoke-nvda.ps1: the first show after a start is now checked as strictly as later shows, in both modes: the window and its document once, the search box once and with its states, no "веб-вміст" and no document address; after the restart also the first snippet, once. No new steps.

## Runs on the release build of 9306025 (built 22:34), before the first-snippet rework

- just smoke (default start, empty browser profile): 81 of 81 steps, 300 of 301 NVDA checks. Step 1: the window was on screen 1584 ms after the start; "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо"; the first Escape hid it. The one failed check: the first snippet after the restart (step 79).
- just smoke-tray: 82 of 82 steps, 299 of 300 NVDA checks; the start in the tray stayed off screen and silent, the first Ctrl+Alt+Space was read cleanly; the same failed check (step 80).

Privacy: in runs 3 and 4 NVDA read notifications of another program while the capture was open (three times). Their text was removed from the temporary files at once, was used for nothing and is not in these notes. From run 4 on the user was asked to switch notifications off for the runs.

## Final runs (2026-11-20, release build of e783810, built 00:26)

- A short measured check before them, 6 starts: the build of 9306025 with the saved sort order "last used": first snippet not read, 2 of 2 (the cause of the failed smoke check). The reworked build: read in 4 of 4 (default start with that sort order twice, start in the tray with it, default start with the default order and an empty profile), each time "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо | (the first snippet), 1 із 2", the first Escape hid the window.
- just smoke (default start, empty browser profile): 81 of 81 steps, 301 of 301 NVDA checks, exit code 0. Step 1: the window was in the foreground 1510 ms after the start; NVDA said "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо"; the first Escape hid it. Step 79 (restart, window after 1342 ms): the same and then "smoke зашифрований (зашифровано), 1 із 1".
- just smoke-tray, six minutes later: 82 of 82 steps, 300 of 300 NVDA checks, exit code 0. Steps 1 and 79: the window never on screen, NVDA silent (hidden copy ready after 348 and 327 ms). Step 2: the first Ctrl+Alt+Space read once, the usual way. Step 80: the same and then the first snippet.
- npm run test:all: 496 frontend tests, 263 Rust tests (1 ignored). npm run lint passes.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-29-e783810.exe (the tested exe, SHA-256 compared). The commits after e783810 change the smoke script, the documents and one comment in startup.rs (git diff e783810..HEAD -- src src-tauri shows that comment only).
- The user allowed every hands-off run through the question dialog; from the last one on the user said not to ask again in this session. Every run ended with two beeps.

## Evidence for the criteria and the Definition of Done

- AC #1: default start read with repeated phrases (existing profile, 2 of 2) or through UI Automation with Escape kept by NVDA (empty profile, 3 of 3); first show after a start in the tray read the same wrong way when asked for within 0.3 s (3 of 3) and cleanly later (5 of 5); first snippet not read in 18 of 18 first shows. Recorded in the notes above before the feature branch existed.
- AC #2: first show after a start, final build: window, search box and first snippet each once in just smoke step 79, just smoke-tray step 80 and 4 of 4 measured starts.
- AC #3: both smoke modes now require the first snippet on the first show after the restart (ExpectCount, not Hope) and passed.
- AC #4: the default just smoke passed with an empty browser profile (step 1 above); the Known Limitations entry is gone from CHANGELOG.md.
- DoD: test:all and lint pass; CHANGELOG [Unreleased] has one Changed and two Fixed entries for users; no new user-facing strings; the release exe was rebuilt and both smoke runs passed on it.

## Noticed, not part of this task (no tasks created)

1. The wrong reading is a race inside NVDA (its helper registers at the very focus event it has to read) and concerns any WebView2 app; it could be reported to NV Access. The app only stays away from the moment in which NVDA loses it.
2. The pause depends on the Windows screen reader flag. A screen reader that does not set it gets the window as soon as the page is ready and may be read the wrong way at a start.
3. With every processor kept busy the window of a default start appeared only 8 to 12 s after the start (prototype runs); it was read correctly. Why it took that long was not looked into.
4. A notification of another program that arrives during just smoke is spoken by NVDA and ends up in the report like any other speech.
5. NVDA logged the error of its own Enter script (IndentNav) once in the first just smoke run, as in earlier tasks.

After the merge into develop (6bc3955): npm run test:all (496 frontend tests, 263 Rust tests) and npm run lint pass again. Nothing was pushed; the task is not archived.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A default start (the window open at once) is now read by NVDA once and properly, also with a new, empty browser profile, and the first snippet is read on the first show after any start.

Cause, from NVDA's source and 18 measured starts recorded before any code change: NVDA reads WebView2 content the usual way only if its helper has already attached to the browser's process, and the helper attaches at the first focus event that process raises, the event of the page getting the keyboard. While the browser's process is still starting up (the first second here), NVDA reads that event first and takes UI Automation: "веб-вміст, регіон", the document address, the search box twice or without states, and the first Escape goes to NVDA. A default start gave the keyboard to the page at once (wrong reading 3 of 3 with an empty profile, repeated phrases 2 of 2 with an existing one); a start in the tray shown within 0.3 s did the same (3 of 3), later shows were clean (5 of 5). It never depended on the time since the previous copy. The first snippet was not read because it was already selected before the window was shown (18 of 18).

Fix, chosen by the user from three options: the main window is always created hidden and without focus; the page reports when its list is loaded with the saved settings; a default start shows the window then (about half a second after the start, complete), and with a screen reader running (Windows flag) only after a pause of three times the start time, between 1 and 4 s (window on screen about 1.5 s after the start here). A show asked for earlier waits for that moment. No snippet is marked as selected until the first show. The user's first choice, letting NVDA attach quietly while the window is hidden, was measured on a build and dropped as agreed: the hidden window became the foreground window and NVDA read it.

Verified on the release build of e783810: just smoke with an empty browser profile 81 of 81 steps and 301 of 301 NVDA checks; just smoke-tray 82 of 82 and 300 of 300; both now check the first show as strictly as later shows and require the first snippet after the restart. Measured boundary: a show 0.4 s after the page was ready was read wrongly (4 of 4), 0.6 s or more correctly (9 of 9, four under processor load). npm run test:all (496 frontend, 263 Rust tests) and npm run lint pass. CHANGELOG [Unreleased]: the Known Limitations entry is gone, one Changed and two Fixed entries added; DEVELOPMENT.md and CLAUDE.md describe the start-up and no longer the "until TASK-29" workaround. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-29-e783810.exe. The format of snippets.db and settings.json is unchanged.

Risks and what is left: the pause is a measured margin, not a guarantee, and it relies on the screen reader flag; the underlying race is in NVDA and could be reported to NV Access. Noticed, no tasks created: a slow first show (8 to 12 s) with every processor kept busy; notifications of other programs spoken during just smoke end up in its report.
<!-- SECTION:FINAL_SUMMARY:END -->
