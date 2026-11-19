---
id: TASK-33
title: Notice damage deeper inside the snippet database
status: To Do
assignee: []
created_date: '2026-11-19T23:55:00Z'
labels:
  - bug
  - backend
  - investigation
  - model-sonnet
  - effort-high
milestone: m-2
dependencies: []
references:
  - src-tauri/src/db.rs
  - src-tauri/src/error_dialogs.rs
  - src-tauri/src/commands.rs
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-28. At start-up QuickSnippets now tells damage of snippets.db apart from other errors and keeps a damaged file instead of deleting it (`open_db_or_ask` in `src-tauri/src/db.rs`). But the start-up only opens the file and prepares the schema, so it notices damage only in the parts it reads then: the file header and the schema. Damage further inside the file (pages holding snippets or indexes) shows up only later, while the app works: the list, a search, saving or copying a snippet fails with SQLite's own error (SQLITE_CORRUPT, "database disk image is malformed"), and no dialog offers to keep the file or start over.

Find out what the user sees and hears then (window, messages, NVDA) and show the user possible solutions before changing code, for example: a quick integrity check at start-up (`PRAGMA quick_check`; its cost on a large database), a clear translated message when a damaged page is met during work, or saving what can still be read. The damaged file must never be deleted or changed without the user's consent, and the formats of snippets.db and settings.json stay as they are. Test only with test copies and test databases, never the user's data.

Investigation first: no code change until the findings are in the notes and the user has chosen a solution. Hands-off runs (just smoke, simulated keys, NVDA checks) need the user's go-ahead each time and end with two beeps; read NVDA speech only through just smoke or the bytes NVDA's log gets during the run itself.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). The same area as TASK-28; the user's snippets are at stake, so the tests need care.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With test databases damaged in pages after the schema, the notes record what the user sees and NVDA says at start-up and during work (list, search, save, copy), before any code change
- [ ] #2 The user is shown the possible solutions, with their costs (such as the start-up time with a large database), through the question dialog and chooses one
- [ ] #3 If a change is made: damage met at start-up or during work leads to a clear message in English, Ukrainian and German, and the damaged file is never deleted or changed without the user's consent; unit tests cover it and just smoke passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
