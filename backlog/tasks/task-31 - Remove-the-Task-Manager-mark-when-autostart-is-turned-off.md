---
id: TASK-31
title: Remove the Task Manager mark when autostart is turned off
status: To Do
assignee: []
created_date: '2026-11-19T19:03:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-medium
dependencies: []
references:
  - src-tauri/src/commands.rs
  - scripts/smoke-nvda.ps1
  - README.md
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-27. With "Start with Windows" on, tauri-plugin-autostart (auto-launch 0.5.0) writes two values under HKCU: the autostart entry `Software\Microsoft\Windows\CurrentVersion\Run\QuickSnippets` (the path to the exe) and an "enabled" mark for Task Manager, `Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run\QuickSnippets` (REG_BINARY). Turning the setting off (`apply_autostart` in src-tauri/src/commands.rs calls the plugin's `disable()`) deletes only the Run value, so the mark stays in the registry for good. Windows ignores a mark without its entry, so nothing breaks, but it is a trace the app leaves on every computer where autostart was ever on, and the READMEs (en, uk, de) have had to say so since TASK-27.

Every copy of QuickSnippets uses the same value name, QuickSnippets, so a test copy can meet the values of the user's installed copy: just smoke already skips its autostart steps when the user's own Run entry exists, and any new check must leave the user's values alone in the same way.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small registry change in Rust and a smoke check; the care is in touching only the app's own values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Turning "Start with Windows" off removes both values named QuickSnippets under HKCU: the Run entry and the StartupApproved\Run mark
- [ ] #2 Turning it on still writes both, so Task Manager lists QuickSnippets as enabled
- [ ] #3 just smoke checks both values in its autostart steps (still skipped when the user's own autostart entry exists) and passes; run only with the user's permission
- [ ] #4 README (en, uk, de) no longer says that the mark stays after turning autostart off
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
