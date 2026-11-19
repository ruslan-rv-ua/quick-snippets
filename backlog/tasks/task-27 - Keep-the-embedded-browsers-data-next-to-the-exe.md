---
id: TASK-27
title: Keep the embedded browser's data next to the exe
status: To Do
assignee: []
created_date: '2026-11-19T16:41:00Z'
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
- [ ] #1 After a start and normal use, the app's browser data lies inside quick-snippets-data next to the exe, and nothing is created or changed in %LOCALAPPDATA%\com.quicksnippets.app
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
