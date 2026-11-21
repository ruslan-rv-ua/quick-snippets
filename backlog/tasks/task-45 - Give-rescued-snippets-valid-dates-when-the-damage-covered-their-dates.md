---
id: TASK-45
title: Give rescued snippets valid dates when the damage covered their dates
status: To Do
assignee: []
created_date: '2026-11-21T10:13:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/db.rs
priority: low
ordinal: 9100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-43 (its archived notes, "Noticed, no task created", item 1). The rescue at start-up (`copy_readable_snippets` in `src-tauri/src/db.rs`) copies every snippet that can still be read with whatever is left of its values. When the damage covers the dates of such a snippet (`created_at`, `updated_at`, `last_used_at`), the copy holds them with U+FFFD in place of the damaged bytes (TASK-33's repair of text that is no longer UTF-8). U+FFFD sorts above any digit, so after Yes such a snippet comes first in the list sorted by modification date (the default) and stays there until it is edited. In TASK-43's test database with a sector of 0xA5 this was snippet 056: its title is intact, its text and both dates are not.

Make the rescue give every copied snippet dates the app can use: a value that is no longer a date in the format QuickSnippets writes is filled the way a missing one is today (for example with the other date of the same snippet or the time of the rescue; `last_used_at` perhaps empty, as for a snippet never used). Dates that are intact stay byte for byte as they were. Check where else the window or the sorting uses these dates. Keep the rest of TASK-33 and TASK-43 as it is: the damaged file is only read, and the formats of snippets.db and settings.json stay as they are. Show the user the possible solutions through the question dialog before changing code. Test only with test databases, never the user's data.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A unit test with a test database whose damage covers the dates of a snippet that can still be read shows that after the rescue its dates are valid dates and it no longer comes first in the list sorted by modification date
- [ ] #2 Intact dates are copied byte for byte, the damaged file is still only read, and the start-up dialog, Yes and No work as in TASK-33
- [ ] #3 The user chose a solution through the question dialog
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
