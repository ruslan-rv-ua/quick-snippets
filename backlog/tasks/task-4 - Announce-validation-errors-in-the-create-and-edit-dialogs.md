---
id: TASK-4
title: Announce validation errors in the create and edit dialogs
status: To Do
assignee: []
created_date: '2026-11-15T23:03:00Z'
updated_date: '2026-11-15T23:33:00Z'
labels:
  - accessibility
  - frontend
  - model-sonnet
  - effort-high
milestone: m-0
dependencies: []
references:
  - src/components/CreateSnippetModal.tsx
  - src/components/EditSnippetModal.tsx
  - src/components/PasswordModal.tsx
  - src/components/__tests__/PasswordModal.test.tsx
  - scripts/smoke-nvda.ps1
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The create and edit dialogs show validation errors (empty title, empty content, password mismatch) as a newly inserted role="alert" element and add aria-describedby to the field at the same moment. The password dialog had the same pattern: inside the app root (role="application") NVDA read only "alert" without the text, and the describedby change made NVDA repeat the message. It was fixed with an always-present assertive live region and no describedby (see PasswordModal.tsx). The create and edit dialogs have not been checked with NVDA yet.

Check first, then fix: add the validation steps to just smoke, run them against the current code, and fix only what NVDA actually gets wrong. If a dialog already reads correctly, the smoke steps alone are enough. Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). The fix follows the pattern already used in PasswordModal.tsx, so this is a change in existing code where verification matters most: unit tests plus an NVDA run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, a just smoke run shows what NVDA currently says for each validation error, and the result is recorded in the task notes
- [ ] #2 just smoke has steps that trigger each validation error in the create and edit dialogs and checks what NVDA says
- [ ] #3 NVDA says each validation message exactly once, with its text
- [ ] #4 Focus moves to the first invalid field as today
- [ ] #5 Unit tests cover the live region and the absence of a newly inserted role="alert"
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
