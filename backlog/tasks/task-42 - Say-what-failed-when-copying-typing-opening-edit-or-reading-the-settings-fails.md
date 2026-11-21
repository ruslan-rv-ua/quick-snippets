---
id: TASK-42
title: >-
  Say what failed when copying, typing, opening edit or reading the settings
  fails
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T00:00:00Z'
updated_date: '2026-11-21T17:11:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/App.tsx
  - src/components/EditSnippetModal.tsx
  - src/components/SettingsModal.tsx
  - src-tauri/src/db.rs
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-40 (its archived notes have the details). Four places still show a backend error as raw English text in a toast: copying a plain snippet, typing a plain snippet with autotype, opening the edit dialog (loading the snippet), and reading the settings when the settings dialog opens. Show each in the language of the app (en, uk, de), saying what failed and the reason the database or Windows gives, in a way NVDA reads, as TASK-38 and TASK-40 did for the dialogs. Decide with the user where each message belongs: for an action started from the main window a toast may be the right place, but its text must say what failed, in the language of the app.

Also, when the snippet database is locked, a dialog stays silent for SQLite's busy timeout of 5 s before its message. Find out whether a shorter wait, or an announcement while the app waits, would help, and present it; change nothing there without the user's choice.

First find out what NVDA says today, with a test copy only (the smoke script of TASK-40 locks the test copy's database with byte-range locks), never with the user's data. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). Error paths from the backend to announced messages, like TASK-38 and TASK-40.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Copying and typing a plain snippet, opening the edit dialog and reading the settings show their failures in the language of the app, saying what failed, and NVDA reads them
- [x] #2 What NVDA said before the change is in the task notes, and the user chose the solutions through the question dialog
- [x] #3 The 5 s of silence with a locked database is investigated, and the user's choice about it is done
- [x] #4 Tests cover each case without touching the user's data
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
1. Frontend: a failed copy or auto-type of a plain snippet, a failed opening of a snippet for editing and a failed read of the settings show a toast in the language of the app that says what failed, with the reason the database or Windows gives as it is (failureMessage); 2 s as now, damage keeps its 8 s.
2. New text settingsOpenFailed(reason) in en, uk, de.
3. Rust: when typing fails after autotype_snippet has hidden the window, play the Windows error sound (MessageBeep MB_ICONERROR); the window stays hidden and the error is returned as before. Nothing else changes: no new wording of reasons, no change to the 5 s busy timeout or to the dialogs.
4. Tests: frontend (each place, uk and de, duration, damage unchanged), Rust (sound only for a typing failure).
5. CHANGELOG [Unreleased], CLAUDE.md (autotype).
6. npm run test:all, npm run lint, release build, NVDA check of the new messages with a test copy (with permission), just smoke (with permission), copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Added from TASK-33 (2026-11-21)

Point 3 of "Noticed" in TASK-33's archived notes: after partial damage of the snippet database, a snippet that the list still shows but whose row the lookup by id no longer finds gives the raw "Query returned no rows" when it is opened for editing, edited or deleted (the dialogs frame it since TASK-40, for example "Не вдалося видалити сніпет. Причина: Query returned no rows."). Say this case in the language of the app as well. The user chose to add it here (question dialog, 2026-11-21: "Дописати в TASK-42").

## Investigation (2026-11-21, before any code change)

### Where each failure comes from (code, tests and safe experiments)

