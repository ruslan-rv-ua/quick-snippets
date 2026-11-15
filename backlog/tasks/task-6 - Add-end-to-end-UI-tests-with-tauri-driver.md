---
id: TASK-6
title: Add end-to-end UI tests with tauri-driver
status: To Do
assignee: []
created_date: '2026-11-15T23:33:00Z'
updated_date: '2026-11-15T23:33:00Z'
labels:
  - testing
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-2
dependencies:
  - TASK-3
  - TASK-1
references:
  - https://v2.tauri.app/develop/tests/webdriver/
  - scripts/smoke-nvda.ps1
  - .github/workflows/ci.yml
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the tauri-driver end-to-end suite if TASK-3 decides go, following the findings recorded there. Changes to Tauri capabilities, plugins or build settings can break features that unit tests do not see, because Vitest mocks all Tauri APIs, and `just smoke` cannot run in CI. The author uses the NVDA screen reader, so the tests should also protect accessibility: focus moves, accessible names and live announcements. Ask the user before any run that opens windows or sends keys on their desktop.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Test infrastructure with a clear spec from TASK-3: everyday coding where verification matters.
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
