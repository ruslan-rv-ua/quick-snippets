---
id: TASK-40
title: >-
  Show the errors of the delete, create, edit and password dialogs where they
  belong
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T17:24:00Z'
updated_date: '2026-11-21T11:54:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-8
dependencies: []
references:
  - src/components/DeleteConfirmModal.tsx
  - src/components/PasswordModal.tsx
  - src/App.tsx
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-38 (its archived notes have the details). Three dialogs still show backend errors badly:
- The delete confirmation (DeleteConfirmModal) passes a failed delete to onError, and App.tsx shows the raw backend text, in English, as a toast outside the open aria-modal dialog, gone after 2 s.
- The create and edit dialogs show a backend error they do not recognise (anything but too long, title length or a duplicate title; for example a database error) raw, in English, under the Title field, as if the title were wrong.
- The password dialog shows every failure of activate_snippet or autotype (also a clipboard or database error) as «Невірний пароль» (wrong password).

Show each error where the user expects it, in the language of the app (en, uk, de), with the real reason and in a way NVDA reads, as TASK-36 and TASK-38 did for the settings dialog. First find out what NVDA says today, with a test copy only, never with the user's data. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). Error paths from the backend to announced messages, like TASK-36 and TASK-38.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A failed delete is shown inside the delete dialog, in the language of the app, and NVDA reads it
- [x] #2 Create and edit show an error they do not recognise as an error of the dialog, not of the Title field
- [x] #3 The password dialog says wrong password only for a wrong password, and other failures with their own message
- [x] #4 What NVDA said before the change is in the task notes, and tests cover each case without touching the user's data
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
## What NVDA says today (probe before the change, 2026-11-21, with the user's permission)

A throwaway test copy of the 0.3.5 release build (develop e064b6b, exe built 2026-11-21 00:08) in %TEMP%\quick-snippets-probe-<time>\test copy\ with its own data folder, language uk, driven by a probe script made of the start and the end of scripts/smoke-nvda.ps1 with its own steps (not committed). No hidden switch in the app: to make the backend fail, the script locked the test copy's snippets.db with byte-range locks as SQLite on Windows takes them (FileStream.Lock on the RESERVED byte 0x40000001 stops every write, on the SHARED range 0x40000002..+510 every read). The app then waits its busy timeout (5 s) and gets "database is locked". Speech read only from the log offset of the run. The user's autostart values were the same before and after (entry absent, mark Binary 02 00 00 00 00 00 00 00 00 00 00 00), by the probe's report and by my own reads.

- Create (title and content filled, write lock, Ctrl+Enter from Content): after about 5 s NVDA said "Назва, редактор, smoke тимчасовий" and then "database is locked". The raw SQLite text, in English, was shown under the Title field (create-title-err) and focus moved to the Title field, as if the title were wrong.
- Edit (Ctrl+E on a plain snippet, write lock, Ctrl+Enter): the same: "database is locked" under Title, focus on Title.
- Delete (Ctrl+D, write lock, Ctrl+Enter, focus on Cancel): NVDA said "database is locked" once, raw English, as the toast outside the aria-modal dialog. The dialog stayed open, focus stayed on Cancel, the toast was gone after about 2 s (measured 2081 ms after it appeared).
- Password (encrypted snippet, the correct password typed, read lock, Enter): NVDA said "Невірний пароль": the dialog called a database failure a wrong password although the password was right. Focus stayed in the password field, which was emptied.
- Password with the clipboard held open by the script (OpenClipboard): the copy still succeeded ("Скопійовано", window hidden), so a clipboard failure could not be produced this way; by the code it would also show "Невірний пароль" (PasswordModal turns every failure of activate_snippet / autotype_snippet into wrongPassword).

## The user's choice (question dialog, 2026-11-21, verbatim answers)

