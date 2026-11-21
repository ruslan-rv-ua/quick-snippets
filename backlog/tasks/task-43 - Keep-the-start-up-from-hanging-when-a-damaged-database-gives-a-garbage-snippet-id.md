---
id: TASK-43
title: >-
  Keep the start-up from hanging when a damaged database gives a garbage snippet
  id
status: To Do
assignee: []
created_date: '2026-11-21T08:45:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-high
dependencies: []
references:
  - src-tauri/src/db.rs
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the managing session while checking TASK-33 (its archived notes have the details). When the check at start-up (`check_health`, PRAGMA quick_check) finds damage inside snippets.db, `copy_readable_snippets` in `src-tauri/src/db.rs` collects snippet ids from four scans (both indexes, the table in both directions) and then reads every id from 1 up to the highest one found (`for id in 1..=last_id`). A damaged page can give a scan a garbage id. With one 512-byte sector of a page of snippets filled with 0xA5 (the pattern of TASK-33's own investigation) the table scan returns the id 5374248273442940325, and the loop never ends in practice: the start-up hangs, one processor core at full load, before any dialog, tray icon or window. NVDA says nothing, and every new start hangs the same way, because the database is opened before the single-instance plugin is set up. The damaged file is not changed; it is only read.

Shown with the app's own `copy_readable_snippets` (db.rs of develop 8c185b8 unchanged, rusqlite 0.32.1 with SQLite 3.46.0, as in the release build) on a test database of 90 snippets of about 300 bytes: the whole page holding snippet 050 filled with 0xA5 finished in 31 ms (79 saved, 11 lost); sector 1 of that page filled with 0xFF in 29 ms (87 saved, 3 lost); sector 1 filled with 0xA5 had not finished after 30 s. quick_check names the id itself: "Tree 2 page 10 cell 8: Rowid 5374248273442940325 out of order". A sweep with Python's SQLite 3.50.4 over the 8 sectors of that page with 4 fills (0xA5, 0xFF, 0x00, random bytes) gave a huge id in 8 of 32 cases (0xA5 in 7 sectors, random bytes in 1: 13939557623); sectors of the title index gave none.

Make the rescue always end quickly, whatever ids the damaged file holds, without losing snippets that can be read: for example read every id that a scan or an index named, and walk the range of ids only up to a limit that a garbage id cannot raise (such as the highest id that could actually be read, plus a margin). Where it can be told apart, a garbage id is not counted or named as a lost snippet in the dialog. The id counter of the new database must stay sane too: it continues after the ids the damaged file really used. Keep the rest of TASK-33 as it is: the damaged file is only read, and the formats of snippets.db and settings.json stay as they are. Show the user the possible solutions before changing code. Test only with test databases, never the user's data.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). The same code as TASK-33; the user's snippets are at stake.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A unit test with a test database whose page of snippets has one sector filled with 0xA5 (a scan returns a huge id) shows that the rescue ends within a second and saves every snippet that can be read
- [ ] #2 The work of the rescue is bounded for any ids a damaged file gives, the id counter of the new database continues after the real ids, and a garbage id is not shown as a lost snippet where it can be told apart
- [ ] #3 The damaged file is still only read, and the start-up dialog, Yes and No work as in TASK-33
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
