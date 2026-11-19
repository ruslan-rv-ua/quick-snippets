---
id: TASK-5
title: Check NVDA on the first show after starting in tray
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-15T23:03:00Z'
updated_date: '2026-11-19T15:22:00Z'
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
- [ ] #2 If reproduced: NVDA announces the window and the search field on the first show after a start in tray
- [ ] #3 just smoke can run in a start-in-tray mode and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/smoke-nvda.ps1: a -StartInTray switch (not app code). The test copy starts with start_in_tray on, the window is first shown by Ctrl+Alt+Space after -TrayIdleSec seconds, and the restart near the end is also a start in tray. Justfile: just smoke-tray. The default run stays as it is.
2. Investigation with the 0.3.3 release build (same code as develop), each run with the user's permission and a minute or more apart: just smoke-tray runs with different waits before the first Ctrl+Alt+Space. Record per first show what NVDA said; a first step with "веб-вміст, регіон" counts as the quick-restart effect, not as this defect.
3. Write the findings into the notes before any app code change.
4. Only if reproduced: describe cause and fix to the user, get consent, fix, rebuild, check with just smoke and just smoke-tray, copy the build to real_db.
5. DEVELOPMENT.md and CLAUDE.md for the new mode; CHANGELOG only if users can notice a change. npm run test:all, npm run lint, git flow finish --no-ff.
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
<!-- SECTION:NOTES:END -->
