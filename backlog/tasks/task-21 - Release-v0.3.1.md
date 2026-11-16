---
id: TASK-21
title: Release v0.3.1
status: To Do
assignee: []
created_date: '2026-11-16T21:47:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-3
dependencies:
  - TASK-20
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the user-visible fixes made after 0.3.0: "No results found" is announced (TASK-14), Delete in the search box erases text (TASK-15), NVDA reads editing in the search box (TASK-16), the window no longer hides while it is still active, so settings are saved (TASK-18), and the search and password dialog stay when the keyboard only moves inside the window (TASK-20). A patch release: no change to stored data.

Same procedure as v0.3.0 (DEVELOPMENT.md; see the archived TASK-8). Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes now; leave a minute between two runs). In v0.3.0 main was fast-forwarded and got no release merge commit; finish this release with --no-ff, as for v0.2.1.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version 0.3.1 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.1 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.1 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.1 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-21-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
