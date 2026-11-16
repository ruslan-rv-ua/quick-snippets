---
id: TASK-17
title: Return focus cleanly after the delete confirmation closes
status: To Do
assignee: []
created_date: '2026-11-16T18:13:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-2
dependencies: []
references:
  - src/components/DeleteConfirmModal.tsx
  - src/components/ModalOverlay.tsx
  - src/App.tsx
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a snippet is deleted with Ctrl+D and Ctrl+Enter, NVDA says "QuickSnippets - Snippet Manager, document | unknown" before it returns to the search box and the list (just smoke step 47 in the TASK-15 run; in the TASK-14 run the same place said "blank"). Focus most likely passes through the document while the dialog closes and the deleted snippet leaves the list. A screen reader user hears noise, and the first thing said after deleting is not where they are. TASK-15 noticed it; it was so before.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A focus fix in existing dialog code, checked with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, a just smoke run records what NVDA says after deleting with Delete and with Ctrl+D, and the cause is recorded in the task notes
- [ ] #2 After a snippet is deleted, NVDA no longer says "document" or "unknown": it says the deletion message once and then where focus is
- [ ] #3 The other dialogs that return focus to the main window (create, edit, settings, help) are checked for the same problem in just smoke
- [ ] #4 Unit tests cover where focus goes after the delete confirmation closes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
