---
id: TASK-31
title: Remove the Task Manager mark when autostart is turned off
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T19:03:00Z'
updated_date: '2026-11-20T01:18:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-medium
milestone: m-6
dependencies: []
references:
  - src-tauri/src/commands.rs
  - scripts/smoke-nvda.ps1
  - README.md
priority: low
ordinal: 3500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-27. With "Start with Windows" on, tauri-plugin-autostart (auto-launch 0.5.0) writes two values under HKCU: the autostart entry `Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets` (the path to the exe) and an "enabled" mark for Task Manager, `Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run\QuickSnippets` (REG_BINARY). Turning the setting off (`apply_autostart` in src-tauri/src/commands.rs calls the plugin's `disable()`) deletes only the Run value, so the mark stays in the registry for good. Windows ignores a mark without its entry, so nothing breaks, but it is a trace the app leaves on every computer where autostart was ever on, and the READMEs (en, uk, de) have had to say so since TASK-27.

Every copy of QuickSnippets uses the same value name, QuickSnippets, so a test copy can meet the values of the user's installed copy: just smoke already skips its autostart steps when the user's own Run entry exists, and any new check must leave the user's values alone in the same way.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small registry change in Rust and a smoke check; the care is in touching only the app's own values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Turning "Start with Windows" off removes both values named QuickSnippets under HKCU: the Run entry and the StartupApproved\Run mark
- [x] #2 Turning it on still writes both, so Task Manager lists QuickSnippets as enabled
- [x] #3 just smoke checks both values in its autostart steps (still skipped when the user's own autostart entry exists) and passes; run only with the user's permission
- [x] #4 README (en, uk, de) no longer says that the mark stays after turning autostart off
- [x] #5 Saving other settings (theme, sort order, or the settings dialog with "Start with Windows" unchanged) leaves both values as they are
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
1. New module src-tauri/src/autostart.rs with the logic of a change of "Start with Windows": nothing happens when the setting did not change; on -> the plugin's enable() as before (Run entry and Task Manager's "enabled" mark); off -> the app itself removes both HKCU values named after the app, `Software\Microsoft\Windows\CurrentVersion\Run` and `...\Explorer\StartupApproved\Run` (RegDeleteKeyValueW; a missing value or key counts as removed; the mark is removed also when the entry is already gone).
2. commands.rs save_settings: write settings.json, then compare with the settings in memory, so the registry changes only when "Start with Windows" changes. The value name comes from package_info().name, the same the plugin uses.
3. Unit tests with an in-memory registry (no real registry).
4. scripts/smoke-nvda.ps1: the autostart steps check both values; a new step between them sets the mark to Task Manager's "Disabled" and checks that two theme saves leave both values alone; both values are recorded at the start and restored exactly at the end, with the state before, at the end and after restoring in the report; with the autostart steps skipped, any change of the user's values fails the run.
5. README (en, uk, de), CHANGELOG [Unreleased] Fixed, CLAUDE.md, DEVELOPMENT.md.
6. npm run test:all, npm run lint, release build, just smoke with the user's permission (the two values recorded before, restored and compared after), copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-20)

