---
id: TASK-40
title: >-
  Show the errors of the delete, create, edit and password dialogs where they
  belong
status: To Do
assignee: []
created_date: '2026-11-20T17:24:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/DeleteConfirmModal.tsx
  - src/components/PasswordModal.tsx
  - src/App.tsx
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-38 (its archived notes have the details). Three dialogs still show backend errors badly:
- The delete confirmation (DeleteConfirmModal) passes a failed delete to onError, and App.tsx shows the raw backend text, in English, as a toast outside the open aria-modal dialog, gone after 2 s.
- The create and edit dialogs show a backend error they do not recognise (anything but too long, title length or a duplicate title; for example a database error) raw, in English, under the Title field, as if the title were wrong.
- The password dialog shows every failure of activate_snippet or autotype (also a clipboard or database error) as «Невірний пароль» (wrong password).

Show each error where the user expects it, in the language of the app (en, uk, de), with the real reason and in a way NVDA reads, as TASK-36 and TASK-38 did for the settings dialog. First find out what NVDA says today, with a test copy only, never with the user's data. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). Error paths from the backend to announced messages, like TASK-36 and TASK-38.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failed delete is shown inside the delete dialog, in the language of the app, and NVDA reads it
- [ ] #2 Create and edit show an error they do not recognise as an error of the dialog, not of the Title field
- [ ] #3 The password dialog says wrong password only for a wrong password, and other failures with their own message
- [ ] #4 What NVDA said before the change is in the task notes, and tests cover each case without touching the user's data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
