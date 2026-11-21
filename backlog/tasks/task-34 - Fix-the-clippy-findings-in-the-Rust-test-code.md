---
id: TASK-34
title: Fix the clippy findings in the Rust test code
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T23:55:00Z'
updated_date: '2026-11-21T19:11:00Z'
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
- [x] #1 `cargo clippy --all-targets -- -D warnings` passes in src-tauri; every test still checks what it checked before (or more), and `npm run test:all` passes
- [x] #2 The user decides through the question dialog whether `npm run lint` uses `--all-targets`; if yes, package.json, DEVELOPMENT.md and CLAUDE.md say so, and a change that reaches the release workflow is checked only with its dry_run input, with the user's go-ahead, never with a real release
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. git flow feature clippy-test-code.
2. Fix all 16 findings of `cargo clippy --all-targets -- -D warnings`: bool asserts -> assert!, needless borrow, struct literal with ..Default::default(), type alias for the db test row, pixel(x, y) helper in the lib.rs tray icon tests, startup.rs test checks the pause the function gives at the fastest start.
3. Add --all-targets to npm run lint, just lint and scripts/final-checks.ps1; describe it in CLAUDE.md and DEVELOPMENT.md. Workflow files stay unchanged.
4. Check that the rewritten tests still fail when the code they check is broken.
5. npm run test:all (389 Rust, 1 ignored, 625 frontend) and npm run lint.
6. Notes, AC, DoD, Done; finish the feature into develop.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Findings of `cargo clippy --all-targets -- -D warnings` on develop 2a3b707 (Rust 1.99): 16, all in test code: bool_assert_comparison x6 (commands.rs 1452, search.rs 279, settings.rs 351-353, 389), needless_borrows_for_generic_args (crypto.rs 599), type_complexity (db.rs 2106, all_rows), field_reassign_with_default x3 (settings.rs 447, 485, 816), assertions_on_constants (startup.rs 176), identity_op x3 and erasing_op (lib.rs 582, 602, 636). The erasing_op `(0 * 16 + 15) * 4` is not a bug: it is the byte index of pixel (15, 0), computed the same way as generate_tray_icon_rgba does; the test checks the pixel it means to.

User's choices (question dialog, 2026-11-21):
- Tray icon tests in lib.rs: "Допоміжна функція (Рекомендовано)"
- startup.rs constant assertion: "Перевіряти саму функцію (Рекомендовано)"
- Check the test code from now on: "Додати в npm run lint (Рекомендовано)"

Done on feature/clippy-test-code:
- Test code (only inside #[cfg(test)]): bool asserts -> assert!(x) / assert!(!x); `BASE64.encode([1u8; 10])` (same bytes); `Settings { field: ..., ..Default::default() }` (same values); `type Row` for all_rows in db.rs (type only); lib.rs tray icon tests use `pixel(x, y) = (y * 16 + x) * 4`, the layout of generate_tray_icon_rgba, for every index (also (0,0), was `data[3]`); startup.rs test asserts `pause_before_first_show_ms(true, 0) >= 600`. No #[allow] added.
- Lint: `--all-targets` added to npm run lint (package.json), just lint (justfile) and scripts/final-checks.ps1 (just final-checks). Described in CLAUDE.md (Commands) and DEVELOPMENT.md. .github/workflows/* unchanged: ci.yml and release.yml call `npm run lint`, so both now check the test code too; the comment in ci.yml line 12 still says "cargo clippy -D warnings" (left, workflow files only on the user's choice).

Checks:
- `cargo clippy --all-targets -- -D warnings`: 0 findings, exit 0. `npm run lint` (now with --all-targets): exit 0.
- Tests still fail when the code they check is broken (temporary edits, files restored byte for byte, checked with sha256): border loop from x=3, short text line at y=11, opaque pixel (15,0), is_encrypted negated in search.rs and get_sorted_snippets_inner, Settings defaults start_in_tray/autostart true and confirm_on_close false, MIN_SCREEN_READER_PAUSE_MS = 500 -> all 9 rewritten tests FAILED, the 3 others in the filter passed. Removing the lower limit of the pause (`.min(MAX)` instead of `.clamp`) -> the startup test FAILED as well, so it now checks the function too.
- `npm run test:all`: 625 frontend tests passed (26 files); Rust 389 passed, 1 ignored (same counts as before).
- Locally clippy with test code took about 0.5 s longer than without (incremental build); not measured on a clean CI runner.

Not done here: the Release workflow dry_run with the new lint (needs a push): left to the managing session and the user. No CHANGELOG entry: nothing a user can notice (test code, lint and docs only). Only test code changed in the app crate, so no release build and no copy to real_db; no focus, dialog or announcement change, so no `just smoke`.

Merged into develop (4bcd67e, git flow feature finish --no-ff); not pushed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`cargo clippy --all-targets -- -D warnings` now passes: the 16 findings in the Rust test code are fixed without weakening any test (no #[allow]). The suspicious `(0 * 16 + 15) * 4` in the tray icon test was not a bug (it is pixel (15, 0)); those tests now use a pixel(x, y) helper, and the least-pause test in startup.rs checks the pause the function gives instead of the constant alone. Every rewritten test was checked to fail when the code it checks is broken.

The user chose "Додати в npm run lint (Рекомендовано)": npm run lint, just lint and just final-checks run clippy with --all-targets, described in CLAUDE.md and DEVELOPMENT.md. CI and the Release workflow call npm run lint, so a clippy finding in a test now stops them too; their files are unchanged. Follow-up for the managing session: a Release dry_run to see the new lint on a clean runner.

Checks: npm run lint passes; npm run test:all passes (625 frontend; Rust 389 passed, 1 ignored). Developer-only: no CHANGELOG entry, no release build.
<!-- SECTION:FINAL_SUMMARY:END -->
