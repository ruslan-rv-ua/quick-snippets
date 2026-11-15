---
id: TASK-5
title: Check NVDA on the first show after starting in tray
status: To Do
assignee: []
created_date: '2026-11-15T23:03:00Z'
updated_date: '2026-11-15T23:18:00Z'
labels:
  - accessibility investigation
dependencies: []
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With "Start in tray" on, the window is hidden from launch. In just smoke runs on 2026-11-15 the first Ctrl+Alt+Space show was sometimes announced by NVDA and sometimes not: NVDA stayed silent until the next key press, then read the window. Later shows were always announced, and with the window opened at launch (the default, now used by just smoke) the first show is announced. Users who start in tray may hear nothing on their first hotkey press after login. Possible cause: the accessibility tree of a never-shown WebView2 window is not ready when it is first shown.

This is an investigation first: no code change until the behaviour is reproduced. Use just smoke runs (a switch that starts the test copy in tray mode would help), and ask the user before every run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduced or ruled out with start_in_tray on through just smoke runs; the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [ ] #2 If reproduced: NVDA announces the window and the search field on the first show after a start in tray
- [ ] #3 just smoke can run in a start-in-tray mode and passes
<!-- AC:END -->
