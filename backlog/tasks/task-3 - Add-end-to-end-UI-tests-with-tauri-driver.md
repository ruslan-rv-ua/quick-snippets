---
id: TASK-3
title: Decide whether to add end-to-end UI tests with tauri-driver
status: To Do
assignee: []
created_date: '2026-11-15T19:12:00Z'
updated_date: '2026-11-15T23:33:00Z'
labels:
  - testing
  - accessibility
  - investigation
  - model-opus
  - effort-high
milestone: m-2
dependencies:
  - TASK-4
references:
  - https://v2.tauri.app/develop/tests/webdriver/
  - scripts/smoke-nvda.ps1
  - .github/workflows/ci.yml
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Changes to Tauri capabilities, plugins or build settings (for example removeUnusedCommands) can break features that unit tests do not see, because Vitest mocks all Tauri APIs. `just smoke` (scripts/smoke-nvda.ps1) now covers most flows on the real exe with NVDA, but it needs the user to keep hands off the keyboard and cannot run in CI. This task decides whether tauri-driver end-to-end tests are worth adding on top of it; TASK-6 builds them only if the answer is go.

Research: whether tauri-driver works here (msedgedriver must match the installed WebView2 runtime, on the developer machine and on windows-latest), what WebDriver cannot reach (the global hotkey, the tray, autotype into another window), and whether accessible names and focus can be checked through it. Ask the user before any run that opens windows or sends keys on their desktop.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). A short research task that ends in a judgment call; the stronger model pays off here, and the build itself (TASK-6) can then run on a cheaper one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Findings are recorded in the task notes: whether tauri-driver works on Windows here and on windows-latest in CI, with the msedgedriver and WebView2 versions checked
- [ ] #2 Findings say what WebDriver cannot reach (global hotkey, tray, autotype) and whether accessible names and focus can be checked through it
- [ ] #3 A go or no-go decision with reasons is recorded; on go TASK-6 is updated with the findings, on no-go TASK-6 is archived
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
