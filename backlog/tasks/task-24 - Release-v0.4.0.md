---
id: TASK-24
title: Release v0.3.3
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T07:11:00Z'
updated_date: '2026-11-19T13:00:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-5
dependencies:
  - TASK-12
  - TASK-23
  - TASK-26
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the fixes made after 0.3.2: a clear, translated message when a snippet's text is too long (TASK-12), and title and content length checks that agree between the dialogs, the backend and the database (TASK-26). A patch release: the database and the stored data do not change, so going back to 0.3.x stays safe. The milestone was planned as v0.4.0 in case TASK-12 changed the database; it did not, so the user chose 0.3.3 (2026-11-19).

Same procedure as v0.3.2 (DEVELOPMENT.md; see the archived TASK-23). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; if it fails, fix the cause and run it again. Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.3 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.3.3 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` passes on the release build (run only with the user's permission)
- [x] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.3 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.3 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-24-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.3 (version bump 004aba9):
- just final-checks: versions match (0.3.3), tsc, clippy, Rust and Vitest tests, build OK; exe 3.7 MB.
- npm run test:all: 489 Vitest tests in 26 files and 245 Rust tests (1 ignored), all pass. npm run lint: pass. npx tauri build --no-bundle: OK, exe 3,852,800 bytes, file version 0.3.3.
- just smoke on that release exe: 80 of 80 steps OK, NVDA checks 284 of 284. The settings dialog reads "QuickSnippets версія 0.3.3". The NVDA log had the one known error of NVDA's own script_caret_newLine (Enter in a text field), as in TASK-12, TASK-26 and earlier runs.
- CHANGELOG: [Unreleased] turned into "v0.3.3 - 2026-11-19" unchanged, with an empty [Unreleased] above it: three Fixed entries (TASK-12, TASK-26), all user-facing. No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-24-004aba9.exe (same SHA-256 as the build, F233FC7D…DB2A).

Release:
- git flow release finish 0.3.3 --no-ff --notag --no-push: main got the release merge commit 04c2f78 "Merge branch 'release/0.3.3'" (parents a929185 and 2de27bb); develop got merge 2b41f7c. main and develop have the same tree. Pushed main and develop (no tags); CI did not start on the push, as intended.
- Release workflow run 44527699071 on main 04c2f78 passed in 7.5 min: build, lint, Vitest and Rust tests, Tauri build, ZIP, tag push and the release step all succeeded. Tag v0.3.3 is on 04c2f78.
- Release https://github.com/ruslan-rv-ua/quick-snippets/releases/tag/v0.3.3 (Latest, not a pre-release) has quick-snippets-0.3.3-windows-x64.zip (1,996,426 bytes) and its .sha256; the checksum ed859bd2…8de1 matches the downloaded ZIP. The ZIP holds quick-snippets.exe (file version 0.3.3, 3,838,976 bytes), LICENSE and README.md. The generated notes ("Full Changelog" link only) were replaced with the v0.3.3 CHANGELOG section.
- Excavator run 44529002124 in scoop-bucket passed: commit 4d0f0eb "quick-snippets: Update to version 0.3.3"; bucket/quick-snippets.json shows 0.3.3, the v0.3.3 URL and the same hash.
- Scoop copy updated: the data folder was first copied to C:\scoop\persist\quick-snippets\quick-snippets-data-backup-0.3.2-2026-11-19 (both files identical). scoop update quick-snippets went 0.3.2 -> 0.3.3 with the hash check OK; current points to 0.3.3, its exe reads 0.3.3, quick-snippets-data is still the junction to the persist folder and its files are unchanged. The app was not running and was not started. The 0.3.2 folder stays, so scoop reset quick-snippets@0.3.2 can go back.
- real_db has the local release build from 004aba9; 04c2f78 has the same code (the later commits only add Backlog notes and the merge).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v0.3.3, a patch release with the fixes made after 0.3.2: a clear, translated message when a snippet's text is too long (TASK-12), and titles of 3 to 50 characters in any language with no silent cutting of the Title and Content fields (TASK-26); stored data unchanged, so going back to 0.3.x stays safe. Version bumped in the three files and both lock files, [Unreleased] turned into a v0.3.3 CHANGELOG section, git flow release finished with --no-ff so main has the release merge commit 04c2f78. The Release workflow passed, created tag v0.3.3 and published the ZIP and .sha256; the release notes are the changelog section, and Excavator updated the Scoop manifest to 0.3.3 with the matching hash. Verified with just final-checks, npm run test:all (489 Vitest, 245 Rust), npm run lint, just smoke (80/80 steps, 284/284 NVDA checks) and the published checksum. The user's Scoop copy is updated to 0.3.3 after a backup of its data folder. No follow-ups.
<!-- SECTION:FINAL_SUMMARY:END -->
