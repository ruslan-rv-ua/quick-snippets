---
id: TASK-7
title: Release v0.2.1
status: Done
assignee: []
created_date: '2026-11-15T23:33:00Z'
updated_date: '2026-11-16T00:23:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-0
dependencies:
  - TASK-4
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: high
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The NVDA accessibility fixes already in develop (notifications no longer re-read older ones, the wrong-password message is announced once, the password field keeps focus), the smaller exe and the new CI reach users, including the author's Scoop install, only through a release. TASK-4 completes the announcement fixes for this patch release.

Follow DEVELOPMENT.md: git flow release start, bump the version in the three files, move the CHANGELOG Unreleased entries into a v0.2.1 section, git flow release finish, then the Release workflow on GitHub and Excavator in scoop-bucket. Pushing and running workflows need the user's go-ahead, and so does the just smoke run.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A documented, mechanical procedure with a few steps where a slip matters (versions, merges, tags).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.2.1 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [x] #2 CHANGELOG.md has a v0.2.1 section with the former Unreleased entries
- [x] #3 `just smoke` passes on the release build (run only with the user's permission)
- [x] #4 git flow release finished: main and develop contain the release; tag v0.2.1 created by the Release workflow
- [x] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.2.1 after Excavator runs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
