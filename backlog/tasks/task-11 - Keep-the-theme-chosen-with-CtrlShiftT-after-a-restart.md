---
id: TASK-11
title: Keep the theme chosen with Ctrl+Shift+T after a restart
status: To Do
assignee: []
created_date: '2026-11-16T00:38:00Z'
labels:
  - bug
  - frontend
  - model-sonnet
  - effort-medium
milestone: m-1
dependencies: []
references:
  - src/contexts/ThemeContext.tsx
  - src/contexts/__tests__/ThemeContext.test.tsx
  - src/hooks/useKeyboard.ts
  - src/App.tsx
  - src/components/SettingsModal.tsx
  - README.md
priority: medium
ordinal: 3100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ctrl+Shift+T switches between the light and dark theme, and the README (en, uk, de) offers it as one of the two ways to choose the theme ("switch with a single shortcut or from Settings"). But the shortcut changes the theme only for the current session: nothing saves it, so the next start brings back the old theme, unless the user happened to open Settings and press Save in between. The sort shortcuts (Ctrl+Shift+1 to 4) already save their choice (handleSort in src/App.tsx).

Related: TASK-9 reworks the settings dialog after this fix and makes Cancel restore the theme as it was when the dialog opened, so it builds on how this task saves the theme.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small fix in existing code, covered by unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After Ctrl+Shift+T, the chosen theme is still in use after the app restarts
- [ ] #2 Saving the theme leaves every other setting unchanged, including sort order, language and window position
- [ ] #3 In the settings dialog, a theme change is still saved only by Save
- [ ] #4 Unit tests cover the save on Ctrl+Shift+T and that the other settings are kept
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
