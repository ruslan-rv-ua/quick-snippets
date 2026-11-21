---
id: TASK-33
title: Notice damage deeper inside the snippet database
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T23:55:00Z'
updated_date: '2026-11-21T08:10:00Z'
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
- [x] #1 With test databases damaged in pages after the schema, the notes record what the user sees and NVDA says at start-up and during work (list, search, save, copy), before any code change
- [x] #2 The user is shown the possible solutions, with their costs (such as the start-up time with a large database), through the question dialog and chooses one
- [x] #3 If a change is made: damage met at start-up or during work leads to a clear message in English, Ukrainian and German, and the damaged file is never deleted or changed without the user's consent; unit tests cover it and just smoke passes
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
1. db.rs: quick check of the opened database at start-up (PRAGMA quick_check); copy every readable snippet of a damaged database into a new file (ids, titles, contents byte for byte, dates; text that is no longer UTF-8 repaired with U+FFFD in the copy only; titles of unreadable snippets from the title index); the start-up flow with a dialog (Yes: rename the damaged file to snippets-damaged-<date>.db unchanged and put the copy in its place; No: keep working with the damaged file; copy or rename failure: try again or keep working); classify damage errors met during work (SQLITE_CORRUPT, SQLITE_NOTADB; a snippet whose text is no longer UTF-8); the list and search report whether damage cut them short.
2. error_dialogs.rs: texts of the new dialogs in en, uk, de (counts, up to 10 titles of unreadable snippets, the kept file name and folder).
3. commands.rs: damage errors become fixed texts the frontend recognises (like WRONG_PASSWORD); get_sorted_snippets and search_snippets return the list with a damaged flag.
4. Frontend: errors.ts helpers; translations en/uk/de; create, edit, delete and password dialogs give the damage reason and the advice to restart; copying, typing and opening a snippet for editing show a translated toast for damage (other errors unchanged: TASK-42); the main window shows a notice instead of "no snippets yet" when the list is incomplete, read by screen readers once per show.
5. Tests on test databases (Rust) and frontend tests.
6. CHANGELOG [Unreleased], CLAUDE.md rows of db.rs and error_dialogs.rs.
7. npm run test:all, npm run lint, release build, a one-off NVDA probe of the new dialog and messages, just smoke (unchanged, 91 steps); copy the build to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-21, no code change)

Test databases only, made in the session scratchpad. A throwaway probe (a small Rust program, not in the repo) compiles the app's own src-tauri/src/db.rs and search.rs unchanged (#[path]), with the same rusqlite 0.32.1 / SQLite 3.46.0 and opt-level "z" as the release build, plus copies of the inner IPC functions of commands.rs. It made a database of 93 snippets with the app's schema (90 plain ones of about 300 bytes, one of about 30 KB with 7 overflow pages, 2 marked encrypted; 25 pages of 4096 bytes) and damaged copies of it after the schema. Each copy was opened the way the app starts (`open_db_or_ask`), listed in all 8 sort orders, searched, every snippet opened (get_snippet_by_id) and copied (activate_snippet: content, touch_last_used, UTF-8), and saving, editing and deleting were tried on fresh copies of it.

### What the app does today

