---
id: TASK-18
title: Keep focus in the settings dialog when it opens
status: To Do
assignee: []
created_date: '2026-11-16T19:17:00Z'
labels:
  - bug
  - investigation
  - accessibility
  - frontend
  - model-fable
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/SettingsModal.tsx
  - src/components/ModalOverlay.tsx
  - src/hooks/useWindowHiding.ts
  - src-tauri/src/lib.rs
  - scripts/smoke-nvda.ps1
priority: medium
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Right after the settings dialog opens, focus sometimes leaves the window content for a moment: NVDA says "порожньо", then "додаток | додаток" and the dialog again. Twice focus did not come back, the settings were not saved and the just smoke autostart step failed (TASK-16: the first baseline run on the 0.3.0 code and the first run on new code). Both times Ctrl+Alt+Space had been pressed while the window was already open, just before Ctrl+, opened the dialog. A user who opens the settings this way may lose their changes without noticing. The just smoke autostart step now reports where the window, the dialog and the keyboard were when it fails.

This is an investigation first: no code change until the failure is reproduced. Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Fable 5.2 (`/model fable`), effort medium (`/effort medium`). An intermittent focus problem across the window show events, WebView2 and the dialog code: describe the outcome, not the steps. If Fable usage is limited, Claude Opus 5.5 at effort xhigh is the alternative.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The failure is reproduced or ruled out through just smoke runs, and the findings (how many runs, what NVDA said, suspected cause) are recorded in the task notes before any code change
- [ ] #2 If reproduced: after Ctrl+Alt+Space with the window already open, the settings dialog keeps focus when it opens, and Ctrl+Enter saves the changes
- [ ] #3 just smoke has a step for this sequence and passes in several runs in a row
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
