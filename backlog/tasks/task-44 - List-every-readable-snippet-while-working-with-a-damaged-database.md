---
id: TASK-44
title: List every readable snippet while working with a damaged database
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T08:45:00Z'
updated_date: '2026-11-21T10:47:00Z'
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
- [x] #1 The notes say what the list and the search show today with test databases damaged in different pages, and what a fuller list would cost
- [x] #2 The user chose a solution through the question dialog
- [x] #3 If a change is made: with a damaged database the list and the search show every snippet that can be read, in the chosen order, and unit tests on test databases cover it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-21, no change to the app's code)

Test databases only, in this session's scratchpad. A throwaway probe (a small Rust program, not in the repo) compiles the app's own src-tauri/src/db.rs, search.rs and error_dialogs.rs unchanged (include!, built with `--cfg test` so that test_damage is there), with rusqlite 0.32.1 / SQLite 3.46.0, opt-level "z", LTO and panic=abort as in the release build. It opens each damaged copy the way the app does (open_and_init_db), lists it in all 8 orders (list_snippets_sorted) and searches it (list_snippets_for_search + search::search, as get_sorted_snippets and search_snippets do), counts the snippets the app can open by id (get_snippet_by_id), and compares with a prototype of a fuller list: TASK-43's bounded reader read_snippets_one_by_one plus a sort in Rust that copies SQLite's order (NOCASE folds ASCII letters only; the date of change as idx_snippets_updated_at gives it, ties by id ascending, reversed for ascending; the other orders as SQLite's sorter gives them, ties by id ascending; last use: no date last). On every healthy test database the Rust sort gave exactly SQLite's order in all 8 orders and in the search, ties of the date of change included.

Databases: the unit tests' build_db (90 snippets of about 300 bytes, 17 pages: the table's root 2, sqlite_sequence 3, the date index 4, the title index 5, 12 pages of snippets) and three made for the probe with 500, 5,000 and 50,000 snippets (0.6, 6.2, 61.8 MB; mostly 100-1500 bytes, every 100th 8 KB, every 1000th 60 KB, every 20th encrypted, every 3rd used, some equal dates of change, every 37th deleted).

### What the list and the search show today (after No at start-up)

90 snippets ("readable" = the app can open it by id):
- The middle page of snippets (page 12; 82 of 90 readable): by date of change 34 (ascending 48); by creation date, title and last use 0 in both directions; the search 34 (the exact title "Сніпет 001 тест" finds nothing).
- The first page, oldest ids (82 readable): by date of change descending 82; every other order 0.
- The last page, newest ids (88 readable): by date of change descending 0 and the search 0; ascending 88; the other orders 0.
- Two pages of snippets (74 readable): 18 / 32, the other orders 0, the search 18.
- The date of change index (all 90 readable): by date of change 0 in both directions, the search 0; by creation date, title and last use 90 and not marked damaged, so no notice.
- The title index: every list and search complete and not marked damaged (no notice), as TASK-33 found.
- Both indexes: as the date index.
- The table's root page (its only interior page here): 0 everywhere; nothing can be read by id either.
- Sector 1 of the middle page filled with 0xA5 or 0xFF (88 openable; the reader returns 89: snippet 056 keeps its title, its text and dates are damaged): by date of change 35 / 54, the other orders 0, the search 35.
- 2 bytes of the title of snippet 041 no longer UTF-8 (quick_check ok): every list 89, 041 left out and the list marked damaged.