- tauri-plugin-autostart 2.5.1 uses auto-launch 0.5.0. Its `enable()` writes `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets` (REG_SZ, the exe path followed by a space) and `HKCU\...\Explorer\StartupApproved\Run\QuickSnippets` (REG_BINARY `02 00 00 00 00 00 00 00 00 00 00 00`, "enabled"). Its `disable()` deletes only the Run value and fails when it is missing. The newer auto-launch 0.6.0 and tauri-plugin-autostart 3.0.0-alpha.3 (Tauri 3) still leave the mark, so an upgrade does not help.
- The value name is `package_info().name` = productName "QuickSnippets", the same for every copy.
- `save_settings` called `apply_autostart` on every save, not only when "Start with Windows" changed: the theme (Ctrl+Shift+T), the sort order and every save of the settings dialog. So a copy with autostart off deleted the Run entry of any other copy (for example the user's installed one) whenever it saved its settings; a copy with autostart on pointed the entry at itself and overwrote Task Manager's "disabled" mark with "enabled".
- just smoke therefore did not really protect the user's entry: it skipped its autostart steps when the user's Run entry existed, but the test copy (autostart off) deleted that entry at its first settings save, and the script did not put it back.

## The user's choice (question dialog, 2026-11-20, verbatim answers)

- How to remove the Task Manager mark: "Доповнити плагін (рекомендовано)" (turning off: the app itself removes both values, also when the Run entry is already gone; turning on stays with the plugin as before).
- When the app changes the autostart values: "Лише при зміні галочки (рекомендовано)" (only when "Start with Windows" changes; a mark left by an older version goes away when the setting is turned on and off once). Added as acceptance criterion #5.

## The user's autostart values before the task (read only, 2026-11-20)

- `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets`: absent.
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run\QuickSnippets`: REG_BINARY `02 00 00 00 00 00 00 00 00 00 00 00` (probably left by earlier just smoke runs or an earlier autostart).

## What changed (commits c8ac8dd and dd93519)

- `src-tauri/src/autostart.rs` (new): `RUN_KEY`, `TASK_MANAGER_MARK_KEY`, the trait `AutostartRegistry` (`enable`, `remove_value`), `apply_change(registry, name, was_on, now_on)` (nothing when unchanged; on -> `enable()`; off -> `remove_entry_and_mark`), `remove_entry_and_mark` (both removals are always tried, the first error is returned), `remove_current_user_value` (`RegDeleteKeyValueW` on HKEY_CURRENT_USER; `ERROR_FILE_NOT_FOUND` counts as removed). 9 tests: 7 with an in-memory registry (on writes both; off removes both; off removes a mark left without its entry; the mark goes even when the entry cannot be removed; a mark that cannot be removed is reported; only values of this name; on->on and off->off touch nothing) and 2 on the mapping of Windows status codes. No test touches the real registry.
- `src-tauri/src/commands.rs`: `AppAutostart` (the plugin's `enable()`, the app's own removal), `apply_autostart(was_on, now_on, app)` with the name from `package_info().name`; `save_settings` writes settings.json, swaps the settings in memory and only then applies a change of `autostart`. Before, it applied the setting at every save and before writing the file. The plugin's `disable()` is no longer used.
- `src-tauri/Cargo.toml`: windows-sys feature `Win32_System_Registry`.
- `scripts/smoke-nvda.ps1`: `Get-AutostartMark`, `Format-Bytes`, `Get-AutostartValue`/`Get-AutostartState` (kind and data of both values), `Restore-AutostartState`. Step 39 also waits for the mark `02 00 00 00 00 00 00 00 00 00 00 00`; new step 40 writes Task Manager's "Disabled" (`03 00 00 00` + FILETIME), saves the theme twice (Ctrl+Shift+T) and checks that the entry and the mark are unchanged; step 41 waits until both values are gone. The finally block reads both values, restores the ones from before the run exactly and reads them again; the report shows "before", "at the end" and whether they were restored. A failed restore, or changed values while the autostart steps were skipped, makes the run fail (exit 1). The old cleanup removed only an entry that pointed at the test exe.
- README (en, uk, de): turning the setting off removes both values; the registry changes only when the setting is turned on or off. CHANGELOG [Unreleased] Fixed: two entries (the mark; other settings no longer touch autostart, with the multi-copy and Task Manager effects). CLAUDE.md: `autostart.rs` row, the Portable note. DEVELOPMENT.md: how just smoke handles the autostart values.

## Checks

- `npm run test:all`: 496 frontend tests and 299 Rust tests pass (was 290; 1 ignored, as before). `npm run lint` passes.
- The smoke helpers, in Windows PowerShell 5.1 on a scratch key of their own (`HKCU\Software\QsSmokeHelperTest-<guid>`, removed afterwards; the real autostart values were not read or written by this check): 22 of 22 (both absent, String with the plugin's trailing space, Binary "Disabled" with its time, ExpandString kept unexpanded, a restore over overwritten values, a missing key).
- Release build of dd93519 (code as in c8ac8dd), 3,864,576 bytes.
- `just smoke` with the user's permission (2026-11-20 03:11-03:14, 172 s): 82 of 82 steps, 301 of 301 NVDA checks, exit code 0. Step 39 (on: entry pointing at the test exe and the "enabled" mark), step 40 (two theme saves leave Task Manager's "Disabled" mark and the entry as they were), step 41 (off: both values gone) all OK. Report: before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", at the end "entry absent; mark absent", after restoring "as before". 2 errors in the NVDA log during the run, the first the known `script_caret_newLine` of NVDA itself (TASK-28 saw one).
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-31-dd93519.exe`, SHA-256 F717535CA7490784C56E2D21E5C3EB6B6CE0FCAA16E80A9282091D0B3BA6B71D, the same as the build.

## The user's autostart values after the task

- Recorded again right before just smoke (03:11:40) with a scratchpad script: Run entry absent; StartupApproved\Run mark Binary `02 00 00 00 00 00 00 00 00 00 00 00`, the same as at the start of the task.
- After the run (compared by the same script, independently of the smoke's own restore): exactly the same, kind and data. The leftover mark stays as the user had it; turning autostart on and off once in 0.3.4 would remove it.

Definition of Done #4: the task adds no strings to the interface (src/i18n/translations.ts unchanged); the user-facing texts it changes are the READMEs, in en, uk and de.

## After the merge into develop (merge commit 805d84d)

- `npm run test:rust` (299 passed, 1 ignored) and `npm run lint` pass on develop.
- `npm run test`: the frontend suite failed once in the first run on develop and once in four more runs, each time on the same test, `src/components/__tests__/App.test.tsx` > "App: where the screen reader is" > "when a search keeps the same snippet selected, the live region says it" (`expected '' to be 'Greeting'`; it waits for the announcement with waitFor's default 1 s, after the 100 ms search debounce). The other 5 runs passed with 496 of 496, and both runs on the branch passed. src/ is byte for byte the same as before this task (`git diff 11ffa3c develop -- src` is empty), so this flakiness is older than TASK-31. Not fixed here; no task created.

## Noticed, no task created

1. The plugin writes the exe path into the Run entry without quotes (the path and a space). Windows usually still starts it from a path with spaces, but such an entry is ambiguous. The option "own code instead of the plugin" would have fixed it; the user chose to complement the plugin.
2. A consequence of "only when the setting changes": if the box is checked but the entry is gone (removed by another copy or by the user) or points to an old place after the folder was moved, a later save no longer rewrites it silently. Turning the setting off and on does; the README already says so for a move.
3. Registry errors while turning autostart on or off are still ignored silently: the setting is saved, and the user is not told that the registry write failed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Turning off "Start with Windows" now removes both HKCU values named QuickSnippets: the Run entry and Task Manager's Explorer\StartupApproved\Run mark (tauri-plugin-autostart's disable() removed only the entry, so the mark stayed for good). By the user's choice the registry now changes only when the setting itself changes: saving the theme, the sort order or the settings dialog no longer removes another copy's entry, points the entry at the saving copy, or undoes Task Manager's "Disabled". Turning on still uses the plugin's enable(), which writes both.

New module src-tauri/src/autostart.rs with 9 unit tests on an in-memory registry; save_settings applies a change after writing settings.json. just smoke checks both values, a new step checks that two theme saves leave a "Disabled" mark alone, and the script records the user's two values before every run and restores them exactly afterwards. README (en, uk, de), CHANGELOG, CLAUDE.md and DEVELOPMENT.md updated.

Verified: npm run test:all and npm run lint; just smoke on the release build dd93519 with the user's permission, 82 of 82 steps and 301 of 301 NVDA checks; the user's autostart values were the same before and after (Run entry absent, an old mark 02 00 00 00 00 00 00 00 00 00 00 00); build copied to real_db as quick-snippets-TASK-31-dd93519.exe.

Follow-ups for review: a mark left by 0.3.3 or older stays until the setting is turned on and off once; a checked box no longer rewrites a missing or moved entry at the next save; the Run entry path is unquoted (plugin); a pre-existing flaky frontend test (App.test.tsx, "the live region says it") failed in 2 of 9 runs.
<!-- SECTION:FINAL_SUMMARY:END -->
