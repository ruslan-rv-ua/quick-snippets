---
id: TASK-32
title: Investigate the slow first show of the window under full processor load
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T23:24:00Z'
updated_date: '2026-11-21T21:46:00Z'
labels:
  - investigation
  - performance
  - accessibility
  - model-opus
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/startup.rs
  - src-tauri/src/lib.rs
  - src/App.tsx
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-29. In its prototype runs with all 20 logical processors of the computer kept busy, the window of a default start appeared only 8 to 12 s after the start (NVDA read it correctly). Without load it appears about 0.5 s after the start, or about 1.5 s with a screen reader running. Why the start took that long under load was not looked into. Details: notes of the archived TASK-29 (prototype run 4).

Since TASK-29 the window of a default start is created hidden and shown only when the page reports that its first list is loaded with the saved theme, language and sort order (`frontend_ready`), and with a screen reader running only after a pause of three times the start time, between 1 and 4 s (`src-tauri/src/startup.rs`). If the page does not report within 3 s, the start-up goes on without it. Under load each part can take longer: the embedded browser's start, the page's two list loads, the pause and the 3 s fallback. The prototype runs used fixed pauses (1 and 2.5 s), so the current build may behave differently.

Find out where the time goes under load and whether the app can shorten it without bringing back the wrong NVDA reading of TASK-29: a window shown less than about 0.6 s after the page was ready was read the wrong way. Investigation first: no code change until the findings are in the notes and the user agrees to a change. If the time is simply what the embedded browser needs on a fully loaded computer, recording that is the result.