- Copying a plain snippet (Enter, `activate_snippet`): the database read (`get_snippet_by_id`), `touch_last_used` (its error is ignored, but it waits like any write) and the clipboard (arboard 3.6.1 through tauri-plugin-clipboard-manager 2.3.2). Errors: "database is locked" (another program holds the database), "Query returned no rows" (the snippet is gone: another program deleted it, or partial damage as TASK-33 noted), damage (said in the language of the app since TASK-33), and from the clipboard "The native clipboard is not accessible due to being held by another party." (arboard tries OpenClipboard 6 times, 5 ms apart) or "Unknown error while interacting with the clipboard: Could not place the specified text to the clipboard".
- Auto-typing a plain snippet (Shift+Enter, `autotype_snippet`): the same database errors before anything happens; then the backend hides the window, waits 150 ms and types with PostMessageW(WM_CHAR) into the focused window. Errors of the typing come after the window is hidden: "PostMessageW(WM_CHAR) failed: Access is denied. (os error 5)" (the target runs with higher rights, for example as administrator), "... Invalid window handle. (os error 1400)" (the target closed while typing, for example a dialog that closes on the snippet's Enter), "... Not enough quota is available to process this command. (os error 1816)" (the target's queue of 10,000 messages is full: a long snippet into a program that stops taking messages), and from the SendInput fallback "Auto-type failed: no events were sent. ..." (only when no window has the keyboard). The frontend shows them as a toast in the hidden window.
- Opening a snippet for editing (Ctrl+E, `get_snippet_by_id`): the database errors.
- Reading the settings when the settings dialog opens (`get_settings`): returns the settings kept in memory; its only error is a poisoned lock, which the release build cannot reach (panic = "abort"). An unreadable settings.json is handled at start-up by the native dialog (TASK-28). A failure is shown as a raw toast and the dialog closes (SettingsModal `onError`, covered by a unit test); it cannot be produced in the app.
- Safe experiments (throwaway scripts in the session scratchpad; only hidden windows of the script itself, no key, no focus): PostMessageW(WM_CHAR) to a window whose thread takes no messages failed after 9,999 posts with 1816; to a destroyed window with 1400; from a process at low integrity to a window at medium integrity (the rule that applies to QuickSnippets typing into a program run as administrator) with 5. Windows error texts on this computer are English. The clipboard: another process holding it with OpenClipboard(NULL) does not block arboard (the copy works: this is why TASK-40's probe could not make the copy fail); a process holding it with a window of its own does (6 tries, error 5), and most programs open it that way.

### What the user sees and NVDA says today (probe with NVDA, test copy only)

A throwaway probe script (scripts/smoke-nvda.ps1 lines 97-1042 unchanged, with its own steps; not committed) ran the release build of 4328a9b (0.3.6, byte for byte the TASK-47 build; src, src-tauri and scripts unchanged since) in %TEMP%\quick-snippets-probe42-<time>\test copy\ with its own data folder (language uk, auto-type delay 1 ms as in a new install), three test snippets written into its snippets.db with Python before the start, and the script's own home window as the target. Speech read only from the log offsets of the run. Three runs with the user's permission; the first two stopped early on checks of my probe, and their findings agree with the third. The user's autostart values were the same before and after every run (entry absent, mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), by the probe's report and by my own reads; no copy of the app was left running and the test folders were removed. One utterance of the third run was a notification of another program; it was masked unread.

- A snippet another program deleted from the database (Python, while the copy ran): Enter: NVDA said "Query returned no rows" at once; the toast was in the window from about 0.4 s to 2.1 s after the key; clipboard unchanged, the window stayed. Ctrl+E: the same toast, read once; the edit dialog did not open; the snippet stayed listed.
- Auto-type into a window whose field removes itself after the first letter (a window of the script, like a field or dialog that closes while it is typed into): 5 of 419 characters reached it and QuickSnippets was hidden; NVDA read the field, the five letters and the window title, nothing about the failure. Ctrl+Alt+Space 3 s later: the window, the search box and the first snippet; no message any more.
- The database held by another program for 2 s (a read lock on the test copy's snippets.db, freed after 2 s): Enter: the window's thread took no messages from 0.33 s to 2.15 s after the key, NVDA was silent, then said "Скопійовано" at 2.2 s; copied, the window hid.
- The database locked for writing only (another program inside a write transaction): Enter: the snippet is read at once, but marking its last use (`touch_last_used`, a write) waits SQLite's busy timeout: the window's thread took no messages from 0.34 s to 5.58 s, Windows called the window not responding and put its stand-in "QuickSnippets (Не відповідає)" in its place, NVDA said "невідомо", then "Скопійовано"; copied after 5.56 s.
- The database held by another program (read lock) for the whole 5 s: Enter, Shift+Enter and Ctrl+E behaved alike. The window's thread took no messages for 5.2 to 5.6 s (twice the hung state lasted until 11 s, while NVDA hung too); Windows called the window not responding and showed "QuickSnippets (Не відповідає)" (NVDA once read that title). NVDA said nothing for about 7.7 s after the key, then "невідомо", "database is locked" (the raw toast) and "область" (the embedded browser read through UI Automation). NVDA's watchdog logged freezes of NVDA itself of 2.6 to 2.7 s, 0.7 to 1.2 s, 1.0 s, 1.0 to 1.3 s and 2.2 s: 6 to 9 s in all within 15 s of the key (run 2: 3.7, 0.8, 1.0, 2.2 and 0.9 s); the log had 5 errors of NVDA in these three steps (CorePump "errors in this core pump cycle", "error executing event: gainFocus" on the search box). The toast was never found in the window by UI Automation (the stand-in window was in its place while the toast lasted). Afterwards the keyboard either went to another window (the app then hides) or stayed in the app window without reaching the page: End did not move the selection and NVDA said nothing. Clipboard unchanged, nothing typed, the edit dialog did not open.
- Not produced: a clipboard held by another program (my probe held it without a window, which does not block; see the experiment above); a failed read of the settings (unreachable).

In short: outside the dialogs every such failure is SQLite's or Windows' English text in a 2 s toast; a typing failure after the hide is not said at all; a locked database freezes the window for 5 s, makes Windows call it not responding, freezes NVDA for several seconds and loses the keyboard.

## The user's choice (question dialog, 2026-11-21, verbatim answers)

- Permission for the probes: run 1 "Так, запускай (Рекомендовано)", run 2 "Так, запускай (Рекомендовано)", run 3 "Так, запускай (Рекомендовано)".
- "Копіювання (Enter), автодрук (Shift+Enter) і відкриття редагування (Ctrl+E) у головному вікні, а також відкриття налаштувань (воно практично не може зламатися, бо налаштування вже в пам'яті). Сьогодні невдача тут — це спливне повідомлення сирим англійським текстом, наприклад «Query returned no rows»: NVDA читає його один раз, на екрані воно 2 секунди. Як показувати такі невдачі?" = "Спливне на 2 секунди" (in the language of the app, saying what failed; as long as now).
- "Причину зараз дають база чи Windows англійською: «database is locked» (базу тримає інша програма), «Query returned no rows» (сніпета вже немає в базі), «The native clipboard is not accessible…» (буфер обміну зайнятий), «Access is denied». Так само зараз пишуть і діалоги створення, редагування, видалення й пароля: «Причина: database is locked». Як подавати причину?" = "Причина як є" (the raw text of the database or Windows everywhere, as in the dialogs now).
- "Автодрук ховає вікно QuickSnippets ще до набору. Якщо набір ламається вже потім (вікно, куди друкуєте, запущене від імені адміністратора, закрилося під час набору або не встигає приймати символи), повідомлення лишається в схованому вікні. На пробі дійшло 5 символів із 419, NVDA про невдачу не сказав нічого, а після Ctrl+Alt+Space повідомлення вже не було. Що робити в такому випадку?" = "Лише звук помилки" (the Windows error sound; the window stays hidden).
- "Коли базу тримає інша програма, QuickSnippets чекає до 5 секунд і весь цей час не відповідає. На пробі Windows назвав вікно «Не відповідає», NVDA мовчав близько 7,7 секунди, потім ще кілька разів зависав, а фокус перескакував в інше вікно або клавіші не доходили до програми. Навіть успішне копіювання, коли інша програма лише пише в базу, тривало 5,5 секунди з тим самим «Не відповідає». Діалоги створення, редагування й видалення теж мовчать ці 5 секунд. Що з цим робити?" = "Як зараз" (nothing changes).

The other options offered: "Спливне на 8 секунд (Рекомендовано)", "Спливне до наступної клавіші"; "Відомі своїми словами, скрізь (Рекомендовано)", "Своїми словами лише в головному"; "Знову показати вікно (Рекомендовано)", "Вікно Windows з повідомленням", "Як зараз"; "Вікно не завмирає (Рекомендовано)", "Коротше чекання, 2 секунди", "Обидва".

So "Query returned no rows" (the note from TASK-33 above) gets the frame of the message in the language of the app, and the reason stays SQLite's text, by this choice.

## What changed (commits 1d5356e and 1e48423, branch feature/action-failure-messages)

- src/utils/errors.ts: `failureToast(frame, failure, tf)`, the toast of a failed action of the main window: `failureMessage` (what failed, in the language of the app, with the reason as the backend gives it; damage in words of the app) and how long it stays (damage DAMAGE_TOAST_MS, 8 s; anything else the default 2 s).
- src/App.tsx: `showActionError` (copying and auto-typing a snippet without a password) uses it for every error; before, anything but damage was the raw text only. The settings dialog's `onError` (a failed read at opening) now shows `settingsOpenFailed(asSentence(reason))`.
- src/hooks/useAppModals.ts: `openEdit` the same, with `snippetOpenFailed`.
- src/i18n/translations.ts: `settingsOpenFailed(reason)` in en, uk, de; doc comments of the copy, auto-type and open texts. src/components/SettingsModal.tsx: doc comment of `onError` only.
- src-tauri/src/commands.rs: `autotype_snippet_inner(conn, id, password, hide, type_text, alert)` holds the flow of `autotype_snippet` apart from Tauri (read, mark last use, hide, type, erase the text) and calls `alert` only when the typing itself fails, after the window has hidden. `autotype_snippet` passes the real hide (and the 150 ms pause), `send_unicode_text` with the delay from the settings, and `autotype::win::error_sound`.
- src-tauri/src/autotype.rs: `error_sound()`: MessageBeep(MB_ICONERROR), the sound scheme's "Critical Stop" (on this computer Windows Foreground.wav), played asynchronously.
- src-tauri/Cargo.toml: windows-sys feature Win32_System_Diagnostics_Debug (MessageBeep); Cargo.lock unchanged.
- Unchanged, by the user's choice: the reasons stay SQLite's or Windows' own text (also in the dialogs of TASK-40), the busy timeout of 5 s, the dialogs, just smoke (91 steps). Also unchanged: the damage texts (DATABASE_DAMAGED, SNIPPET_DAMAGED), the formats of snippets.db and settings.json, and the rule that the text of an encrypted snippet never leaves Rust (no error holds it or the password: tested).
- CHANGELOG [Unreleased] Fixed: two entries. CLAUDE.md: the Autotype section.

## Checks

- On the branch: `npm run test:all` passes: 625 frontend tests (was 612) and 389 Rust tests (was 384; 1 ignored, as before); SettingsModal.test.tsx did not fail (TASK-46). `npm run lint` passes. New tests: App 9 and one old one replaced (copy with a locked database, with a busy clipboard and for a snippet no longer in the database; auto-type; opening for editing; the settings; Ukrainian; German; a damage notice stays 8 s, the others 2 s); errors.test.ts 5 (failureToast); Rust 5 (`autotype_snippet_inner`: hide, then type, no sound; a typing failure sounds once and returns the error as it is; an encrypted snippet types the decrypted text and its errors hold neither text nor password; a missing snippet, a wrong password and a damaged text fail before the hide: no hide, no typing, no sound; a locked database (another connection in BEGIN EXCLUSIVE, busy timeout 0) fails before the hide and works once free). Mocked IPC, in-memory and temporary databases only: no file of the user touched.
- Mutation checks: no sound on a typing failure (2 Rust tests fail), a sound always (3), the raw text for copy and auto-type (9 frontend tests), every toast 8 s (6), the raw text for the settings (3) and for opening (4). All restored.
- Release build of 1e48423: 3,900,416 bytes, SHA-256 5730EB3AC7C93B01CC8ED8AA86D93605FC60E799EC2A110FECCE2467950FE1A7.
- Verification with NVDA, with the user's permission given together for it and just smoke ("Так, обидва поспіль (Рекомендовано)"): the probe script above, with the clipboard now held by another program with a window of its own (as most programs hold it), test copies only.
  - 0.3.6 (a copy of the TASK-47 build), Enter with the clipboard busy: NVDA said "The native clipboard is not accessible due to being held by another party." once; the toast was in the window from 0.3 s to 2.1 s; clipboard unchanged. This is the case the investigation could not produce.
  - The new build, Enter with the clipboard busy: "Не вдалося скопіювати сніпет. Причина: The native clipboard is not accessible due to being held by another party." once, from 0.3 s to 2.1 s; clipboard unchanged, focus stayed. Enter on a snippet another program deleted: "Не вдалося скопіювати сніпет. Причина: Query returned no rows." once, 0.3 s to 2.0 s. Ctrl+E on it: "Не вдалося відкрити сніпет. Причина: Query returned no rows." once, 0.4 s to 2.1 s; no dialog. No "невідомо", "додаток" or window title in these steps.
  - Auto-type into the window whose field removes itself: 7 of 419 characters, the app window hidden, NVDA said nothing about the failure (as chosen). The sound is not in NVDA's log, and AudioSes.dll was not loaded in the app's process before or after, so Windows plays it outside the process and the probe could not detect it. Asked whether they heard it, the user answered "Не можу сказати": the sound is covered by the unit tests and the code only, not confirmed by ear. The user's sound scheme (.Default) plays Windows Foreground.wav for it.
- `just smoke` on the release build of 1e48423: 91 of 91 steps, 356 of 356 NVDA checks, exit code 0, no errors in the NVDA log during the run.
- The user's autostart values: entry absent and mark Binary 02 00 00 00 00 00 00 00 00 00 00 00 before and after every run (the reports and my own reads); the smoke report: at the end "mark absent", restored "as before". No copy of the app left running, no test folders left in %TEMP%.
- Notifications of other programs: lines that looked like them were masked unread in every report (third probe 1, verification 1, smoke 3) and in my console captures.
- Copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-42-1e48423.exe, SHA-256 the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown.

## Noticed, no task created

1. A locked database freezes the app's window for up to 5 s, because the commands run on the window's thread: Windows calls it not responding and shows its stand-in, NVDA freezes for several seconds, and afterwards the keyboard may be lost (see the investigation). The user chose to keep it ("Як зараз"). If this is ever changed: `#[tauri::command(async)]` for the snippet commands keeps the window responding (the list loads must keep their order at start-up), marking the last use need not wait, and "please wait" can be said while the database is busy.
2. Even a successful copy takes 5 s when another program only writes into the database: `touch_last_used` waits SQLite's busy timeout before the clipboard is written.
3. The probes of TASK-40 and of this task first held the clipboard with OpenClipboard(NULL), which blocks no other program; a test needs a window of its own, as the verification did.
4. A typing failure still adds its toast (2 s) to the hidden window; harmless, as nobody sees it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Copying or auto-typing a snippet without a password, opening a snippet for editing and reading the settings as the settings dialog opens showed a failure as the backend's own English text only, for 2 s. A probe with NVDA on a test copy showed: a deleted snippet gave "Query returned no rows", a busy clipboard its English text; an auto-type failure after the window has hidden (a target run as administrator, closed while typing, or with a full queue) was said nowhere; and a database held by another program froze the window for 5 s, so that Windows called it not responding, NVDA froze for several seconds and the keyboard could be lost afterwards.

By the user's choice (question dialog, all the smallest options): the toast now says what failed, in the language of the app, with the reason as the database or Windows gives it, for 2 s as before (new text settingsOpenFailed in en, uk, de); a typing failure after the window has hidden plays the Windows error sound (MessageBeep MB_ICONERROR); the reasons, the dialogs and the busy timeout of 5 s stay as they are.

Verified: npm run test:all (625 frontend, 389 Rust), npm run lint, mutation checks; NVDA verification on the release build (each new message read once, about 2 s, focus kept; the old build said the bare English reason); just smoke 91 of 91, 356 of 356; the user's autostart values unchanged; build copied to real_db as quick-snippets-TASK-42-1e48423.exe. The sound itself was not confirmed by ear (the user could not say); unit tests cover it.

Follow-ups for review: the window freeze with a locked database (kept by the user's choice), the 5 s a copy waits when another program only writes.
<!-- SECTION:FINAL_SUMMARY:END -->
