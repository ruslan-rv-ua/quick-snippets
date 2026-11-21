---
id: TASK-46
title: Make the settings dialog test that fails under load reliable
status: To Do
assignee: []
created_date: '2026-11-21T11:45:00Z'
labels:
  - test
  - frontend
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/__tests__/SettingsModal.test.tsx
priority: low
ordinal: 9200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the managing session while checking TASK-45. A frontend test in `src/components/__tests__/SettingsModal.test.tsx` named "opening the dialog again shows no old message" (two tests have that name: one for the autostart message, one for the save message) failed once in TASK-33's checks and once in TASK-45's, both times while the computer was busy with other work (a build running in parallel); run again without that load, every test passed. The Release workflow runs `npm run test` before the build, so such a failure stops a release run (before any tag or release exists) and the run has to be started again.

Find out which of the two fails and why it depends on load (for example a wait with a short time limit, or state left from the previous opening of the dialog), reproduce the failure under load if possible (for example during a parallel build or with many test workers), and make the test reliable without weakening what it checks. Only test code should change; if the dialog itself turns out to have a timing bug, show the user the solutions through the question dialog before changing it.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The notes say which test failed, why it depends on load, and how the failure was reproduced (or why it could not be)
- [ ] #2 The test passes in repeated runs while the computer is busy, and it still fails when the dialog shows the old message after being opened again
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
