---
id: TASK-43
title: >-
  Keep the start-up from hanging when a damaged database gives a garbage snippet
  id
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T08:45:00Z'
updated_date: '2026-11-21T11:54:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-high
milestone: m-8
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
- [x] #1 A unit test with a test database whose page of snippets has one sector filled with 0xA5 (a scan returns a huge id) shows that the rescue ends within a second and saves every snippet that can be read
- [x] #2 The work of the rescue is bounded for any ids a damaged file gives, the id counter of the new database continues after the real ids, and a garbage id is not shown as a lost snippet where it can be told apart
- [x] #3 The damaged file is still only read, and the start-up dialog, Yes and No work as in TASK-33
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
1. db.rs: read the damaged database in one read transaction; read every named id (1..=2^53-1) on its own; compute the ceiling from the highest id read, the id counter and the title index (each trusted up to 100,000 above the highest id read); try the ids up to the ceiling that no one named (at most 1,000,000); count as lost only unreadable named ids up to the ceiling; the new counter is the ceiling; no overflow anywhere. A bounded reader the list of TASK-44 can reuse.
2. Tests on test databases: the 0xA5 sector (ends within a second, every readable snippet saved, garbage not counted), the new counter, a garbage id just above the real ones (0x7F), a damaged counter, the walk limit; the TASK-33 tests unchanged.
3. npm run test:all, npm run lint; CLAUDE.md row of db.rs if the described behaviour changes; CHANGELOG only if a TASK-33 entry changes.
4. Release build; a test copy with a 0xA5 database shows the dialog at once and NVDA reads it (with the user's go-ahead); just smoke (with the user's go-ahead); copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-21, no change to the app's code)

