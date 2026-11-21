---
id: TASK-49
title: Release v0.3.7
status: To Do
assignee:
  - '@claude'
created_date: '2026-11-21T21:56:00Z'
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
- [ ] #1 Version 0.3.7 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.7 section with user-facing notes only, and the GitHub release notes are that section
- [ ] #3 `just smoke` and `just smoke-tray` pass on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.7 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.7 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-49-<short commit>.exe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
