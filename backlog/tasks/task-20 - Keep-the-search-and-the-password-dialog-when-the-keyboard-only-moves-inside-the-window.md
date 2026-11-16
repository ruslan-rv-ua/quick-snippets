---
id: TASK-20
title: >-
  Keep the search and the password dialog when the keyboard only moves inside
  the window
status: To Do
assignee: []
created_date: '2026-11-16T21:47:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-3
dependencies: []
references:
  - src/hooks/useWindowHiding.ts
  - src/App.tsx
  - src-tauri/src/window_blur.rs
  - src-tauri/src/lib.rs
  - scripts/smoke-nvda.ps1
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the web content loses the keyboard, the frontend at once clears the search and closes the password dialog (the partial reset on blur in src/hooks/useWindowHiding.ts, which also turns off auto-type mode). Before TASK-18 this went together with hiding the window. Since TASK-18 (src-tauri/src/window_blur.rs) the window hides only after it has not been the foreground window for 200 ms, and while it is still the foreground window the keyboard is given back to the content. The frontend still reacts at once, though: when an action through UI Automation (screen readers, voice control, automation tools) moves the keyboard to an internal WebView2 window for a moment, the window stays open, but the typed search is gone and an open password dialog has closed. TASK-18 found this.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A change in existing code where the timing with the Rust side matters, checked with unit tests and just smoke.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When the keyboard only moves inside the window and the window stays the foreground window, the search text, the selection and an open password dialog stay as they were
- [ ] #2 When the window really hides because another window became active, the search is cleared and the password dialog closes, as today
- [ ] #3 Unit tests cover both cases, and just smoke has a step that moves the keyboard to the internal WebView2 window with a query typed and with the password dialog open, and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
