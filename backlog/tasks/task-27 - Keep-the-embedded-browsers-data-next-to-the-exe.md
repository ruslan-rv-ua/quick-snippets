---
id: TASK-27
title: Keep the embedded browser's data next to the exe
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-19T16:41:00Z'
updated_date: '2026-11-19T17:15:00Z'
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
- [ ] #1 After a start and normal use, the app's browser data lies in the quick-snippets-webview folder next to the exe, outside quick-snippets-data, and nothing is created or changed in %LOCALAPPDATA%\com.quicksnippets.app
- [ ] #2 Two copies of the app in different folders no longer share browser data
- [ ] #3 Updating from 0.3.3 keeps snippets and settings, also with the Scoop persist folder; what happens to the folder older versions left in %LOCALAPPDATA% is decided with the user and stated in CHANGELOG.md
- [ ] #4 `just smoke` and `just smoke-tray` pass on the new release build (run only with the user's permission)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
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
<!-- SECTION:NOTES:END -->
