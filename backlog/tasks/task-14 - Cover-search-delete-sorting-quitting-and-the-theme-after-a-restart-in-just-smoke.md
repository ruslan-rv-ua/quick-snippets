---
id: TASK-14
title: >-
  Cover search, delete, sorting, quitting and the theme after a restart in just
  smoke
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T16:28:00Z'
updated_date: '2026-11-16T17:28:00Z'
labels:
  - testing
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-2
dependencies:
  - TASK-3
references:
  - scripts/smoke-nvda.ps1
  - DEVELOPMENT.md
  - README.md
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-3 decided on 2026-11-16 not to add tauri-driver end-to-end tests and to keep just smoke (scripts/smoke-nvda.ps1) as the end-to-end check of the real release exe with NVDA. Its notes explain why: WebDriver cannot hear NVDA, and NVDA speech is where the recent bugs were.

just smoke has 35 steps, but several everyday flows are not in it: search, delete with its confirmation dialog, the four sort shortcuts, quitting through the exit confirmation, and the theme chosen with Ctrl+Shift+T after a restart. These flows had real bugs before (layout-dependent shortcuts in 1d1b418, Ctrl+Enter in the exit and delete confirmations in f54b8f6 and 303f474, the sort change announced three times in 61420d6, search results announced wrongly in 8cec14a and cce24b3, the theme not saved in 232fe67), and the unit tests mock every Tauri API, so only a run of the real exe shows them working together.

Ask the user before every just smoke run: the keyboard and mouse must stay untouched for about a minute, and the user's own QuickSnippets is closed and not started again. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Script work with a clear scope, where checking each step against real NVDA output matters.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New steps cover search: typing a query filters the list, and Escape clears the search
- [x] #2 New steps cover delete with the confirmation dialog: Delete or Ctrl+D opens it, Escape keeps the snippet, Ctrl+Enter deletes it
- [x] #3 New steps cover the four sort shortcuts (Ctrl+Shift+1 to 4), including the direction toggle on a second press
- [x] #4 New steps cover quitting with the exit confirmation on: Alt+F4 opens it, Escape keeps the app running, Ctrl+Enter quits
- [x] #5 A step changes the theme with Ctrl+Shift+T, restarts the test copy and checks that the theme stayed
- [x] #6 Every new step checks the app state (UI Automation, settings.json or the process) and what NVDA says, and just smoke passes with all old and new steps on a fresh release build
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read how scripts/smoke-nvda.ps1 builds steps (Invoke-Step with Expect, ExpectAny, ExpectCount, Forbid) and how the app behaves: search box and live region, delete and exit confirmations, sort toasts, Ctrl+Shift+T, close handling in lib.rs.
2. Add steps after the autostart steps, so the earlier steps keep the dark theme and the default sort: search (match, no match, Escape clears), the four sort shortcuts with a second press each (settings.json and list order), delete (Delete opens, Escape keeps, Ctrl+D and Ctrl+Enter delete), turning on the exit confirmation, Ctrl+Shift+T, Alt+F4 with Escape and with Ctrl+Enter, restart of the test copy, the theme read back in Settings.
3. Note in DEVELOPMENT.md that the test restarts its own copy.
4. Ask the user, build the release exe, run just smoke, adjust the speech checks to what NVDA really says; report any app defects to the user before changing app code.
5. npm run test:all, npm run lint, finalize, git flow feature finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## First just smoke run with the new steps (2026-11-16)

52 of 52 steps OK, 137 of 138 NVDA checks. Old steps unchanged: 35 of 35.

App defect found (not fixed yet, the user decides): a search with no matches is silent. NVDA never says "Нічого не знайдено" (step "Пошук без збігів"). Cause in src/components/SnippetList.tsx: the live-region effect starts a 200 ms timer when the query changes, but useSearchLogic delivers the new results about 100 ms later (100 ms debounce plus IPC). The effect runs again for the new snippets, its cleanup clears the timer, and because the query did not change this time it returns early, so the live region is never filled. A found snippet is still heard, through aria-activedescendant on the search box, not through the live region; with no results there is no active item, so nothing is said. The unit tests in SnippetList.test.tsx change query and snippets in one render, so they do not see it.

Ctrl+Shift+T changes the theme without any announcement. The user chose to only record this; the theme step checks settings.json, and after the restart the theme list in Settings, which NVDA reads as "Світла".

Script problem found: when the test copy quits, Windows activated the next window in z-order (the Claude window), so NVDA read another program into the report. Fix: put the home window right below the app window before quitting.

## Outcome (2026-11-16)

- The user chose to fix the silent "no results" search here. Fixed in src/components/SnippetList.tsx: the live region now waits for the results of a changed query and speaks only what aria-activedescendant does not, "No results found", or the first result when the active snippet stayed the same. An empty query with an empty list (the reset when the window hides) says nothing; the old code announced "no results" there. Four new unit tests in SnippetList.test.tsx deliver the results in a later render, as the app does; three of them fail on the old code.
- The theme shortcut stays silent; the user chose to only record it.
- The z-order fix for the quit step did not work (Windows still activated the Claude window). Instead the quit step reads NVDA speech only up to Ctrl+Enter ($script:SpeechUntil), waits 1.5 s after focus is back in the home window, and the next step starts after that. The final run had no other program's speech in the report.
- New steps (17): search with a match, without matches, Escape clears it; Ctrl+Shift+1 to 4, each pressed twice (settings.json and list order checked after each press, every toast said once); Delete opens the confirmation with focus on Cancel, Escape keeps the snippet, Ctrl+D and Ctrl+Enter delete it ("Видалено" once); exit confirmation turned on in Settings; Ctrl+Shift+T writes theme light and keeps other settings; Alt+F4 opens the exit confirmation, Escape keeps the app running and visible, Alt+F4 and Ctrl+Enter quit with exit code 0; restart of the test copy with the same data folder (deleted snippet gone, theme light); Settings after the restart, NVDA reads "Тема, комбінований список, Світла".
- Verification: just smoke on the release build of f396363: 52 of 52 steps, 138 of 138 NVDA checks (three runs, all with the user's permission; the first found the defect, the second the report leak). npm run test:all: 390 frontend tests, 217 Rust tests (1 ignored). npm run lint passes. Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-14-f396363.exe.
- Noticed, not changed: Delete with focus in the search box opens the delete confirmation even while a query is typed, so the Delete key never deletes text forward in the search field while a snippet is selected.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
just smoke now covers search, delete with its confirmation, the four sort shortcuts with the direction toggle, quitting through the exit confirmation, and the theme chosen with Ctrl+Shift+T after a restart of the test copy: 17 new steps, 52 in all, 138 NVDA checks, all passing on a fresh release build.

The new steps found a real defect: a search with no matches was silent for screen readers, because the live-region announcement was cancelled when the results arrived about 100 ms after the query. With the user's approval it is fixed in SnippetList.tsx and covered by unit tests; CHANGELOG [Unreleased] has a Fixed entry. Ctrl+Shift+T still gives no spoken feedback; the user chose to only record that. The quit step leaves NVDA speech after the app exits out of the report, because Windows may activate another program first.

Checks: npm run test:all and npm run lint pass. Build: C:\5-quicksnippets\real_db\quick-snippets-TASK-14-f396363.exe.
<!-- SECTION:FINAL_SUMMARY:END -->
