---
id: TASK-34
title: Fix the clippy findings in the Rust test code
status: To Do
assignee: []
created_date: '2026-11-19T23:55:00Z'
labels:
  - tooling
  - tests
  - model-sonnet
  - effort-low
milestone: m-2
dependencies: []
references:
  - package.json
  - src-tauri/src/lib.rs
  - src-tauri/src/settings.rs
priority: low
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-28. `npm run lint` runs `cargo clippy -- -D warnings`, which checks only the app code, not the Rust tests. `cargo clippy --all-targets -- -D warnings` also checks the tests and fails with 15 findings (2026-11-20, develop at 8a256c9): `assert_eq!` with a literal bool (commands.rs, search.rs, settings.rs), a needless borrow (crypto.rs), field assignments after `Default::default()` (settings.rs), a constant assertion (startup.rs), and in the tray icon tests of lib.rs operations with no effect and one that "will always return zero". Look at that last one closely: it may mean a test does not check what it means to. Developer-only: users notice nothing.

Fix the findings without weakening what the tests check, then ask the user whether `npm run lint` (and so CI and the release workflow) should use `--all-targets`, so that new findings in tests are caught. Rust tests stay single-threaded (`--test-threads=1`).

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort low (`/effort low`). Mostly mechanical changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `cargo clippy --all-targets -- -D warnings` passes in src-tauri; every test still checks what it checked before (or more), and `npm run test:all` passes
- [ ] #2 The user decides through the question dialog whether `npm run lint` uses `--all-targets`; if yes, package.json, DEVELOPMENT.md and CLAUDE.md say so, and a change that reaches the release workflow is checked only with its dry_run input, with the user's go-ahead, never with a real release
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
