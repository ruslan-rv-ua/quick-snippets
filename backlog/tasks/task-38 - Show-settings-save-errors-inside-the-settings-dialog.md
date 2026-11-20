---
id: TASK-38
title: Show settings save errors inside the settings dialog
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-20T16:04:00Z'
updated_date: '2026-11-20T17:10:00Z'
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
- [ ] #1 When the settings cannot be saved, the settings dialog shows a message in the language of the app that NVDA reads
- [ ] #2 What NVDA said before the change is written in the task notes, and the user chose the solution through the question dialog
- [ ] #3 Tests cover a failed save without touching the user's data or settings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

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
<!-- SECTION:NOTES:END -->
