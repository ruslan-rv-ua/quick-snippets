---
id: TASK-49
title: Release v0.3.7
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T21:56:00Z'
updated_date: '2026-11-21T23:48:00Z'
labels:
  - release model-sonnet effort-medium
milestone: m-9
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
Ships the changes made after 0.3.6. For users (CHANGELOG [Unreleased], both from TASK-42): when copying or auto-typing a snippet without a password, opening a snippet for editing or opening the settings fails, the notice says what failed, in the language of the app; when auto-type fails while it types, QuickSnippets plays the Windows error sound (its window is already hidden then). For developers only, not in the CHANGELOG: TASK-46 (a settings dialog test that failed under load), TASK-34 (`npm run lint` runs clippy with `--all-targets`, Rust test code included), TASK-48 (Rust code formatted with cargo fmt; `just final-checks` also runs `cargo fmt --check`), TASK-32 (investigation only, nothing changed). Planned as a patch release: snippets.db and settings.json keep the 0.3.6 format (no schema change, the same settings fields; checked by the managing session on 2026-11-21), so going back to 0.3.6 stays safe. The user chose 0.3.7 (2026-11-21, managing session, question dialog: «Випуск 0.3.7 (Рекомендовано)»); if a format turns out to have changed, ask the user about the version again.

Same procedure as v0.3.6 (DEVELOPMENT.md; see the archived TASK-47 and TASK-41). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; its lint now includes the Rust test code, and a dry run with it passed on 2026-11-21 (run 44940335284, see the archived TASK-34). If a check fails in the workflow, read its log and ask the user before running the workflow again. The workflow publishes generated notes (only a "Full Changelog" link): replace them with the v0.3.7 CHANGELOG section, as for 0.3.3 to 0.3.6. Pushing and running workflows need the user's go-ahead, and so do the just smoke and just smoke-tray runs (about three minutes each; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.7 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.3.7 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [x] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.7 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.7 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-49-<short commit>.exe
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
1. Check that CHANGELOG [Unreleased] lists only user-visible changes and that snippets.db and settings.json keep the 0.3.6 format (otherwise ask the user about the version again).
2. git flow release start 0.3.7; version 0.3.7 in package.json, tauri.conf.json, Cargo.toml and both lock files; CHANGELOG [Unreleased] becomes "v0.3.7 - 2026-11-22" with an empty [Unreleased] above it.
3. On the release branch: npm run test:all, npm run lint, just final-checks, npx tauri build --no-bundle.
4. just smoke and just smoke-tray on that release exe, a minute apart; compare the user's autostart values before and after (read only).
5. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-49-<short commit>.exe and compare SHA-256.
6. git flow release finish 0.3.7 --no-ff --notag --no-push; push main and develop (no tags; CI does not run on push).
7. Release workflow on main with version 0.3.7; check the ZIP and .sha256; release notes = the v0.3.7 CHANGELOG section.
8. Excavator in scoop-bucket; manifest shows 0.3.7 and the same hash. Back up C:\scoop\persist\quick-snippets\quick-snippets-data with checksums, scoop update quick-snippets, checksums after match; the app is not started.
9. Notes, acceptance criteria, final summary, status Done (not archived); hand-over note task-49-release-0.3.7-handover.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user's answers before the start (question dialog, 2026-11-22, verbatim):
- Plan and CHANGELOG section (both [Unreleased] entries unchanged under "v0.3.7 - 2026-11-22"): «Так, починай (Рекомендовано)», with the added text «Працюй автономно аж поки не оновиш застосунок за допомогою scoop. дозволи на тести не проси, я дозволяю. зупинись лише якщо щось піде не так.»
- Excavator by hand or wait for the schedule: «запускай все сам аж доки не виконаєш задачу»
- Update the user's Scoop copy to 0.3.7: «Так, оновити (Рекомендовано)»
So the smoke runs, the push, the Release workflow, the notes replacement, Excavator and the Scoop update ran without further questions, as the user asked.