Test databases only, made in this session's scratchpad. A throwaway probe (a small Rust program, not in the repo) compiles the app's own src-tauri/src/db.rs unchanged (#[path]), with rusqlite 0.32.1 / SQLite 3.46.0 and opt-level "z" as in the release build. It builds the same database as test_damage::build_db (90 plain snippets, 17 pages: 2 the table's root, 3 sqlite_sequence, 4 the modification date index, 5 the title index, 6-17 pages of snippets), overwrites one 512-byte sector of one page (fills 0xA5, 0xFF, 0x00, 0x7F, 0x70, three kinds of random bytes, the same sector of the page before or after) and runs on each copy the quick check, the four scans of copy_readable_snippets, the id counter and a read of every id.

1. The hang: 0xA5 in any of sectors 1-7 of any page of snippets makes the table scans return the id 5374248273442940325 (nine bytes of 0xA5 read as a varint); quick_check says "Rowid 5374248273442940325 out of order". The app's own copy_readable_snippets on such a copy (sector 1 of page 12, which holds snippet 050) had not ended after 10 s; the same sector filled with 0xFF ended in 9 ms (89 saved, 1 lost).
2. Garbage ids are common: of 755 damaged sectors in pages of snippets, 117 gave an id above 10 million (the loop never ends in practice), 30 between 100,001 and 10 million, 67 between 1,001 and 100,000, 26 between 91 and 1,000, 166 an id of 0 or below, 349 none. Sectors of the modification date index gave ids such as -91, 0, 112, 113, 127; sectors of the title index gave none; a damaged sqlite_sequence page made the counter unreadable (never a garbage value). Interior pages of a database of 5,000 snippets (311 cases) gave no huge id.
3. Each id read on its own costs about 27 us: every read outside a transaction takes and releases the lock of the file and checks its header. Inside one read transaction: 0.4 us for a missing id, 0.85 us for a snippet. Measured with the app's function: a garbage id of 298,203 (random bytes) made the rescue take 8.4 s; the walk the counter allows today (up to 100,000 past the highest id found) alone can take 2.7 s.
4. Garbage ids are counted as lost snippets: with a sector of the modification date index damaged (garbage 113 or 127) all 90 snippets can be read, but the rescue said saved 90, lost 1 (untitled): the dialog would say 91 snippets in the database, one unreadable. Ids of 0 or below are not counted (the walk starts at 1).
5. The id counter of the new database takes the garbage id: after the case of 298,203 its sqlite_sequence said 298203 (highest real id 90). With 5374248273442940325 new snippets would get ids above 2^53, which the window's JavaScript numbers cannot hold exactly: such snippets could not be opened, copied or deleted.
6. `known_max + 100_000` overflows when a garbage id lies within 100,000 of i64::MAX and the counter is even higher: the release build (no overflow checks) would wrap to a negative last id, copy nothing and offer an empty database. Not seen in the sweep (it needs a second damaged place).
7. Nothing else lets a number from the file drive a loop or a size: the scans stopped by themselves in every case (at most 4 rows per snippet plus a few: 372 for 90 snippets, 20,000 for 5,000, under 4 ms); quick_check reads every page once; SQLite itself limits a value it reads; the lists end with their rows. No damaged sector made a garbage id readable as a snippet (0 of about 1,300 cases).

Reproduced with unit tests in db.rs (`damage_sector`; `copy_within` runs the rescue in a thread of its own and waits at most 1 s with recv_timeout, so a hang fails the test instead of hanging the test run): `test_copy_readable_snippets_ends_quickly_after_a_garbage_id` and `test_copy_readable_snippets_counter_continues_after_the_real_ids` fail with "the rescue had not ended after 1.0 s"; `test_copy_readable_snippets_does_not_count_a_garbage_id_as_lost` fails with lost_untitled 1. The three ran in 2.2 s.

## The user's choice (question dialog, 2026-11-21, verbatim)

- "TASK-43: як обмежити порятунок пошкодженої бази, щоб запуск не зависав на сміттєвому номері? ..." = "Стеля з прочитаного (рекомендовано)": every id a scan or an index names is read on its own; ids no one named are tried from 1 only up to the ceiling, never more than 1,000,000 of them; the ceiling is the damaged database's id counter if it is not below the highest id read and not more than 100,000 above it, otherwise the highest id read (or an id the title index names within the same 100,000); an id above 9,007,199,254,740,991 is always garbage; the dialog counts and names as lost only unreadable ids from 1 to the ceiling (garbage ids only go to the log); the new database's counter is the ceiling; the damaged database is read in one read transaction.

The other options offered: "Лише названі номери" (only named ids, no walk), "Межа часу" (the walk as now, stopped after 1 s).

## What changed (commit b13702e, branch feature/rescue-garbage-ids)

- src-tauri/src/db.rs:
  - `read_snippets_one_by_one(conn, keep)`: the bounded reader (TASK-44 can reuse it for the list). Ids from the four scans as before (title index with titles, date index, table in both directions). Every named id from 1 to `MAX_SNIPPET_ID` is read on its own; then `snippet_ceiling`; then the ids up to the ceiling that no scan named are tried, at most `MAX_TRIED_IDS` (1,000,000). A named id up to the ceiling that cannot be read (or that the caller could not keep) is lost, with the title the title index gives (or the row's own title when the schema refused it); any other named id is garbage and only goes to the log ("The rescue left out ids that name no snippet (N in all): [...]").
  - `snippet_ceiling(top, counter, titled)`: the id counter when it is not below the highest id read (`top`) and at most `ID_MARGIN` (100,000) above it; otherwise `top`, or the highest id the title index names up to ID_MARGIN above `top`; never above `MAX_SNIPPET_ID` = 2^53 - 1 (the window's JavaScript numbers).
  - `keep_reading`: the damaged database is read in one read transaction (BEGIN), begun again if an error ended it, rolled back at the end (reads only); a transaction the caller began stays open.
  - `copy_readable_snippets` uses the reader; the new database's counter is the ceiling. No arithmetic on ids from the file can overflow any more (`known_max + 100_000` is gone).
- Tests (db.rs): `test_damage::damage_sector`; `copy_within` (the rescue in a thread of its own, `recv_timeout`); 9 new tests: the 0xA5 sector ends within 1 s and saves every readable snippet with its title and text, garbage not counted; the new counter after the real ids; a garbage id of 127 from the date index not counted (0x7F); `snippet_ceiling`; a damaged counter with the newest snippets lost (the title index names them, new ids after theirs); the counter trusted only near the real ids (25, 100,020, 100,021, 10^12); huge ids (2^53 not copied; a readable 10^12 bounded by MAX_TRIED_IDS); the read transaction (every snippet read inside it, ended again, a caller's transaction kept); the whole start-up path with the 0xA5 sector, No and Yes, in a thread with a 1 s limit.
- CLAUDE.md: the db.rs row names `read_snippets_one_by_one` and `snippet_ceiling` and why every loop stops at the ceiling.
- CHANGELOG.md unchanged: the hang was never released, and the TASK-33 entries in [Unreleased] still describe what happens. No new user-facing strings (the dialog texts are TASK-33's).

## Checks

- Before the fix the three reproducing tests failed (two with "the rescue had not ended after 1.0 s", one with lost_untitled 1); their run took 2.2 s.
- On the branch (b13702e): `npm run test:all` passes: 612 frontend tests, 379 Rust tests (was 370; 1 ignored, as before). `npm run lint` passes.
- Mutation checks (a throwaway script, db.rs restored after each): walking up to the highest named id (4 tests fail), no cap on the walk (1), every unreadable named id counted as lost (1), the counter trusted without limit (3), named ids above 2^53-1 read (1), no read transaction (2), the read transaction left open (2), title index ids raising the ceiling without limit (2).
- The same code in a release-like probe build (opt-level "z", SQLite 3.46.0): the 0xA5 sector 27 ms (was: not ended after 10 s), 89 saved, 1 lost («Сніпет 055 тест»), 90 in all, new counter 90; the 0x7F date index 27 ms, 90 of 90, counter 90 (was 91 in all, counter 127); garbage ids 293,785 and 298,203: 27 ms instead of 8.3-8.4 s, 90 in all instead of 91.
- Verification probe with NVDA on the release build of b13702e (3,896,320 bytes), with the user's go-ahead each time (11:30, and 11:56 right before just smoke): a throwaway script (the helpers of scripts/smoke-nvda.ps1, lines 97-1042 unchanged, and its own steps; not committed), throwaway test copies in %TEMP%\quick-snippets-verify43-<time>\, language uk, the dialog answered by WM_COMMAND (no keys); speech read only from the log offset of each step, any other speech filtered out of my output.
  - The build of TASK-33 (real_db\quick-snippets-TASK-33-cbaf647.exe, copied to the scratchpad and run as a test copy) with the 0xA5 database: after 10 s no dialog and no window, the process alive with 10 s of processor time in those 10 s; NVDA said nothing.
  - The new build with the 0xA5 database: the dialog 69-76 ms after the start, in the foreground; NVDA read "QuickSnippets — Помилка, діалог, База сніпетів snippets.db пошкоджена. Сніпетів у базі: 90. Вдається прочитати: 89. Не вдається прочитати: 1: «Сніпет 055 тест». ... | Так, кнопка, Alt+, т". No: the window with 35 snippets, the notice above the list read once; after closing, snippets.db byte for byte as before. Yes: the window with 89; snippets-damaged-<time>.db byte for byte the damaged database; the new snippets.db: 89 snippets, highest id 90, counter 90, quick_check ok.
  - The 0x7F date index database: the dialog 71-79 ms after the start, "Сніпетів у базі: 90. Усі вдається прочитати." (before the fix: 91, one unreadable); Yes: 90 in the window; the new database: 90 snippets, highest id 90, counter 90, quick_check ok.
  - In the first run two steps failed on mistakes of the probe itself (a hash of snippets.db while the app held it open; a Python call whose quotes Windows PowerShell dropped); fixed and run again: 7 of 7.
- just smoke on the same build: 91 of 91 steps, 356 of 356 NVDA checks; the NVDA log had the one known error of NVDA's own script_caret_newLine. Its report: autostart at the end "mark absent", restored "as before".
- The user's autostart values before and after all runs (the reports and my own reads): entry absent, mark Binary 02 00 00 00 00 00 00 00 00 00 00 00. No copy of the app running afterwards, no test folder left in %TEMP%; the user's installed copy was not running and was not started.
- Copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-43-b13702e.exe, SHA-256 0117F005994015C9F4F254F8CCC9530C2731F1017D1633F9B56BF23C2169D0F5, the same as the build.
- just smoke-tray not run: nothing changed in how the window is created, started in the tray or shown.

## Noticed, no task created

1. The rescue copies a readable snippet with whatever is left of its values. In the 0xA5 test database the sector also covered the text and both dates of snippet 056 (its title is intact): the copy holds them with U+FFFD (TASK-33's repair), and since U+FFFD sorts above any date, snippet 056 comes first in the default list after Yes. A date that is no longer a date could be filled like a missing one (the other date, or the time of the rescue). Not about ids; left for review.
2. Not tested: a real disk read error (SQLITE_IOERR) during the rescue. `keep_reading` begins the read transaction again after such an error, so the reads stay fast, but no test can make SQLite fail a read.

## Merge (2026-11-21)

Merged into develop with git flow feature finish --no-ff: feature/rescue-garbage-ids (merge 4df96b1; code b13702e, Backlog aec05ca). The tree of develop after the merge is the tree that was tested (git diff aec05ca 4df96b1 is empty). Nothing pushed, no tag, version unchanged; not archived: left to the managing session.

## Check by the managing session (2026-11-21)

- git: develop 1841dd8 = merge 4df96b1 of feature/rescue-garbage-ids (code b13702e, Backlog aec05ca) plus the Backlog commit; the feature branch is gone; the app code at b13702e is the same as on develop (only backlog/ differs).
- `npm run test` 612 passed, `npm run test:rust` 379 passed (1 ignored: the crypto timing report, as before), `npm run lint` passes.
- Code review of db.rs: every loop is bounded (named ids up to 2^53-1, the walk up to the ceiling and at most 1,000,000 ids); the new counter is the ceiling, never below an id copied; no arithmetic on ids from the file can overflow; the read transaction on the damaged file is ended in every path, so No goes on with a connection outside any transaction (a test covers it); the doc of copy_readable_snippets now says rightly that rescue_if_damaged removes an old rescue file first.
- My own probe (the app's db.rs compiled into a small program, rusqlite 0.32.1 / SQLite 3.46.0, opt-level "z"), test databases only: the database that hung TASK-33's code (0xA5 in sector 1 of the page holding snippet 050) now 27.7 ms, 87 saved, 3 lost, 90 in all, new counter 90, the garbage id 5374248273442940325 only in the log. A sweep of 520 damaged copies of a 90-snippet database (every page but the first, every sector, fills 00, 7F, A5, FF and random bytes): slowest 137 ms; none counted more than 90 snippets; none left out a snippet that Python's SQLite 3.50.4 could read by id; the new counter was 90 every time.
- real_db\quick-snippets-TASK-43-b13702e.exe: SHA-256 0117F005994015C9F4F254F8CCC9530C2731F1017D1633F9B56BF23C2169D0F5, 3,896,320 bytes, the same as src-tauri\target\release\quick-snippets.exe.
- The user's autostart values unchanged (entry absent, mark 02 00 00 00 00 00 00 00 00 00 00 00); no copy of the app running; no test folder left in %TEMP%; the handover note task-43-rescue-hang-handover.md is in the shared notes folder.
- The user's answers (question dialog, verbatim): archive the task and its session "Так, обидві (Рекомендовано)"; push develop "Так, надіслати (Рекомендовано)"; the damaged dates noticed by the session "Нова задача на потім (Рекомендовано)", now TASK-45 (low, Later); next "TASK-44 (Рекомендовано)".
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A damaged sector can give the rescue's scans a garbage snippet id (a sector of 0xA5 in a page of snippets: 5374248273442940325). TASK-33's rescue read every id up to the highest one named, so the start-up hung before any dialog, tray icon or window, at every start; smaller garbage ids cost seconds (298,203: 8.4 s), were counted as lost snippets in the dialog and became the id counter of the new database.

By the user's choice ("Стеля з прочитаного"), every id a scan or an index names is read on its own; ids no one named are tried only up to the ceiling (the old id counter when it agrees with the ids read, at most 100,000 above them; otherwise the highest id read or one the title index names), never more than 1,000,000; an id above 2^53 - 1 is always garbage. The dialog counts as lost only unreadable ids up to the ceiling; the new database's counter is the ceiling. The damaged file is read in one read transaction (30-65 times faster per id) and is still only read. The bounded reader `read_snippets_one_by_one` is ready for TASK-44.

Verified: 9 new unit tests (the hang reproduced with a 1 s limit first), npm run test:all (612 frontend, 379 Rust), npm run lint, mutation checks; on the release build of b13702e the dialog comes 69-79 ms after the start and NVDA reads it (the TASK-33 build showed nothing in 10 s), No keeps the file unchanged, Yes keeps the damaged file and gives counter 90; just smoke 91/91, 356/356; the user's autostart values unchanged; copied to real_db as quick-snippets-TASK-43-b13702e.exe.

Follow-up for review: a readable snippet whose dates were overwritten keeps U+FFFD dates in the copy and sorts first by date.
<!-- SECTION:FINAL_SUMMARY:END -->
