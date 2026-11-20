---
id: TASK-36
title: Tell the user when Start with Windows cannot be changed
status: To Do
assignee: []
created_date: '2026-11-20T01:27:00Z'
labels:
  - bug backend frontend accessibility model-sonnet effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/commands.rs
  - src-tauri/src/autostart.rs
  - src/i18n/translations.ts
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-31. Turning "Start with Windows" on or off can fail in the registry (for example access denied, or a policy that locks the autostart keys). `apply_autostart` in src-tauri/src/commands.rs ignores that error, as before TASK-31: the setting is saved as changed and the settings dialog closes as if it had worked, so the user does not learn that Windows will (or will not) start QuickSnippets. `crate::autostart::apply_change` already returns the first error, and turning off tries both removals.

Tell the user in the language of the app (en, uk, de), in a way NVDA reads, and decide with the user what the setting shows after such a failure: the old value or the new one. Test with the in-memory registry of src-tauri/src/autostart.rs, never by breaking the real registry: every copy of QuickSnippets uses the same value names, so the user's own autostart values must stay as they are. Present the solutions through the question dialog before changing code.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). An error path from the backend to an announced message.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When turning Start with Windows on or off fails, the user gets a message in the language of the app that NVDA reads
- [ ] #2 The user chose through the question dialog what the setting shows after such a failure, and the app does that
- [ ] #3 Tests cover a failing turn-on and a failing turn-off without touching the real registry
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
