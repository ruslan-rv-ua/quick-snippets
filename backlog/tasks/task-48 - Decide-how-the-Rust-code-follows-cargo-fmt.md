---
id: TASK-48
title: Decide how the Rust code follows cargo fmt
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-21T19:19:00Z'
updated_date: '2026-11-21T19:28:00Z'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Format with plain `cargo fmt` (no rustfmt.toml) in a commit of its own, nothing else in it.
2. Check: `cargo fmt --check`, `npm run lint`, `npm run test:all` with the same counts (625 frontend, 389 Rust, 1 ignored).
3. Separate commit: `.git-blame-ignore-revs` with the formatting commit's hash, and `cargo fmt --check` in scripts/final-checks.ps1; describe both in CLAUDE.md (Commands) and DEVELOPMENT.md.
4. Build the release exe and copy it to C:\5-quicksnippets\real_db\quick-snippets-TASK-48-<commit>.exe.
5. Finish the task, merge the git flow branch into develop (no push).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Findings (2026-11-21, develop 08644b6, rustfmt 1.10.0, edition 2021, no rustfmt.toml): `cargo fmt --check` reports 234 places in 10 files; autostart.rs, paths.rs and main.rs are already clean. 175 of them are in test modules, 60 in app code. Kinds:
- 211 places where rustfmt would split onto several lines what the code keeps on one line: one-line if/else (`if encrypted { a } else { b }`), method chains, struct literals (`DialogText { title: title(lang), message }`), function and assert! arguments. The lines are mostly under 100 characters, but over rustfmt's smaller default limits for such constructs (`use_small_heuristics`).
- 19 places where older code (mostly autotype.rs) is wrapped earlier than needed and rustfmt joins it into one line.
- About 40 code lines are longer than 100 characters (up to 170), almost all in tests.
- Long doc comments are not affected: rustfmt does not rewrap comments by default.
No rustfmt.toml reproduces the existing code, so there is no consistent house style: `use_small_heuristics = "Max"` still leaves 166 differences, `max_width` 110/120/140 leaves 211/186/185, `max_width = 80` leaves 435. The justfile already has `just format` (plain `cargo fmt`, default style).
The GitHub workflows install Rust with `components: clippy` only (no rustfmt), so a `cargo fmt --check` in `npm run lint` would need rustfmt added there too.

User's choices (question dialog, verbatim):
- What to do with the code: "Відформатувати за замовчуванням (Рекомендовано)"
- Check the formatting from now on: "Лише локально" (the check goes into `just final-checks` only; `npm run lint`, CI, Release and the workflow files stay unchanged)
- .git-blame-ignore-revs: "Так, окремим комітом (Рекомендовано)"
<!-- SECTION:NOTES:END -->
