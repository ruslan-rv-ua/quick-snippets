---
id: TASK-8
title: Release v0.3.0
status: To Do
assignee: []
created_date: '2026-11-15T23:33:00Z'
updated_date: '2026-11-16T12:39:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-1
dependencies:
  - TASK-1
  - TASK-2
  - TASK-7
  - TASK-9
  - TASK-10
  - TASK-11
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
  - SECURITY.md
priority: medium
ordinal: 3500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the toolchain upgrade (TASK-1), the new key derivation for encrypted snippets (TASK-2), the fix that keeps the Ctrl+Shift+T theme after a restart (TASK-11), the reworked settings dialog (TASK-9) and the keyboard shortcuts help on F1 (TASK-10). A minor version because the stored format of encrypted snippets may change: if snippets re-encrypted by 0.3.0 cannot be read by 0.2.x, the release notes must say so plainly, since a downgrade would lock users out of those snippets.

Same procedure as v0.2.1 (DEVELOPMENT.md). Pushing and running workflows need the user's go-ahead, and so does the just smoke run.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The same documented procedure as v0.2.1, plus careful release notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Version 0.3.0 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.0 section, and the release notes explain the encrypted snippet format change and whether downgrading is safe
- [ ] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished: main and develop contain the release; tag v0.3.0 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.0 after Excavator runs
- [ ] #6 On the release build, run as a test copy with its own data folder, an encrypted snippet stored in the 0.2.1 format opens with its password, is then stored in the v2 format, and opens again (ask the user before any run that takes the keyboard)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
