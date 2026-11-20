---
id: TASK-32
title: Investigate the slow first show of the window under full processor load
status: To Do
assignee: []
created_date: '2026-11-19T23:24:00Z'
labels:
  - investigation
  - performance
  - accessibility
  - model-opus
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src-tauri/src/startup.rs
  - src-tauri/src/lib.rs
  - src/App.tsx
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-29. In its prototype runs with all 20 logical processors of the computer kept busy, the window of a default start appeared only 8 to 12 s after the start (NVDA read it correctly). Without load it appears about 0.5 s after the start, or about 1.5 s with a screen reader running. Why the start took that long under load was not looked into. Details: notes of the archived TASK-29 (prototype run 4).

Since TASK-29 the window of a default start is created hidden and shown only when the page reports that its first list is loaded with the saved theme, language and sort order (`frontend_ready`), and with a screen reader running only after a pause of three times the start time, between 1 and 4 s (`src-tauri/src/startup.rs`). If the page does not report within 3 s, the start-up goes on without it. Under load each part can take longer: the embedded browser's start, the page's two list loads, the pause and the 3 s fallback. The prototype runs used fixed pauses (1 and 2.5 s), so the current build may behave differently.

Find out where the time goes under load and whether the app can shorten it without bringing back the wrong NVDA reading of TASK-29: a window shown less than about 0.6 s after the page was ready was read the wrong way. Investigation first: no code change until the findings are in the notes and the user agrees to a change. If the time is simply what the embedded browser needs on a fully loaded computer, recording that is the result.

Hands-off runs take the keyboard: ask the user before every run, start only test copies (never the user's installed copy), and end each run with two beeps. Read NVDA speech only through just smoke or the bytes NVDA's log gets during the run itself; suggest Do Not Disturb first, since NVDA also speaks notifications of other programs.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort medium (`/effort medium`). Measurement work with several moving parts (the embedded browser, the page, the app's own waits), but a narrower question than TASK-29.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On the current release build under full processor load, the time from the start to the window on screen is measured in stages (process start, page loaded, frontend_ready, show), with and without a screen reader, and compared with the time 0.3.3 needs to show its list under the same load; runs, load and times are recorded in the notes before any code change
- [ ] #2 The notes name what takes the time under load (the embedded browser, the page, or the app's own waits such as the pause and the 3 s fallback) and whether the app can shorten it without the wrong NVDA reading of TASK-29
- [ ] #3 If the user agrees to a change: under the same load the window of a default start appears sooner than before, complete, and NVDA reads it correctly; just smoke and just smoke-tray pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
