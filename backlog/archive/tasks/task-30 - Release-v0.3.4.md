---
id: TASK-30
title: Release v0.3.4
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T16:42:00Z'
updated_date: '2026-11-20T05:04:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-6
dependencies:
  - TASK-27
  - TASK-28
  - TASK-29
  - TASK-31
  - TASK-35
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the fixes made after 0.3.3: with "Start in tray" the window no longer flashes at startup and takes the keyboard, and NVDA reads the first Ctrl+Alt+Space show properly (TASK-5, already in develop); the browser data stays next to the exe (TASK-27, already in develop); translated startup error dialogs, and a damaged database that is kept instead of deleted (TASK-28); turning "Start with Windows" off also removes the Task Manager mark from the registry (TASK-31); and whatever TASK-29 changes, including the fix for the first default start with an empty browser profile. Planned as a patch release: none of these tasks is meant to change the database or the settings format, so going back to 0.3.x stays safe. The user chose 0.3.4 (2026-11-19); if one of the tasks does change a format, ask the user about the version again. CHANGELOG [Unreleased] must not ship the Known Limitations entry TASK-27 added, unless the user accepts it.

Same procedure as v0.3.3 (DEVELOPMENT.md; see the archived TASK-24). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; if it fails, fix the cause and run it again. Pushing and running workflows need the user's go-ahead, and so do the just smoke and just smoke-tray runs (about two and a half minutes each; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.4 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.3.4 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [x] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.4 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.4 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-30-<short commit>.exe
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
1. git flow release start 0.3.4; version 0.3.4 in package.json, tauri.conf.json, Cargo.toml and both lock files; CHANGELOG [Unreleased] becomes "v0.3.4 - 2026-11-20".
2. On the release branch: npm run test:all, npm run lint, just final-checks, npx tauri build --no-bundle.
3. just smoke and just smoke-tray on that release exe (a minute apart); compare the user's autostart values before and after.
4. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-30-<short commit>.exe and compare SHA-256.
5. git flow release finish 0.3.4 --no-ff --notag --no-push; push main and develop (no tags; CI does not run on push).
6. Release workflow on main with version 0.3.4; check the ZIP and .sha256; release notes = the v0.3.4 CHANGELOG section.
7. Excavator in scoop-bucket; manifest shows 0.3.4. Back up C:\scoop\persist\quick-snippets\quick-snippets-data with checksums, scoop update quick-snippets, checksums after match; the app is not started.
8. Notes, acceptance criteria, final summary, status Done (not archived); hand-over note task-30-release-handover.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.4 (version bump 18457db):
- npm run test:all: 502 Vitest tests in 26 files and 299 Rust tests (1 ignored), all pass. npm run lint: pass.
- just final-checks: versions match (0.3.4), tsc, clippy, Rust and Vitest tests, build OK; exe 3.7 MB.
- npx tauri build --no-bundle: OK, exe 3,864,576 bytes, file version 0.3.4, SHA-256 BA387047...01E1.
- just smoke on that release exe: 82 of 82 steps OK, NVDA checks 301 of 301, 171 s. The settings dialog reads "QuickSnippets версія 0.3.4". The NVDA log had the one known error of NVDA's own script_caret_newLine (Enter in a text field).
- just smoke-tray a minute later on the same exe: 83 of 83 steps OK, NVDA checks 300 of 300, 179 s. The window never appeared during the start in the tray, and NVDA read the first Ctrl+Alt+Space properly, also after the restart. No errors in the NVDA log.
- The user's autostart values were the same before the runs and after each of them (no Run entry; the old StartupApproved mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), according to the script's report and a separate read-only check.
- CHANGELOG: [Unreleased] turned into "v0.3.4 - 2026-11-20" unchanged, with an empty [Unreleased] above it: Before you upgrade (2 entries), Changed (2) and Fixed (10), all user-facing; no Known Limitations entry. No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-30-18457db.exe (same SHA-256 as the build).

Release:
- git flow release finish 0.3.4 --no-ff --notag --no-push: main got the release merge commit eb981c5 "Merge branch 'release/0.3.4'" (parents 04c2f78 and f089d0d); develop got merge 1f109ac. main and develop have the same tree, and no local tag was created. Pushed main and develop (no tags); CI did not start on the push, as intended.
- Release workflow run 44677306941 on main eb981c5 passed in 8.3 min: build, lint, Vitest and Rust tests, Tauri build, ZIP, tag push and the release step all succeeded. Tag v0.3.4 is on eb981c5 (a later git fetch --tags brought it here too; it matches GitHub).
- Release https://github.com/ruslan-rv-ua/quick-snippets/releases/tag/v0.3.4 (Latest, not a pre-release) has quick-snippets-0.3.4-windows-x64.zip (2,004,061 bytes) and its .sha256; the checksum 85a02ccc...0ce5 matches the downloaded ZIP. The ZIP holds quick-snippets.exe (file version 0.3.4, 3,850,752 bytes), LICENSE and README.md. The generated notes ("Full Changelog" link only) were replaced with the v0.3.4 CHANGELOG section; checked to be identical to that section on main.
- Excavator run 44678330922 in scoop-bucket passed: commit aa5ee63 "quick-snippets: Update to version 0.3.4"; bucket/quick-snippets.json shows 0.3.4, the v0.3.4 URL and the same hash.
- Scoop copy updated: the data folder was first copied to C:\scoop\persist\quick-snippets\quick-snippets-data-backup-0.3.3-2026-11-20 (SHA-256 of both files identical). scoop update quick-snippets went 0.3.3 -> 0.3.4 with the hash check OK; current points to 0.3.4, its exe is the one from the release ZIP, quick-snippets-data is still the junction to the persist folder, and the SHA-256 of both data files is the same before and after the update. The app was not running and was not started. The 0.3.3 folder stays, so scoop reset quick-snippets@0.3.3 can go back.
- real_db has the local release build from 18457db; eb981c5 has the same code (the later commits only add these Backlog notes and the merge). The user's autostart values are still the same as before the task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v0.3.4, a patch release with the fixes made after 0.3.3: the built-in browser's data next to the exe (TASK-27); translated start-up dialogs and a damaged database that is kept, not deleted (TASK-28); a window that appears complete and is read properly by screen readers after a start, also with "Start in tray" (TASK-5, TASK-29); autostart that removes the Task Manager mark and changes the registry only when the setting changes (TASK-31); and a search announcement that is no longer lost when the list reloads (TASK-35). The database and settings format are unchanged, so going back to 0.3.x stays safe. Version bumped in the three files and both lock files, [Unreleased] turned into the v0.3.4 CHANGELOG section, git flow release finished with --no-ff so main has the release merge commit eb981c5. The Release workflow passed, created tag v0.3.4 and published the ZIP and .sha256; the release notes are the changelog section, and Excavator updated the Scoop manifest to 0.3.4 with the matching hash. Verified with npm run test:all (502 Vitest, 299 Rust), npm run lint, just final-checks, just smoke (82/82 steps, 301/301 NVDA checks), just smoke-tray (83/83, 300/300) and the published checksum. The user's Scoop copy is updated to 0.3.4 after a backup of its data folder; the data checksums match before and after. No follow-ups.
<!-- SECTION:FINAL_SUMMARY:END -->
