---
id: TASK-30
title: Release v0.3.4
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-19T16:42:00Z'
updated_date: '2026-11-20T04:52:00Z'
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
- [ ] #1 Version 0.3.4 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.4 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.4 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.4 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-30-<short commit>.exe
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
<!-- SECTION:NOTES:END -->
