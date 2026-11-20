---
id: TASK-41
title: Release v0.3.5
status: To Do
assignee: []
created_date: '2026-11-20T17:24:00Z'
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
- [ ] #1 Version 0.3.5 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.5 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.5 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.5 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-41-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
