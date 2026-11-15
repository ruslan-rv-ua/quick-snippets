---
id: TASK-3
title: Add end-to-end UI tests with tauri-driver
status: To Do
assignee: []
created_date: '2026-11-15T19:12:00Z'
updated_date: '2026-11-15T23:18:00Z'
labels:
  - testing accessibility
dependencies: []
references:
  - https://v2.tauri.app/develop/tests/webdriver/
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Changes to Tauri capabilities, plugins or build settings (for example removeUnusedCommands) can break features that unit tests do not see, because Vitest mocks all Tauri APIs. Today the only check is a manual run of the release exe, which is slow and easy to skip. The author uses the NVDA screen reader, so the tests should also protect accessibility: focus moves, accessible names and live announcements. tauri-driver (official Tauri WebDriver bridge) works on Windows with msedgedriver.

Since this task was written, `just smoke` (scripts/smoke-nvda.ps1) covers most of these flows on the real exe with NVDA, but it needs the user to keep hands off the keyboard and cannot run in CI. So start with research: whether tauri-driver works here (msedgedriver must match the installed WebView2 runtime, on the developer machine and on windows-latest), what WebDriver cannot reach (the global hotkey, the tray, autotype into another window), and whether accessible names and focus can be checked through it. Decide what the suite would add beyond just smoke, mainly coverage in CI, or whether the task should be dropped. Ask the user before any run that opens windows or sends keys on their desktop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research findings are recorded in the task notes before building anything: whether tauri-driver works here on Windows and in CI, what the suite would add beyond just smoke, and a go or no-go decision (no-go closes the task)
- [ ] #2 One command (npm script and just recipe) builds the app and runs the E2E suite locally
- [ ] #3 Tests cover: create snippet, search, copy to clipboard (Enter), encrypted snippet with password prompt, edit, delete, settings save
- [ ] #4 Tests check accessible names of the main controls and that focus lands in the right field after each modal opens and closes
- [ ] #5 Tests run against an isolated data folder and never touch the real quick-snippets-data
- [ ] #6 CI runs the suite on windows-latest
- [ ] #7 DEVELOPMENT.md explains how to run and extend the suite
<!-- AC:END -->
