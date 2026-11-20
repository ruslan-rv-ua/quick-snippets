---
id: TASK-38
title: Show settings save errors inside the settings dialog
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T16:04:00Z'
updated_date: '2026-11-20T17:18:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/SettingsModal.tsx
  - src/App.tsx
  - src/i18n/translations.ts
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-36. When the settings dialog cannot save (for example settings.json cannot be written: a read-only folder, a full disk, a file locked by another program), `handleSave` in src/components/SettingsModal.tsx passes the error to `onError`, and App.tsx shows it as an error toast (ToastContainer, aria-live polite) outside the open dialog. The text is the backend's raw error, in English whatever the language of the app, and whether NVDA reads that toast while the dialog is open has never been checked: the dialog is aria-modal, so the page behind it may be hidden from screen readers. Since TASK-36 a refused change of "Start with Windows" is shown inside the dialog instead (a FieldError live region under the setting).

First find out what NVDA says today when the save fails, with a test copy only (for example a read-only settings file of the test copy), never with the user's data. Then show the error inside the dialog, in the language of the app (en, uk, de), in a way NVDA reads, and decide with the user what the dialog does after such a failure. Other dialogs also pass their errors to the same toast (App.tsx): note in the task notes which of them have the same problem, without fixing them here. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). An error path from the backend to an announced message, like TASK-36.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the settings cannot be saved, the settings dialog shows a message in the language of the app that NVDA reads
- [x] #2 What NVDA said before the change is written in the task notes, and the user chose the solution through the question dialog
- [x] #3 Tests cover a failed save without touching the user's data or settings
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
1. Probe what NVDA says today (test copy, read-only settings.json), with permission.
2. Present solutions through the question dialog, record the choice.
3. SettingsModal: live region above the buttons, localized message with the Windows reason, dialog stays open, focus stays.
4. Vitest tests of a failed save; smoke steps with a read-only settings.json of the test copy.
5. CHANGELOG, DEVELOPMENT.md; test:all, lint, release build, just smoke, copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What NVDA says today (probe before the change, 2026-11-20, with the user's permission)

A throwaway test copy (release build of develop, code as in 3c8ab57, in %TEMP%\quick-snippets-probe-<time>\test copy\ with its own data folder, language uk), driven by a probe script that reuses the helpers of scripts/smoke-nvda.ps1. Ctrl+, opened the settings, Down showed the light theme, then the test copy's settings.json was made read-only and Ctrl+Enter pressed (focus in the theme list), then Escape. Speech read only from the log offset of the run.

- Ctrl+Enter: NVDA said "Access is denied. (os error 5)" once and nothing else: the toast outside the aria-modal dialog is read, but it is the raw text of Windows (English here) and does not say that the settings were not saved.
- The dialog stayed open, focus stayed in the theme list, settings.json kept the dark theme, the light theme stayed on screen. The toast was gone after 2 s (default toast time), so a sighted user may miss it.
- Escape: the dialog closed, NVDA read the search box, the dark theme came back on screen (nothing was saved).
- The user's autostart values the same before and after: entry absent, mark Binary 02 00 00 00 00 00 00 00 00 00 00 00. No notification text in the captured speech.
- The text comes from io::Error in save_settings_to_path (settings.rs, std::fs::write); Rust takes it from Windows (FormatMessageW), so it is in the Windows display language. On a failed write save_settings_inner returns before it changes the settings in memory: nothing is saved.

## The user's choice (question dialog, 2026-11-20, verbatim answers)

- "Де в діалозі налаштувань показати повідомлення, що налаштування не збереглися, і куди піде фокус? ..." = "Над кнопками (рекомендовано)" (the message at the bottom of the dialog, above Cancel and Save, stays while the dialog is open; focus does not move; NVDA reads it once, like the autostart message).
- "Що сказати в повідомленні про невдале збереження налаштувань? ..." = "Своїми словами + причина (рекомендовано)" (a sentence in the language of the app: settings not saved, settings.json in quick-snippets-data next to the program cannot be written, the reason as Windows gives it, nothing changed).
- "Що робить діалог після невдалого збереження? ..." = "Лишається відкритим (рекомендовано)" (every change in the dialog stays, Save can be tried again and a new failure is read again; Cancel and Escape bring back the theme and language from before the dialog opened, since those are what is saved).
- "Наприкінці потрібен just smoke на новій release-збірці ... Що обираєте?" = "Smoke з новими кроками (рекомендовано)" (permission for just smoke at the end, with new steps: the test copy's settings.json read-only, Ctrl+Enter in the settings, NVDA reads the new message once, the file unchanged; then Escape and the file writable again).

The other options offered: "Під заголовком, фокус на «Зберегти»", "Окреме вікно з OK"; "Лише своїми словами", "Своїми словами за видом помилки"; "Відкритий, тема й мова назад"; "Smoke без нових кроків", "Без smoke".

## Other dialogs that pass errors to the same toast or show raw backend text (not fixed here)

- Delete confirmation (DeleteConfirmModal): a failed delete goes to onError, App.tsx shows String(err) as an error toast outside the open aria-modal dialog; raw backend text in English, gone after 2 s; the dialog stays open. Same problem as here (by the probe, NVDA would likely read the toast, but in English and without saying what failed).
- Settings dialog, loading on open: a failed getSettings goes to onError (raw text as a toast) and the dialog does not open. Not inside a dialog, but raw English.
- Create and edit dialogs: a backend error they do not recognise (anything but too long, title length, duplicate title; for example a database error) is shown raw, in English, as the message under the Title field, as if the title were wrong.
- Password dialog: every failure of activate_snippet / autotype (also a clipboard or database error) is shown as «Невірний пароль».
- Outside dialogs: a failed copy or autotype of a plain snippet and a failed opening of the edit dialog (useAppModals.openEdit) show String(err) as a toast; a failed save of the theme (Ctrl+Shift+T, ThemeContext), the sort order and the window position is ignored silently.

## What changed (commits 5c8532a, 6d1bc8e)

- src/components/SettingsModal.tsx: a failed save (updateSettings throws, i.e. save_settings could not write settings.json) no longer goes to onError (the toast in App.tsx). The dialog keeps `saveError` (the backend's error text) and shows it in a FieldError live region (`settings-save-error`, aria-live assertive, atomic, always rendered, not referenced by aria-describedby) right above the footer with Cancel and Save. The dialog stays open with every change, focus is not moved, Save can be tried again; the message is emptied at the start of every save (so a repeated failure is announced again) and when the dialog closes. Cancel still brings back the theme and language from before the dialog opened (nothing was saved). onError is now used only when the settings cannot be read at opening.
- src/i18n/translations.ts: `settingsSaveFailed(reason)` in en, uk, de: settings not saved, settings.json in the quick-snippets-data folder next to the program cannot be written, "Reason: <Windows error>", nothing was changed. The message follows the language shown in the dialog.
- src/utils/errors.ts: `asSentence` ends the Windows error with a full stop ("Access is denied. (os error 5)" + ".").
- src/styles/theme.css: the empty region cancels the dialog's gap.
- scripts/smoke-nvda.ps1: two new steps after the autostart refusal steps (88 steps instead of 86): the test copy's settings.json read-only, Ctrl+, Down (light theme shown), Ctrl+Enter: the message once, "os error" once (no second reading from elsewhere), "Нічого не змінено", focus still in the theme list, the file byte for byte unchanged; then Escape: dialog closed, dark theme and uk in settings.json, file unchanged, made writable again. The final block also clears the read-only attribute. Header and DEVELOPMENT.md (smoke section) describe it.
- CHANGELOG [Unreleased] Fixed: one entry.
- No backend change: save_settings_inner already returns Err before it touches the settings in memory when the first write fails, and commands.rs has a test for an unwritable file ("an unwritable file changes nothing", TASK-36).

## Checks

- On the branch: `npm run test:all` passes: 525 frontend tests (was 513) and 321 Rust tests (1 ignored, as before). `npm run lint` passes. New tests: SettingsModal 10 (replacing the old "reports a save error" test: the empty region above the footer, a failed save keeps the dialog and the focus on Save, Ctrl+Enter from a control keeps the focus there, nothing saved and the changes kept and Cancel brings back theme and language, Save again once writable, a second failure re-announced, Ukrainian and German texts, reopening shows no old message, both messages after a refused autostart change); errors.test.ts 3 for asSentence. All with an in-memory backend: no file and no setting of the user touched.
- Mutation check: without emptying the message at the start of a save, "a second failure empties the message first" fails. Restored.
- Release build of 6d1bc8e: 3,863,040 bytes.
- `just smoke` with the user's permission (2026-11-20, about 19:17 to 19:20, 180 s): 88 of 88 steps, 333 of 333 NVDA checks, exit code 0.
  - Step 86 (read-only settings.json, Ctrl+Enter in the theme list): NVDA said "Не вдалося зберегти налаштування: файл settings.json у теці quick-snippets-data поруч із програмою не записується. Причина: Access is denied. (os error 5). Нічого не змінено." once; "os error" once (the toast is gone); focus stayed in the theme list; settings.json byte for byte unchanged.
  - Step 87 (Escape): the list and the selected snippet, no message, dark theme and uk in settings.json, file unchanged, writable again.
  - One error in the NVDA log during the run: scriptHandler.executeScript, EditableText.script_caret_newLine with gesture Enter (an Enter in an editable field); not tied to a step, steps 86 and 87 send no Enter. Not caused by this change as far as I can tell; TASK-36 had none, TASK-37 did not report.
- The user's autostart values: the smoke report says before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", after restoring "as before"; my own read after the run (read only): Run\QuickSnippets absent, mark 02 00 00 00 00 00 00 00 00 00 00 00.
- The report held one line with a notification of another program: masked in the report file without reading it; my captured output was deleted.
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-38-6d1bc8e.exe`, SHA-256 21599908BD1CC5B6B5A1D2537EB0FCD15D10CA851DF7224000FEFAB35B9DC942, the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown; the new steps run in that mode too.

## Noticed, no task created

1. save_settings_inner: if the first write succeeds, Windows refuses the autostart change and then the second write (with the old autostart) fails, the command returns Err while the file and memory hold the refused value; the dialog would then say "nothing was changed". Practically unreachable (the file was written a moment before).
2. The reason comes from Windows in its display language; on an English Windows it stays English inside a Ukrainian or German message, by the user's choice.
3. Other dialogs (see the list above) still show raw backend errors or a toast outside the dialog.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
When settings.json could not be written, the settings dialog passed the raw Windows error to a toast outside the aria-modal dialog. A probe with a read-only settings file of a test copy showed that NVDA read it, but only as "Access is denied. (os error 5)", in English, without saying that the settings were not saved, and the toast was gone after 2 s.

By the user's choice (question dialog, all recommended options): the dialog now stays open with every change, focus stays where it is, and a live region above Cancel and Save says in the language of the app (en, uk, de) that the settings were not saved, that settings.json in quick-snippets-data next to the program cannot be written, the reason as Windows gives it, and that nothing was changed. Save can be tried again; Cancel brings back the theme and language from before. No backend change.

Verified: npm run test:all (525 frontend, 321 Rust) and npm run lint; a mutation check; just smoke on the release build 6d1bc8e with the user's permission: 88 of 88 steps, 333 of 333 NVDA checks, two new steps with a read-only settings.json of the test copy (message read once, focus kept, file unchanged); the user's autostart values unchanged; build copied to real_db as quick-snippets-TASK-38-6d1bc8e.exe.

Follow-ups for review: the delete dialog still shows its errors as a raw toast outside the dialog; create and edit show unknown backend errors raw under Title; the password dialog calls every failure a wrong password.
<!-- SECTION:FINAL_SUMMARY:END -->
