---
id: TASK-11
title: Keep the theme chosen with Ctrl+Shift+T after a restart
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T00:38:00Z'
updated_date: '2026-11-16T12:46:00Z'
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
- [x] #1 After Ctrl+Shift+T, the chosen theme is still in use after the app restarts
- [x] #2 Saving the theme leaves every other setting unchanged, including sort order, language and window position
- [x] #3 In the settings dialog, a theme change is still saved only by Save
- [x] #4 Unit tests cover the save on Ctrl+Shift+T and that the other settings are kept
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add updateSettings(patch) to src/hooks/useIpc.ts: read settings, merge the patch, save; calls run one after another so quick presses do not overwrite each other.
2. ThemeContext: add setTheme(t) that only applies the theme (for the settings dialog preview); toggleTheme (Ctrl+Shift+T) applies and saves through updateSettings({ theme }).
3. SettingsModal uses setTheme, so the dialog still saves the theme only with Save.
4. handleSort in App.tsx uses updateSettings too, so sort and theme saves cannot race.
5. Unit tests: toggleTheme saves and keeps other settings; setTheme does not save; dialog theme buttons do not save; updateSettings serialises calls.
6. CHANGELOG [Unreleased] Fixed entry. test:all and lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation:
- src/hooks/useIpc.ts: new updateSettings(patch) reads the saved settings, merges only the given fields and saves. Calls are chained on one promise queue, so quick updates cannot read the same old settings and overwrite each other; a failed update rejects but does not block the next one.
- ThemeContext: toggleTheme (Ctrl+Shift+T) applies the theme and calls updateSettings({ theme }). New setTheme(t) only applies the theme, without saving. toggleTheme reads the current theme from the html class rather than inside a state updater, so React StrictMode cannot save twice.
- SettingsModal theme buttons now call setTheme, so the dialog still saves the theme only with Save. TASK-9 can use setTheme to restore the theme on Cancel.
- handleSort in App.tsx now uses updateSettings too, so a theme save and a sort save cannot undo each other.
- save_settings in Rust still writes the current window position, as before; that is the real position, not a change to it.

Verification:
- New tests: ThemeContext (toggle saves and keeps every other field, two quick toggles end with the right saved theme, setTheme does not save), useIpc updateSettings (keeps other fields, serialises, recovers after a failure), SettingsModal (theme buttons do not save, Save stores the dialog theme).
- Startup already reads the theme from get_settings (existing ThemeContext tests) and the Rust settings round trip is covered by settings.rs tests.
- npm run test:all: 23 files / 328 frontend tests and 213 Rust tests pass. npm run lint passes.
- Not done: a manual check in the built app (press Ctrl+Shift+T, restart). It needs simulated keys.
- No focus, dialog structure or announcement changes, so just smoke was not needed. No new user-facing strings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ctrl+Shift+T now saves the chosen theme, so it stays after a restart. A new updateSettings helper changes only the given settings fields and runs updates one after another; the theme shortcut and the sort shortcuts both use it, so other settings are kept and quick shortcuts cannot undo each other. The theme context gained setTheme, which shows a theme without saving; the settings dialog uses it, so there the theme is still saved only by Save (TASK-9 can use it to restore the theme on Cancel). Unit tests cover the save, the kept fields, quick repeated presses and the dialog. npm run test:all and npm run lint pass. Not checked by hand in the built app.
<!-- SECTION:FINAL_SUMMARY:END -->
