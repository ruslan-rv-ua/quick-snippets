---
id: TASK-37
title: Quote the exe path in the autostart entry
status: To Do
assignee: []
created_date: '2026-11-20T01:27:00Z'
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
