---
id: TASK-13
title: Detect German for the tray menu when the language follows Windows
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-16T13:48:00Z'
updated_date: '2026-11-16T14:23:00Z'
labels:
  - bug
  - backend
  - model-sonnet
  - effort-medium
milestone: m-1
dependencies: []
references:
  - src-tauri/src/settings.rs
  - src-tauri/src/lib.rs
  - src/contexts/LanguageContext.tsx
priority: low
ordinal: 3400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With the language set to "Same as Windows" (an empty language in settings.json), the window and the tray menu detect the language separately. The window knows English, Ukrainian and German, but detect_language in src-tauri/src/settings.rs returns "uk" for Ukrainian locales and "en" for everything else. On a German Windows the window is therefore German and the tray menu English, although the German tray labels already exist in src-tauri/src/lib.rs. TASK-9 found this while reworking the settings dialog.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small fix in existing Rust code with unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With the language set to "Same as Windows" on a German Windows locale, the tray menu is German, like the window
- [ ] #2 For any Windows locale, the tray menu and the window use the same language when the language follows Windows
- [ ] #3 Rust tests cover German, Ukrainian, English and an unsupported locale
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. settings.rs: pure language_from_locale (uk, de, else en); detect_language reads the Windows display language (GetUserPreferredUILanguages) instead of the regional format.
2. New command get_system_language; the window asks it for "Same as Windows" instead of using navigator.language, so window and tray use one function.
3. Rust tests for de, uk, en and unsupported locales; frontend tests for the new source.
4. CHANGELOG, test:all, lint, release build to real_db.
<!-- SECTION:PLAN:END -->
