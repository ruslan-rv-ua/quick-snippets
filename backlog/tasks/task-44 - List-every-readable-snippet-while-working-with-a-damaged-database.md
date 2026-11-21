---
id: TASK-44
title: List every readable snippet while working with a damaged database
status: To Do
assignee: []
created_date: '2026-11-21T08:45:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies:
  - TASK-43
references:
  - src-tauri/src/db.rs
priority: low
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-33 (its archived notes have the details). When the start-up dialog about a damaged snippet database is answered No, QuickSnippets keeps working with the damaged file. The list and the search then still stop at the first damaged page (`read_listing` in `src-tauri/src/db.rs`), and some sort orders show no snippet at all, although the snippets past the damaged page can still be read one by one by id, as TASK-33's rescue does; the window only says above the list that not all snippets are shown. Find out whether the list and the search can show every snippet that can still be read, in the chosen sort order, for example by reading the snippets the way the rescue does when a list is cut short, and what that costs; show the user the solutions through the question dialog before changing code. Keep the notice while the database is damaged. Test only with test databases, never the user's data. Builds on TASK-43, which bounds how the rescue reads ids.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The notes say what the list and the search show today with test databases damaged in different pages, and what a fuller list would cost
- [ ] #2 The user chose a solution through the question dialog
- [ ] #3 If a change is made: with a damaged database the list and the search show every snippet that can be read, in the chosen order, and unit tests on test databases cover it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
