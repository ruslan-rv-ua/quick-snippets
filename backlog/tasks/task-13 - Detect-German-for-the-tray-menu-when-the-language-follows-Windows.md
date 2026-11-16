---
id: TASK-13
title: Detect German for the tray menu when the language follows Windows
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T13:48:00Z'
updated_date: '2026-11-16T14:24:00Z'
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
- [x] #1 With the language set to "Same as Windows" on a German Windows locale, the tray menu is German, like the window
- [x] #2 For any Windows locale, the tray menu and the window use the same language when the language follows Windows
- [x] #3 Rust tests cover German, Ukrainian, English and an unsupported locale
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
1. settings.rs: pure language_from_locale (uk, de, else en); detect_language reads the Windows display language (GetUserPreferredUILanguages) instead of the regional format.
2. New command get_system_language; the window asks it for "Same as Windows" instead of using navigator.language, so window and tray use one function.
3. Rust tests for de, uk, en and unsupported locales; frontend tests for the new source.
4. CHANGELOG, test:all, lint, release build to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Window and tray now use one function: settings::detect_language (Windows display language via GetUserPreferredUILanguages, mapped by language_from_locale to uk, de or en). The window asks it through the new get_system_language command instead of navigator.language. Behaviour change: the tray menu no longer follows the regional format; a user with an English Windows display language and Ukrainian regional format now gets an English tray menu, matching the window.
Checks: npm run test:all passed (frontend 386 + new tests, Rust 217 passed, 1 ignored); npm run lint passed. Release build from cc6783c copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-13-cc6783c.exe. git status was clean after the build (Cargo.toml not reported, .gitattributes works). Not tested on a real German Windows; covered by unit tests of language_from_locale and the existing German tray labels test. No new user-facing strings; no focus, dialog or announcement changes, so just smoke was not needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
On "Same as Windows" the tray menu and the window now always use the same language. detect_language reads the Windows display language and knows en, uk and de; the window gets its language from the same function through get_system_language. Rust tests cover German, Ukrainian, English and unsupported locales; frontend tests cover the new source. Not checked on a real German Windows by hand.
<!-- SECTION:FINAL_SUMMARY:END -->
