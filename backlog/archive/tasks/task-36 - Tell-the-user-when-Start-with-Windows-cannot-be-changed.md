---
id: TASK-36
title: Tell the user when Start with Windows cannot be changed
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T01:27:00Z'
updated_date: '2026-11-20T15:59:00Z'
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
- [x] #1 When turning Start with Windows on or off fails, the user gets a message in the language of the app that NVDA reads
- [x] #2 The user chose through the question dialog what the setting shows after such a failure, and the app does that
- [x] #3 Tests cover a failing turn-on and a failing turn-off without touching the real registry
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

## Cause (2026-11-20)

- Since TASK-31, `save_settings` (src-tauri/src/commands.rs) wrote settings.json, swapped the settings in memory and then called `apply_autostart`, which dropped the result of `crate::autostart::apply_change` (`let _ = ...`). The command returned Ok, the settings dialog closed, and the setting stayed saved as changed, although Windows did not do it.
- Where a change can fail (auto-launch 0.5.0, src/windows.rs): `enable()` opens `Run` with KEY_SET_VALUE and writes the entry; a locked key or security software makes it fail there, before anything is written. It then opens `StartupApproved\Run` with KEY_SET_VALUE and, if that works, writes the mark (a failure there would leave the entry written; practically unreachable). Turning off (`RegDeleteKeyValueW`) fails with access denied on a locked key even when the value does not exist.

## What changed (commits 2aa4997, d6c1d67)

- `src-tauri/src/autostart.rs`: `AutostartRegistry::value_exists` (real: `current_user_value_exists`, `RegGetValueW` with `RRF_RT_ANY | RRF_NOEXPAND` and no buffers; only `ERROR_FILE_NOT_FOUND` counts as gone, a value that cannot be read counts as there). `apply_change` returns an error only when Windows still does what it did before: turning on fails when `enable()` fails; turning off (`turn_off`) fails only while the Run entry is still there after `remove_entry_and_mark`. So a Task Manager mark that cannot be removed (a leftover Windows ignores, as with 0.3.3 and older) and a locked key that holds no entry (for example settings copied from another computer) are no failure. `TEST_REFUSAL_VAR` = `QUICK_SNIPPETS_TEST_AUTOSTART_ERROR` (non-empty value) with `RefusingRegistry`: every change fails, nothing is written or removed. The in-memory registry moved to `#[cfg(test)] pub(crate) mod memory` (failing_enable, failing_key, unreadable; it logs reads too), so commands.rs tests use it.
- `src-tauri/src/commands.rs`: `AutostartError` (`cannot_turn_on`, `cannot_turn_off`) and `SaveSettingsOutcome { autostart_error }`, serialized in snake_case. `save_settings_inner(new, current, path, registry, name)`: writes settings.json, swaps memory, applies a change of the setting only (as before); on a refused change it writes the file again with the previous value of `autostart`, puts it back in memory and reports which change failed. The command `save_settings` returns the outcome and picks `RefusingRegistry` when the test variable is set, else `AppAutostart` (plugin `enable()`, own removal, own read). `apply_autostart` is gone.
- Frontend: `SaveSettingsOutcome`/`AutostartError` in src/types/index.ts; `saveSettings` and `updateSettings` (useIpc.ts) return it. SettingsModal: after a refusal the dialog stays open; `shownAtOpen` becomes the saved theme and language (Cancel no longer brings back the old ones); the check box gets the kept value with `flushSync` before `focus()`, and only then the message is set, in a `FieldError` live region (aria-live assertive, atomic, always rendered) under the hint in the row of the setting, not referenced by aria-describedby. The message is cleared at the start of every save (so a repeated failure is announced again) and when the dialog closes. `SettingsRow` got a `message` prop; CSS for the empty region. New strings `autostartTurnOnFailed`, `autostartTurnOffFailed` in en, uk, de; the message says the other settings are saved and, for a failed turn-off, that QuickSnippets still starts with Windows.
- scripts/smoke-nvda.ps1: `Start-RefusingCopy` (the variable only for that start, removed from the script process right after; the first start clears it). The restart near the end (both modes) uses it. Four new steps after "Ctrl+, після перезапуску": prepare (dark theme, Space ticks the box, Shift+Tab to Save), Enter on Save (message once, focus on the cleared box, dark theme and autostart false in settings.json, registry as before), Space and Ctrl+Enter on the box (message once again), Escape (dark theme kept, registry as before).
- README (en, uk, de) Start with Windows bullet, CHANGELOG [Unreleased] Fixed, CLAUDE.md (autostart.rs row), DEVELOPMENT.md (smoke section).

## Checks