500 / 5,000 / 50,000 snippets:
- The middle page of snippets: 483 of 487 readable, by date of change 49 / 71; 4,860 of 4,865: 128 / 330; 48,647 of 48,649: 39,802 / 8,845. Every other order 0. The search as the list by date of change.
- The last page: 486 readable: 395 / 91; 4,864: 397 / 4,467; 48,648: 37,545 / 11,103; the other orders 0.
- A page of the date of change index (all readable): 262 / 106, 3,919 / 830, 6,599 / 41,922; the other orders complete and unmarked.
- A page of the title index: complete everywhere, unmarked.
- An interior page of the table, not its root: 5,000: 3,226 of 4,865 readable (1,639 lost), 14 / 20 shown, the other orders 0; 50,000: 47,173 of 48,649 readable, 1,234 / 1,694 shown, the other orders 0.
- Sector 1 of the middle page filled with 0xA5: 500: 485 openable, 415 / 71 shown, the other orders 0; in the 5,000 and 50,000 files that sector held no cells (quick_check ok, nothing lost).

In short: after No the list shows only the snippets in front of the first damaged place in the order of the list, every order that sorts all rows first (creation date, title, last use, both directions) shows none as soon as one page of the table is damaged, and the search follows the list by date of change.

### A fuller list (prototype in the probe)

- Every snippet read one by one with TASK-43's reader (the same snippets as "Вдається прочитати" in the start-up dialog), sorted in Rust: every readable snippet in every order and every search, in every case above (82, 88, 74, 90, 89; 483, 4,860, 3,226, 48,647, 47,173 and so on). The order equals the healthy file's order for those snippets, except where a snippet's own values are damaged: snippet 056's dates read as U+FFFD and sort above every date (as TASK-45 found in the copy); 041 sorts by its repaired title.
- Returned by the reader but not openable by the app: 056 (text and dates damaged) and 041 (title not UTF-8); copying them says "this snippet is damaged" (TASK-33).
- The cheaper idea, reading the table from both ends up to the damage (no reads by id), is complete with one damaged place, but with two damaged pages it misses the snippets between them: 50 of 74, 320 of 481, 3,255 of 4,858, 32,389 of 48,645.

### Cost (release-like build, warm file cache; median of 5-9 runs)

