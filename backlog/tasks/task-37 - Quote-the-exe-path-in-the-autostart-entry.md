---
id: TASK-37
title: Quote the exe path in the autostart entry
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-20T01:27:00Z'
updated_date: '2026-11-20T16:22:00Z'
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
- [ ] #1 With Start with Windows on, the autostart entry holds the exe path in quotes, and that command line starts the right exe from a folder whose path has spaces (checked with a test copy)
- [ ] #2 Turning the setting off still removes both values, and the registry still changes only when the setting itself changes
- [ ] #3 Unit tests cover the written entry without touching the real registry; just smoke checks the quoted entry in its autostart steps
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
<!-- SECTION:NOTES:END -->
