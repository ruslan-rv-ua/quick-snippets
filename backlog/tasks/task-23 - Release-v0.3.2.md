---
id: TASK-23
title: Release v0.3.2
status: To Do
assignee: []
created_date: '2026-11-19T07:10:00Z'
updated_date: '2026-11-19T07:11:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-4
dependencies:
  - TASK-17
  - TASK-19
  - TASK-22
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

Same procedure as v0.3.1 (DEVELOPMENT.md; see the archived TASK-21). Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes; leave a minute between two runs). Finish the release with --no-ff, so main gets a release merge commit.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version 0.3.2 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.2 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.2 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.2 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-23-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