- A healthy database, per show of the window (the list by date of change) and per search ("eta"): 500 snippets 0.2 / 0.5 ms; 5,000: 10 / 13 ms; 50,000: 165 / 190 ms.
- The damaged middle page, fuller list per show / per search (today's list up to the damage, then the reader and the sort): 500: 1.1 / 1.4 ms; 5,000: 16 / 19 ms; 50,000: 306 / 329 ms (an earlier, noisier run: 0.35-0.7 s).
  - The reader alone: 1.1, 14, 150 ms (the four scans 0.2, 4.3, 51 ms; the reads by id 0.7, 8.6, 91 ms; without the text 0.4, 6, 65 ms). The sort: 0.1, 1.5, 21 ms.
  - Today's list until it meets the damage: up to 130 ms on 50,000 (39,802 rows read first); skipped when the app remembers that the database is damaged.
  - A search over rows kept in memory: 0.3, 2.9, 30 ms.
  - The table from both ends and a sort: 0.3, 5.7, 64 ms.
- Tauri runs these commands (not async) on the main thread: the window waits that long at every show and every search (debounced 100 ms). Drawing the list is not measured; it is the same as for a healthy database of that size.

## The user's choice (question dialog, 2026-11-21, verbatim answers)

- "TASK-44: що мають показувати список і пошук, коли після «Ні» під час запуску програма працює з пошкодженою базою? Зараз вони обриваються на першій пошкодженій сторінці: у тестовій базі видно 34 з 82 сніпетів, які ще читаються, а за сортуванням за датою створення, назвою чи використанням — жодного." = "Залишити як є"
- "TASK-44: якщо список покаже всі сніпети, які читаються, яким має бути попередження над списком? ..." = "З кількістю (рекомендовано)"
- "TASK-44: якщо список покаже всі сніпети, які читаються, коли показувати попередження над ним?" = "Поки база пошкоджена (рекомендовано)"
- The last two were asked for the case of a fuller list, so I asked once more: "TASK-44: ви обрали «Залишити як є» для списку, а для попередження — «З кількістю» і «Поки база пошкоджена». Два запитання про попередження стосувалися випадку, коли список покаже всі сніпети, які читаються. Як зробити?" = "Нічого не змінювати (рекомендовано)": the list, the search and the notice stay as they are; the task closes with the investigation and this choice; no build and no NVDA check are needed.

The other options offered: for the list "Усі, щоразу (рекомендовано)" (read one by one with TASK-43's reader whenever damage cuts a list short; 500 snippets about 1 ms, 5,000 16-19 ms, 50,000 0.3 s per show and per search), "Усі, з пам'яттю" (the same, the rows kept in memory until the next change; a search 3 ms on 5,000, 30 ms on 50,000), "Таблиця з обох кінців" (64 ms on 50,000, misses the snippets between two damaged places); for the notice "Загальний, без кількості", "Текст як є"; for when it shows "Як зараз"; in the last question "Змінити лише попередження", "Таки показувати всі сніпети".

## What changed

Nothing in the app: no code, no texts, CHANGELOG.md and CLAUDE.md unchanged (the db.rs row of CLAUDE.md is still true). No release build for this task: the newest build stays C:\5-quicksnippets\real_db\quick-snippets-TASK-43-b13702e.exe. No NVDA check and no just smoke: nothing a user sees or hears changed, and no copy of the app was started.

## Checks (2026-11-21, on develop 1efae94, the app's code unchanged)

- `npm run test:all` passes: 612 frontend tests (26 files), 379 Rust tests (1 ignored: the crypto timing report, as before). `npm run lint` passes (tsc --noEmit, cargo clippy -D warnings).
- No copy of the app was started in this task, so no NVDA check, no just smoke and no release build: nothing a user sees or hears changed. The newest build in real_db stays quick-snippets-TASK-43-b13702e.exe; no TASK-44 copy was made, as there is no new build.
- The user's autostart values, read only, at the start of the checks and at the end: the Run entry QuickSnippets absent, the StartupApproved mark Binary 02 00 00 00 00 00 00 00 00 00 00 00. No quick-snippets process running, no test folder in %TEMP%.
- The probe's test databases (about 520 MB) and its build output were removed from the scratchpad; its reports stay there.
- Acceptance criterion #3 and Definition of Done #3-#5 are checked as not applicable: no change was made (the user's choice), so there is no new behaviour to test, no CHANGELOG entry, no new string and no change to focus, dialogs or announcements.

## Noticed, no task created

1. If a fuller list is ever wanted: the simplest way is `read_snippets_one_by_one` plus a sort in Rust, as in the probe; a snippet with a damaged date would best sort last rather than first, and the notice "Not all snippets are shown" would need another text, since with only an index damaged every snippet is shown.
2. Today the notice depends on the sort order: with only the date of change index damaged, sorting by title shows every snippet and no notice; with only the title index damaged there is no notice at all, although saving fails (TASK-33 saw this too). Left as it is by the user's choice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
After No in the start-up dialog about a damaged snippet database, the list and the search stop at the first damaged page: in a test database with one damaged page of snippets the window shows 34 of the 82 snippets that can still be read, and every order that sorts all rows first (creation date, title, last use) shows none; the same holds for databases of 500, 5,000 and 50,000 snippets, for a damaged index, an interior page and a damaged sector.

A prototype (TASK-43's bounded reader plus a sort in Rust that gives exactly SQLite's order) listed every readable snippet in every order and search, at about 1 ms per show or search for 500 snippets, 16-19 ms for 5,000 and 0.3 s for 50,000 (a healthy 50,000 database takes 0.17-0.19 s); keeping the rows in memory would make searches cheaper, and reading the table from both ends would be cheaper still but misses snippets between two damaged places.

The user chose to leave the list, the search and the notice as they are (question dialog, verbatim answers in the notes). No code changed; npm run test:all (612 frontend, 379 Rust) and npm run lint pass on develop; no build, NVDA check or just smoke was needed. Follow-up ideas for a fuller list are in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
