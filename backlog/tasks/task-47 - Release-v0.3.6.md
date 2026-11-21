---
id: TASK-47
title: Release v0.3.6
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-21T11:45:00Z'
updated_date: '2026-11-21T12:01:00Z'
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
- [ ] #1 Version 0.3.6 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.6 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.6 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.6 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-47-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
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
