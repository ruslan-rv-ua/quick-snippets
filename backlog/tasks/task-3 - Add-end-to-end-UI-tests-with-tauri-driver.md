---
id: TASK-3
title: Add end-to-end UI tests with tauri-driver
status: To Do
assignee: []
created_date: '2026-11-15T19:12:00Z'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One command (npm script and just recipe) builds the app and runs the E2E suite locally
- [ ] #2 Tests cover: create snippet, search, copy to clipboard (Enter), encrypted snippet with password prompt, edit, delete, settings save
- [ ] #3 Tests check accessible names of the main controls and that focus lands in the right field after each modal opens and closes
- [ ] #4 Tests run against an isolated data folder and never touch the real quick-snippets-data
- [ ] #5 CI runs the suite on windows-latest
- [ ] #6 DEVELOPMENT.md explains how to run and extend the suite
<!-- AC:END -->
