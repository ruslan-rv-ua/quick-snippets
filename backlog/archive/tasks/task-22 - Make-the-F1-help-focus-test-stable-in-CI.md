---
id: TASK-22
title: Make the F1 help focus test stable in CI
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T23:16:00Z'
updated_date: '2026-11-19T07:44:00Z'
labels:
  - testing
  - frontend
  - model-sonnet
  - effort-medium
milestone: m-4
dependencies: []
references:
  - src/components/__tests__/App.test.tsx
  - src/hooks/useWindowEvents.ts
priority: low
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Vitest test "F1 opens the help with focus on the first shortcut" in src/components/__tests__/App.test.tsx failed once in CI on develop (commit 280d32f, run 43975084408, first attempt): focus was still on the search box. It passes locally every time and passed when the job was rerun. TASK-21 found it while releasing v0.3.1. The likely cause is a timing race on the slower CI machine: the 60 ms initial-focus timer in src/hooks/useWindowEvents.ts may fire after F1 and move focus back to the search box. If so, a user who presses F1 right after the window opens could hit the same race, so check the app as well as the test. A test that fails at random makes CI results less trustworthy and slows releases.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small timing fix in a test or in the focus code, with a clear way to check it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause is confirmed (for example by making the initial-focus timer fire after F1 on purpose) and recorded in the task notes
- [x] #2 If a user pressing F1 right after the window opens can lose focus from the help the same way, the app is fixed and a test covers it
- [x] #3 The test passes in many runs in a row locally (for example 50) and in CI
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
1. Initial focus goes through focusSearch, which skips the search box while a dialog is open (same rule as onShow).
2. App test: hold back the 60 ms initial-focus timer, press F1, then run the timer; focus must stay on the first shortcut. Same for Ctrl+N. Make the existing F1 test independent of the timer.
3. Run the F1 tests 50 times, npm run test:all, npm run lint.
4. CHANGELOG Fixed entry, release build, just smoke (with the user's permission), copy exe to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause confirmed. The initial-focus timer in useWindowEvents.ts (60 ms after mount) calls onInitialFocus, which useWindowHiding.ts wired to searchRef.current?.focus() with no check for an open dialog. When the timer fired after F1, it moved focus from the first shortcut back to the search box. Reproduced on purpose: with the delay raised to 500 ms and a 700 ms wait after the help dialog appeared, the test failed at the same line as in CI (expect(first).toHaveFocus(), focus in the search box). On the slower CI machine, rendering and findByRole took longer than 60 ms, so the real timer fired after F1.

App defect too: in the real app the same timer runs after the window content loads. A key pressed in those first 60 ms (F1, Ctrl+N, or keys typed while the app starts) opens a dialog, and the timer then pulls focus back to the search box behind the open dialog. The onShow handler already skips this when a dialog is open; the initial focus did not.

Fix: useWindowHiding.ts wires onInitialFocus to focusSearch, which skips the search box while any dialog is open (same rule as onShow). New App tests hold back the 60 ms timer and run it after F1 and after Ctrl+N; both fail without the fix and pass with it. A third test checks that the timer still focuses the search box when no dialog is open.

Verification: App.test.tsx run 50 times in a row, 0 failures. npm run test:all: 435 Vitest, 230 Rust. npm run lint passes. Release exe built from fa43097; just smoke: 70/70 steps, 181/181 NVDA checks (the first run missed 5 object descriptions because NVDA's "Report object descriptions" was off; after the user turned it on, all passed). The NVDA log had the known script_caret_newLine error from earlier tasks. Copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-22-fa43097.exe. No new user-facing strings. CI run of AC #3 is left to the leading session, which pushes develop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The flaky F1 help test was a real app bug. The initial-focus timer, which fires 60 ms after the window content loads, moved focus to the search box even if a dialog had opened in the meantime; on the slower CI machine it fired after F1. Initial focus now skips an open dialog, as focus on window show already did. Tests run the timer after F1 and Ctrl+N. Checked: 50 local runs without a failure, test:all, lint, just smoke 70/70 and 181/181. CHANGELOG has a Fixed entry. CI confirmation is pending until develop is pushed.
<!-- SECTION:FINAL_SUMMARY:END -->