Checks before the release:
- CHANGELOG [Unreleased] held only the two user-visible Fixed entries of TASK-42.
- Formats unchanged since v0.3.6 (f7a453e): git diff -w of db.rs, settings.rs and crypto.rs shows only cargo fmt reformatting (TASK-48) in init_db, the migration and the settings struct; the same table, indexes, user_version 1 and settings fields. Cargo.toml only gained the windows-sys feature Win32_System_Diagnostics_Debug (TASK-42's error sound). So 0.3.7 stays a patch release and going back to 0.3.6 stays safe.

Checks on release/0.3.7 (version bump 17abe65):
- npm run test:all: 625 Vitest tests in 26 files and 389 Rust tests (1 ignored), all pass. npm run lint (clippy --all-targets): pass.
- just final-checks: versions match (0.3.7), all automated checks pass; exe 3.7 MB.
- npx tauri build --no-bundle: OK, exe 3,900,416 bytes, file version 0.3.7, SHA-256 D0754334B575A089FC1303C74E06C946E193EA3FB66B5CFA0E3A98724F3075A6.
- just smoke on that exe: 91 of 91 steps OK, NVDA checks 356 of 356; no errors in the NVDA log; the settings dialog reads "QuickSnippets версія 0.3.7". One line of captured speech (step 1) held the word «сповіщення», which no string of the app has: probably a notification of another program; it was not read and was replaced with a "hidden" mark in the run log and the report.
- just smoke-tray about a minute later: 92 of 92 steps OK, NVDA checks 355 of 355; the window did not appear during the start in the tray (step 1) and NVDA read the first Ctrl+Alt+Space properly (step 2). The NVDA log had 2 errors of NVDA itself, the first the known script_caret_newLine (Enter in a text field); the report shows only the first, as in TASK-41; no check failed. No «сповіщення» lines.
- The user's autostart values were the same before the runs, after each of them (each run restores them) and at the end of the task: no Run entry QuickSnippets; StartupApproved mark Binary 02 00 00 00 00 00 00 00 00 00 00 00 (read only). No app process and no quick-snippets* folder in C:\Temp after the runs.
- No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-49-17abe65.exe (same SHA-256 as the build).

Release:
- git flow release finish 0.3.7 --no-ff --notag --no-push: main got the release merge commit 896d467 "Merge branch 'release/0.3.7'" (parents f7a453e and 17abe65); develop got merge 9b33564; no local tag; release/0.3.7 deleted. Pushed main and develop (develop with the two earlier Backlog commits 81dd677 and c775b58); CI did not start on the push.
- Release workflow run 44961177552 on main 896d467: success in about 4 min (lint, both test suites, Tauri build, ZIP, tag push, release). Tag v0.3.7 is on 896d467.
- Release https://github.com/ruslan-rv-ua/quick-snippets/releases/tag/v0.3.7 (Latest, not a draft or pre-release) has quick-snippets-0.3.7-windows-x64.zip (2,015,046 bytes) and its .sha256; the checksum 41dbd75f11aa3298fdcc9a1fde43c70fea84addbdb95c7e2ad6a077aa6425703 matches the downloaded ZIP and GitHub's digest. The ZIP holds quick-snippets.exe (file version 0.3.7, 3,865,600 bytes, SHA-256 F3DAB702CAB9F340E29BDBF497C755DF3F0F762627259F31F96DFC7B8054E289), LICENSE and README.md.
- The generated notes ("Full Changelog" link only) were replaced with the v0.3.7 CHANGELOG section on main without its heading line; checked to be identical.
- Excavator run 44961601042 in scoop-bucket: success, commit 74016dd "quick-snippets: Update to version 0.3.7"; bucket/quick-snippets.json shows 0.3.7, the v0.3.7 URL and the same hash.
- The user's Scoop copy: the data folder was first copied to C:\scoop\persist\quick-snippets\quick-snippets-data-backup-0.3.6-2026-11-22 (SHA-256 of both files identical). scoop update updated Scoop and its buckets, then quick-snippets 0.3.6 -> 0.3.7 with the hash check OK. current points to 0.3.7, its exe is the one from the release ZIP, quick-snippets-data is still the junction to the persist folder, and the SHA-256 of both data files is the same before and after (settings.json 150E6556C0F72994E90FB39ED17A89BF366E638FF041C42C4EA2586090068412, snippets.db C7C88CB957CCB910CC61A943FC0AB7470D7D105D669E383CD382CFB64305C428). The app was not running and was not started. The 0.3.6 folder stays, so scoop reset quick-snippets@0.3.6 can go back.
- real_db has the local release build from 17abe65; 896d467 has the same code (the merge only).

## After the task (managing session, 2026-11-22)

Checked independently by the managing session: tag v0.3.7 on 896d467 (same tree as 17abe65); the release (not a draft or pre-release) with quick-snippets-0.3.7-windows-x64.zip and its .sha256, its notes equal to the v0.3.7 CHANGELOG section; Release run 44961177552 success on 896d467; the Scoop manifest at 0.3.7 with the hash of the .sha256 asset; the installed exe equal to the one in the ZIP (F3DAB702…E289), quick-snippets-data still the junction to the persist folder, the app not running; the real_db copy equal to the build (D0754334…75A6); npm run test:all (625 Vitest, 389 Rust) and npm run lint pass on develop d766739; the autostart values unchanged; no test copies or smoke folders left.

The user's choice (question dialog, verbatim): «Заархівувати й надіслати (Рекомендовано)». So this task and milestone m-9 (v0.3.7) archived and the commit pushed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Released v0.3.7, a patch release with the user-visible changes made after 0.3.6 (TASK-42): a failed copy, auto-type, edit or settings opening now says what failed in the language of the app, and a failure during auto-type plays the Windows error sound. TASK-46, TASK-34, TASK-48 and TASK-32 changed only tests, tooling or nothing. The database and settings formats are unchanged, so going back to 0.3.6 stays safe. Version bumped in the three files and both lock files, [Unreleased] turned into the v0.3.7 CHANGELOG section, git flow release finished with --no-ff so main has the release merge commit 896d467. The Release workflow passed, created tag v0.3.7 and published the ZIP and .sha256; the release notes are the changelog section, and Excavator updated the Scoop manifest to 0.3.7 with the matching hash. Verified with npm run test:all (625 Vitest, 389 Rust), npm run lint, just final-checks, just smoke (91/91 steps, 356/356 NVDA checks), just smoke-tray (92/92, 355/355) and the published checksum. The user's Scoop copy is updated to 0.3.7 after a backup of its data folder; the data checksums match before and after. Follow-up for the user, unchanged since 0.3.5: one real Windows sign-in with Start with Windows on.
<!-- SECTION:FINAL_SUMMARY:END -->
