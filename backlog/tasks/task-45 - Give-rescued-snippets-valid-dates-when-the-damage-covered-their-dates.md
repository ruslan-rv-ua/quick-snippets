---
id: TASK-45
title: Give rescued snippets valid dates when the damage covered their dates
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T10:13:00Z'
updated_date: '2026-11-21T11:38:00Z'
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
- [x] #1 A unit test with a test database whose damage covers the dates of a snippet that can still be read shows that after the rescue its dates are valid dates and it no longer comes first in the list sorted by modification date
- [x] #2 Intact dates are copied byte for byte, the damaged file is still only read, and the start-up dialog, Yes and No work as in TASK-33
- [x] #3 The user chose a solution through the question dialog
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
1. db.rs: `is_app_date` (the one format every version writes, strftime('%Y-%m-%dT%H:%M:%f'), on a real calendar day). In `copy_readable_snippets` a date of creation or change that is not such a date (U+FFFD, zero bytes, letters, spaces, empty) is stored as '' and, once every snippet is copied, gets the oldest intact date of creation or change in the new database (`fill_damaged_dates`; the time of the rescue only when no snippet has one); a damaged date of last use is left empty; intact dates are copied as they are. The damaged file is only read; the dialog's counts do not change.
2. Tests on test databases: TASK-43's 0xA5 database (snippet 056 valid dates, the oldest one, last by date of change and creation, every other date byte for byte); single dates overwritten (creation, change, last use) and a date moved into the future (kept); empty dates; no intact date at all; is_app_date against SQLite's own strftime; the start-up path with Yes; the TASK-33 and TASK-43 tests unchanged.
3. npm run test:all and npm run lint; CHANGELOG [Unreleased] (the TASK-33 Added entry, not released yet); CLAUDE.md row of db.rs.
4. The probe again on the new code (release-like build); release build; a check with a test copy only with the user's go-ahead right before it; copy to real_db and compare SHA-256.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Added by the managing session (2026-11-21), from TASK-44

