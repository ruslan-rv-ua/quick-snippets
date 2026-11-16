---
id: TASK-14
title: >-
  Cover search, delete, sorting, quitting and the theme after a restart in just
  smoke
status: To Do
assignee: []
created_date: '2026-11-16T16:28:00Z'
updated_date: '2026-11-16T16:28:00Z'
labels:
  - testing
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-2
dependencies:
  - TASK-3
references:
  - scripts/smoke-nvda.ps1
  - DEVELOPMENT.md
  - README.md
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-3 decided on 2026-11-16 not to add tauri-driver end-to-end tests and to keep just smoke (scripts/smoke-nvda.ps1) as the end-to-end check of the real release exe with NVDA. Its notes explain why: WebDriver cannot hear NVDA, and NVDA speech is where the recent bugs were.

just smoke has 35 steps, but several everyday flows are not in it: search, delete with its confirmation dialog, the four sort shortcuts, quitting through the exit confirmation, and the theme chosen with Ctrl+Shift+T after a restart. These flows had real bugs before (layout-dependent shortcuts in 1d1b418, Ctrl+Enter in the exit and delete confirmations in f54b8f6 and 303f474, the sort change announced three times in 61420d6, search results announced wrongly in 8cec14a and cce24b3, the theme not saved in 232fe67), and the unit tests mock every Tauri API, so only a run of the real exe shows them working together.

Ask the user before every just smoke run: the keyboard and mouse must stay untouched for about a minute, and the user's own QuickSnippets is closed and not started again. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Script work with a clear scope, where checking each step against real NVDA output matters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New steps cover search: typing a query filters the list, and Escape clears the search
- [ ] #2 New steps cover delete with the confirmation dialog: Delete or Ctrl+D opens it, Escape keeps the snippet, Ctrl+Enter deletes it
- [ ] #3 New steps cover the four sort shortcuts (Ctrl+Shift+1 to 4), including the direction toggle on a second press
- [ ] #4 New steps cover quitting with the exit confirmation on: Alt+F4 opens it, Escape keeps the app running, Ctrl+Enter quits
- [ ] #5 A step changes the theme with Ctrl+Shift+T, restarts the test copy and checks that the theme stayed
- [ ] #6 Every new step checks the app state (UI Automation, settings.json or the process) and what NVDA says, and just smoke passes with all old and new steps on a fresh release build
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
