---
id: TASK-36
title: Tell the user when Start with Windows cannot be changed
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-20T01:27:00Z'
updated_date: '2026-11-20T15:38:00Z'
labels:
  - bug backend frontend accessibility model-sonnet effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/commands.rs
  - src-tauri/src/autostart.rs
  - src/i18n/translations.ts
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-31. Turning "Start with Windows" on or off can fail in the registry (for example access denied, or a policy that locks the autostart keys). `apply_autostart` in src-tauri/src/commands.rs ignores that error, as before TASK-31: the setting is saved as changed and the settings dialog closes as if it had worked, so the user does not learn that Windows will (or will not) start QuickSnippets. `crate::autostart::apply_change` already returns the first error, and turning off tries both removals.

Tell the user in the language of the app (en, uk, de), in a way NVDA reads, and decide with the user what the setting shows after such a failure: the old value or the new one. Test with the in-memory registry of src-tauri/src/autostart.rs, never by breaking the real registry: every copy of QuickSnippets uses the same value names, so the user's own autostart values must stay as they are. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). An error path from the backend to an announced message.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When turning Start with Windows on or off fails, the user gets a message in the language of the app that NVDA reads
- [ ] #2 The user chose through the question dialog what the setting shows after such a failure, and the app does that
- [ ] #3 Tests cover a failing turn-on and a failing turn-off without touching the real registry
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
1. src-tauri/src/autostart.rs: turning on fails when the plugin's enable() fails; turning off counts as failed only while the autostart entry (Run\QuickSnippets) is still there, read back through a new AutostartRegistry::value_exists (a value that cannot be read counts as present). A Task Manager mark that cannot be removed is a leftover Windows ignores, as up to 0.3.3, not a failure. Tests with the in-memory registry for a failing turn-on and a failing turn-off.
2. src-tauri/src/commands.rs: save_settings returns what it could not do (autostart_error: null, "cannot_turn_on" or "cannot_turn_off"). After a failed change the setting keeps its previous value in settings.json and in memory; the other settings stay saved. The logic in a testable inner function. Hidden test switch: with the environment variable QUICK_SNIPPETS_TEST_AUTOSTART_ERROR set, the app pretends Windows refused the change and leaves the registry alone.
3. Frontend: saveSettings/updateSettings in useIpc.ts return that result. After such a failure SettingsModal stays open: the check box shows the saved (previous) value, focus moves to it, and a live region under it (always rendered, as FieldError) says the message, which also says the other settings are saved. Cancel then no longer brings back the saved theme and language. Strings in en, uk, de.
4. Vitest tests: the message in the live region, the check box value and focus, the dialog stays open, the other settings saved, Cancel keeps them, a second failure is announced again.
5. scripts/smoke-nvda.ps1: the last restart of the test copy runs with the test switch; a new step ticks Start with Windows, saves, and expects NVDA to read the message once, focus on the check box (not checked), autostart false and the other settings in settings.json, the registry values unchanged.
6. CHANGELOG [Unreleased], CLAUDE.md, DEVELOPMENT.md (and README if it describes this).
7. npm run test:all, npm run lint, release build, just smoke (the user allowed it in the question dialog), copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The user's choice (question dialog, 2026-11-20, verbatim answers)

- "Якщо Windows не дозволила ввімкнути чи вимкнути «Запускати разом з Windows» (наприклад, через політику чи антивірус), що має показувати й зберігати ця галочка?" = "Як було (рекомендовано)" (the check box goes back to its state before the attempt and is saved so; when turning off removed the entry and only Task Manager's mark is left, that is not a failure).
- "Як показати повідомлення про те, що «Запускати разом з Windows» не вдалося змінити, щоб NVDA його прочитав?" = "Діалог відкритий (рекомендовано)" (the settings dialog stays open, the message appears under the check box, focus moves to the check box).
- "Що робити з іншими змінами, збереженими тим самим натисканням «Зберегти» (тема, мова, трей, питання перед закриттям, затримка автодруку), коли не вдалася лише зміна автозапуску?" = "Зберегти їх (рекомендовано)" (the other changes are saved and take effect; the message says so; Cancel no longer brings them back).
- "Наприкінці потрібен just smoke на новій release-збірці ... Що обираєте?" = "Smoke з перемикачем (рекомендовано)" (permission for just smoke at the end; a hidden environment variable, for tests only, makes the app pretend Windows refused the change without touching the registry; smoke starts the test copy with it at its last restart and checks that NVDA reads the message once).

The other options offered: "Як вибрав користувач"; "Сповіщення після закриття", "Окреме вікно з OK"; "Не зберігати нічого"; "Smoke без перемикача", "Без smoke".
<!-- SECTION:NOTES:END -->
