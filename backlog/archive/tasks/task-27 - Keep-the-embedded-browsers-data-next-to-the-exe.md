---
id: TASK-27
title: Keep the embedded browser's data next to the exe
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T16:41:00Z'
updated_date: '2026-11-19T18:42:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-high
milestone: m-6
dependencies: []
references:
  - src-tauri/src/lib.rs
  - src-tauri/src/paths.rs
  - README.md
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-5. README promises a portable app: "no installer, no registry, no AppData; the whole app lives in one folder", with all data in quick-snippets-data next to the exe. The embedded browser (WebView2) breaks that promise: with no data folder set, Tauri gives it a profile in %LOCALAPPDATA%\com.quicksnippets.app\EBWebView. A copy run from a USB stick leaves that folder on every computer it runs on, and all copies on one computer (the Scoop copy, the test copies of just smoke, old versions) share one browser profile.

The profile holds only WebView2's own state and cache: the frontend uses no localStorage or IndexedDB, and the settings live in settings.json, so nothing the user set is lost when it moves. Since TASK-5 the main window is built in `setup` in src-tauri/src/lib.rs (`WebviewWindowBuilder::from_config`), so builder options can be set there.

Under Scoop, quick-snippets-data is a persist folder kept between versions. The folder that older versions left in %LOCALAPPDATA% may still be in use by an older copy, so whether the app touches it at all is the user's decision.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A small change in window creation, but where the files go matters for Scoop and for older copies, and NVDA has to be checked on the new build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a start and normal use, the app's browser data lies in the quick-snippets-webview folder next to the exe, outside quick-snippets-data, and nothing is created or changed in %LOCALAPPDATA%\com.quicksnippets.app
- [x] #2 Two copies of the app in different folders no longer share browser data
- [x] #3 Updating from 0.3.3 keeps snippets and settings, also with the Scoop persist folder; what happens to the folder older versions left in %LOCALAPPDATA% is decided with the user and stated in CHANGELOG.md
- [x] #4 `just smoke` with an existing browser profile (-BrowserProfileFrom; with an empty one a default start stops at step 1 until TASK-29, as the user decided) and `just smoke-tray` pass on the new release build (run only with the user's permission)
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
1. paths.rs: get_webview_data_dir(), the folder quick-snippets-webview next to the exe, with unit tests (next to the exe, outside quick-snippets-data, not in AppData).
2. lib.rs setup: WebviewWindowBuilder::data_directory(paths::get_webview_data_dir()). Tauri then never resolves or creates %LOCALAPPDATA%\com.quicksnippets.app.
3. scripts/smoke-nvda.ps1: a last step that checks the test copy's browser data is in quick-snippets-webview next to the test exe, quick-snippets-data holds no browser files, and %LOCALAPPDATA%\com.quicksnippets.app is unchanged by the run (file count and newest change time only).
4. Docs: README (en, uk, de), CHANGELOG [Unreleased], DEVELOPMENT.md, CLAUDE.md.
5. npm run test:all, npm run lint; release build.
6. With the user's permission: a short hidden start in a Scoop-like layout (quick-snippets-data as a junction, then a second app folder on the same data); just smoke and just smoke-tray, a minute apart.
7. Copy the build to C:\5-quicksnippets\real_db; record the checks; git flow feature finish --no-ff; Done, not archived; nothing pushed.

