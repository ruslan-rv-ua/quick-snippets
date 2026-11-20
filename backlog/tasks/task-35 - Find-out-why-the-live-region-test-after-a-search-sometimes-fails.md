---
id: TASK-35
title: Find out why the live region test after a search sometimes fails
status: To Do
assignee: []
created_date: '2026-11-20T01:27:00Z'
labels:
  - testing frontend accessibility investigation model-opus effort-medium
milestone: m-6
dependencies: []
references:
  - src/components/__tests__/App.test.tsx
  - src/App.tsx
  - src/components/SnippetList.tsx
priority: medium
ordinal: 3750
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-31. The frontend test `src/components/__tests__/App.test.tsx` > "App: where the screen reader is" > "when a search keeps the same snippet selected, the live region says it" (line 396) sometimes fails with `expected '' to be 'Greeting'`. During TASK-31 (2026-11-20) it failed in 2 of 9 runs of `npm run test`, 2 of 7 on develop after the merge; the check run after TASK-31 passed (496 of 496). src/ had not changed since 11ffa3c, so the flakiness is older than TASK-31.

The test opens the app, waits until the first snippet ("Greeting") is selected, types "g", waits until `search_snippets` is called, and then waits for the live region of the list (`.snippet-list-wrapper [aria-live]`, see src/components/SnippetList.tsx) to say "Greeting", with the default waitFor timeout of 1 s, after the 100 ms search debounce.

First find out which it is: a test that is too slow when the computer is busy, or an app that can really miss this announcement, for example when an answer from the start-up (App.tsx loads the list twice before `frontend_ready`) arrives after the answer to the search, or when the live region is emptied before the check. A real miss would mean that NVDA users sometimes do not hear the selected snippet after a search; then fix the app, not only the test. Repeat the run many times (for example `npx vitest run src/components/__tests__/App.test.tsx` in a loop), also while the processor is busy (for example during a Rust build), and give the failure rate before and after.

The Release workflow runs `npm run test` before the build, and CI runs it on pull requests: a flaky failure stops a release (safely, before the tag exists) and needs a rerun. Planned before TASK-30 by the user's choice (2026-11-20). Present the cause and the solutions through the question dialog before changing code.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort medium (`/effort medium`). A timing problem that may hide a missed announcement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause is found and written in the task notes: a test that is too slow, or the way the app misses the announcement
- [ ] #2 The user chose the fix through the question dialog; if the app can miss the announcement, the app is fixed, not only the test
- [ ] #3 The test passes in at least 50 runs in a row, also while the processor is busy, and still fails when the announcement is removed from the app
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
