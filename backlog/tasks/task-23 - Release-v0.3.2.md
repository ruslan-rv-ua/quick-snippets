---
id: TASK-23
title: Release v0.3.2
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-19T07:10:00Z'
updated_date: '2026-11-19T11:28:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-4
dependencies:
  - TASK-17
  - TASK-19
  - TASK-22
  - TASK-25
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the small NVDA fixes planned after 0.3.1: clean focus after the delete confirmation closes (TASK-17), a shorter announcement of the search box (TASK-19), and the F1 help focus race, if TASK-22 finds that a user can hit it. A patch release: no change to stored data.

Same procedure as v0.3.1 (DEVELOPMENT.md; see the archived TASK-21), with one change from TASK-25: CI no longer runs on push, so do not wait for CI after pushing develop or main. The Release workflow itself runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; if it fails, fix the cause and run it again. Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes; leave a minute between two runs). Finish the release with --no-ff, so main gets a release merge commit.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.2 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.2 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.2 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.2 after Excavator runs
- [x] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-23-<short commit>.exe
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
1. Mark TASK-23 In Progress on develop; git flow release start 0.3.2.
2. Bump the version to 0.3.2 in Cargo.toml, tauri.conf.json, package.json and both lock files; turn [Unreleased] into "v0.3.2 - 2026-11-19" with an empty [Unreleased] above it; commit.
3. just final-checks; npm run test:all; npm run lint; npx tauri build --no-bundle.
4. just smoke on the release exe, only after the user's go-ahead.
5. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-23-<commit>.exe.
6. git flow release finish 0.3.2 --no-ff --notag.
7. With the user's go-ahead: git push origin main develop; gh workflow run release.yml --ref main -f version=0.3.2 (the workflow runs lint and tests itself; no CI wait after the push).
8. Check the release: ZIP and .sha256, checksum, notes replaced with the v0.3.2 CHANGELOG section; run Excavator in scoop-bucket (with the go-ahead); check the manifest version and hash.
9. Ask whether to update the Scoop copy (back up quick-snippets-data first, close the running copy, do not start it again).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.2 (version bump 9271639):
- just final-checks: versions match (0.3.2), tsc, clippy, Rust and Vitest tests, build OK; exe 3,851,776 bytes, file version 0.3.2.
- npm run test:all: 453 Vitest tests in 24 files and 230 Rust tests (1 ignored), all pass. npm run lint: pass. npx tauri build --no-bundle: OK.
- just smoke on that release exe (with the user's go-ahead): 77 of 77 steps OK, NVDA checks 273 of 273. Only the optional "Скопійовано" (Copied) was not heard once; the report marks it as not an error (the window hides right after copying). The settings dialog reads "QuickSnippets версія 0.3.2".
- CHANGELOG: [Unreleased] turned into "v0.3.2 - 2026-11-19" unchanged, with an empty [Unreleased] above it: one Changed entry (TASK-19) and two Fixed entries (TASK-17, TASK-22), all user-facing. TASK-25 is not listed: it changes only the Release workflow and CI. No new user-facing strings in this task.
- The release build is copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-23-9271639.exe (same SHA-256 as the build).
<!-- SECTION:NOTES:END -->
