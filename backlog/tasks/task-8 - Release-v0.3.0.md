---
id: TASK-8
title: Release v0.3.0
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-15T23:33:00Z'
updated_date: '2026-11-16T14:46:00Z'
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
  - TASK-13
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
Ships the toolchain upgrade (TASK-1), the new key derivation for encrypted snippets (TASK-2), the fix that keeps the Ctrl+Shift+T theme after a restart (TASK-11), the reworked settings dialog (TASK-9), the keyboard shortcuts help on F1 (TASK-10) and the German tray menu fix (TASK-13). A minor version because the stored format of encrypted snippets changed (TASK-2): 0.2.x cannot open an encrypted snippet that 0.3.0 created or re-encrypted and shows "Wrong password", although the data stays intact and 0.3.0 opens it again. The release notes must say so plainly and advise a backup of quick-snippets-data before upgrading; TASK-2's notes ("Going back to 0.2.x") have the details.

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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Check CI on the latest develop commit (a56043e): passed.
2. git flow release start 0.3.0; bump the version in Cargo.toml, tauri.conf.json, package.json (and lock files); move [Unreleased] into a v0.3.0 section; commit.
3. just final-checks; npm run test:all; npm run lint.
4. npx tauri build --no-bundle; just smoke on the release exe.
5. Check a 0.2.1-format encrypted snippet on a test copy with its own data folder: opens, is stored as v2:, opens again.
6. git flow release finish 0.3.0; push main and develop (no tags); wait for CI.
7. Run the Release workflow for 0.3.0 on main; check ZIP and .sha256; replace the generated release notes with user-facing notes (format change, going back to 0.2.x, backup advice).
8. Run Excavator in scoop-bucket; check the manifest shows 0.3.0.
9. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-8-<commit>.exe.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.0 (commit 040b934, version bump f29c84a):
- CI for develop a56043e passed before the release started.
- just final-checks: versions match (0.3.0), tsc, clippy, 217 Rust tests, 386 Vitest tests, build OK; exe 3,849,728 bytes.
- npm run lint and npm run test:all: pass.
- just smoke on the release exe: 35 of 35 steps OK, NVDA checks 105 of 105.
- 0.2.1 format check (script outside the repo): a test copy of the release exe with its own temp data folder created its database; the pinned v0.2.1 sample blob from crypto.rs was inserted as is_encrypted=1. First open with the password copied the right text and the stored content changed from the legacy format (116 bytes) to v2: (119 bytes); the second open with the same password copied the right text again.
- CHANGELOG: [Unreleased] moved into v0.3.0; the note on going back to 0.2.x moved to a new first subsection "Before you upgrade" with the advice to back up quick-snippets-data.
<!-- SECTION:NOTES:END -->
