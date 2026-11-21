---
id: TASK-41
title: Release v0.3.5
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T17:24:00Z'
updated_date: '2026-11-20T22:25:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-7
dependencies:
  - TASK-36
  - TASK-37
  - TASK-38
  - TASK-39
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the fixes made after 0.3.4: a change of Start with Windows that Windows refuses is shown in the settings dialog (TASK-36); the autostart entry holds the exe path in quotes and the app writes it itself, without tauri-plugin-autostart (TASK-37); a failed save of the settings is shown inside the settings dialog (TASK-38); and settings.json is written so that a failed save never damages it (TASK-39). Planned as a patch release: none of these tasks is meant to change the database or the settings format, so going back to 0.3.x stays safe. The user chose 0.3.5 (2026-11-20); if one of the tasks does change a format, ask the user about the version again.

Same procedure as v0.3.4 (DEVELOPMENT.md; see the archived TASK-30 and TASK-24). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist. The workflow publishes generated notes (only a "Full Changelog" link): replace them with the v0.3.5 CHANGELOG section, as for 0.3.3 and 0.3.4. Pushing and running workflows need the user's go-ahead, and so do the just smoke and just smoke-tray runs (about three minutes each; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag. A real sign-in with Start with Windows on was never tried for the quoted entry of TASK-37: suggest it to the user after the release.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.5 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.3.5 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [x] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.5 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.5 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-41-<short commit>.exe
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
Checks on release/0.3.5 (version bump 3bdc792):
- npm run test:all: 525 Vitest tests in 26 files and 331 Rust tests (1 ignored), all pass. npm run lint: pass.
- just final-checks: versions match (0.3.5), all automated checks pass; exe 3.7 MB.
- npx tauri build --no-bundle: OK, exe 3,866,112 bytes, file version 0.3.5, SHA-256 E7718AB1...7680.
- just smoke on that release exe: 88 of 88 steps OK, NVDA checks 333 of 333. The settings dialog reads "QuickSnippets версія 0.3.5". The NVDA log had 2 errors of NVDA itself, the first the known script_caret_newLine (Enter in a text field); the report names only the first.
- just smoke-tray a minute later on the same exe: 89 of 89 steps OK, NVDA checks 332 of 332, no errors in the NVDA log.
- The user's autostart values were the same before and after each run (no Run entry; the old StartupApproved mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), according to the reports and a separate read-only check. During the runs the test copy turns autostart on (quoted entry) and off, then the script restores the values.
- CHANGELOG: [Unreleased] turned into "v0.3.5 - 2026-11-21" unchanged (Fixed, 4 entries, all user-facing), with an empty [Unreleased] above it. No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-41-3bdc792.exe (same SHA-256 as the build).

Release:
- git flow release finish 0.3.5 --no-ff --notag --no-push: main got the release merge commit 963ea66 "Merge branch 'release/0.3.5'" (parents eb981c5 and 3bdc792); develop got merge 20d42e5. main and develop have the same tree, and no local tag was created. Pushed main and develop (no tags); CI does not run on push.
- Release workflow run 44827811182 on main 963ea66 passed in about 5 min. Tag v0.3.5 is on 963ea66.
- Release https://github.com/ruslan-rv-ua/quick-snippets/releases/tag/v0.3.5 (Latest, not a pre-release) has quick-snippets-0.3.5-windows-x64.zip (2,005,721 bytes) and its .sha256; the checksum 95a7bc98...f349 matches the downloaded ZIP. The ZIP holds quick-snippets.exe (file version 0.3.5, 3,851,264 bytes), LICENSE and README.md. The generated notes ("Full Changelog" link only) were replaced with the v0.3.5 CHANGELOG section; checked to be identical to that section on main.
- Excavator run 44828589844 in scoop-bucket passed: commit 968d2f4 "quick-snippets: Update to version 0.3.5"; bucket/quick-snippets.json shows 0.3.5, the v0.3.5 URL and the same hash.
- Scoop copy updated: the data folder was first copied to C:\scoop\persist\quick-snippets\quick-snippets-data-backup-0.3.4-2026-11-21 (SHA-256 of both files identical). scoop update quick-snippets went 0.3.4 -> 0.3.5 with the hash check OK; current points to 0.3.5, its exe is the one from the release ZIP, quick-snippets-data is still the junction to the persist folder, and the SHA-256 of both data files is the same before and after. The app was not running and was not started. The 0.3.4 folder stays, so scoop reset quick-snippets@0.3.4 can go back.
- real_db has the local release build from 3bdc792; 963ea66 has the same code (the merge only).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v0.3.5, a patch release with the fixes made after 0.3.4: a Start with Windows change that Windows refuses is shown in the settings dialog (TASK-36); the autostart entry holds the exe path in quotes and the app writes it itself (TASK-37); a failed settings save is shown inside the settings dialog (TASK-38); and settings.json is replaced in one step, so a failed save never damages it (TASK-39). The database and settings format are unchanged, so going back to 0.3.x stays safe. Version bumped in the three files and both lock files, [Unreleased] turned into the v0.3.5 CHANGELOG section, git flow release finished with --no-ff so main has the release merge commit 963ea66. The Release workflow passed, created tag v0.3.5 and published the ZIP and .sha256; the release notes are the changelog section, and Excavator updated the Scoop manifest to 0.3.5 with the matching hash. Verified with npm run test:all (525 Vitest, 331 Rust), npm run lint, just final-checks, just smoke (88/88 steps, 333/333 NVDA checks), just smoke-tray (89/89, 332/332) and the published checksum. The user's Scoop copy is updated to 0.3.5 after a backup of its data folder; the data checksums match before and after. Follow-up for the user: one real Windows sign-in with Start with Windows on, since the quoted entry of TASK-37 was only checked by the smoke test, not by a real sign-in.
<!-- SECTION:FINAL_SUMMARY:END -->