1. Start-up notices none of it: `open_db_or_ask` opened every damaged copy without a dialog. Opening and reading left the file byte for byte as it was.
2. The list and the search hide the damage. `list_snippets_sorted` and `list_snippets_for_search` (db.rs) return an empty list when the query cannot be prepared, end the list silently at the first damaged page (rusqlite yields the error once, `filter_map(|r| r.ok())` drops it, and the iteration ends), and drop rows whose title is not valid UTF-8. The frontend also ignores a failed list load (`useSearchLogic`, `.catch(() => void 0)`). What the window lists depends on the sort order and on where the damage is:
   - A damaged page of snippets in the middle (page 12 of 25, snippets 49-56): by modification date, the default (read through idx_snippets_updated_at), 37 of 93; the other direction 48; by creation date, title or last use 0, because these sort all rows first and the scan stops at the damaged page before any row is returned. Search over all titles: 35 of 91.
   - The page with the newest snippets damaged (page 25, snippets 92-93): the default list and the search are empty (0 of 93), although 91 snippets can be read.
   - The table's root page damaged (page 2): every list and search empty; no snippet can be opened or copied; saving fails.
   - The modification date index damaged (page 4): the default list and the search are empty although all 93 snippets are intact; sorting by creation date, title or last use shows all 93. Saving, editing and deleting fail.
   - The title index damaged (page 5): lists and search complete; saving, editing and deleting fail.
   - An overflow page of the long snippet damaged: lists complete, except by creation date (0: created_at lies after the content in the row, so sorting by it reads the overflow chain). That snippet cannot be opened or copied; everything else works.
   - sqlite_sequence damaged: lists complete; saving a new snippet fails; editing and deleting work.
   - The free page list damaged (after deleting the long snippet): lists complete; one new snippet saves, 30 do not.
   - 512 bytes (one disk sector) inside the page of snippets 49-56: default list 40, the other orders 0; snippet 53 gives "Query returned no rows" (opening, editing and deleting it), snippet 54 "Conversion error from type Text at index: 4, invalid utf-8 sequence of 1 bytes from index 0".
   - 4 bytes inside the text of snippet 40 (structure intact): quick_check and integrity_check say ok; copying it says "Invalid UTF-8 content", opening it for editing "invalid utf-8 sequence of 1 bytes from index 10".
   - 2 bytes inside the title of snippet 41 in the table: quick_check ok, integrity_check "row 41 missing from index idx_snippets_title". The snippet silently disappears from every list and search (its title is no longer UTF-8); editing or deleting it gives "database disk image is malformed".
   - 2 bytes of a title inside the title index: quick_check ok; integrity_check "non-unique entry in index idx_snippets_title / row 42 missing from index idx_snippets_title"; the app works normally.
3. Errors met during work are SQLite's own English text, "database disk image is malformed" (SQLITE_CORRUPT): copying a plain snippet and opening it for editing show it as a toast; saving and deleting show it inside their dialogs since TASK-40 ("Не вдалося зберегти сніпет. Причина: database disk image is malformed. Нічого не змінено.").
4. The app keeps writing into the damaged file: saving, editing and deleting snippets in its readable parts work, and every copy writes last_used_at (`touch_last_used`, its error ignored). In these tests that never made quick_check worse, but the damaged file keeps changing while the user works.

### Checks and what could be saved

