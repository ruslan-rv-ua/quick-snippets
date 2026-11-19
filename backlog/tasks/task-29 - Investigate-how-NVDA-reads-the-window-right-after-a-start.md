---
id: TASK-29
title: Investigate how NVDA reads the window right after a start
status: To Do
assignee: []
created_date: '2026-11-19T16:42:00Z'
labels:
  - accessibility
  - investigation
  - model-fable
  - effort-medium
milestone: m-6
dependencies:
  - TASK-27
references:
  - scripts/smoke-nvda.ps1
  - src-tauri/src/lib.rs
  - DEVELOPMENT.md
priority: low
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-5, on its fixed build. Two things NVDA does on the first show of the window after QuickSnippets starts, seen in just smoke and just smoke-tray runs:

- After the window and the search box, NVDA does not read the first snippet of the list (step 80 of the tray run only hopes for it: it was not said in either run). On every later show it is read. The window opened by a default start behaves the same.
- A default start (without "Start in tray") is read with repeated phrases, as in 0.3.3: "QuickSnippets | QuickSnippets - Snippet Manager, документ | QuickSnippets - Snippet Manager, документ | додаток, пробіл | додаток | додаток | Пошук, ...". NVDA seems to get the window while the page is still loading. TASK-5 left the default start as it was on purpose.

Related and still unexplained: the reading with "веб-вміст, регіон" after a quick restart of a default start (TASK-18). TASK-5 showed that it does not depend on the time since the previous copy, as DEVELOPMENT.md once said; details are in the notes of the archived TASK-5 and TASK-18.

This is an investigation first: no code change until the behaviour is reproduced and its suspected cause is recorded in the notes, and the app changes only after the user agrees. Use just smoke and just smoke-tray runs, and ask the user before every run, since the keyboard and mouse must stay untouched for about two and a half minutes. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days. Starts after TASK-27, because a new place for the browser data can change what happens at the first start.

Recommended setup: Claude Fable 5.2 (`/model fable`), effort medium (`/effort medium`). Timing between WebView2, the page and NVDA, the kind of ambiguous work Fable is meant for: describe the outcome, not the steps. If Fable usage is limited, Claude Opus 5.5 at effort xhigh is the alternative.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both behaviours reproduced or ruled out through just smoke runs, with a default start and with a start in the tray; the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [ ] #2 If the cause is in the app and the user agrees to a fix: on the first show after a start NVDA reads the window, the search box and the first snippet, each once, as on later shows
- [ ] #3 If fixed: just smoke and just smoke-tray require the first snippet on the first show, and both pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
