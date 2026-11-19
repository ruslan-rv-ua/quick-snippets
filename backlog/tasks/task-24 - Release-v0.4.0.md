---
id: TASK-24
title: Release v0.3.3
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-19T07:11:00Z'
updated_date: '2026-11-19T12:50:00Z'
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
- [ ] #1 Version 0.3.3 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.3 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.3 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.3 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-24-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.3 (version bump 004aba9):
- just final-checks: versions match (0.3.3), tsc, clippy, Rust and Vitest tests, build OK; exe 3.7 MB.
- npm run test:all: 489 Vitest tests in 26 files and 245 Rust tests (1 ignored), all pass. npm run lint: pass. npx tauri build --no-bundle: OK, exe 3,852,800 bytes, file version 0.3.3.
- just smoke on that release exe: 80 of 80 steps OK, NVDA checks 284 of 284. The settings dialog reads "QuickSnippets версія 0.3.3". The NVDA log had the one known error of NVDA's own script_caret_newLine (Enter in a text field), as in TASK-12, TASK-26 and earlier runs.
- CHANGELOG: [Unreleased] turned into "v0.3.3 - 2026-11-19" unchanged, with an empty [Unreleased] above it: three Fixed entries (TASK-12, TASK-26), all user-facing. No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-24-004aba9.exe (same SHA-256 as the build, F233FC7D…DB2A).
<!-- SECTION:NOTES:END -->