5. `PRAGMA quick_check` notices every structural damage above: a damaged page of snippets, an index, an overflow chain, sqlite_sequence, the free page list, a damaged sector. For a page full of garbage the statement itself fails with SQLITE_CORRUPT; otherwise it returns lines such as "Tree 4 page 4: btreeInitPage() returns error code 11". It does not notice damaged bytes inside a text or a title: SQLite keeps no checksums. `PRAGMA integrity_check` also notices a damaged title (the index and the table disagree).
6. Snippets readable one by one by id (`SELECT ... WHERE id = ?`): 85 of 93 with the damaged middle page, 91 with the newest page, 92 with the overflow page, 93 with a damaged index, sqlite_sequence or free page list, 0 with the table's root page. In every case but a damaged index itself, all 93 titles (with their ids) stayed readable through one of the two indexes, so the snippets that cannot be saved can be named.
7. Cost, measured with the probe (release-like build, warm file cache; this computer's NVMe SSD reads 3.5 GB/s without the cache):
   - `PRAGMA quick_check`: 0.4 MB (300 snippets of 1 KB) under 1 ms; 12 MB (3,000 of 2 KB) 11-14 ms; 59 MB (1,000 of 60 KB) 33-34 ms; 294 MB (5,000 of 60 KB) 151-162 ms.
   - `PRAGMA integrity_check`: 0.2 ms, 13 ms, 58 ms, 271 ms for the same files.
   - After a restart of Windows the file is first read from disk: here about 17 ms more per 60 MB (much more on a hard disk).
   - Copying every readable snippet into a new file: 36 ms, 162 ms, 245 ms, 0.92 s.
   - For comparison: opening and preparing the schema takes 2-4 ms; the window of a default start appears about 0.5 s after the start, about 1.5 s with a screen reader.

### What the user sees and NVDA says (probe, with the user's permission, 2026-11-21 02:33)

A throwaway probe script (the helpers of scripts/smoke-nvda.ps1, lines 97-1042 copied unchanged, with its own steps; not committed) ran the release build of develop (3,866,112 bytes, SHA-256 identical to the TASK-40 build 618a3c2; src, src-tauri and scripts unchanged since) in three throwaway test copies, each in %TEMP%\quick-snippets-probe33-<time>\phaseN\test copy\ with its own data folder, language uk and one test database. Speech read only from the log offset of each step. 17 of 17 steps ran; no notification of another program was in the report. The user's autostart values were the same before and after (entry absent, mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), by the probe's report and by my own reads. The test folders were removed and no copy of the app was left running.

- Phase 1, the damaged page of snippets 49-56 (93 snippets in the file, 85 readable):
  - Start: the window appeared after 1.4 s; NVDA read the window, the search box and "Сніпет 090 тест, 1 із 37". Nothing says that 56 snippets are missing.
  - End and Ctrl+Shift+Space: "Сніпет 057 тест, 37 із 37".
  - Search "045" (snippet 045 is readable but lies past the damaged page): "Нічого не знайдено".
  - Ctrl+Shift+1 (sort by creation date): "Сортування: Найновіші | список | елемент списку | Пошук, ... порожньо"; the window shows «Сніпетів ще немає — створіть перший!». Ctrl+Shift+2 brought the 37 back.
  - Saving a new snippet: "Збережено" and the list has 38: the app writes into the damaged file without a word.
  - Copying it: works, the window hides.
- Phase 2, a damaged overflow page of «Великий сніпет», a damaged sqlite_sequence, damaged bytes in the text of snippet 040:
  - Start: the window, the search box, "Сніпет 090 тест, 1 із 93" (everything listed).
  - Enter on «Великий сніпет»: the toast "database disk image is malformed", read once, in English; the clipboard unchanged, the window stays.
  - Ctrl+E on it: the same toast; the edit dialog does not open.
  - Enter on «Сніпет 040 тест»: the toast "Invalid UTF-8 content".
  - Saving a new snippet: "Не вдалося зберегти сніпет. Причина: database disk image is malformed. Нічого не змінено." (the message of TASK-40 with SQLite's English reason); the dialog stays.
  - Deleting «Великий сніпет»: "Не вдалося видалити сніпет. Причина: database disk image is malformed."
- Phase 3, the damaged modification date index, all 93 snippets intact:
  - Start: NVDA read the window and "Пошук, комбінований список, згорнуто, ... порожньо", no snippet; the window shows «Сніпетів ще немає — створіть перший!».
  - Search "Сніпет": "Нічого не знайдено".
  - Ctrl+Shift+3 (sort by title): "Сортування: А–Я | список | Великий сніпет, 1 із 93": all 93 are there.
  - Saving: "Не вдалося зберегти сніпет. Причина: database disk image is malformed. Нічого не змінено."

In short: at start-up the user hears nothing about the damage; the list is silently incomplete or empty and may even say that there are no snippets yet; a damaged snippet fails with SQLite's English text; saving and deleting fail with TASK-40's message and an English reason; where saving still works, it goes into the damaged file.

For the record: the user answered the permission question for the probe with «так. далі запускай тести без мого дозволу в цій сесії» (yes; run the tests without asking in this session from now on).

## The user's choice (question dialog, 2026-11-21, verbatim answers)

- "TASK-33: як програма має поводитися з пошкодженням всередині бази сніпетів? ..." = "Перевірка, збереження й повідомлення (рекомендовано)": a quick check at every start; on damage a dialog before the window, in the language of the app, with how many snippets can be read and the titles of those that cannot; Yes moves every readable snippet into a new database and keeps the damaged file next to it, unchanged, as snippets-damaged-<date>.db; during work translated damage messages instead of English ones, and an incomplete list says that the database is damaged.
- "Якщо програма перевірятиме базу сніпетів під час кожного запуску, яку перевірку робити?" = "Швидка, quick_check (рекомендовано)".
- "Якщо під час запуску з’явиться діалог про пошкоджену базу з пропозицією зберегти читабельні сніпети в нову базу, що робитиме відмова?" = "Працювати з пошкодженою базою (рекомендовано)": two standard buttons; No renames and changes nothing, the app opens with the damaged file as before, and the dialog comes again at the next start.
- "Якщо пошкодження трапиться вже під час роботи (копіювання, збереження, неповний список), що має запропонувати перекладене повідомлення?" = "Порада перезапустити (рекомендовано)": the message says that the snippet database is damaged and what failed, and advises restarting QuickSnippets, which then checks the database and offers to save what can be read.
- "TASK-33, перевірка з NVDA після змін: як перевіряти, що NVDA читає новий діалог пошкодження під час запуску й нові повідомлення під час роботи?" = "Окремий пробний прогін": a one-off probe script checks it once; just smoke stays as it is (91 steps).

The other options offered: "Лише повідомлення під час роботи", "Перевірка й збереження лише під час запуску", "Збереження за командою під час роботи"; "Повна, integrity_check"; "Закрити програму", "Три кнопки"; "Зберегти одразу, без перезапуску"; "Нові кроки в just smoke (рекомендовано)".

## What changed (commit 06968b0, branch feature/damaged-db-inside)

- src-tauri/src/db.rs:
  - `check_health`: `PRAGMA quick_check` on the opened database; Healthy, Damaged (also when the pragma itself fails with SQLITE_CORRUPT), or Unknown (another error: nothing is offered).
  - `copy_readable_snippets`: ids from a scan of the table in both directions and from both indexes (each up to the first damaged page) and the id counter (trusted up to 100,000 past the highest id found); every id up to the highest is read on its own (`SELECT ... WHERE id = ?`) and copied with its id, title, content bytes, is_encrypted and dates into a new file with the same schema (`init_db`). Encrypted contents stay byte for byte; a title or plain text that is no longer UTF-8 is repaired with U+FFFD in the copy only; missing dates are filled from the other date or now. Snippets known from a scan or index that cannot be read are lost, named by the title index where it still has them. The id counter of the copy continues after every id the damaged file used (its one sqlite_sequence row is updated or added). Reads the damaged file only.
  - `rescue_if_damaged` (testable with an ask closure, like `open_db_or_ask`): healthy or unknown -> go on; damaged -> copy into `snippets-rescue.tmp` next to snippets.db, then the question (`RescueDialog::Offer` with the counts and the kept name `snippets-damaged-<stamp>.db` from `damaged_db_name`). Yes: close the damaged file, rename it with `keep_damaged_db` (with its journal), rename the copy to snippets.db, open it again (`RescueOutcome::Reopen`, which goes through `open_db_or_ask` and the check again). No: remove the copy, keep the connection. A failed copy or rename removes the copy, changes nothing and asks whether to try again (`RescueFailure::CopyFailed` / `KeepFailed`); No keeps working with the damaged file. A folder called snippets-rescue.tmp is never removed.
  - `open_db_at_startup`: `open_db_or_ask`, then `rescue_if_damaged`, in a loop.
  - `damage_of`, `DATABASE_DAMAGED` ("The snippet database is damaged"), `SNIPPET_DAMAGED` ("This snippet is damaged").
  - `list_snippets_sorted`, `list_snippets_for_search` return `Listing { rows, damaged }`: damage that stops the reading or leaves out a row (a title that is not UTF-8) sets `damaged`; other errors end the list unmarked, as before.
  - `test_damage` (test only): test databases of 90 snippets damaged on purpose (a page filled with 0xA5, found through SQLite's dbstat table; bytes overwritten inside a title or text).
- src-tauri/src/error_dialogs.rs: `RescueFailure`; `db_damaged_inside` (counts, up to 10 titles in the quotes of the language and "and N more", the kept file name and folder, Yes and No; special wording when every snippet or none can be read) and `db_rescue_failed` (what failed, the details, try again), in en, uk, de; same title as the other start-up dialogs; standard Yes/No.
- src-tauri/src/commands.rs: `db_err` replaces `map_rusqlite_err` and the plain `to_string` of database errors (damage -> the fixed texts; "Title already exists" as before); a plain text that is not UTF-8 -> SNIPPET_DAMAGED (`plaintext_to_string`, the bytes zeroized, none in the error; was "Invalid UTF-8 content"); `get_sorted_snippets` and `search_snippets` return `SnippetListView { items, damaged }`.
- Frontend: `DATABASE_DAMAGED`, `SNIPPET_DAMAGED`, `isDatabaseDamaged`, `isSnippetDamaged`, `isDamage`, `failureMessage` (src/utils/errors.ts); translations `databaseDamaged`, `restartToRepair`, `snippetDamaged`, `snippetOpenFailed`, `listDamaged` in en, uk, de; the create, edit, delete and password dialogs give damage in words of the app (with the advice to restart for a damaged database); copying or typing a plain snippet and opening a snippet for editing show a toast for damage only (8 s; any other error as before, TASK-42); `useSearchLogic.listDamaged`; `SnippetList` shows the notice above the list instead of "no snippets yet" / "no results" and reads it once after each show of the window (its own polite live region, `shownCount` from App), an empty damaged search says the notice instead of "no results"; CSS `.list-notice`.
- CHANGELOG [Unreleased]: one Added, two Fixed entries. CLAUDE.md: rows of db.rs and error_dialogs.rs.

## Checks

- On the branch: `npm run test:all` passes: 612 frontend tests (was 572), 370 Rust tests (was 336; 1 ignored, as before). `npm run lint` passes. New tests: Rust 34 (db.rs 21 on test databases damaged on purpose: the quick check; the list flags; damage_of; copy_readable_snippets with a healthy database, a damaged page of snippets, the table's root page, an index, the newest page lost and broken text; rescue_if_damaged with a healthy database, No, Yes, a rename failure, a copy failure and a leftover rescue file; commands.rs 7; error_dialogs.rs 6), frontend 40 (errors 8, SnippetList 9, the delete, create and edit dialogs 3 each, the password dialog 6, App 7, useSearchLogic 1). Every test works on test databases or mocked IPC; no file of the user touched.
- Mutation checks: "no snippets yet" for a damaged empty list, failureMessage ignoring damage, a list not marked at a damaged page, Yes deleting the damaged file instead of keeping it: 21 frontend and 3 Rust tests failed; all restored. Found in review and fixed before the commit: `INSERT OR REPLACE` into sqlite_sequence (a table without a key) would have added a second counter row; the new test fails without the fix.
- Verification probe with NVDA on the release build of 06968b0 (the user's standing permission for this session): a throwaway script (the helpers of smoke-nvda.ps1 and its own steps, not committed), four throwaway test copies in %TEMP%\quick-snippets-verify33-<time>\, language uk, the start-up dialog answered by WM_COMMAND (no keys); 15 of 15 steps:
  - Phase A (the page of snippets 49-56 damaged): the dialog was in the foreground; NVDA read "QuickSnippets — Помилка, діалог, База сніпетів snippets.db пошкоджена. Сніпетів у базі: 93. Вдається прочитати: 85. Не вдається прочитати: 8: «Сніпет 049 тест», ... «Сніпет 056 тест». Перенести сніпети, які вдається прочитати, у нову базу? Так: ... (85). Пошкоджений файл отримає назву snippets-damaged-2026-11-21-09-59.db і залишиться в теці ... без змін. Ні: ... Під час наступного запуску програма запитає знову. | Так, кнопка, Alt+т". No: the window with 37 snippets; NVDA read the window, the search box, "Сніпет 090 тест, 1 із 37" and then "Показано не всі сніпети: база сніпетів пошкоджена. Перезапустіть QuickSnippets: під час запуску програма перевірить базу й запропонує зберегти сніпети, які ще вдається прочитати." The search "045" answered with that notice instead of «Нічого не знайдено»; sorting by creation date showed the notice instead of «Сніпетів ще немає».
  - Phase B (the overflow page of «Великий сніпет», the id counter and bytes of snippet 040 damaged), No: the list complete, no notice. Copying «Великий сніпет»: "Не вдалося скопіювати сніпет. Причина: база сніпетів пошкоджена. Перезапустіть QuickSnippets: ...", clipboard unchanged; Ctrl+E: "Не вдалося відкрити сніпет. Причина: база сніпетів пошкоджена. ..."; copying «Сніпет 040 тест»: "Не вдалося скопіювати сніпет. Причина: цей сніпет пошкоджений, його не вдається прочитати."; saving: "Не вдалося зберегти сніпет. Причина: база сніпетів пошкоджена. Нічого не змінено. Перезапустіть QuickSnippets: ...", the dialog open; deleting: "Не вдалося видалити сніпет. Причина: база сніпетів пошкоджена. Перезапустіть QuickSnippets: ...". Each read once.
  - Phase C (the database of phase A), Yes: the window with 85 snippets, no notice; snippets-damaged-2026-11-21-10-01.db byte for byte the damaged test database; the data folder holds settings.json, snippets.db and the kept file, no rescue file.
  - Phase D (only the modification date index damaged): "Сніпетів у базі: 93. Усі вдається прочитати." Yes: all 93 in the default order.
  - Found: after sorting into an empty damaged list NVDA said "невідомо | додаток | додаток": with the notice above the list, the list had no child left. Fixed in cbaf647 (an empty damaged list holds the notice where «Сніпетів ще немає» stood). On the release build of cbaf647 this step said once "елемент списку | додаток | додаток" and once "список | елемент списку | Пошук, ...", the same as the 0.3.5 build (a copy of real_db\quick-snippets-TASK-40-618a3c2.exe run from the scratchpad) said on the same database in a run right before: NVDA's timing, not the change.
- `just smoke` on the release build of cbaf647 (3,892,224 bytes): 91 of 91 steps, 356 of 356 NVDA checks, exit code 0; the NVDA log had the one known error of NVDA's own script_caret_newLine.
- The user's autostart values: entry absent and mark Binary 02 00 00 00 00 00 00 00 00 00 00 00 before and after every run (the reports and my own reads); the smoke report: at the end "mark absent", restored "as before".
- No notification of another program in any report; the console captures were deleted.
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-33-cbaf647.exe`, SHA-256 8E973B6F16E461EBBA28DC82808C33A94624BACA262C20CEB2C9E01FD5C53D80, the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown; the new dialog comes before the window, like TASK-28's.

## Noticed, no task created

1. With No in the start-up dialog the list still stops at the damaged page, and some orders show none. Reading the snippets one by one, as the rescue does, would list every readable one; not done (the user chose to keep working with the damaged file as it is).
2. Damaged bytes inside a text or a title are not found by quick_check; they show up when the snippet is read («цей сніпет пошкоджений»). A rescue started by other damage repairs them with U+FFFD in the copy.
3. A snippet that the list shows but the row lookup no longer finds after partial damage still gives the raw "Query returned no rows" (TASK-42's area).
4. SettingsModal.test.tsx failed once while it ran in parallel with an NVDA probe (load) and passed when run again alone: timing-sensitive under load.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Damage of snippets.db beyond its header and schema went unnoticed. An investigation with 15 kinds of damage in test databases and an NVDA probe showed that the start-up said nothing, the list and the search silently stopped at a damaged page or came out empty ("No snippets yet"), a damaged snippet failed with SQLite's English text, and saving went on into the damaged file.

By the user's choice (question dialog, all recommended options): a quick check (PRAGMA quick_check) at every start, a few milliseconds for a usual database; on damage a native dialog in en, uk and de gives how many snippets can be read and names those that cannot. Yes copies every readable snippet into a new snippets.db and keeps the damaged file next to it, unchanged, as snippets-damaged-<date-time>.db; No keeps working with the damaged file. During work damage is said in the language of the app with the advice to restart, and an incomplete list says so (read once after each show) instead of "no snippets yet". The formats of snippets.db and settings.json are unchanged.

Verified: npm run test:all (612 frontend, 370 Rust), npm run lint, mutation checks; a verification probe with NVDA on the release build (the dialog read in full, No and Yes as described, the kept file byte for byte, every message read once); just smoke 91 of 91, 356 of 356; the user's autostart values unchanged; build copied to real_db as quick-snippets-TASK-33-cbaf647.exe.

Follow-ups for review: with No, a damaged list still shows only the snippets before the damaged page; damaged bytes inside a text or title are found only when the snippet is read; other raw errors outside the dialogs remain for TASK-42.
<!-- SECTION:FINAL_SUMMARY:END -->
