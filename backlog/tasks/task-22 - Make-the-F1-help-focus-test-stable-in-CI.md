---
id: TASK-22
title: Make the F1 help focus test stable in CI
status: To Do
assignee: []
created_date: '2026-11-16T23:16:00Z'
updated_date: '2026-11-19T07:10:00Z'
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
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Vitest test "F1 opens the help with focus on the first shortcut" in src/components/__tests__/App.test.tsx failed once in CI on develop (commit 280d32f, run 43975084408, first attempt): focus was still on the search box. It passes locally every time and passed when the job was rerun. TASK-21 found it while releasing v0.3.1. The likely cause is a timing race on the slower CI machine: the 60 ms initial-focus timer in src/hooks/useWindowEvents.ts may fire after F1 and move focus back to the search box. If so, a user who presses F1 right after the window opens could hit the same race, so check the app as well as the test. A test that fails at random makes CI results less trustworthy and slows releases.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small timing fix in a test or in the focus code, with a clear way to check it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause is confirmed (for example by making the initial-focus timer fire after F1 on purpose) and recorded in the task notes
- [ ] #2 If a user pressing F1 right after the window opens can lose focus from the help the same way, the app is fixed and a test covers it
- [ ] #3 The test passes in many runs in a row locally (for example 50) and in CI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