8. Added after the first runs: -BrowserProfileFrom in scripts/smoke-nvda.ps1, a run with an existing browser profile, and the hand-over of the empty-profile default start to TASK-29 (the user's decision); CHANGELOG Known Limitations until then.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research (2026-11-19, before any code change)

- Tauri 2.10.2 (tauri/src/manager/webview.rs): on Windows, when a webview has no data directory, Tauri sets it to %LOCALAPPDATA%\<identifier> (here com.quicksnippets.app) and creates that folder; WebView2 then keeps its profile in EBWebView inside it. With WebviewWindowBuilder::data_directory(path) Tauri uses that path instead, creates it if missing, and never resolves the LocalData path. wry passes it to CreateCoreWebView2EnvironmentWithOptions as the user data folder.
- Not usable: "dataDirectory" in tauri.conf.json (from_config resolves it inside %LOCALAPPDATA%\<window label>\ and ignores absolute paths); the WEBVIEW2_USER_DATA_FOLDER environment variable (Tauri would still create %LOCALAPPDATA%\com.quicksnippets.app).
- Nothing else writes to that folder: the app's own code uses only quick-snippets-data next to the exe; of the four plugins, single-instance uses a named mutex and a hidden window, global-shortcut and clipboard-manager write no files, autostart writes the Run registry value only while autostart is on.
- On this computer the folder holds only EBWebView: 604 files, 102 MB, last change 2026-11-19 18:17. Read with no copy of the app running, and only names at the top level, file count, total size and newest change time.
- The frontend uses no localStorage, sessionStorage, IndexedDB or cookies, and its context menu is off: nothing in the old profile has to be carried over.

## Options shown to the user (question dialog, 2026-11-19)

Where the browser data goes:
1. A subfolder EBWebView inside quick-snippets-data, as AC #1 said. Kept by Scoop persist across updates; backups of quick-snippets-data then include the browser cache, and copying that folder while the app runs may hit a file the browser holds open.
2. A separate folder next to the exe, outside quick-snippets-data. quick-snippets-data keeps only the user's data; under Scoop the folder lies in the version folder, so the browser starts with an empty cache after each update and old versions keep theirs until scoop cleanup; AC #1 has to be reworded.

What happens to %LOCALAPPDATA%\com.quicksnippets.app, left by 0.3.3 and older:
1. Leave it alone: the new version never reads, changes or deletes it; CHANGELOG and README say it can be deleted by hand once 0.3.3 or older is no longer used.
2. Delete it automatically at every start: the app touches AppData again, could remove the data of another program with the same identifier, and the folder comes back after a downgrade.
3. Delete it only on the user's command (a button in the settings): new UI strings in three languages, new NVDA checks, more work.

Follow-up question, the folder name: quick-snippets-webview for any exe (all exes in one folder share it, renaming the exe changes nothing), or <exe name>.WebView2 as WebView2 itself names it (one folder per differently named exe, e.g. per test build in real_db).

## Decision (user, 2026-11-19, question dialog)

- The browser data goes to quick-snippets-webview next to the exe, outside quick-snippets-data. AC #1 reworded to match.
- %LOCALAPPDATA%\com.quicksnippets.app is left alone; CHANGELOG and README tell users they may delete it.
- The format of snippets.db and settings.json does not change.

## Checks on the release build of 226183c (built 19:17)

- Scoop-like layout (temporary script outside the repo, allowed by the user; output ASCII): quick-snippets-data as a junction to a shared "persist" folder, first in app folder v1, then in v2 on the same data to play an update; start_in_tray on, so the copies started hidden; each copy stopped after 3 s. Result: quick-snippets-webview\EBWebView created next to each exe about 0.1 s after the start (159 files, 7.7 MB each); the persist folder held only snippets.db and settings.json; a snippet written into the database between the two starts was still there after the v2 start, snippets.db was byte-identical, and all settings kept their values; %LOCALAPPDATA%\com.quicksnippets.app unchanged before and after (694 items, newest change 18:17:49.264). The script reported a failure that was its own mistake: it counted every visible top-level window of the process, and both copies always have two (the helper windows of tauri-plugin-single-instance and of tao's event loop: WS_VISIBLE | WS_POPUP, layered, 0 x 0, never on screen; the same in 0.3.3). The main window would have been a third; none was seen.
- just smoke, run 1 (19:25, about 105 s after the last copy of the script above had been killed): stopped at step 1. NVDA read the window through UI Automation ("QuickSnippets - Snippet Manager – веб-вміст, регіон | ... документ, http://tauri.localhost/ | за кліком, додаток, Пошук, ..."), so Escape went to NVDA and the window did not hide: the effect described in DEVELOPMENT.md, seen since 0.3.0, whose condition is unknown. New with this build: every test copy now starts with an empty browser profile of its own, where before all copies shared the old, warm one in AppData. Whether that matters is not known after one run. After the run: no copy running, no leftover test folder, %LOCALAPPDATA%\com.quicksnippets.app unchanged.

- just smoke, run 2 (19:36, 10 minutes after the previous copy had been killed): stopped at step 1 with the same reading ("веб-вміст, регіон | ... документ, http://tauri.localhost/ | за кліком, додаток, ..."). NVDA's configuration has no UI Automation setting for Chromium (defaults), and nvda.ini last changed at 10:02, before the passing runs of TASK-5.
- Experiment (allowed by the user): scripts/smoke-nvda.ps1 got -BrowserProfileFrom, which copies a quick-snippets-webview folder left by an earlier copy next to the test exe before the first start. A hidden start of the new build made that profile (159 files, 7.7 MB) and quit normally on WM_CLOSE (code 0); 60 s later just smoke ran with it (19:51): 81 of 81 steps, 284 of 284 NVDA checks. Step 1 was read the normal way, with the noise every default start has had since 0.3.3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | (again) | додаток, пробіл | додаток | додаток | Пошук, комбінований список, згорнуто, ..., порожньо". Step 81 (new): quick-snippets-webview of the test copy 194 files, 9.0 MB at the end; %LOCALAPPDATA%\com.quicksnippets.app unchanged (694 items, newest change 18:17:49). NVDA logged its own Enter script error twice (known, see TASK-18 and TASK-5).
- Finding: a default start (window created visible and focused) with an empty browser profile is read by NVDA through UI Automation, and Escape then goes to NVDA instead of hiding the window: 2 of 2 runs with an empty profile, 0 of 1 with an existing one. An empty profile needs longer to load the page, so NVDA meets the window before the web content is ready. Up to 0.3.3 every copy shared one old profile in AppData, so an empty profile happened about once per computer. With the profile next to the exe it happens at the first start of every new copy, and under Scoop after every update (the folder lies in the version folder).

- just smoke-tray (20:13, empty browser profile, as the first start after an update with autostart): 82 of 82 steps, 293 of 293 NVDA checks. Start in the tray: the window never on screen, NVDA silent (hidden copy ready after 345 ms). First show: read the normal way, "QuickSnippets | QuickSnippets - Snippet Manager, документ | додаток | додаток | Пошук, комбінований список, згорнуто, ..., порожньо", 517 ms from Ctrl+Alt+Space to focus in the search box. The restart in the tray and its first show (steps 79 and 80) the same. Step 82: quick-snippets-webview 190 files, 8.9 MB; %LOCALAPPDATA%\com.quicksnippets.app unchanged. So an empty profile harms only a start with the window open at once: in the tray the page has loaded long before the first show.

- Decision (user, 2026-11-19, question dialog), from three options (fix it in TASK-29; move the profile into quick-snippets-data, where Scoop keeps it across updates; fix it now by showing the window of a default start only once the page is ready): the folder stays next to the exe and the empty-profile default start is fixed in TASK-29, which comes before the release. The finding is in the notes of TASK-29; CHANGELOG [Unreleased] lists it under Known Limitations until then; DEVELOPMENT.md and CLAUDE.md say that a default just smoke stops at step 1 with an empty profile and how to run it with an existing one (-BrowserProfileFrom, kept in scripts/smoke-nvda.ps1).

## Evidence for the criteria and the Definition of Done (2026-11-19)

- AC #1: the last step of just smoke (run with an existing profile, after a full session and a restart) and of just smoke-tray: browser data in quick-snippets-webview next to the test exe (194 and 190 files, 9.0 and 8.9 MB), no EBWebView in quick-snippets-data; %LOCALAPPDATA%\com.quicksnippets.app unchanged by every run of the day (694 items, newest change 18:17:49.264, read only as count and time, with no other copy running).
- AC #2: in the Scoop-like check each app folder got its own quick-snippets-webview; every just smoke test copy started with an empty profile of its own, which is exactly what made the default runs stop at step 1.
- AC #3: db.rs, settings.rs, crypto.rs and commands.rs are unchanged since v0.3.3 (git diff v0.3.3..HEAD empty), so data written by 0.3.3 is read by the same code; in the Scoop-like check the snippet and all settings survived the move to a second app folder on the same junctioned persist folder, and snippets.db stayed byte-identical. 0.3.3 itself was not run: it would have written to %LOCALAPPDATA%\com.quicksnippets.app. The old folder is left alone (the user's decision), stated in CHANGELOG [Unreleased] (Before you upgrade) and in the READMEs.
- AC #4 (reworded with the user's decision on the empty profile): just smoke with an existing profile 81 of 81 steps, 284 of 284 NVDA checks; just smoke-tray with an empty profile 82 of 82, 293 of 293. A default just smoke with an empty profile stopped at step 1 in 2 of 2 runs (handed to TASK-29).
- DoD: npm run test:all (489 frontend tests, 250 Rust tests, 1 ignored) and npm run lint pass; CHANGELOG [Unreleased] has Before you upgrade, Changed and Known Limitations entries for users; no new user-facing strings in the app (the README texts are in en, uk and de); the release exe was rebuilt and the smoke runs above were made on it.
- Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-27-226183c.exe (the tested exe of 19:17, SHA-256 compared). The commits after 226183c change only the smoke script, documents and Backlog. Its first start there begins with an empty browser profile and creates quick-snippets-webview in real_db.

## Noticed, not part of this task (no tasks created)

- README (en) "No registry — QuickSnippets does not touch Windows registry or AppData directories" and the "no registry" in the Portable bullet of all three READMEs: with "Start with Windows" on, tauri-plugin-autostart writes HKCU\Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets (just smoke checks that value).
- The first start with an empty profile: in the tray the copy took about 0.35 s until ready; the browser folder appeared about 0.1 s after the process start. Its size after a full smoke session: about 9 MB.

After the merge into develop (15305e3): npm run test:all (489 frontend, 250 Rust tests) and npm run lint pass again. Nothing was pushed; the task is not archived.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The embedded browser (WebView2) no longer keeps its data in %LOCALAPPDATA%\com.quicksnippets.app. setup in lib.rs now passes paths::get_webview_data_dir(), the folder quick-snippets-webview next to the exe and outside quick-snippets-data, to the window builder's data_directory, so Tauri never resolves or creates the AppData folder. The user chose this from the options in the notes: a separate folder next to the exe, so quick-snippets-data and its backups (and Scoop persist) keep only snippets and settings, with the same name for any exe. The folder older versions left in AppData is not touched; CHANGELOG and the READMEs say it may be deleted once 0.3.3 or older is no longer used.

Verified on the release build of 226183c: in a Scoop-like layout (junctioned persist folder, a second app folder as the update) the browser data went next to each exe, persist kept only snippets.db and settings.json, a snippet and all settings survived, and AppData stayed unchanged. just smoke with an existing browser profile: 81 of 81 steps, 284 of 284 NVDA checks; just smoke-tray with an empty one: 82 of 82, 293 of 293. A new last step in both checks where the test copy keeps its browser data and that %LOCALAPPDATA%\com.quicksnippets.app is unchanged. npm run test:all (489 frontend, 250 Rust tests) and npm run lint pass.

Found and handed over: a default start (window open at start) with an empty browser profile is read by NVDA through UI Automation, and NVDA takes Escape: just smoke stopped at step 1 in 2 of 2 runs. With the folder next to the exe this happens at the first start of every new copy and, under Scoop, after every update. By the user's decision TASK-29 fixes it before the release; until then CHANGELOG lists it under Known Limitations, and scripts/smoke-nvda.ps1 has -BrowserProfileFrom for runs with an existing profile. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-27-226183c.exe. Noticed, no task: the READMEs say "no registry", but autostart writes a Run value.
<!-- SECTION:FINAL_SUMMARY:END -->
