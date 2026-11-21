---
id: TASK-48
title: Decide how the Rust code follows cargo fmt
status: To Do
assignee: []
created_date: '2026-11-21T19:19:00Z'
labels:
  - tooling
  - model-sonnet
  - effort-low
milestone: m-2
dependencies: []
priority: low
ordinal: 10200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-34. `cargo fmt --check` in src-tauri reports 234 places in 10 Rust files (autotype.rs, commands.rs, crypto.rs, db.rs, error_dialogs.rs, lib.rs, search.rs, settings.rs, startup.rs, window_blur.rs; 2026-11-21, develop at e4afef0). There is no rustfmt.toml, so rustfmt's default style applies; the differences are older than TASK-34. Nothing checks the formatting today: `npm run lint` runs tsc and clippy only.

Find out what kinds of differences these are (for example line width, which the code may use wider than the default on purpose), then present the options through the question dialog before changing anything, for example: format everything once with `cargo fmt`; first add a rustfmt.toml that matches the style the code already has; add `cargo fmt --check` to `npm run lint` (and so to CI and the release workflow); or leave the code as it is. A formatting change must be a commit of its own with nothing else in it (it may go into `.git-blame-ignore-revs`, so that blame skips it) and must change no behaviour. Developer-only: users notice nothing, no CHANGELOG entry.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort low (`/effort low`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The notes say what kinds of differences cargo fmt --check reports, and the user chose through the question dialog what to do (format once, a rustfmt.toml, a check in npm run lint, or nothing)
- [ ] #2 If the code is formatted: the formatting is a commit of its own with no other change, cargo fmt --check passes, and npm run test:all and npm run lint pass with the same test counts
- [ ] #3 If a check is added to npm run lint: package.json, the Justfile, scripts/final-checks.ps1, CLAUDE.md and DEVELOPMENT.md say so, and the change is checked with the Release workflow dry_run input with the user's go-ahead, never with a real release
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
