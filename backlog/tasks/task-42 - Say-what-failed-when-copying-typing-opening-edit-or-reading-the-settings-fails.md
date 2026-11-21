---
id: TASK-42
title: >-
  Say what failed when copying, typing, opening edit or reading the settings
  fails
status: To Do
assignee: []
created_date: '2026-11-21T00:00:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/App.tsx
  - src/components/EditSnippetModal.tsx
  - src/components/SettingsModal.tsx
  - src-tauri/src/db.rs
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-40 (its archived notes have the details). Four places still show a backend error as raw English text in a toast: copying a plain snippet, typing a plain snippet with autotype, opening the edit dialog (loading the snippet), and reading the settings when the settings dialog opens. Show each in the language of the app (en, uk, de), saying what failed and the reason the database or Windows gives, in a way NVDA reads, as TASK-38 and TASK-40 did for the dialogs. Decide with the user where each message belongs: for an action started from the main window a toast may be the right place, but its text must say what failed, in the language of the app.

Also, when the snippet database is locked, a dialog stays silent for SQLite's busy timeout of 5 s before its message. Find out whether a shorter wait, or an announcement while the app waits, would help, and present it; change nothing there without the user's choice.

First find out what NVDA says today, with a test copy only (the smoke script of TASK-40 locks the test copy's database with byte-range locks), never with the user's data. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). Error paths from the backend to announced messages, like TASK-38 and TASK-40.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Copying and typing a plain snippet, opening the edit dialog and reading the settings show their failures in the language of the app, saying what failed, and NVDA reads them
- [ ] #2 What NVDA said before the change is in the task notes, and the user chose the solutions through the question dialog
- [ ] #3 The 5 s of silence with a locked database is investigated, and the user's choice about it is done
- [ ] #4 Tests cover each case without touching the user's data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