Hands-off runs take the keyboard: ask the user before every run, start only test copies (never the user's installed copy), and end each run with two beeps. Read NVDA speech only through just smoke or the bytes NVDA's log gets during the run itself; suggest Do Not Disturb first, since NVDA also speaks notifications of other programs.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort medium (`/effort medium`). Measurement work with several moving parts (the embedded browser, the page, the app's own waits), but a narrower question than TASK-29.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On the current release build under full processor load, the time from the start to the window on screen is measured in stages (process start, page loaded, frontend_ready, show), with and without a screen reader, and compared with the time 0.3.3 needs to show its list under the same load; runs, load and times are recorded in the notes before any code change
- [x] #2 The notes name what takes the time under load (the embedded browser, the page, or the app's own waits such as the pause and the 3 s fallback) and whether the app can shorten it without the wrong NVDA reading of TASK-29
- [x] #3 If the user agrees to a change: under the same load the window of a default start appears sooner than before, complete, and NVDA reads it correctly; just smoke and just smoke-tray pass
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
1. Investigation without code changes. A measuring tool outside the repo watches each start of a throwaway test copy from outside (windows, the processes of the embedded browser with their creation time, processor time and priority, focus and foreground events) and reads NVDA's log only for the bytes written during that start. A measuring build of the same source (a scratch copy outside the repo, never committed) writes the time of every stage of the start-up and can be told that no screen reader runs.
2. Run 1, no load: the current release build, the measuring build with and without the screen reader pause, 0.3.3, a start in the tray.
3. Runs under full processor load (20 busy threads of normal priority on 20 logical processors): the same sets, so that each stage can be compared with and without load and with 0.3.3.
4. Findings into the notes: where the time goes, whether it harms the user or NVDA's reading, what the app could do about it.
5. Options shown to the user through the question dialog, "change nothing" among them. No code change before the user's choice.
6. If a change is chosen: feature branch, tests, lint, release build to real_db, just smoke and just smoke-tray (each with permission), merge into develop. Nothing pushed.

7. Chosen by the user: the browser argument --disable-renderer-backgrounding next to --force-renderer-accessibility (constant BROWSER_ARGUMENTS in src-tauri/src/lib.rs, guarded by unit tests); CHANGELOG [Unreleased], CLAUDE.md, DEVELOPMENT.md; the final release build measured under the same full load with the probe, then just smoke and just smoke-tray.

8. Outcome: after the check of the final build the user had the change rolled back. develop is unchanged; the fix stays on the unmerged local branch feature/page-process-priority; just smoke and just smoke-tray were not run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-21, before any code change)

Computer: Intel Core i5-14500 (14 cores, 20 logical processors), Windows 11 Pro 26200, power plan "High performance", WebView2 runtime 157.0.4341.60, NVDA 2026.2 running in every run. Build under test: the release exe of d7fee2f (built 21.11.2026 21:32; develop 91d923f differs from it in documents only).

Tools, all outside the repo (session scratch folder):
- A probe (PowerShell 5.1 with a C# class) that starts one throwaway test copy at a time and watches it from outside: its windows (seen, visible, foreground), foreground/focus/show events, every process of the copy (creation time, processor time, priority class, Windows efficiency mode, base priorities of the threads; sampled every 50 ms), NVDA's helper DLL in the app and browser processes. After the window is in front it waits 3.5 s (5 s under load), presses Escape (only if the test window is in front) and a second time if the window stayed. All times below are milliseconds since Windows created the process of the test copy.
- A measuring build: a scratch copy of the source at 91d923f, never committed, with stage marks written to a file (Rust: run, setup, window built, page load started/finished, each IPC call, frontend_ready, pause, show; page: first script, React mount, the two list loads) and three switches for runs only: pretend the screen reader flag is off, extra browser arguments, another ready timeout. Built with the normal release profile. Its times match the unchanged release exe (below).
- Load: a separate process of normal priority with 20 threads that never sleep (one per logical processor), switched on 1.8 s before each start and off after the Escape check; it ends by itself after 75 s.
- Each test copy: its own folder, settings as in just smoke (uk, dark, confirm on close off), a database with two plain snippets. First start of a folder = empty browser profile, later starts = existing profile. 0.3.3 is the exe from Scoop's cache (quick-snippets#0.3.3#9eed3c1.zip, same file as the installed 0.3.3); its browser data were sent to the test folder with WEBVIEW2_USER_DATA_FOLDER, and %LOCALAPPDATA%\com.quicksnippets.app was counted before and after each of its starts (694 items, unchanged).
- NVDA's log was read only for the bytes written during each start; a line was kept as text only if it was about the test copy, anything else only counted (none appeared). The user's autostart values were read before and after every run and stayed as they were (Run entry absent, mark 02 00 00 00 00 00 00 00 00 00 00 00). No copy of the user was running.

Permissions (question dialog, each asked right before its run): run 1 «Так, запускай», and for starting 0.3.3 with its browser data redirected «Так, з перенаправленням (Recommended)»; the run stopped after 8 s on an error in the probe's own report code, and the repeat was allowed with «Так, запускай»; run 2 (full load) «Так, запускай» and, asked about NVDA's speech (run 1 had no speech entries in the log, the speech had been off), «Мовлення буде ввімкнене».

### Run 1, no load (10 starts)

- Unchanged release exe: window on screen at 1350 (empty profile), 1281 and 1289 (existing profile).
- Measuring build, screen reader flag as Windows reports it: empty profile: window built (WebView2 created) 273, page load started 331, first script 344, page load finished 348, frontend_ready 370, pause 1047 (start time 349), show 1418, on screen 1420. Existing profile: 228, 239, 251, 255, 276, pause 1000, 1286, 1294.
- Measuring build told that no screen reader runs (NVDA itself stayed on): window built 225 and 220, frontend_ready 269 and 263, on screen 281 and 280. NVDA kept the first Escape in 2 of 2: the wrong reading TASK-29 describes for a window shown right when the page is ready.
- 0.3.3: window on screen at 33 and 27 (it is created visible), its list in the accessibility tree at 429 and 324; NVDA kept the first Escape in 2 of 2.
- Start in the tray, Ctrl+Alt+Space sent 2.07 s after the start: on screen at 2073.
- The 3 s fallback counts from the end of setup: it fired at about 3230, long after frontend_ready, and did nothing.

### Run 2, all 20 logical processors busy (6 starts)

- Unchanged release exe: window on screen at 11503 (empty profile), 14218 and 2279 (existing profile).
- Measuring build: empty profile: window built 6327, page load started 6344, frontend_ready 6407, pause 4000 (start time 6365), show 10417, on screen 10419 (in front only at 13288). Existing profile: 5251, 5263, 5313, pause 4000, 9317, 9326; and 7595, 7608, 7655, pause 4000, 11671, 11677.
- NVDA, 6 of 6: "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо | проба другий сніпет, 1 із 2", and the first Escape hid the window. The slow start is read correctly.

### Where the time goes

1. 5 to 10 s: creating the embedded browser's view (the `build()` call in setup, 0.2 s without load). The browser's page process (renderer) is created about 0.3 s after the start and 0.1 s later the browser puts it into the lowest priority class (IDLE, base priority 4) with Windows' efficiency mode (EcoQoS). It stays there until the view is created: 409 to 5284, 460 to 7637, 530 to 6331, 502 to 7452, 407 to 10177 ms in the five slow starts; in the one fast start (2279) only 456 to 568. With 20 threads of normal priority busy, a process of that class gets the processor only when Windows rescues starved threads, every few seconds; the app's own process and the browser's main process do nothing in that time (their processor time does not grow). As soon as the view exists the page process is back at normal priority and the page loads in 60 to 80 ms, as without load.
   The same low-priority moment exists without load (seen in 5 of 8 starts of the current build as one sample around 220 ms); there it costs nothing because free processors run the process anyway. In 0.3.3 it was not seen at the start in run 1 (to be checked under load in run 3).
2. 4 s: the app's own pause for a screen reader. It is three times the start time, at most 4 s; with the start already 5 to 10 s long it is always the full 4 s.
3. Not involved: the page (its two list loads take a few ms), the 3 s fallback (it counts from the end of setup), NVDA.

### Run 3, all 20 logical processors busy (10 starts)

Permission (question dialog, right before the run): «Так, запускай». NVDA's speech was on. %LOCALAPPDATA%\com.quicksnippets.app: 694 items before and after each of the three starts of 0.3.3, unchanged.

- 0.3.3 under the same load: window on screen at 91 (empty profile), 65 and 66; its list in the accessibility tree at 747, 573 and 561. Its page process stayed at normal priority from its creation in 3 of 3: the window is visible when the browser's view is created. NVDA: with the empty profile the wrong reading ("QuickSnippets - Snippet Manager – веб-вміст, регіон | ... документ, http://tauri.localhost/ | за кліком, додаток | додаток | додаток | Пошук, комбінований список, розгорнуто", first Escape kept by NVDA); with the existing profile the repeated phrases of 0.3.3 ("документ" twice, "додаток, пробіл"), the first snippet not read, first Escape hid the window.
  So the slow start under load is not what the embedded browser needs on a loaded computer: 0.3.3 has its list after 0.6 to 0.75 s under the same load. It came with the window that is created hidden (0.3.4, TASK-29): for a hidden window the browser starts its page process at the lowest priority.
- Measuring build without the screen reader pause (what a user without a screen reader gets today): window built 9398 and 1494, on screen at 9470 and 1569 (page process in the IDLE class 462 to 9438 and 464 to 1539). NVDA, still running, read both the wrong way and kept the first Escape, as expected for a window shown right when the page is ready: the pause is still needed under load.
- Possible remedy, measured with the measuring build: the browser argument `--disable-renderer-backgrounding` next to `--force-renderer-accessibility` (the browser then never lowers the priority of its page process). Under the same load, screen reader pause on: window built 452, 451, 435; frontend_ready 564, 513, 506; pause 1599, 1470, 1434; window on screen at 2170 (empty profile), 1986 and 1941. The page process stayed at normal priority. NVDA, 3 of 3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо | проба другий сніпет, 1 із 2", first Escape hid the window.
- The same argument without the pause: on screen at 517 and 500 (NVDA read these the wrong way, as every window shown without the pause).

Comparison under full load, window on screen: current build with a screen reader 9.3 to 14.2 s (one start of six 2.3 s), without a screen reader 1.6 to 9.5 s; with the argument 1.9 to 2.2 s and 0.5 s; 0.3.3 at once, list after 0.6 to 0.75 s. Without load: 1.3 to 1.4 s with a screen reader, 0.28 s without.

Microsoft's page on WebView2 browser flags (learn.microsoft.com, webview-features-flags, read 2026-11-21) does not list this argument and says of all flags: "Apps in production shouldn't use WebView2 browser flags, because these flags might be removed or altered at any time, and aren't necessarily supported long-term." It is a Chromium switch; the app already ships one such argument (`--force-renderer-accessibility`). If it stopped working one day, the start would be as it is now.

### Run 4: does the argument change anything else (9 starts, 5 without load, 4 under full load)

Permission (question dialog, right before the run): «Так, запускай». NVDA's speech was on.

- Without load, with the argument: window on screen at 1392 (empty profile), 1293 and 1271; without it in the same run 1269. NVDA read all three as in run 2 (window and document once, search box once with its states, first snippet), first Escape hid the window.
- Start in the tray with the argument, Ctrl+Alt+Space 2.0 s after the start: on screen 73 ms after the key, read correctly.
- Start in the tray under full load, Ctrl+Alt+Space after 2.0 s and again every 1.7 s until the window was there. Current code: window built only at 9919, and the app registers its hotkey and makes its tray icon after that, so the five presses before it were lost; the next press was remembered and shown after the 4 s pause, window on screen at 13992 (12 s after the first press). With the argument: window built at 400, the first press (2013) showed the window at 2079. Both read correctly.
- A later show under load (copy started and hidden without load, load switched on 3 s later, then Ctrl+Alt+Space): window on screen 68 ms after the key without the argument, 65 ms with it; both read correctly, first Escape hid the window. Later shows do not suffer from the load.
- While the window is hidden, the page process stays at normal priority also without the argument (watched for 5.4 s after hiding; the page is never told that it is hidden, its visibility state stays "visible"). The browser lowers its priority only between creating the process and creating the view, and again while the app quits. So the argument changes exactly that first moment and nothing during the rest of the app's life.

### Findings

- What takes the time under full load: the embedded browser, but only because of how the app starts it since 0.3.4. For a window that is created hidden the browser starts its page process in the lowest priority class with Windows' efficiency mode and raises it only when the view exists; creating the view needs that very process, and with every processor busy it waits 5 to 10 s for Windows to rescue it. On top comes the app's own pause for a screen reader, 4 s, its maximum, because it is three times the start time. The page, the 3 s fallback and NVDA take no part.
- Harm to the user: with a screen reader the window of a default start appears after 9 to 14 s instead of 1.3 s; without one after 1.6 to 9.5 s instead of 0.3 s. With a start in the tray there is no hotkey and no tray icon for the first 5 to 10 s, and presses of Ctrl+Alt+Space in that time are lost. Nothing is read wrongly: NVDA read every slow start correctly (9 of 9 with the pause), and the window appears complete. Later shows are not affected. The condition is rare on this computer (every one of 20 logical processors busy with work of normal priority, as during a large build); on a computer with few processors it is reached far sooner, for example while other programs start after login.
- Can the app shorten it without the wrong reading: yes, with one more browser argument, `--disable-renderer-backgrounding`. Measured on the measuring build: under the same load the window is on screen after 1.9 to 2.2 s (0.5 s without a screen reader), the pause then being about 1.5 s; NVDA read it correctly in 8 of 8 starts with the pause (3 under load, 3 without, 2 in the tray), nothing else changed without load or while hidden. The pause itself must stay: every window shown without it was read the wrong way, also under load (6 of 6).
- Cost and risk of the argument: Microsoft does not promise that browser flags keep working (see run 3); if this one stopped, the start would be as it is now. No effect on the hidden app was found, since its page process is at normal priority there anyway.

## Decision (user, 2026-11-21, question dialog)

Shown: the measured times (1.3 s without load; 9 to 14 s under full load, 1.6 to 9.5 s without a screen reader; read correctly), the cause in plain words, the lost Ctrl+Alt+Space of a start in the tray, the 0.6 to 0.75 s of 0.3.3, and three options: «Аргумент браузера (Recommended)» (add `--disable-renderer-backgrounding`; measured 2 s under the same load, 0.5 s without a screen reader, hotkey in the tray after 0.4 s, NVDA correct 8 of 8, nothing changes without load; risk: Microsoft does not promise such arguments forever, and if this one stops working the start is as now; tests, build, just smoke and just smoke-tray needed, each run asked for), «Нічого не міняти», «Лише коротша пауза NVDA» (largest pause 4 s to 2 s: only 2 s of 9 to 14, the cause stays, may bring back the wrong reading on slow computers, not measured; not recommended).

- The user chose «Аргумент браузера (Recommended)».

## Fix (2026-11-21, after the user's choice)

- Branch feature/page-process-priority. d7df175 (src-tauri/src/lib.rs, CHANGELOG.md): the browser arguments are the constant BROWSER_ARGUMENTS, "--force-renderer-accessibility --disable-renderer-backgrounding", with the reasons for both in its comment; three unit tests guard them. 2a6143a: CLAUDE.md and DEVELOPMENT.md (cause, measurements, what not to remove).
- cargo fmt --check clean; npm run test:all: 625 frontend tests, 392 Rust tests (1 ignored); npm run lint passes. Release build of d7df175 made 23:28 (sha256 B78EC432…EF490F), the new argument string is in the exe.

### Run 5: the final release build under the same full load (5 starts)

Permission (question dialog, right before the run): «Так, запускай». NVDA's speech was on.

- Default start, all 20 logical processors busy: window on screen at 2664 (empty profile), 1911 and 2104 (before the change 11503, 14218 and 2279 with the unchanged build, run 2). The page process stayed at normal priority. NVDA, 3 of 3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, порожньо | проба другий сніпет, 1 із 2"; the first Escape hid the window. The window appears complete: the search box with its states and the first snippet are read at once, and in the measuring build the show always came after frontend_ready.
- In the second of these starts the window was on screen at 1911 but became the foreground window only at 6296; NVDA read it then, correctly (see "Noticed" 2).
- Default start without load: on screen at 1308, read correctly.
- Start in the tray under load, Ctrl+Alt+Space at 2024: on screen at 2127, but NVDA read it the wrong way ("QuickSnippets - Snippet Manager – веб-вміст, регіон" twice, the search box without its states) and kept the first Escape. The same scenario had been read correctly in run 4. Run 6 looked into it.

### Run 6: is that wrong reading caused by the change? (11 starts in the tray, 10 under full load)

Permission (question dialog, right before the run): «Так, запускай». Measuring build with an existing profile; Ctrl+Alt+Space was pressed a set time after the app's start-up was over (the gate open, read from the trace file).

- Without the argument (the code as before), key 2 s after the start-up was over, i.e. 12 to 13 s after the start: read correctly, the wrong way, correctly (1 wrong of 3).
- With the argument, key 0.3 s after the start-up was over (2.1 to 2.5 s after the start): correctly 3 times, the wrong way once (1 wrong of 4).
- With the argument, key 6 s after the start-up was over (8 s after the start): correctly 3 of 3.

So the wrong reading does not come from the change. All first shows by Ctrl+Alt+Space under full load taken together: without the argument 1 wrong of 4, with it 2 wrong of 9. Windows that open by themselves at a default start were read correctly under full load in 12 of 12 (6 without the argument, 6 with it), and every first show by the hotkey without load was read correctly (3 of 3 here, 9 of 9 in TASK-29). It is the race inside NVDA that TASK-29 describes, lost more often when NVDA has just handled a key press and the computer is fully busy; the pause cannot help, since the start-up is long over when the key comes.

### Noticed, not part of this task (no tasks created)

1. Under full processor load, the first show of the window by Ctrl+Alt+Space after a start in the tray is read by NVDA the wrong way in about one of four (3 of 13), with the first Escape kept by NVDA; with or without this change, also 12 s after the start. Later shows under load were read correctly (2 of 2).
2. Under full load the window is now and then on screen for 2 to 4.4 s before it becomes the foreground window and gets the keyboard (3 of 29 first shows under load: at 10.4 to 13.3 s and 13.1 to 15.4 s without the argument, at 1.9 to 6.3 s with it). NVDA read each of them correctly once the window was in front. Not looked into; the show and the request for the keyboard are made by the app at the same moment.
3. The 3 s fallback for a page that never reports counts from the end of setup, so it cannot shorten a slow creation of the browser's view.
4. If the browser argument stopped working after an update of WebView2, nothing would report it: the start on a fully busy computer would just be slow again. just smoke does not check the priority of the page process.
5. In run 1 NVDA's speech was switched off (no speech entries in the log, only keys); the probe then judges the reading only by the first Escape. just smoke would fail all its speech checks in that case.

Correction to the run 6 paragraph above: first shows by the hotkey without load were read correctly in 2 of 2 starts of this task (run 1, judged by the first Escape because NVDA's speech was off, and run 4), and in 5 of 5 in TASK-29 when the key came at least 0.7 s after the page was ready; not "3 of 3" and "9 of 9".

## Second decision (user, 2026-11-21, question dialog, after runs 5 and 6)

Shown: the result of the check of the final build (a default start under full load shows the window after 1.9 to 2.7 s instead of 9 to 14 s, read correctly 3 of 3) and the finding of runs 5 and 6 (after a start in the tray, a first show by Ctrl+Alt+Space under full load is read the wrong way about one time in four; not caused by the change: 1 of 4 without it, 2 of 9 with it; not seen without load or on later shows). Asked whether to finish the chosen change, with the options «Так, завершуй (Recommended)» and «Ні, відкотити зміну», and in the same dialog for permission to run just smoke and just smoke-tray, with the options «Так, обидва поспіль», «Лише just smoke», «Ні, не зараз».

- The user chose «Ні, відкотити зміну» and, for the smoke runs, «Ні, не зараз».

So the change is not part of the product. develop stays at 91d923f plus this task's Backlog record: no code, CHANGELOG, CLAUDE.md or DEVELOPMENT.md change. The work is kept on the unmerged local branch feature/page-process-priority (d7df175 code, tests and CHANGELOG entry; 2a6143a and b4e2001 documents), not pushed; it can be finished later with `git flow feature finish --no-ff page-process-priority` after just smoke and just smoke-tray, or removed with `git branch -D feature/page-process-priority`. just smoke and just smoke-tray were not run on that build. No build of it was copied to real_db. The release exe in src-tauri/target/release was rebuilt from develop afterwards.

## Checks after the rollback (develop, 91d923f)

- npm run test:all: 625 frontend tests, 389 Rust tests (1 ignored). npm run lint passes. Release exe rebuilt from develop at 23:45 (sha256 63CCB994…B086C6); it holds only --force-renderer-accessibility.
- 52 starts of test copies in all (51 measured, one in the aborted first run), 5 of them 0.3.3. No test copy and no load process was left after any run; the user's autostart values were the same before and after every run; %LOCALAPPDATA%\com.quicksnippets.app had 694 items before and after each start of 0.3.3.
- NVDA's log: in the byte ranges of the 51 measured starts there was only speech about the test copy and the title of the probe's own window; no line had to be hidden and no notification was masked.

## Evidence for the criteria and the Definition of Done

- AC #1: the stages (process start, view created, page load started and finished, frontend_ready, pause, show, window on screen) are measured on the unchanged release build from outside and on the measuring build of the same source from inside, with the screen reader pause and without it, without load and with all 20 logical processors busy, and compared with 0.3.3 under the same load: "Investigation", runs 1 to 3, written before the feature branch existed. "Without a screen reader" was measured with NVDA still running and the measuring build told that the flag is off; NVDA was never closed.
- AC #2: "Where the time goes" and "Findings": the creation of the browser's view (its page process starved at the lowest priority) and the app's 4 s pause; the app can shorten it with one browser argument without the wrong reading for a default start.
- AC #3: does not apply in the end. The user first chose the change and then, after the check of the final build, had it rolled back («Ні, відкотити зміну»). Measured on the branch before that: a default start under the same load 1.9 to 2.7 s instead of 9 to 14 s, complete, read correctly 3 of 3 (6 of 6 with the measuring build). just smoke and just smoke-tray were not run («Ні, не зараз»).
- DoD #1 and #2: pass on develop after the rollback. #3: no user-visible change, nothing to add. #4: no new strings. #5: nothing in develop changed; the release exe was rebuilt from develop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No change was made to the product. The investigation is the result; a fix was built and measured on a branch and then rolled back at the user's decision.

Measured (i5-14500, 20 logical processors, WebView2 157, NVDA 2026.2; 52 starts of throwaway test copies, six hands-off runs, each allowed by the user right before): without load the window of a default start is on screen after 1.3 s with a screen reader (page ready after 0.27 s, pause 1 s), after 0.28 s without one. With all 20 logical processors busy with threads of normal priority: 9 to 14 s with a screen reader (5 of 6 starts, one 2.3 s), 1.6 to 9.5 s without one; with a start in the tray there is no hotkey and no tray icon for the first 5 to 10 s, and presses of Ctrl+Alt+Space in that time are lost. NVDA read every slow default start correctly (6 of 6), and the window was complete.

Cause: for a window created hidden (since 0.3.4) the embedded browser starts its page process in the lowest priority class with Windows' efficiency mode and raises it only once the browser view exists, and creating the view needs that very process. Under full load it starves for 5 to 10 s inside the `build()` call of setup; then the app's pause for a screen reader adds its maximum of 4 s, being three times the start time. The page, the 3 s fallback and NVDA take no part. 0.3.3, whose window was visible at that moment, shows its list after 0.6 to 0.75 s under the same load.

Remedy found and measured: the browser argument `--disable-renderer-backgrounding` next to `--force-renderer-accessibility`. Under the same load the window of a default start is on screen after 1.9 to 2.7 s (0.5 s without a screen reader) and is read correctly (6 of 6 with the measuring build and with a release build), the hotkey of a start in the tray works after 0.4 s; nothing changes without load or while the window is hidden. The pause must stay: a window shown without it was read the wrong way in 6 of 6, four of them under load. Microsoft does not promise that browser flags keep working.

Decisions of the user (question dialog, verbatim in the notes): first «Аргумент браузера (Recommended)»; after the check of the final build, which also showed a wrong reading that is not caused by the change, «Ні, відкотити зміну», and for just smoke and just smoke-tray «Ні, не зараз». So develop is unchanged (91d923f plus this record); the fix stays on the unmerged, unpushed local branch feature/page-process-priority (d7df175, 2a6143a, b4e2001: code with unit tests, CHANGELOG entry, CLAUDE.md, DEVELOPMENT.md). It passed npm run test:all and npm run lint there; just smoke and just smoke-tray were not run on it, and no build was copied to real_db. After the rollback npm run test:all (625 frontend, 389 Rust tests) and npm run lint pass on develop, and the release exe was rebuilt from develop.

Noticed, no tasks created: (1) under full load the first show of the window by Ctrl+Alt+Space after a start in the tray is read by NVDA the wrong way about one time in four (3 of 13), with or without the fix, also 12 s after the start; windows that open by themselves and later shows were read correctly; (2) under full load the window is now and then on screen for 2 to 4.4 s before it gets the keyboard (3 of 29); (3) the 3 s fallback counts from the end of setup and cannot shorten a slow creation of the view; (4) nothing would report it if the argument stopped working; (5) with NVDA's speech switched off, NVDA writes no speech to its log. The measuring tool is outside the repo; a copy lies in the shared notes folder of the managing session (task-32-measuring-tool).
<!-- SECTION:FINAL_SUMMARY:END -->
