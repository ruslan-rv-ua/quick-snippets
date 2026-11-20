---
id: TASK-37
title: Quote the exe path in the autostart entry
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T01:27:00Z'
updated_date: '2026-11-20T16:31:00Z'
labels:
  - bug backend security model-sonnet effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/autostart.rs
  - src-tauri/src/commands.rs
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-31. tauri-plugin-autostart 2.5.1 (auto-launch 0.5.0) writes the autostart entry `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets` as the exe path followed by a space, without quotes. Windows usually still starts QuickSnippets from such a path, but when the path has spaces the command line is ambiguous: Windows first tries shorter names such as `C:\Program.exe` (the "unquoted path" weakness; low risk under HKEY_CURRENT_USER, since it needs a program planted in such a folder). Copies under Scoop (`C:\scoop\apps\...`) have no spaces in the path; portable copies may.

Options: rewrite the entry with quotes after the plugin's `enable()` (the `AutostartRegistry` trait in src-tauri/src/autostart.rs is the place for it), a plugin setting or a newer plugin version that quotes it, or writing both values without the plugin (TASK-31 kept the plugin for turning on, by the user's choice). Keep the TASK-31 rules: the registry changes only when the setting itself changes, turning off removes both values, and every copy uses the same value name, so tests and just smoke must leave the user's own values as they were. Present the options through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small registry change with care for the user's values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With Start with Windows on, the autostart entry holds the exe path in quotes, and that command line starts the right exe from a folder whose path has spaces (checked with a test copy)
- [x] #2 Turning the setting off still removes both values, and the registry still changes only when the setting itself changes
- [x] #3 Unit tests cover the written entry without touching the real registry; just smoke checks the quoted entry in its autostart steps
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
1. src-tauri/src/autostart.rs: the app writes both values itself (the user's choice). command_line(exe) gives the exe path in quotes and nothing after it, an error for an empty, non-Unicode or quoted path. Turning on: the Run entry (REG_SZ), then Task Manager's "enabled" mark only if its key exists; if the mark cannot be written, the entry is removed again and turning on fails. AutostartRegistry: write_string and write_binary_in_existing_key instead of enable; WindowsRegistry for the real registry; the in-memory registry keeps kind and data. Turning off and "only when the setting changes" unchanged; an old unquoted entry is left alone.
2. commands.rs: save_settings passes current_exe() to save_settings_inner; AppAutostart removed. lib.rs and Cargo.toml: tauri-plugin-autostart removed.
3. Unit tests with the in-memory registry for the exact string written, the mark, a missing mark key, a failing entry or mark, an unusable path, an unquoted old entry left alone by other saves and removed by turning off. Mutation check: an unquoted command_line must fail them.
4. scripts/smoke-nvda.ps1: the test copy in "...\test copy" with test.exe one folder up; step 39 checks the quoted entry exactly and creates a process from it, suspended, which must be the test copy, not test.exe. Checked first on its own in a scratch folder.
5. CHANGELOG [Unreleased] Fixed (including the old entry), CLAUDE.md, DEVELOPMENT.md.
6. npm run test:all, npm run lint, release build, just smoke (allowed in the question dialog) with the user's autostart values recorded before and compared after, copy to real_db, handover note.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The user's choice (question dialog, 2026-11-20, verbatim answers)

- "Як програмі записувати шлях до exe в лапках, коли ви вмикаєте «Запускати разом з Windows»? Новішої версії плагіна чи його налаштування, яке ставить лапки, немає: найновіші tauri-plugin-autostart 2.7.0 і auto-launch 0.6.0 теж пишуть без лапок. Автор auto-launch виправив це лише в коді, який ще не випустив." = "Писати самій (рекомендовано)" (the app itself writes both values, the entry already quoted and Task Manager's "enabled" mark; the plugin is removed from the app; this replaces the TASK-31 choice to keep the plugin for turning on).
- "Що робити зі старим записом автозапуску без лапок, який лишила попередня версія, коли «Запускати разом з Windows» увімкнено? Зараз у вашому реєстрі такого запису немає. Правило з TASK-31: реєстр змінюється лише тоді, коли змінюється сама галочка, бо всі копії програми пишуть значення з тією самою назвою." = "Лишити як є (рекомендовано)" (the app does not rewrite an old entry; turning the setting off and on once writes it with quotes; the changelog says so).
- "Що має статися, коли Windows не дає записати запис автозапуску в лапках, наприклад через політику чи захисну програму? Правило з TASK-36: після невдалої зміни галочка лишається як була, а діалог налаштувань про це каже." = "Невдале ввімкнення (рекомендовано)" (a failed turn-on: the check box stays off, the existing message, no new strings; anything written only in part is removed again, so that Windows does what the check box shows).
- "Можна наприкінці запустити just smoke на новій release-збірці? Він триває близько трьох хвилин і весь цей час забирає клавіатуру й мишу; раджу ввімкнути режим «Не турбувати»." = "Так, з перевіркою лапок (рекомендовано)" (permission for just smoke at the end; the test copy lies in a folder whose name has a space; the autostart steps check the quoted entry and that Windows picks the test copy from that command line, not a copy with a shorter name placed next to it; the process is created suspended and closed at once).

The other options offered: "Переписати після плагіна"; "Виправити під час запуску"; "Лишити без лапок мовчки"; "Без smoke".

## Investigation (2026-11-20)

- auto-launch 0.5.0 (src/windows.rs, used by tauri-plugin-autostart 2.5.1) writes the Run entry as `format!("{} {}", app_path, args.join(" "))`: the exe path and a space, no quotes. The plugin sets the path from `current_exe().display()` and has no setting for it. tauri-plugin-autostart 2.7.0 (latest 2.x, auto-launch ^0.6) and 3.0.0-alpha.3 do the same; auto-launch 0.6.0 (latest release) too. The unreleased main branch of auto-launch quotes the path (`build_command_line`), but it is not published.
- The frontend does not use the plugin (no npm package, no capability); only `AppAutostart::enable` in commands.rs and the registration in lib.rs.
- The user's values before the task (read only, 2026-11-20): `Run\QuickSnippets` absent; `StartupApproved\Run\QuickSnippets` Binary `02 00 00 00 00 00 00 00 00 00 00 00`.

## Cause

- tauri-plugin-autostart 2.5.1 sets the exe path from `current_exe().display()` and auto-launch 0.5.0 (src/windows.rs) writes the Run entry as `format!("{} {}", app_path, args.join(" "))`: the path and a space, no quotes, and the plugin has no setting for the path. With a space in the path the command line is ambiguous: CreateProcess, given no program name apart from the command line, tries the shorter names first (`...\test.exe` for `...\test copy\quick-snippets.exe`) and starts a program found there.

## What changed (commits 01a06f0, 3fcef3d)

- `src-tauri/src/autostart.rs`: the app writes both values itself (the user's choice). `command_line(exe)`: the exe path in quotes and nothing after it; an empty path, one that is not valid Unicode or holds a quote gives an error instead of an entry. `turn_on`: the Run entry (REG_SZ, `RegSetKeyValueW`), then Task Manager's "enabled" mark `MARK_ENABLED` (REG_BINARY, `RegOpenKeyExW` with KEY_SET_VALUE + `RegSetValueExW`) only if `StartupApproved\Run` exists, as the plugin did; if the mark cannot be written, the entry just written is removed again and turning on fails (the existing TASK-36 message, no new strings). The trait `AutostartRegistry` has `write_string` and `write_binary_in_existing_key` instead of `enable`; `WindowsRegistry` is the real registry (the helpers are now private). The in-memory registry (`memory`) keeps kind and data (`Value::String`/`Value::Binary`), has `missing_key`, and its `failing_key` also makes writes fail; `failing_enable` is gone. Turning off, "only when the setting changes" and the refusing test registry are as before. An unquoted entry of 0.3.4 or older is left alone (the user's choice); turning off removes it like any other.
- `src-tauri/src/commands.rs`: `save_settings_inner(..., name, exe)`; `save_settings` passes `std::env::current_exe().unwrap_or_default()` (an unknown path makes turning on fail). `AppAutostart` removed.
- `src-tauri/src/lib.rs`, `Cargo.toml`: tauri-plugin-autostart removed; Cargo.lock drops auto-launch, dirs, dirs-sys, redox_users, tauri-plugin-autostart, winreg.
- `scripts/smoke-nvda.ps1`: the test copy lies in `%TEMP%\quick-snippets-smoke-<time>\test copy\` with a second copy of the exe, `test.exe`, one folder up; step 39 checks that the Run entry is exactly `"<test exe>"` as String, then `[QsSmokeNative]::ExeOfCommandLine` creates a process from that entry with CreateProcess (no application name), suspended, reads its image path with QueryFullProcessImageName and ends it before it runs: it must be the test copy, not test.exe. The cleanup removes the whole folder. Still 86 steps.
- CHANGELOG [Unreleased] Fixed (the quotes; an old entry is left alone, turn the setting off and on once), CLAUDE.md (autostart.rs row), DEVELOPMENT.md (smoke section, exe size section).

## Checks

- On the branch: `npm run test:all` passes: 513 frontend tests (unchanged) and 321 Rust tests (was 312; 1 ignored, as before). `npm run lint` passes. autostart.rs has 24 tests (was 15): the exact quoted string written as REG_SZ for a path with spaces, quotes also without spaces and nothing after the path, an empty, quoted or non-Unicode path gives no entry, the "enabled" mark as REG_BINARY, a missing Task Manager key writes only the entry, a failing entry write leaves nothing, a failing mark write takes the entry back (an old "Disabled" mark stays), turning on replaces an unquoted entry and a "Disabled" mark, turning off removes an unquoted entry, saves with the setting unchanged leave an unquoted entry and a "Disabled" mark as they are, the RegOpenKeyExW status mapping. commands.rs: save_settings_inner writes the quoted path; the refused turn-on now fails on the entry write.
- Mutation check: with `command_line` returning the path and a space (the plugin's format), 4 autostart tests and the commands.rs turn-on test fail; restored byte for byte.
- `cargo clippy --all-targets`: only the old findings in test code (TASK-34); none in the new code. rustfmt applied to autostart.rs only (the other files have older format differences).
- The suspended-start helper of the smoke script, on its own in Windows PowerShell 5.1, in a scratch folder (no registry): for `"...\test copy\quick-snippets.exe"` Windows took the test copy, for the plugin's format `...\test copy\quick-snippets.exe ` it took `...\test.exe` one folder up; no process left, folder removed. The changed script parses in Windows PowerShell 5.1 and keeps its BOM and CRLF.
- Release build of 3c8ab57 (code as in 01a06f0, script as in 3fcef3d): 3,862,528 bytes (TASK-36: 3,868,160).
- `just smoke`, first run with the user's permission (18:23 to 18:24): stopped at step 17 "Shift+Enter друкує сніпет в інше вікно": Ctrl+A and Delete in the script's own test window did not empty its field within 3 s (the keys did not reach that window), so steps 18 to 86, the autostart steps among them, were skipped; 16 steps OK, 54 of 54 NVDA checks OK. The step does not depend on the test copy's folder or on autostart and had not failed so before; not investigated further. One line of captured speech (step 8) held a notification of another program: masked in the report unread, the scratch copy of the output deleted.
- `just smoke`, second run with the user's permission (question dialog: "Так, ще раз (рекомендовано)"; 18:26:47 to 18:29:39, about 172 s): 86 of 86 steps, 322 of 322 NVDA checks, exit code 0. Step 39: entry `"C:\Temp\quick-snippets-smoke-20261120-182647\test copy\quick-snippets.exe"` (String), and Windows takes `C:\Temp\quick-snippets-smoke-20261120-182647\test copy\quick-snippets.exe` from it, not test.exe; mark "enabled". Step 40 (theme saves leave Task Manager's "Disabled") and step 41 (off: both values gone) OK. Steps 82 to 85 (refused turn-on message) OK. One line of captured speech (step 6) held a notification: masked unread, scratch output deleted.
- The user's autostart values: the smoke reports say before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", after restoring "as before" (both runs). My own read-only reads at 18:23:29, 18:25:45, 18:26:38 and 18:30:00: `Run\QuickSnippets` absent, `StartupApproved\Run\QuickSnippets` Binary 02 00 00 00 00 00 00 00 00 00 00 00 every time. No QuickSnippets process and no smoke folder left after either run.
- Copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-37-3c8ab57.exe`, SHA-256 E3AA235232541C4FCBAF7C47F0AD5A129EEEAC475609C67BE2F827A02BB4D3D7, the same as the build.
- `just smoke-tray` not run: nothing changed in how the window is created, started in the tray or shown.
- Not checked: a real sign-in with the entry (Explorer reading the Run key at logon). The smoke check uses CreateProcess's reading of a command line, the documented way the unquoted path is ambiguous.

Definition of Done #4: the task adds no strings (src/i18n/translations.ts unchanged); a failed write uses the TASK-36 message.

## Noticed, no task created

1. The first smoke run failed at step 17 (Ctrl+A and Delete did not reach the script's test window). Not seen before; the second run passed. Possibly a one-off (a notification arrived in the same run).
2. A Windows notification was read by NVDA in each run (steps 8 and 6), although the user was advised to turn on Do Not Disturb.

## After the merge into develop (merge commit 245b6f9)

- The tree of 245b6f9 is the same as that of the tested branch tip f5e20c9 (the build 3c8ab57 differs from it only in the Backlog notes).
- `npm run test:all` (513 frontend tests, 321 Rust tests, 1 ignored) and `npm run lint` pass on develop.
- The merge commit has git flow's default message, as the earlier feature merges (07280ec). Nothing pushed; develop is 5 commits ahead of origin/develop.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tauri's autostart plugin (tauri-plugin-autostart 2.5.1 / auto-launch 0.5.0) wrote the autostart entry as the exe path and a space, without quotes. With a space in the path, Windows reads such a command line by trying shorter names first (C:\Portable.exe for C:\Portable Apps\...) and would start a program found there. No released version of the plugin quotes the path.

By the user's choice (question dialog, all recommended options): the app now writes both values itself, the Run entry as the exe path in quotes and nothing after it (REG_SZ) and Task Manager's "enabled" mark (only where its key exists), and the plugin is removed (six crates fewer, exe 5.6 KB smaller). A write Windows refuses, of the entry or the mark, is a failed turn-on: the entry just written is removed again, the setting stays off and the existing message says so (no new strings). An unquoted entry left by 0.3.4 or older is not rewritten (the registry changes only when the setting changes); turning the setting off and on once rewrites it, as the CHANGELOG says. Turning off still removes both values.

Verified: npm run test:all (513 frontend, 321 Rust) and npm run lint on the branch and on develop; in-memory registry tests check the exact string written, and a mutation to the plugin's format fails them; just smoke on the release build 3c8ab57 with the user's permission: the first run stopped at step 17 (keys did not reach the script's test window, unrelated), the second passed 86 of 86 steps and 322 of 322 NVDA checks, with step 39 finding the quoted entry of the test copy in a folder with a space and Windows taking the test copy from it, not the test.exe placed one folder up; the user's autostart values were the same before and after both runs (entry absent, old mark 02 00 00 00 00 00 00 00 00 00 00 00); build copied to real_db as quick-snippets-TASK-37-3c8ab57.exe.

Follow-ups for review: a real sign-in with the quoted entry was not tried (the check uses CreateProcess's reading of the command line); the one-off step 17 failure of the first smoke run; NVDA read a Windows notification in both runs.
<!-- SECTION:FINAL_SUMMARY:END -->
