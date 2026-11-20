---
id: TASK-38
title: Show settings save errors inside the settings dialog
status: To Do
assignee: []
created_date: '2026-11-20T16:04:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/SettingsModal.tsx
  - src/App.tsx
  - src/i18n/translations.ts
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-36. When the settings dialog cannot save (for example settings.json cannot be written: a read-only folder, a full disk, a file locked by another program), `handleSave` in src/components/SettingsModal.tsx passes the error to `onError`, and App.tsx shows it as an error toast (ToastContainer, aria-live polite) outside the open dialog. The text is the backend's raw error, in English whatever the language of the app, and whether NVDA reads that toast while the dialog is open has never been checked: the dialog is aria-modal, so the page behind it may be hidden from screen readers. Since TASK-36 a refused change of "Start with Windows" is shown inside the dialog instead (a FieldError live region under the setting).

First find out what NVDA says today when the save fails, with a test copy only (for example a read-only settings file of the test copy), never with the user's data. Then show the error inside the dialog, in the language of the app (en, uk, de), in a way NVDA reads, and decide with the user what the dialog does after such a failure. Other dialogs also pass their errors to the same toast (App.tsx): note in the task notes which of them have the same problem, without fixing them here. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). An error path from the backend to an announced message, like TASK-36.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the settings cannot be saved, the settings dialog shows a message in the language of the app that NVDA reads
- [ ] #2 What NVDA said before the change is written in the task notes, and the user chose the solution through the question dialog
- [ ] #3 Tests cover a failed save without touching the user's data or settings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
