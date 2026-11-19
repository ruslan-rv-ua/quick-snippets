---
id: TASK-28
title: Translate the startup error dialogs and keep a damaged database
status: In Progress
assignee: []
created_date: '2026-11-19T16:41:00Z'
updated_date: '2026-11-19T23:36:00Z'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Settings are read before the database (lib.rs), so the database dialog knows the language.
2. New module error_dialogs.rs: dialog language (settings language if en/uk/de, else Windows display language, else English) and the dialog texts in en, uk, de; rfd shows them with the standard Yes/No buttons.
3. db.rs: classify the SQLite error. Damage (SQLITE_CORRUPT, SQLITE_NOTADB) -> dialog "keep the damaged file and start with an empty database?"; Yes renames snippets.db (and its -journal) in the same folder to snippets-damaged-YYYY-MM-DD-HH-MM.db, the dialog names this name and the folder before Yes. Other errors (busy, no access, disk full, ...) -> dialog "Try again?", Yes retries, No quits; no file changes. A failed rename -> the same retry dialog, nothing changed.
4. Unit tests: texts in three languages, language choice, error classification, keeping the damaged file, No changes nothing.
5. CHANGELOG [Unreleased], release build, smoke (with the user's permission), damaged-db dialog checked on a test copy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-20)

- `lib.rs` opened snippets.db before reading settings.json, so the database dialog could not know the app language.
- `handle_db_corruption` showed its dialog after any error while opening or preparing the database, not only damage. With a file that is merely in use or not accessible, Yes deleted a healthy database (or failed and the app panicked on `expect`).
- The standard Yes/No buttons of a Windows message box are always labelled in the Windows language. Own button labels need rfd's `common-controls-v6` feature (TaskDialogIndirect); the lib test binary has no Common Controls v6 manifest (tauri-build embeds it only into the app exe), so the Rust tests would not start without extra build setup.

## The user's choice (question dialog, 2026-11-20, verbatim answers)

- Where and under what name to keep the damaged snippets.db: "Поруч, назва з датою (Рекомендовано)" (renamed in quick-snippets-data, e.g. snippets-damaged-2026-11-20-14-35.db, its journal file along with it; the dialog names it before Yes).
- When snippets.db is not damaged but cannot be opened for another reason: "Окремий діалог «Спробувати ще?» (Рекомендовано)" (Yes tries again, No quits, no file changes).
- Language when the settings are not read yet or are damaged: "Спершу налаштування, потім база (Рекомендовано)" (database dialog in the settings language, "same as Windows" -> Windows language; settings dialog in the Windows language; anything else -> English).
- Button labels: "Звичайні «Так» і «Ні» (Рекомендовано)" (standard Windows buttons, labelled in the Windows language).
<!-- SECTION:NOTES:END -->