- "Діалог видалення. Зараз, коли видалити не вдалося, NVDA каже лише «database is locked» зі спливного повідомлення поза діалогом, яке зникає за 2 секунди. Де показати помилку і куди піде фокус?" = "Над кнопками (рекомендовано)" (the dialog stays open, the message stays above Cancel and Delete while the dialog is open, focus does not move, NVDA reads it once; Ctrl+Enter tries again and a new failure is read again; as in the settings dialog).
- "Діалоги створення й редагування. Зараз незнайома помилка (наприклад, база зайнята) стоїть англійською під полем «Назва», фокус стрибає в «Назву», ніби назва неправильна. Де показувати таку помилку?" = "Над кнопками (рекомендовано)" (a message of the whole dialog above Cancel and Save; focus stays where it was, no field marked invalid, everything typed is kept; Ctrl+Enter tries again; title and content errors (length, duplicate title) stay under their fields as now).
- "Діалог пароля. Зараз будь-яка невдача (на пробі: зайнята база з правильним паролем) звучить як «Невірний пароль», поле очищається. Як показувати інші невдачі?" = "Над кнопками, пароль лишається (рекомендовано)" (a wrong password as now: «Невірний пароль» under the field, the field emptied; any other failure: its own message above the buttons, the field not marked invalid, the password kept, focus in the field, Enter tries again without typing it again).
- "Що сказати в цих повідомленнях? ..." = "Своїми словами + причина (рекомендовано)" (a sentence in the language of the app (en, uk, de) about what failed, and the reason as the database or Windows gives it; as in the settings dialog).
- "Як програма відрізнятиме невірний пароль від інших невдач? ..." = "Точний текст (рекомендовано)" (the dialog says wrong password only when the error is exactly "Wrong password"; in Rust that text becomes a shared constant, and tests check that a wrong password gives exactly it and a locked database or damaged content does not).
- "Наприкінці потрібен just smoke на новій release-збірці ... Додати в нього нові кроки?" = "Smoke з новими кроками (рекомендовано)" (the script locks the test copy's database for a few seconds and checks that NVDA reads the new delete, create and password messages once, that focus stays and nothing is deleted or added; no hidden switch in the app).

The other options offered: "Над кнопками, фокус на «Скасувати»", "Закрити діалог, повідомлення в головному вікні"; "Під заголовком, фокус на «Зберегти»"; "Над кнопками, пароль стирається", "Закрити діалог, повідомлення в головному вікні"; "Лише своїми словами", "Своїми словами за видом помилки"; "Код виду від Rust"; "Smoke без нових кроків".

## What changed (commits 3992aea, 618a3c2)

- src-tauri/src/crypto.rs: `WRONG_PASSWORD` ("Wrong password"), the Display text of `CryptoError::WrongPassword`; no change of behaviour or of the blob formats.
- src-tauri/src/commands.rs: tests only: a wrong password gives exactly WRONG_PASSWORD; damaged content ("Invalid data"), a missing snippet and a locked database file (another connection in BEGIN EXCLUSIVE, busy timeout 0) do not; delete, create and update on a locked database fail with "database is locked"; errors of activate_snippet_get_content never contain the password or the decrypted text.
- src/utils/errors.ts: `WRONG_PASSWORD` and `isWrongPassword` (exact match; "change the two together").
- src/i18n/translations.ts: `snippetSaveFailed(reason)`, `snippetDeleteFailed(reason)`, `snippetCopyFailed(reason)`, `snippetAutotypeFailed(reason)` in en, uk, de; the reason goes through `asSentence`.
- DeleteConfirmModal: no `onError` any more (App.tsx no longer passes it, so no toast). A failed delete sets `failure`, shown in a FieldError live region `delete-error` right above the buttons (aria-live assertive, atomic, always rendered); the dialog stays open, focus is not moved. Emptied at the start of every attempt and when the dialog opens. A busy guard ignores a second Ctrl+Enter while a delete runs (a locked database answers after 5 s).
- CreateSnippetModal, EditSnippetModal: a backend error that is neither too long, nor the title length, nor a duplicate title goes to `failure`, shown in `create-error` / `edit-error` above the buttons; no field is marked invalid and focus stays where it was; everything typed is kept. Emptied at the start of every attempt and on opening.
- PasswordModal: only `isWrongPassword(msg)` leads to «Невірний пароль» under the field (as before: field emptied, aria-invalid). Any other failure: focus to the field first (it usually is there), then `failure` in `pwd-failure` above the buttons, copy or auto-type wording by the dialog's action; the password stays, so Enter tries again; the field is not marked invalid.
- src/styles/theme.css: `.modal-dialog > .field-error` (empty takes no space; the settings dialog keeps its own smaller gap rule, which comes later).
- scripts/smoke-nvda.ps1: `Lock-TestDatabase` / `Unlock-TestDatabase` (byte-range locks on the test copy's snippets.db as SQLite takes them; released after each step and in the final block). Three new steps (create with a write lock, delete with a write lock, the right password with a read lock) and the step "the right password copies" replaced by "Enter alone copies after the failure" (shows that the password stayed): 91 steps instead of 88. DEVELOPMENT.md (smoke section) describes it.
- CHANGELOG [Unreleased] Fixed: one entry.

## Checks

- On the branch: `npm run test:all` passes: 572 frontend tests (was 525) and 336 Rust tests (1 ignored, as before). `npm run lint` passes. New tests: DeleteConfirmModal 8 (empty region above the buttons; a failed delete keeps the dialog and the focus on Cancel, or on Delete when clicked, nothing else holds the text; a second failure empties the message first; a second Ctrl+Enter while a delete runs is ignored; uk and de; a delete that works after a failure closes; reopening shows no old message), Create and Edit 7 each (empty region; dialog, text and focus in Content kept, no field invalid; re-announced; a field error afterwards replaces it; uk and de; reopening), PasswordModal 15 (empty region; not "wrong password", password kept, field not invalid, focus in the field; damaged content, a busy clipboard, an Error object and other letters are no wrong password; focus back to the field after the button; Enter retries with the same password and re-announces; a wrong password afterwards replaces it; auto-type wording; uk and de for copy and auto-type; reopening), App 1 (a failed delete: message in the dialog, no toast), errors.test.ts 9 (isWrongPassword), Rust 5 (see "What changed"). All with mocked IPC or in-memory and temporary databases: no file of the user touched.
- Mutation checks: without emptying the message at the start of an attempt, 2 tests fail in each of the four dialogs; without emptying it on opening, the delete reopening test fails; treating every failure as a wrong password fails 14 password tests. All restored.
- Release build of 618a3c2: 3,866,112 bytes.
- `just smoke` with the user's permission (2026-11-21, about 01:28 to 01:31): 91 of 91 steps, 356 of 356 NVDA checks, exit code 0, no errors in the NVDA log during the run.
  - Step 22 (right password, read lock, Enter): NVDA said "Не вдалося скопіювати сніпет. Причина: database is locked." once and nothing else; no «Невірний пароль», focus in the password field, clipboard unchanged.
  - Step 23 (lock released, Enter alone): copied, the decrypted text in the clipboard, window hidden: the password had stayed in the field.
  - Step 70 (create, write lock, Ctrl+Enter from Content): "Не вдалося зберегти сніпет. Причина: database is locked. Нічого не змінено." once; no "Назва" (focus did not jump), no "Збережено", focus in Content, list unchanged; the next step saved it.
  - Step 73 (delete, write lock, Ctrl+Enter on Cancel): "Не вдалося видалити сніпет. Причина: database is locked." once; Cancel not read again, focus on Cancel, the snippet still listed; the next step deleted it.
- The user's autostart values: the smoke report says before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", at the end "entry absent; mark absent", after restoring "as before"; my own read-only reads before and after the run: Run\QuickSnippets absent, StartupApproved\Run\QuickSnippets 02 00 00 00 00 00 00 00 00 00 00 00 both times. The same before and after the probe.
- The report holds no notification of another program as far as a search for notification words shows; my captured console output of the probe and the smoke was deleted.
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-40-618a3c2.exe`, SHA-256 46CAF7D03137359166E3E9447999D2A1809DB6F51A4006640A4AC91B97D69AD8, the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown; the new steps run in that mode too.
- Edit has no smoke step of its own: it uses the same code path and live region as create, covered by unit tests.

## Noticed, no task created

1. A clipboard failure could not be produced on the probe by holding the clipboard open (the copy still worked); it is covered by unit tests with the text arboard gives.
2. Auto-type from the password dialog hides the window before typing; if typing itself then failed (PostMessage/SendInput), the new message would be in a hidden window. Practically unreachable; as before.
3. While the database is locked, every dialog waits its busy timeout (5 s) in silence before the message: nothing says that the app is busy (the password dialog shows "Decrypting...").
4. Outside dialogs, as TASK-38 listed: copying or auto-typing a plain snippet and opening the edit dialog still show the raw backend text as a toast; the settings dialog still shows a failed read at opening as a raw toast.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Three dialogs showed backend errors badly. A probe with a test copy whose database the script locked showed what NVDA said: a failed delete was read only as "database is locked", from a toast outside the dialog, gone in 2 s; create and edit put that text under Title and moved the focus there; the password dialog said «Невірний пароль» with the right password.

By the user's choice (question dialog, all recommended options): each dialog now shows such a failure above its buttons in a live region, in the language of the app (en, uk, de), with the reason from the database or Windows; the dialog stays open, focus and everything typed stay, and Ctrl+Enter (or Enter) tries again. The password dialog says wrong password only for exactly WRONG_PASSWORD, now a shared constant in crypto.rs and errors.ts; after any other failure the password stays in the field. No plaintext or password is ever part of an error (tested).

Verified: npm run test:all (572 frontend, 336 Rust), npm run lint, mutation checks; just smoke with the user's permission on the release build 618a3c2: 91 of 91 steps, 356 of 356 NVDA checks, three new steps with a locked test database (each message read once, focus kept, nothing added or deleted, Enter alone then copied); the user's autostart values unchanged; build copied to real_db as quick-snippets-TASK-40-618a3c2.exe.

Follow-ups for review: toasts with raw backend text outside dialogs (plain copy and auto-type, opening edit, reading settings at opening) remain; a locked database is 5 s of silence before the message.
<!-- SECTION:FINAL_SUMMARY:END -->
