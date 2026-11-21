---
id: TASK-47
title: Release v0.3.6
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T11:45:00Z'
updated_date: '2026-11-21T12:59:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-8
dependencies: []
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the changes made after 0.3.5: when a snippet cannot be deleted, saved, copied or typed, the dialog says so inside it (TASK-40); QuickSnippets checks the snippet database at every start and, when it is damaged inside, offers to move every snippet that can still be read into a new database and keeps the damaged file (TASK-33), without hanging on garbage snippet ids from a damaged page (TASK-43) and with usable dates for moved snippets whose dates the damage destroyed (TASK-45); the list says when damage cut it short, and damage errors are named as such (TASK-33). TASK-44 changed nothing (the user's choice). Planned as a patch release: none of these tasks changed the format of snippets.db or settings.json, so going back to 0.3.5 stays safe. The user chose 0.3.6 (2026-11-21); if a format turns out to have changed, ask the user about the version again.

Same procedure as v0.3.5 (DEVELOPMENT.md; see the archived TASK-41, TASK-30 and TASK-24). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist. A frontend test in SettingsModal.test.tsx has failed twice under load (TASK-46): if a check fails in the workflow, read its log and ask the user before running the workflow again. The workflow publishes generated notes (only a "Full Changelog" link): replace them with the v0.3.6 CHANGELOG section, as for 0.3.3 to 0.3.5. Pushing and running workflows need the user's go-ahead, and so do the just smoke and just smoke-tray runs (about three minutes each; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag. A real sign-in with Start with Windows on was never tried for the quoted entry of 0.3.5: remind the user after the release.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.6 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.3.6 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [x] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.6 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.6 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-47-<short commit>.exe
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
1. Check that CHANGELOG [Unreleased] lists only user-visible changes and that snippets.db and settings.json keep the 0.3.5 format (otherwise ask the user about the version again).
2. git flow release start 0.3.6; version 0.3.6 in package.json, tauri.conf.json, Cargo.toml and both lock files; CHANGELOG [Unreleased] becomes "v0.3.6 - 2026-11-21" with an empty [Unreleased] above it.
3. On the release branch: npm run test:all, npm run lint, just final-checks, npx tauri build --no-bundle.
4. just smoke and just smoke-tray on that release exe (a minute apart, each with the user's go-ahead right before it); compare the user's autostart values before and after (read only).
5. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-47-<short commit>.exe and compare SHA-256.
6. git flow release finish 0.3.6 --no-ff --notag --no-push; push main and develop (no tags; with the user's go-ahead; CI does not run on push).
7. Release workflow on main with version 0.3.6 (with the user's go-ahead); check the ZIP and .sha256; release notes = the v0.3.6 CHANGELOG section (replacement with the user's go-ahead).
8. Excavator in scoop-bucket; manifest shows 0.3.6 and the same hash. Back up C:\scoop\persist\quick-snippets\quick-snippets-data with checksums, scoop update quick-snippets (with the user's go-ahead), checksums after match; the app is not started.
9. Notes, acceptance criteria, final summary, status Done (not archived); hand-over note task-47-release-0.3.6-handover.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks before the release:
- CHANGELOG [Unreleased] held only user-visible changes: Added (1: the start-up check of the database and the rescue, with the TASK-45 sentence about dates) and Fixed (3: the notice about a damaged list, the damage errors, the dialog errors of TASK-40). No tooling, test, CI or build details.
- Formats unchanged since v0.3.5 (963ea66): init_db (table, indexes, user_version 1) is untouched; the everyday writes to snippets.db are the same statements; the rescue builds its new database with the same init_db and copies the same columns, dates only in the app's format; settings.rs is untouched, so settings.json is the same; crypto.rs only names the existing "Wrong password" text as a constant, the blob formats are unchanged. So 0.3.6 stays a patch release and going back to 0.3.5 stays safe; no new question about the version.

Checks on release/0.3.6 (version bump 4328a9b):
- npm run test:all: 612 Vitest tests in 26 files and 384 Rust tests (1 ignored), all pass. npm run lint: pass.
- just final-checks: versions match (0.3.6), all automated checks pass; exe 3.7 MB.
- npx tauri build --no-bundle: OK, exe 3,900,416 bytes, file version 0.3.6, SHA-256 147BC2D5F69EE7749F5677F9E7AD60F8F0DB696FB9994AC1F50B1D6C8D79645D.
- The user's answer before just smoke: «Так, запускай (Рекомендовано)».
- just smoke on that release exe: 91 of 91 steps OK, NVDA checks 356 of 356, 3 min 22 s. The settings dialog reads "QuickSnippets версія 0.3.6". The NVDA log had 1 error, the known script_caret_newLine of NVDA itself (Enter in a text field). Three lines of captured speech (steps 10, 22 and 39) held the word «сповіщення», which no string of the app has: probably notifications of other programs. They were not read and were replaced with a "hidden" mark in the run log and in %TEMP%\quick-snippets-smoke-report.txt.
- The user's answer before just smoke-tray: «Так, запускай (Рекомендовано)».
- just smoke-tray on the same exe, about nine minutes later: 92 of 92 steps OK, NVDA checks 355 of 355, 3 min 30 s. The window did not appear during the start in the tray (step 1), and NVDA read the first Ctrl+Alt+Space properly (step 2); version 0.3.6. The NVDA log had 1 error, the same known script_caret_newLine. Two lines of captured speech (steps 7 and 21) with «сповіщення» were hidden unread in the same way.
- The user's autostart values were the same before the runs and after each of them (no Run entry; the old StartupApproved mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), according to the reports and a separate read-only check, also at the end of the task. No app process and no quick-snippets* folder in %TEMP% after each run.
- No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-47-4328a9b.exe (same SHA-256 as the build).

Release:
- git flow release finish 0.3.6 --no-ff --notag --no-push: main got the release merge commit f7a453e "Merge branch 'release/0.3.6'" (parents 963ea66 and 4328a9b); develop got merge 543956d. main and develop have the same tree, and no local tag was created.
- The user's answer before the push: «Так, надсилай (Рекомендовано)». Pushed main and develop (no tags); CI did not start on the push.
- The user's answer before the Release workflow: «Так, запускай (Рекомендовано)». Release workflow run 44904993086 on main f7a453e passed in about 4 min: build, lint, Vitest and Rust tests, Tauri build, ZIP, tag push and the release step all succeeded. Tag v0.3.6 is on f7a453e.
- Release https://github.com/ruslan-rv-ua/quick-snippets/releases/tag/v0.3.6 (Latest, not a pre-release) has quick-snippets-0.3.6-windows-x64.zip (2,022,555 bytes) and its .sha256; the checksum 92f875ce0e8382d3dcfabb2804c7ebc70e02730ff29bec28a08b126009fce3ba matches the downloaded ZIP and the digest GitHub shows. The ZIP holds quick-snippets.exe (file version 0.3.6, 3,885,568 bytes, SHA-256 43037E38BE710230A40C8DF89FF180AB9094A1A63141085DD2352AAD4901BA9B), LICENSE and README.md.
- The user's answer before replacing the notes: «Так, замінюй (Рекомендовано)». The generated notes ("Full Changelog" link only) were replaced with the v0.3.6 CHANGELOG section without its heading line, as for 0.3.5; checked to be identical to that section on main.
- The manifest still showed 0.3.5 (the scheduled Excavator runs at 04:20 UTC). The user's answer before running it by hand: «Так, запускай (Рекомендовано)». Excavator run 44905536139 in scoop-bucket passed: commit 0bfe802 "quick-snippets: Update to version 0.3.6"; bucket/quick-snippets.json shows 0.3.6, the v0.3.6 URL and the same hash.
- The user's answer before the Scoop update: «Так, оновлюй (Рекомендовано)». The data folder was first copied to C:\scoop\persist\quick-snippets\quick-snippets-data-backup-0.3.5-2026-11-21 (SHA-256 of both files identical). scoop update quick-snippets updated Scoop and its buckets, then went 0.3.5 -> 0.3.6 with the hash check OK; current points to 0.3.6, its exe is the one from the release ZIP, quick-snippets-data is still the junction to the persist folder, and the SHA-256 of both data files is the same before and after (settings.json 150E6556C0F72994E90FB39ED17A89BF366E638FF041C42C4EA2586090068412, snippets.db C7C88CB957CCB910CC61A943FC0AB7470D7D105D669E383CD382CFB64305C428). The app was not running and was not started. The 0.3.5 folder stays, so scoop reset quick-snippets@0.3.5 can go back.
- real_db has the local release build from 4328a9b; f7a453e has the same code (the merge only).

## Check by the managing session (2026-11-21)

- git: main = origin/main = f7a453e (the release merge commit, parents 963ea66 and 4328a9b) with tag v0.3.6, created by the Release workflow; develop = origin/develop = 61450a6; main and develop have the same tree apart from backlog/. Version 0.3.6 in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json on main; CHANGELOG on main: an empty [Unreleased], then "v0.3.6 - 2026-11-21".
- The last Backlog commit 61450a6 was pushed at 14:52, right after a question to the user; these notes do not quote that answer.
- Release workflow run 44904993086 on main f7a453e: success.
- GitHub release v0.3.6: Latest, not a draft or a pre-release; quick-snippets-0.3.6-windows-x64.zip (2,022,555 bytes, GitHub digest sha256:92f875ce0e8382d3dcfabb2804c7ebc70e02730ff29bec28a08b126009fce3ba) and its .sha256; the release notes are exactly the v0.3.6 CHANGELOG section on main without its heading line.
- scoop-bucket: commit 0bfe802 "quick-snippets: Update to version 0.3.6"; bucket/quick-snippets.json shows 0.3.6, the v0.3.6 URL and the hash 92f875ce...e3ba, the ZIP's digest; Excavator runs 44905536139 and 44905685110 succeeded.
- The user's Scoop copy: current points to 0.3.6; quick-snippets.exe has file version 0.3.6 and the SHA-256 of the exe in the ZIP (43037E38BE710230A40C8DF89FF180AB9094A1A63141085DD2352AAD4901BA9B); Scoop's cached download of 0.3.6 has the release's SHA-256; quick-snippets-data is still the junction to the persist folder; settings.json and snippets.db have the same SHA-256 as in quick-snippets-data-backup-0.3.5-2026-11-21 (hashes only, nothing opened); the 0.3.5 folder stays for scoop reset.
- real_db\quick-snippets-TASK-47-4328a9b.exe: SHA-256 147BC2D5F69EE7749F5677F9E7AD60F8F0DB696FB9994AC1F50B1D6C8D79645D, 3,900,416 bytes, file version 0.3.6, the same as src-tauri\target\release\quick-snippets.exe; f7a453e has the same app code as 4328a9b.
- The user's autostart values unchanged (entry absent, mark 02 00 00 00 00 00 00 00 00 00 00 00); no copy of the app running; no test folder in %TEMP%; the handover note task-47-release-0.3.6-handover.md is in the shared notes folder.
- The user's answers (question dialog, verbatim): archive the task, its session and the milestone v0.3.6 "Так, усе (Рекомендовано)"; push this note "Так, надіслати (Рекомендовано)"; the five lines with «сповіщення» hidden in the smoke reports (perhaps Claude's own notifications at the end of a session's turn during a run) "Нічого не міняти"; next "TASK-42 (Рекомендовано)".
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v0.3.6, a patch release with the changes made after 0.3.5: QuickSnippets checks the snippet database at every start and, when it is damaged inside, offers to move every snippet that can still be read into a new database and keeps the damaged file (TASK-33), without hanging on garbage ids from a damaged page (TASK-43) and with usable dates for moved snippets whose dates the damage destroyed (TASK-45); the list says when damage cut it short and damage errors are named as such (TASK-33); and a delete, save, copy or type that fails is shown inside its dialog (TASK-40). TASK-44 changed nothing. The database and settings formats are unchanged, so going back to 0.3.5 stays safe. Version bumped in the three files and both lock files, [Unreleased] turned into the v0.3.6 CHANGELOG section, git flow release finished with --no-ff so main has the release merge commit f7a453e. The Release workflow passed, created tag v0.3.6 and published the ZIP and .sha256; the release notes are the changelog section, and Excavator (run by hand with the user's go-ahead) updated the Scoop manifest to 0.3.6 with the matching hash. Verified with npm run test:all (612 Vitest, 384 Rust), npm run lint, just final-checks, just smoke (91/91 steps, 356/356 NVDA checks), just smoke-tray (92/92, 355/355) and the published checksum. Both runs captured a few lines of speech that were probably notifications of other programs; they were hidden unread. The user's Scoop copy is updated to 0.3.6 after a backup of its data folder; the data checksums match before and after. Follow-up for the user: one real Windows sign-in with Start with Windows on, since the quoted entry used since 0.3.5 was only checked by the smoke test, not by a real sign-in.
<!-- SECTION:FINAL_SUMMARY:END -->
