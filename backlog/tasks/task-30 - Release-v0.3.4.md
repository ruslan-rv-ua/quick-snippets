---
id: TASK-30
title: Release v0.3.4
status: To Do
assignee: []
created_date: '2026-11-19T16:42:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-6
dependencies:
  - TASK-27
  - TASK-28
  - TASK-29
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the fixes made after 0.3.3: with "Start in tray" the window no longer flashes at startup and takes the keyboard, and NVDA reads the first Ctrl+Alt+Space show properly (TASK-5, already in develop); the browser data stays next to the exe (TASK-27); translated startup error dialogs, and a damaged database that is kept instead of deleted (TASK-28); and whatever TASK-29 changes. Planned as a patch release: none of these tasks is meant to change the database or the settings format, so going back to 0.3.x stays safe. The user chose 0.3.4 (2026-11-19); if one of the tasks does change a format, ask the user about the version again.

Same procedure as v0.3.3 (DEVELOPMENT.md; see the archived TASK-24). CI does not run on push, so do not wait for CI after pushing develop or main. The Release workflow runs lint and both test suites on a clean machine before the build, and a failing check stops it before the tag and the release exist; if it fails, fix the cause and run it again. Pushing and running workflows need the user's go-ahead, and so do the just smoke and just smoke-tray runs (about two and a half minutes each; leave a minute between two runs). Finish the release with --no-ff and --notag: main gets a release merge commit, and the Release workflow creates the tag.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version 0.3.4 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.4 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.4 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.4 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-30-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
