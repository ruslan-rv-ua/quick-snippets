---
id: TASK-5
title: Check NVDA on the first show after starting in tray
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-15T23:03:00Z'
updated_date: '2026-11-19T16:19:00Z'
labels:
  - accessibility
  - investigation
  - model-fable
  - effort-medium
milestone: m-2
dependencies:
  - TASK-4
references:
  - src-tauri/src/lib.rs
  - src-tauri/src/settings.rs
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With "Start in tray" on, the window is hidden from launch. In just smoke runs on 2026-11-15 the first Ctrl+Alt+Space show was sometimes announced by NVDA and sometimes not: NVDA stayed silent until the next key press, then read the window. Later shows were always announced, and with the window opened at launch (the default, now used by just smoke) the first show is announced. Users who start in tray may hear nothing on their first hotkey press after login. Possible cause: the accessibility tree of a never-shown WebView2 window is not ready when it is first shown.

Related finding from TASK-18 (2026-11-16): a test copy started within about 30 s after the previous copy was killed is now and then read by NVDA through UI Automation instead of IAccessible2 ("QuickSnippets - Snippet Manager – веб-вміст, регіон | ... документ ... | за кліком, додаток"), and Escape then does not hide the window, because NVDA takes the key. In 24 quick starts it happened 4 of 8 times for each of three builds; starts after a longer pause were read normally. Both problems concern how NVDA first sees the window, so look at them together (details in TASK-18's notes).

This is an investigation first: no code change until the behaviour is reproduced. Use just smoke runs (a switch that starts the test copy in tray mode would help), and ask the user before every run, since the keyboard and mouse must stay untouched for about two and a half minutes. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Fable 5.2 (`/model fable`), effort medium (`/effort medium`, the Fable default in Claude Code). A root-cause investigation across WebView2 and NVDA timing, the kind of ambiguous work Fable is meant for: describe the outcome, not the steps. If Fable usage is limited, Claude Opus 5.5 at effort xhigh is the alternative.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduced or ruled out with start_in_tray on through just smoke runs; the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [x] #2 If reproduced: NVDA announces the window and the search field on the first show after a start in tray
- [x] #3 just smoke can run in a start-in-tray mode and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/smoke-nvda.ps1: a -StartInTray switch and just smoke-tray; the default run stays as it is. Done (99a8b4f, 8ef2d9c).
2. Investigation with the 0.3.3 build, every run with the user's permission: four runs, recorded in the notes before any app code change. Done.
3. Fix after the user's consent: the main window is created in setup, hidden and without focus when start_in_tray is on, visible and focused otherwise (91f4afb).
4. Measure the new build with NVDA; then just smoke-tray and just smoke on it.
5. DEVELOPMENT.md, CLAUDE.md, CHANGELOG [Unreleased] Fixed; npm run test:all, npm run lint; copy the build to real_db; git flow feature finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation, part 1 (2026-11-19, before any app code change)

Build under test: the release exe of 004aba9 (version 0.3.3, same app code as develop). NVDA 2026.2. The test copy ran with start_in_tray on. Speech was read only from the byte range NVDA wrote during each watched moment.

Tools: the new -StartInTray mode of scripts/smoke-nvda.ps1 (just smoke-tray), and for more samples per minute a temporary script outside the repo that reuses the helpers of the smoke script unchanged: it starts the hidden copy, waits, presses Ctrl+Alt+Space, records for 3 s what NVDA says and where the keyboard is (Win32 only), then quits the copy with Alt+F4 (normal exit, code 0).

Run 1 (10 starts in the tray, one after another) and one full just smoke-tray run: 12 first shows in all.

- NVDA was never silent: 0 of 12. It always began to speak 60 to 150 ms after it saw Ctrl+Alt+Space and had read the search box within 0.3 s. The window was visible and active about 220 ms after the keys, the keyboard in the web content (Chrome_WidgetWin_1). Waiting 0, 5 or 20 s before the keys made no difference, nor did UI Automation queries by the test.
- 2 of 12 were read the normal way (through IAccessible2): "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо". Both were the first start of a run, 75 s or more after the previous copy had ended.
- 10 of 12 were read with the phrases known as the quick-restart effect: "QuickSnippets | QuickSnippets - Snippet Manager – веб-вміст, регіон | (again) | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто | (the last five once more)". The search box is said twice and without its states. All ten started 3 s or 35 s after the previous copy had quit normally (9 in the investigation run, 1 the restart inside just smoke-tray). So this effect needs neither a killed copy nor a pause under 30 s, as TASK-18 assumed: 35 s after a normal exit was not enough, 75 s was.
- just smoke-tray: 81 of 81 steps, 288 of 291 NVDA checks. The three failed checks are that effect at the restart near the end: the search box said twice on the first show, and the next step (settings after the restart) began with "QuickSnippets - Snippet Manager, документ | додаток | додаток".

Found on the way: with start_in_tray on, the window is on screen for a moment at every start. In 12 of 12 starts it was visible and was the foreground window for about 0.3 s; NVDA said "QuickSnippets" and then read the previously active window again. Cause: the window is created visible (tauri.conf.json "visible": true) and hidden only in setup, after the WebView2 control has been created.

## Investigation, part 2 (2026-11-19, still no app code change)

How the silence was seen on 2026-11-15 (from the history of the smoke script, commit 773a685): the test started the copy with start_in_tray on, then opened its own window, slept 5 s, pressed Ctrl+Alt+Space and only then made its first UI Automation query. The build of that evening is what was released as 0.2.1 (exe dated 2026-11-16 00:21).

Run 2: the same temporary script, 4 starts of the 0.3.3 build and 4 starts of the 0.2.1 exe (a copy of the file from Scoop's 0.2.1 folder, run in a temp folder with an empty database), 75 s between starts, the copy quit normally each time.

- Reproduced once on 0.3.3. First start of the run, the app started before the test window existed, 5 s wait, then the keys. The window was visible and active 234 ms after the keys, the keyboard in the web content, UI Automation reported the search box as focused. NVDA logged the key press and said nothing for 3 s. Nothing after Shift, nothing after Ctrl+F; after Down it said "порожньо", which is the line of the text field of the test window: NVDA still held its focus there and had not noticed the app window at all.
- The other three starts of 0.3.3 in that run (75 s, 75 s and 3 s after the previous copy) were read with the "веб-вміст, регіон" phrases.
- 0.2.1: the first start failed in another way (the window stayed on screen for 20 s although start_in_tray was on; not looked into, old version). The second start, the first one in which the test made a UI Automation query, was read normally through IAccessible2. The third and fourth had the "веб-вміст, регіон" phrases.
- The WebView2 processes of the app were gone within 0.1 s after every exit, so a new copy never met a browser process left over from the previous one.

What the two runs show together about the "веб-вміст, регіон" reading: it does not depend on the time since the previous copy (seen 3, 35 and 75 s after a normal exit) but on the test process. In every test process, the first copy on which the test used UI Automation was read normally or not at all; every copy started later by the same process, after that process had made its first UI Automation query, was read with those phrases (13 of 13). A fresh test process 76 s after the previous one got a normal reading again. So the explanation in DEVELOPMENT.md ("under half a minute after the previous copy was killed") is not the real condition.

Working assumption for run 3: both the silence and the extra phrases come from a UI Automation client (here: the test itself) touching the app around its first show, not from the app alone. Run 3 checks this with one start per fresh process: starts with no UI Automation call at all before and for 3 s after the keys, starts with the first query right after the keys (as on 2026-11-15), and starts with the query right before the keys (as in the silent start of run 2).

## Investigation, part 3 (2026-11-19, still no app code change)

Run 3: 8 starts of 0.3.3 in the tray, each in a fresh test process, 30 s apart. Three kinds: no UI Automation call at all before and for 3 s after the keys; first query 0.43 s after the keys began (as on 2026-11-15); a query right before the keys (as in the silent start of run 2).

- The assumption of part 2 did not hold. Two starts read with the "веб-вміст, регіон" phrases had made no UI Automation call before the keys (in one, NVDA spoke those phrases 0.2 s before the first query of the test). So a query of the test is not needed for that reading. The first start of the run, 7 minutes after the last copy, was read normally.
- All 5 starts in the order of 2026-11-15 (the app is started while another program's window is active, then the test window opens) ended the same way: the window was on screen and stayed there for 20 s although start_in_tray was on. The 3 starts with the test window opened first hid as they should.

Run 4: 5 starts watched for 6 s each (Win32 only: no keys, no NVDA speech read, a fresh process each). Two with no test window at all (the app started by a background process while the user's own window was active, as Windows does it at login), two in the order of 2026-11-15, one with the test window first. All 5 hid as they should: the window was visible for about 240 ms (from 107 to 441 ms after the process started) and then hidden; the app held Ctrl+Alt+Space and answered messages. With no test window the app window took the foreground from the user's window for that time. So "the window stays on screen" was not reproduced a second time (5 of 5 in run 3, 1 of 4 in run 2 with 0.2.1, 0 of 4 in run 4); its condition is not known.

## Result of the investigation

First shows after a start in the tray, 0.3.3, all runs: 19. Read normally 3, silent 1, read with the extra phrases and the search box twice 15. In 6 more starts the window never hid, so no first show was tried.

- The silence of the task description is real on 0.3.3 but rare (1 of 19), and its exact cause is not proven. In that start NVDA had not noticed the app window at all (it still held its focus in the previous window), while the app itself was fine: window active, keyboard in the web content, search box focused.
- Common to every start in the tray, 31 of 31 where the start was watched: the window is created visible and hidden about a quarter of a second later, after the WebView2 control has been created (tauri.conf.json "visible": true, win.hide() in setup). For that time it is on screen, usually as the foreground window; NVDA says "QuickSnippets" and reads the previously active window again. NVDA and Windows therefore meet a half-started window before the user ever asks for it, and everything seen in the first show (silence, extra phrases, the window that stayed) happened after that.
- Decision (user, 2026-11-19, asked through the question dialog): change the app so that the window is created hidden and is shown at startup only when start_in_tray is off; then measure again whether the silence and the extra phrases are gone.
- The explanation in DEVELOPMENT.md for the "веб-вміст, регіон" reading (a copy started under half a minute after the previous one was killed) is not the real condition: it was seen 3, 35, 36 and 75 s after a normal exit, in the same and in a fresh test process, with and without UI Automation calls by the test.

## Fix (2026-11-19, after the user's consent through the question dialog)

- First attempt, not kept: "visible": false in tauri.conf.json and win.show() at the end of setup when start_in_tray is off. Measured on that build (4 watched starts, 6 starts with NVDA): the window was never on screen, and all 6 first shows were read normally. But the hidden window became the foreground window about 0.3 s after the start and stayed it: wry focuses the WebView2 control when it creates it (MoveFocus), also in a hidden window. NVDA then read the invisible window during startup ("QuickSnippets | QuickSnippets - Snippet Manager, документ | невідомо | ... | Пошук, комбінований список, ...") and the keyboard stayed in it. Worse than the flash, so this version was dropped before any commit.
- 91f4afb, kept: Tauri no longer creates the main window itself ("create": false in tauri.conf.json). setup in lib.rs builds it from the same config with WebviewWindowBuilder::from_config and sets visible and focused from show_window_at_launch(start_in_tray): without "Start in tray" both true, exactly what Tauri did before; with it both false. No more win.hide() in setup. A window created without focus is shown without activation (tao uses SW_SHOWNOACTIVATE for it), so showing it relies on the set_focus() call that the hotkey, the tray and the second-launch handler already make after show().
- Two unit tests for show_window_at_launch.

## Measured on the build of 91f4afb (release exe of 17:35)

- Watched starts (Win32 only, no keys), start_in_tray on: app started by a background process with another program's window active, in the order of 2026-11-15, and with the test window first. In all 3 the window was hidden and not the foreground window for the whole 5 s. Default start (start_in_tray off): visible and active 109 ms after the process started, as in 0.3.3.
- 6 starts in the tray with NVDA, each in a fresh test process, 20 s apart, 5 s wait before Ctrl+Alt+Space: 3 with the test window first, 3 in the order of 2026-11-15; no UI Automation call before the keys, in one start the first query 0.44 s after them. During the hidden start NVDA said nothing about the app. All 6 first shows were read the normal way: "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо", 40 to 60 ms after NVDA saw the keys; window visible and active 221 to 238 ms after the keys, keyboard in the web content.
- Before the fix (0.3.3): 3 of 19 first shows read normally, 15 with the "веб-вміст, регіон" phrases, 1 silent. After: 6 of 6 normal here, and 6 of 6 on the first attempt.
- npm run test:all: 489 frontend tests, 247 Rust tests (1 ignored). npm run lint passes.

## Full runs on the fixed build (2026-11-19, release exe of 91f4afb, built 17:35)

- just smoke (default start): 80 of 80 steps, 284 of 284 NVDA checks.
- just smoke-tray, first run: 81 of 81 steps, 292 of 293 NVDA checks. The one failed check is in step 50 (Ctrl+Shift+1 twice): at the second press NVDA read the notification area as one phrase, "Сортування: Найновіші Сортування: Найстаріші", so "Сортування: Найновіші" was said twice. The hand-over note of TASK-19 describes the same failure in two runs made before this task; it was put down there to a missing aria-haspopup, but here it happened with aria-haspopup in place. It has nothing to do with the tray: the default run right after it and the second tray run had the step right.
- just smoke-tray, second run: 81 of 81 steps, 293 of 293 NVDA checks, exit code 0.
- In both tray runs, steps 1 and 79 (start and restart in the tray): the window was never on screen and NVDA said nothing. Steps 2 and 80 (first show after each): "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, ..., порожньо", the search box once. Step 81 (settings right after the first show after the restart) no longer begins with the document and "додаток"; on 0.3.3 it did.
- Totals on the fixed build: 13 of 13 starts in the tray without the window on screen (3 watched, 6 with NVDA, 4 in just smoke-tray); 10 of 10 first shows read normally. On 0.3.3: 3 of 19 normal. The start in which the window stayed on screen (6 times on 0.3.3) has nothing left to go wrong in: the window is not shown at such a start at all.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-5-91f4afb.exe (the tested exe, SHA-256 compared). 8ef2d9c and b6a2f7d after it change only the smoke script and documents.
- No new user-facing strings.
- Every hands-off run was allowed by the user through the question dialog and ended with two beeps: the runs were started from a tool, where the user cannot hear the "Готово" of the script.

## Found on the way, not part of this task (no tasks created)

1. WebView2 keeps its data in %LOCALAPPDATA%\com.quicksnippets.app\EBWebView. Every copy of the app shares that folder (the installed copy, test copies, old versions), and it lies outside quick-snippets-data, against the "portable, no AppData" rule.
2. The message shown when settings.json cannot be read (the dialog in load_settings, settings.rs) exists in Ukrainian only.
3. On the first show after a start NVDA does not read the first snippet after the search box (step 80 only hopes for it: not said in either run); on every later show it does. The same holds for the window opened by a default start.
4. A default start is still read with some noise, as in 0.3.3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | QuickSnippets - Snippet Manager, документ | додаток, пробіл | додаток | додаток | Пошук, ...". NVDA gets the window while the page is still loading. The default start was deliberately left as it was. For the "веб-вміст, регіон" reading after a quick restart of a default start (TASK-18) the condition is still unknown; DEVELOPMENT.md now says so.
5. The sort announcement read twice now and then (see above): seen in TASK-19 and once here.
6. tao's set_focus() presses and releases Alt by itself when Windows refuses to bring the window to the foreground. With "Start in tray" on, set_focus() is now what activates the window after show(). In all measured shows the window was active 0.2 s after Ctrl+Alt+Space, so the plain call was enough; noted only.
7. NVDA logs an error of its own Enter script (script_caret_newLine, IndentNav) once per run, as noted in TASK-18.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
With "Start in tray" on, the window no longer appears at startup, and NVDA reads the first Ctrl+Alt+Space show properly.

Investigation (four hands-off runs on 0.3.3, recorded before any app code change): of 19 first shows after a start in the tray, 3 were read normally, 15 with extra "веб-вміст, регіон" phrases and the search box twice, and 1 not at all (NVDA had not noticed the window; the app itself was fine). In 6 more starts the window never hid. In every watched start the window was created visible and hidden a quarter of a second later: on screen, usually as the foreground window, announced by NVDA. The exact cause of the silent show was not proven. The earlier explanation of the extra phrases (a copy started under half a minute after a killed one) proved wrong.

Fix (91f4afb, with the user's consent): Tauri no longer creates the main window ("create": false in tauri.conf.json). setup in lib.rs builds it from the same config: hidden and without focus when start_in_tray is on, visible and focused as before otherwise. A first attempt that only hid the window was dropped before any commit: the hidden window took the keyboard, because the web content focuses itself when it is created.

Verified on the release build of 91f4afb: 13 of 13 starts in the tray without the window on screen or in the foreground, 10 of 10 first shows read normally, default start as in 0.3.3. just smoke: 80 of 80 steps, 284 of 284 NVDA checks. just smoke-tray, the new mode (scripts/smoke-nvda.ps1 -StartInTray): 81 of 81 steps and 293 of 293 checks in the second run; the first run failed one check in the sort step (announcement read twice), an intermittent failure already seen in TASK-19 and unrelated to the tray. npm run test:all (489 frontend, 247 Rust tests) and npm run lint pass. CHANGELOG [Unreleased] has two Fixed entries; DEVELOPMENT.md and CLAUDE.md describe the new mode and the rule. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-5-91f4afb.exe.

Not done, no tasks created: (1) WebView2 keeps its data in %LOCALAPPDATA%\com.quicksnippets.app\EBWebView, shared by every copy and outside quick-snippets-data; (2) the "settings.json is damaged" dialog exists in Ukrainian only; (3) on the first show after a start NVDA does not read the first snippet, on later shows it does; (4) a default start is read with some repeated phrases, as in 0.3.3, and the cause of the "веб-вміст, регіон" reading after a quick restart of a default start is still unknown; (5) the sort announcement is read twice now and then.
<!-- SECTION:FINAL_SUMMARY:END -->