The description suggests filling a damaged date the way a missing one is filled today, for example with the time of the rescue. A snippet whose dates are both damaged (snippet 056 in TASK-43's test database with a sector of 0xA5) would then get the time of the rescue as its date of change, become the newest snippet and again come first in the list sorted by date of change, which acceptance criterion #1 rules out. TASK-44's session, which built a prototype of a fuller list, found that a snippet with a damaged date sorts best last rather than first (its archived notes, "Noticed, no task created", item 1). So look for a filling that does not make such a snippet the newest, for example one that puts it at the end of the default order (newest first) or next to its intact neighbours by id, and show the user the options through the question dialog. The user asked for this note: "Так, дописати (Рекомендовано)".

## Investigation (2026-11-21, no change to the app's code)

Test databases only, in this session's scratchpad. A throwaway probe (a small Rust program, not in the repo) compiles the app's own src-tauri/src/db.rs and error_dialogs.rs unchanged (#[path], built with `--cfg test` so that test_damage is there), rusqlite 0.32.1 / SQLite 3.46.0, opt-level "z". Each damaged copy is checked (check_health), rescued with the app's own copy_readable_snippets, and the copy is read back: every date is tested against SQLite's own `strftime('%Y-%m-%dT%H:%M:%f', x) IS x`, and the position of every snippet with a damaged date is taken in all 8 orders (list_snippets_sorted) and in the search's order (list_snippets_for_search), against its position in the healthy database.

Every released version (0.1.0 to 0.3.5) writes dates only as `strftime('%Y-%m-%dT%H:%M:%f', 'now')`, e.g. 2026-11-21T10:13:05.123 (git history of db.rs): one format to check.

1. TASK-43's database (build_db, 90 snippets, sector 1 of the middle page of snippets filled with 0xA5): 89 saved, 1 lost; snippet 056 keeps its title, its text and both dates come out as 23 x U+FFFD. After Yes it is 1st of 89 by date of change (healthy: 35th), 1st by creation date (35th) and 1st in the search's order; last in both "oldest first" orders.
2. Sweep: two databases of 90 snippets (build_db, and build_db with a date of use for every 3rd snippet), every sector 0-7 of each of the 12 pages of snippets, 11 fills (A5, FF, 00, 7F, 70, 30, 39, 20, three kinds of random bytes): 2,112 damaged copies; the rescue is offered for 2,002, the other 110 pass the quick check (no bad date in them).
   - 1,233 copies (557 + 676) gave exactly one snippet with damaged dates: always the date of creation and the date of change together, plus the date of use when the snippet had one (299). Never a single date: the dates lie next to each other at the end of a row, so a damaged sector that begins inside the text of a snippet (after its title) overwrites the end of the text and all its dates; the title stays, the snippet is still read and copied (text damaged in 1,228 of them; in 5 the sector began inside the date of creation itself, e.g. "2026-11-07T1" followed by zero bytes).
   - What a damaged date of creation holds depends on the bytes: U+FFFD in 548 (A5, FF, random bytes), zero bytes in 156, and in the other 529 23 characters that are no date: spaces, "000...", "999...", "ppp...", 0x7F. U+FFFD, letters and "999..." sort above every date: the snippet comes first in every "newest first" order (date of change, the default; creation; last use) and first among equally good search matches; zero bytes, spaces and "000..." sort below every date: last in "newest first", first in "oldest first". By date of change, newest first: 777 of 1,233 first (773 of them moved there), 456 last (443 moved there). The title order is unchanged (titles intact).
   - No date of creation or change came out empty (NULL): today an empty one gets the other date or the time of the rescue (COALESCE).
3. Only part of a date's bytes changed (made by hand: overwrite_after on the date in the table, plus a damaged date index page so that the rescue is offered): creation only, change only, use only, creation and change, all three, with A5, 00, the year's first two digits "99" (9926: still a date in the format, in the future) and "00" (0026: an old date).
4. Where the window or the sorting uses the dates: only the sort orders by date of creation, change and last use (both directions; never used sorts last in both) and the search, whose equally good matches keep the order by date of change, newest first. The window never shows a date (SnippetView carries created_at and updated_at, the frontend does not use them). An edit gives the snippet a new date of change, a copy a new date of use; a damaged date of creation stays.

### Fillings tried in the probe (positions over the 1,233 sweep cases)

- Time of the rescue (as an empty date today): first by date of change, newest first, in all 1,233.
- Own other date, else the date of creation of the nearest lower id: by creation within one place of the healthy position in every case; by date of change, newest first, at the very end in 1,206 (in build_db every date of creation is older than every date of change), never first. With only the date of creation damaged (case 3) the own date of change made snippet 045 the newest by creation (1st of 90 instead of 46th).
- Dates of the nearest lower id (both): within one place of the healthy position in every order but last use (build_db's dates follow the ids; a real base's dates of change do not).
- The oldest intact date of the base (both): by date of change, newest first, at the very end in all 1,233; by date of creation, newest first, at the very end in 1,206 of 1,233; never first in "newest first"; at or near the start of "oldest first".
- A damaged date of use left empty: the snippet joins the never used at the end of the order by last use, in both directions.

## The user's choice (question dialog, 2026-11-21, verbatim)

- "TASK-45: чим заповнювати пошкоджену дату створення й дату зміни сніпета, коли порятунок переносить його в нову базу?" = "Найстаріша дата бази": both dates, each one that is damaged, get the oldest intact date in the new database; such a snippet is always at the very end of "newest first" and at the start of "oldest first".
- "TASK-45: чим заповнювати пошкоджену дату використання сніпета (коли його копіювали, а дата затерта)?" = "Порожня (Рекомендовано)": as for a snippet never used.

The other options offered: "Сусід і своя дата (Рекомендовано)" (creation from the nearest lower id, change = its own creation date), "Дати сусіда" (both dates from the nearest lower id); "Дата зміни" for the date of use. Explained before the question and not offered: the time of the rescue (the snippet becomes the newest, first again) and "the other date of the same snippet" alone (both dates are damaged together; with only the date of creation damaged it made the snippet the newest by creation). Said before the question: intact dates stay byte for byte in every option, and an empty date of creation or change is filled the same way as a damaged one.

## What changed (commit e0eddc8, branch feature/rescue-damaged-dates)

- src-tauri/src/db.rs:
  - `is_app_date`: whether a value is a date in the one format every version writes, `strftime('%Y-%m-%dT%H:%M:%f', 'now')`: 23 characters, a real calendar day, hours 0-23. It agrees with SQLite's own strftime round trip, except the hour 24, which SQLite gives back unchanged but the app never writes (so it counts as damage). A date in the format that lies in the future (damage of the year's digits) is kept as it is.
  - `copy_readable_snippets`: copies only dates that pass is_app_date. A date of creation or change that does not (U+FFFD, zero bytes, letters, spaces, empty) is stored as '' and, once every snippet is copied, `fill_damaged_dates` gives it the oldest intact date of creation or change of the snippets copied; only when no snippet has an intact date, the time of the rescue. The oldest date and the ids to fill are noted while copying, so no second pass reads the new file (for big snippets reading a date means reading the whole row). A damaged date of last use is left empty. Before: a damaged date was copied as read, an empty one got the other date or the time of the rescue (COALESCE).
  - Unchanged: intact dates byte for byte, titles and texts as before (U+FFFD repair), encrypted contents byte for byte, the damaged file only read, the Rescue counts of the start-up dialog, Yes and No, the id counter.
- Tests (db.rs, 5 new): `test_is_app_date_agrees_with_sqlite` (8 dates, 30 values that are none, the hour 24); `test_copy_readable_snippets_gives_overwritten_dates_the_oldest_date` (acceptance criterion #1: TASK-43's 0xA5 database, snippet 056 gets the oldest date for both, every other date byte for byte as the rescue reads it, 056 last by date of change and first in "oldest first", among the last two by date of creation, last in the search's order, 090 first again); `test_copy_readable_snippets_fills_each_overwritten_date_on_its_own` (only the date of creation of 045, of change of 046, of last use of 047, the year of 060 turned into 9926: kept); `test_copy_readable_snippets_fills_empty_dates_like_overwritten_ones` (NULL dates in a table without NOT NULL; no intact date at all: the time of the rescue); `test_rescue_if_damaged_yes_puts_a_snippet_with_overwritten_dates_last` (the start-up path with Yes). The TASK-33 and TASK-43 tests are unchanged and pass.
- CHANGELOG.md [Unreleased]: one sentence added to the TASK-33 Added entry (not released yet): a moved snippet whose dates the damage destroyed gets the oldest date in the database, so it appears at the end of lists sorted newest first; a destroyed date of last use counts as never used.
- CLAUDE.md: the db.rs row (intact dates as they are; is_app_date; fill_damaged_dates; last use left empty).
- No frontend change, no new user-facing strings, nothing changed in dialogs, focus or what screen readers read: `just smoke` is not required (Definition of Done #5).

## Checks so far (2026-11-21)

- `npm run test:all`: 612 frontend tests, 384 Rust tests (was 379; 1 ignored, as before). The first run had one failure in SettingsModal.test.tsx ("opening the dialog again shows no old message") while the probe was being built in parallel; run again without other load: all pass (TASK-33's notes saw the same test fail once under load). `npm run lint` passes. `cargo clippy --tests` (not part of lint) warns only about older test code in other places, nothing in the new code.
- Mutation checks (a throwaway script, db.rs restored byte for byte after each): dates copied as read (4 tests fail), the code before TASK-45 (4), the time of the rescue for damaged dates (4), the date check without the calendar (1), a damaged date of last use copied (1), the newest intact date instead of the oldest (4), damaged dates left unfilled (3).
- The probe again on the new code (release-like build, the same 2,112 damaged copies): in the 2,002 copies where the rescue is offered, no value in the new database is no date. The 1,233 snippets whose dates were damaged: by date of change, newest first (the default), and in the search's order, the very last in all 1,233, never first; by date of change, oldest first, the very first in all; by date of creation, newest first, the very last in 1,206, and in the other 27 (snippets 002, 003 and 005 near the start of the base) one place before the end, right before the snippet whose date they got (equal dates are listed by id). TASK-43's database: snippet 056 89th of 89 by date of change (was 1st after Yes, 35th in the healthy base).

## Check of the release build (2026-11-21)

- Release build of e0eddc8 (`npx tauri build --no-bundle`): 3,900,416 bytes, SHA-256 FFF5C6297CF0CB5C18CE585692E173385CE997335EC7494BCBE8D601C2BB7F66.
- A check with a test copy, with the user's go-ahead right before it ("Так, запускай (Рекомендовано)", asked twice: the first run failed on a mistake of my own script, see below). A throwaway script (not in the repo; the NVDA log helpers of scripts/smoke-nvda.ps1 and its own steps) ran a copy of the build from %TEMP%\quick-snippets-verify45-<time>\test copy\ with its own data folder (language uk, confirm_on_close off) and TASK-43's damaged test database made by the probe (build_db, sector 1 of the middle page of snippets filled with 0xA5); the dialog was answered with WM_COMMAND IDYES (no keys); speech read only from the log offset of the run, any other speech counted, not shown.
  - The dialog came 137 ms after the start, in the foreground; NVDA read it in full: "QuickSnippets — Помилка, діалог, База сніпетів snippets.db пошкоджена. Сніпетів у базі: 90. Вдається прочитати: 89. Не вдається прочитати: 1: «Сніпет 055 тест». ..." and "Так, кнопка, Alt+, т": the counts of TASK-43.
  - Yes: the window 1.5 s later; NVDA read "QuickSnippets", "QuickSnippets - Snippet Manager, документ", the search box ("Пошук, комбінований список, ... порожньо") and "Сніпет 090 тест, 1 із 89": the newest snippet first, not 056. No error in the NVDA log during the run.
  - Closed with WM_CLOSE. The data folder held settings.json, snippets.db and snippets-damaged-2026-11-21-13-37.db, the latter byte for byte the damaged test database. The new snippets.db: 89 snippets, quick_check ok, no value that is no date, id counter 90; by date of change and by date of creation, newest first: 090, 089, 088 first, ... 002, 001, 056 last; 056 has the oldest date of the database (that of 001) as date of creation and change, no date of last use.
  - The first run (13:36) found no dialog: my script passed $null for "any title" to a C# method, which PowerShell turns into an empty string, so no window matched; the test copy waited in its dialog (snippets-rescue.tmp in its folder), was stopped after 15 s and its folder removed. Fixed (an empty string means any), tested on Explorer's windows, run again with the user's go-ahead (13:37): every step passed.
- `just smoke` not run: nothing changed in focus, dialogs or what screen readers read (Definition of Done #5); the dialog's text and counts are the same, as the check shows. `just smoke-tray` not run: the window's creation and first show are unchanged.
- The user's autostart values, read only, before the work, before and after each run and at the end: the Run entry QuickSnippets absent, the StartupApproved mark 02 00 00 00 00 00 00 00 00 00 00 00. No copy of the app running afterwards, no test folder left in %TEMP%; the user's installed copy was not running and was not started; the user's data and %LOCALAPPDATA%\com.quicksnippets.app were not touched.
- Copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-45-e0eddc8.exe, SHA-256 FFF5C6297CF0CB5C18CE585692E173385CE997335EC7494BCBE8D601C2BB7F66, the same as the build.

## Noticed, no task created

1. A date in the app's format that damage moved into the future (only the year's digits overwritten with other digits, e.g. 2026 -> 9926) is kept, since it cannot be told apart from a date written while the clock was wrong; such a snippet would still come first. Not seen in the sweep: every damaged sector also overwrote separators. Left as it is.
2. The probe's sweep found the damage covering the dates of creation and change always together; a single date is damaged only by damage of a few bytes.

Definition of Done #4 and #5 are checked as not applicable: there is no new user-facing string, and nothing changed in focus, dialogs or what screen readers read (the release exe was rebuilt and checked with a test copy and NVDA all the same).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A damaged disk sector that begins inside the text of a snippet overwrites the end of the text and all its dates while the title stays, so the rescue at start-up still copies the snippet. Its dates came out as U+FFFD (or zero bytes, letters, spaces), and U+FFFD sorts above every date: after Yes such a snippet came first in the default list (in a sweep of 2,112 damaged test copies: 1,233 such snippets, 777 of them first by date of change).

By the user's choice ("Найстаріша дата бази"; date of last use: "Порожня (Рекомендовано)"), the rescue now keeps only dates in the one format every version writes (`is_app_date`); a damaged or empty date of creation or change gets the oldest intact date of the snippets copied (`fill_damaged_dates`; the time of the rescue only when no snippet has one), and a damaged date of last use is left empty. Such a snippet now goes to the end of the lists sorted newest first instead of the top. Intact dates are copied byte for byte, the damaged file is only read, and the start-up dialog, its counts, Yes and No are as before.

Verified: 5 new unit tests on test databases (acceptance criterion #1 with TASK-43's 0xA5 database; single, empty and future dates; the start-up path with Yes), 7 mutation checks caught, `npm run test:all` (612 frontend, 384 Rust) and `npm run lint` pass; the probe again on the new code (no value that is no date in any rescued copy; every such snippet last by date of change); a check of the release build with a test copy and NVDA (after Yes NVDA reads "Сніпет 090 тест, 1 із 89", the damaged file kept byte for byte, 056 last); the user's autostart values unchanged; copied to real_db as quick-snippets-TASK-45-e0eddc8.exe. No new strings, no change to focus, dialogs or speech, so no `just smoke`.

Left as it is: a date that damage moved into the future but kept the format is kept (it cannot be told apart from a date written with a wrong clock).
<!-- SECTION:FINAL_SUMMARY:END -->
