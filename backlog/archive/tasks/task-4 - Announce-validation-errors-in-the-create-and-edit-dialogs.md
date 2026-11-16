---
id: TASK-4
title: Announce validation errors in the create and edit dialogs
status: Done
assignee:
  - '@claude'
created_date: '2026-11-15T23:03:00Z'
updated_date: '2026-11-15T23:55:00Z'
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
- [x] #1 Before any code change, a just smoke run shows what NVDA currently says for each validation error, and the result is recorded in the task notes
- [x] #2 just smoke has steps that trigger each validation error in the create and edit dialogs and checks what NVDA says
- [x] #3 NVDA says each validation message exactly once, with its text
- [x] #4 Focus moves to the first invalid field as today
- [x] #5 Unit tests cover the live region and the absence of a newly inserted role="alert"
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add smoke steps that trigger each validation error: create dialog (empty title, empty content, password mismatch) and edit dialog (empty title, empty content).
2. Run just smoke against the current exe (with the user's permission) and record what NVDA says.
3. Where NVDA gets it wrong, switch to the PasswordModal pattern: always-present assertive live region, no aria-describedby, no newly inserted role="alert".
4. Unit tests for the live regions and focus.
5. Rebuild the release exe, run just smoke again, run test:all and lint, update CHANGELOG.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline just smoke run, 2026-11-16, exe built 2026-11-15 23:24 from the current code (before any fix):
- Create, empty content (first error in a freshly opened dialog): NVDA said only "Вміст, редактор, неправильне введення, багаторядковий, порожньо | попередження". The message text was NOT said. FAIL.
- Create, empty title: "Назва має бути від 3 до 50 символів | попередження". Text once. OK.
- Create, password mismatch (focus already in the confirm field): "Паролі не збігаються | попередження". Text once. OK.
- Edit, empty title: "Назва має бути від 3 до 50 символів | попередження". Text once. OK.
- Edit, empty content (focus already in the field): "Вміст не може бути порожнім | попередження". Text once. OK.
So the newly inserted role="alert" is unreliable: the first one in the dialog is read as just "попередження" (alert), the same bug PasswordModal had. Every message is followed by the extra word "попередження". Fix: always-present assertive live regions without role="alert" and without aria-describedby, as in PasswordModal.
Unrelated: the NVDA log had one error during the run (script_caret_newLine with gesture Enter), not in the validation steps.

After the fix (release exe rebuilt 2026-11-16 01:53), just smoke: 20 of 20 steps OK, 25 of 25 NVDA checks OK.
- Create, empty content: "... Вміст не може бути порожнім | Вміст, редактор, неправильне введення, ..." — text once.
- Create, empty title / password mismatch; Edit, empty title / empty content: each message once, and the extra word "попередження" is gone.
- Focus lands on the invalid field in every step (checked through UI Automation).
Implementation: new FieldError component (always-present assertive live region, aria-atomic, no role="alert"); fields keep aria-invalid but no longer use aria-describedby. CSS cancels the form-field gap for an empty error so the layout does not change.
Not changed: pressing Save again with the same error does not repeat the message (the region text does not change); this was the same before.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Validation errors in the create and edit dialogs now use always-present assertive live regions (new FieldError component) instead of newly inserted role="alert" elements, and the fields no longer point at them with aria-describedby. This follows the fix already used in PasswordModal.

Why: a baseline NVDA smoke run showed the first error in a freshly opened create dialog read as just "попередження" (alert) without the text, and every message was followed by "попередження".

Verification: just smoke now has seven validation steps (create: empty content, empty title, password mismatch, Escape; edit: empty title, empty content, Escape); after the fix all 25 NVDA checks pass and each message is said once with focus on the invalid field. Unit tests cover the live regions, focus, the backend duplicate-title error and the absence of role="alert" and aria-describedby. npm run test:all and npm run lint pass.

Not covered: a repeated submit with the same error is not announced again (unchanged behaviour).
<!-- SECTION:FINAL_SUMMARY:END -->