- On the branch: `npm run test:all` passes: 513 frontend tests (was 502) and 312 Rust tests (was 299; 1 ignored, as before). `npm run lint` passes. New tests: autostart.rs 15 tests (was 9; a failing turn-on, a failing turn-off that keeps the entry but removes the mark, a mark that cannot be removed is no failure, a locked key without an entry is no failure, an unreadable entry after a failed removal is a failure, the test registry refuses both changes, the test variable, the RegGetValueW status mapping); commands.rs 7 tests of save_settings_inner (refused turn-on and turn-off keep the previous value in the file and in memory and save the rest, the test registry, success, an unchanged setting does not ask Windows, an unwritable file changes nothing, the JSON names); SettingsModal 10 tests; useIpc 1 new and 1 changed.
- Mutation checks of two frontend tests: without flushSync, "the box shows the saved value when it gets the focus" fails (the box was still ticked at the focus); without emptying the message at the start of a save, "a second refusal empties the message first" fails. Both restored.
- Windows PowerShell 5.1: a child started with Start-Process while the variable is set in the script's process gets it (cmd.exe `set` showed QUICK_SNIPPETS_TEST_AUTOSTART_ERROR=1), and the script's process no longer has it afterwards. The changed script parses in Windows PowerShell 5.1 and keeps its BOM.
- `cargo clippy --all-targets`: only the old findings in test code (TASK-34); none in the new code.
- Release build of 603f49c (code as in 2aa4997, script as in d6c1d67): 3,868,160 bytes.
- `just smoke` with the user's permission (2026-11-20, about 17:54 to 17:57, 180 s): 86 of 86 steps, 322 of 322 NVDA checks, exit code 0, no errors in the NVDA log during the run. Steps 39 to 41 (real autostart on, theme saves leave Task Manager's "Disabled", off) OK. New steps 82 to 85 OK:
  - 82: NVDA read the theme list with "Темна", the check box "не позначено", "позначено" after Space, and "Зберегти, кнопка".
  - 83 (Enter on Save): "недоступно" (Save while saving), the whole message once, then "Запуск і закриття, групування" and "Запускати разом з Windows, прапорець, не позначено, Діє з наступного входу в Windows." So NVDA says the message before the focus, although the page sets it after; both are said in full. settings.json: dark theme, autostart false; registry unchanged.
  - 84 (Space, Ctrl+Enter on the box): "пробіл", "позначено", the message once again, "не позначено".
  - 85 (Escape): focus back on the snippet in the list, no message; the dark theme stays saved.
- The user's autostart values: the smoke report says before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", at the end "entry absent; mark absent", after restoring "as before". My own read-only reads right before the run (17:51:44) and after it (17:57:47): Run\QuickSnippets absent, StartupApproved\Run\QuickSnippets Binary 02 00 00 00 00 00 00 00 00 00 00 00 both times.
- The captured smoke output held no notification text (0 lines); my scratch copy of it was deleted.
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-36-603f49c.exe`, SHA-256 2AB0EE373BA359543F1A0BEDC2AC1AEAA30B9A32A5E8F31D6E8FF3793C9A9F80, the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown. Its restart in the tray uses the same Start-RefusingCopy, so the new steps run there too, but that mode was not run in this task.
- The failed turn-off message is covered by the Rust and frontend tests; just smoke checks NVDA only with the turn-on message (the same live region).

## Noticed, no task created

1. If the plugin's enable() wrote the entry and then failed on Task Manager's mark (the mark key opened for writing, the write failed), the entry would stay while the setting is saved as off. Practically unreachable; not rolled back, since the entry could belong to another copy.
2. value_exists reads the value name every copy shares, so another copy's entry counts as there. It matters only after a failed removal.
3. Other save errors of the settings dialog (for example settings.json not writable) still show the backend's English text as a toast outside the open dialog, and whether NVDA reads that toast while the modal dialog is open is unchecked. Older than this task.
4. The test variable ships in the release exe, by the user's choice; it only makes changes of the setting fail and writes nothing.

## After the merge into develop (merge commit 07280ec)

- The tree of 07280ec is the same as that of the tested branch tip 603f49c.
- `npm run test:all` (513 frontend tests, 312 Rust tests, 1 ignored) and `npm run lint` pass on develop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Turning "Start with Windows" on or off can fail when a policy or security software blocks the autostart entries. save_settings ignored that: the dialog closed and the setting looked changed although Windows did not do it.

By the user's choice (question dialog): the setting keeps its previous value, in settings.json and in memory, so it always shows what Windows does; the other settings of the same save stay saved; the settings dialog stays open, the check box goes back to the kept value and gets the focus, and a live region under it says the message in en, uk or de, which NVDA reads. Cancel then no longer brings back the saved theme and language. Turning off counts as failed only while the autostart entry is still there. A hidden test variable, QUICK_SNIPPETS_TEST_AUTOSTART_ERROR, makes every change fail without touching the registry; just smoke uses it after its restart.

Verified: npm run test:all (513 frontend, 312 Rust) and npm run lint, on the branch and on develop; two mutation checks of the key frontend tests; just smoke on the release build 603f49c with the user's permission: 86 of 86 steps, 322 of 322 NVDA checks, the message read once at each of two refusals; the user's autostart values the same before and after (entry absent, old mark 02 00 00 00 00 00 00 00 00 00 00 00); build copied to real_db as quick-snippets-TASK-36-603f49c.exe.

Follow-ups for review: a plugin enable() that writes the entry and then fails on the mark is not rolled back (practically unreachable); other save errors of the settings dialog still appear as an English toast outside the dialog.
<!-- SECTION:FINAL_SUMMARY:END -->
