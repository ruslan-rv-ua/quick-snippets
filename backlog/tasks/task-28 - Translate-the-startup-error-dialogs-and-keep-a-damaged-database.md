---
id: TASK-28
title: Translate the startup error dialogs and keep a damaged database
status: To Do
assignee: []
created_date: '2026-11-19T16:41:00Z'
labels:
  - bug
  - backend
  - i18n
  - model-sonnet
  - effort-high
milestone: m-6
dependencies: []
references:
  - src-tauri/src/settings.rs
  - src-tauri/src/db.rs
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two native dialogs appear when QuickSnippets cannot read its data, before the web interface exists, so src/i18n/translations.ts does not cover them:

- `load_settings` in src-tauri/src/settings.rs, when settings.json cannot be read: Ukrainian only (found by TASK-5). Yes resets the settings to the defaults, No quits.
- `handle_db_corruption` in src-tauri/src/db.rs, after any error while opening snippets.db, not only real damage: English only. Yes deletes snippets.db for good and starts an empty database, No quits. A damaged SQLite file can often still be partly recovered, so deleting it throws away the user's only copy of their snippets.

The project rule is that every user-facing string exists in en, uk and de (the tray labels are already translated in Rust). When settings.json is damaged, the language setting is unknown; the app already detects the Windows display language for "language follows Windows" (settings.rs).

The user chose (2026-11-19) to cover both dialogs and to keep the damaged database file instead of deleting it.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Small changes in Rust, but the database dialog is the one place where the app throws away the user's snippets, so the new behaviour needs careful tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both dialogs (settings.json that cannot be read, snippets.db that cannot be opened) are in English, Ukrainian or German: the language from the settings when they can be read, otherwise the Windows display language, otherwise English
- [ ] #2 Yes in the database dialog no longer deletes the damaged file: it stays next to the new empty database under a name that says what it is, and the user is told that name
- [ ] #3 No in either dialog still quits without changing any file
- [ ] #4 Unit tests cover the dialog texts in the three languages and keeping the damaged database file
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
