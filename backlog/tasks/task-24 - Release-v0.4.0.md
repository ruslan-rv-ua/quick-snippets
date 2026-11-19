---
id: TASK-24
title: Release v0.4.0
status: To Do
assignee: []
created_date: '2026-11-19T07:11:00Z'
updated_date: '2026-11-19T07:54:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-5
dependencies:
  - TASK-12
  - TASK-23
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the fix for the size limit of encrypted snippets (TASK-12). A minor version, because TASK-12 may change the database schema: SQLite cannot change a CHECK constraint in place, so raising the limit means rebuilding the table. If the schema changes, the release notes must say plainly whether going back to 0.3.x is safe, and advise a backup of the quick-snippets-data folder before upgrading, as the v0.3.0 notes did.

Same procedure as v0.3.1 (DEVELOPMENT.md; see the archived TASK-21), with one change from TASK-25: CI no longer runs on push, so do not wait for CI after pushing develop or main. The Release workflow itself runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; if it fails, fix the cause and run it again. Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes; leave a minute between two runs). Finish the release with --no-ff, so main gets a release merge commit.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure, plus careful release notes if the schema changed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version 0.4.0 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.4.0 section with user-facing notes only, it says whether going back to 0.3.x is safe, and the GitHub release notes are that section
- [ ] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.4.0 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.4.0 after Excavator runs
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
