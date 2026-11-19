---
id: TASK-28
title: Translate the startup error dialogs and keep a damaged database
status: Done
assignee: []
created_date: '2026-11-19T16:41:00Z'
updated_date: '2026-11-19T23:50:00Z'
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
- [x] #1 Both dialogs (settings.json that cannot be read, snippets.db that cannot be opened) are in English, Ukrainian or German: the language from the settings when they can be read, otherwise the Windows display language, otherwise English
- [x] #2 Yes in the database dialog no longer deletes the damaged file: it stays next to the new empty database under a name that says what it is, and the user is told that name
- [x] #3 No in either dialog still quits without changing any file
- [x] #4 Unit tests cover the dialog texts in the three languages and keeping the damaged database file
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
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

## What changed (commit cd8d291)

- `src-tauri/src/error_dialogs.rs` (new): texts of the three start-up dialogs in en, uk and de (settings.json cannot be read; snippets.db damaged; snippets.db cannot be opened for another reason, "Try again?"), localized titles, `dialog_language` (settings language if en/uk/de, else `detect_language()`: Windows display language, else English), `ask_yes_no` (rfd, warning icon, standard Yes/No).
- `src-tauri/src/lib.rs`: settings are read before the database; the database dialog gets `dialog_language(settings.language)`.
- `src-tauri/src/settings.rs`: `load_settings` uses the translated dialog in the Windows display language. No still quits with exit code 1, Yes still resets.
- `src-tauri/src/db.rs`: `open_and_init_db` no longer shows dialogs; `classify_open_error` (SQLITE_CORRUPT and SQLITE_NOTADB = damage; BUSY/LOCKED, CANTOPEN, PERM/READONLY, FULL, other); `damaged_db_name` (`snippets-damaged-YYYY-MM-DD-HH-MM.db`, `-2`, `-3` when taken; local time from SQLite's own clock, no new crate); `keep_damaged_db` (renames the file and its `-journal`, never overwrites, puts the journal back if the main rename fails); `open_db_or_ask` (the loop, testable with a closure instead of the dialog); `open_db_at_startup` (rfd dialogs, No = exit 0). `handle_db_corruption` is gone.
- Tests: 14 new in db.rs, 12 in error_dialogs.rs (texts in three languages, language choice, classification incl. a real garbage file and a real damaged schema page, names, keeping the file and journal byte for byte, two damaged files in one minute, No changes nothing, a file held open without sharing -> try-again dialog and nothing changed, try again opens the same database with its snippets, rename failure -> try-again dialog and nothing changed).
- CHANGELOG [Unreleased] Fixed: three entries. CLAUDE.md: error_dialogs.rs row, db.rs row, i18n note.

Found on the way: SQLite itself discards an invalid rollback journal (and plays back a valid one) on every open, before any dialog; so "No changes nothing" holds for our code, while SQLite's own crash recovery of the journal happens as before. Documented in the test.

## Checks

- `npm run test:all`: 496 frontend tests, 290 Rust tests (was 263) pass. `npm run lint` passes. (`cargo clippy --all-targets` has older errors in other test code, not part of `npm run lint`; the new code has none.)
- Release build of cd8d291, dialogs on test copies with test data only (a scratchpad folder; script answers by WM_COMMAND to the message box, no simulated keys; NVDA speech read only from the log bytes written during the run, other lines counted, not shown):
  1. Settings uk + garbage snippets.db: Ukrainian damage dialog naming `snippets-damaged-2026-11-20-01-44.db` and the data folder; No -> exit code 0, snippets.db unchanged (SHA-256), no new files.
  2. Settings de + garbage db: German dialog; Yes -> app runs, the damaged file kept byte for byte under the shown name, a new SQLite snippets.db.
  3. Settings en + healthy db held open without sharing: English "cannot be opened ... Another program may be using the file ... Try again?" (not damage); file released, Yes -> app runs, no second dialog, no damaged copy.
  4. Damaged settings.json: dialog in the Windows display language (uk-UA here); No -> exit code 1, settings.json unchanged, no new files.
  5. Damaged settings.json + garbage db: Yes resets the settings, then the database dialog in the Windows language ("Same as Windows"); No -> exit, snippets.db unchanged.
  NVDA read each dialog as: title, "діалог", the whole text, then "Так, кнопка, Alt+т". All dialogs were the foreground window. The first run of scenarios 4-5 failed because the script took the language list (en-US first) instead of the UI language (uk-UA) and missed the second dialog; fixed in the script and rerun with the user's permission: 0 failed checks.
- `just smoke` on the release build of cd8d291 (with the user's permission): 81 of 81 steps, 301 of 301 NVDA checks. The NVDA log had the one known error of NVDA's own script_caret_newLine (Enter in a text field), as in earlier tasks.
- Build copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-28-cd8d291.exe`, SHA-256 61E1734D...C0ABF identical to the build.

Merged into develop with git flow feature finish --no-ff (32bb21f). On develop: npm run test:all (496 + 290) and npm run lint pass. Not pushed, not archived: left to the managing session.
<!-- SECTION:NOTES:END -->
