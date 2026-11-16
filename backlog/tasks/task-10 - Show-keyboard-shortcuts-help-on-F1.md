---
id: TASK-10
title: Show keyboard shortcuts help on F1
status: To Do
assignee: []
created_date: '2026-11-16T00:34:00Z'
labels:
  - accessibility
  - frontend
  - model-sonnet
  - effort-high
milestone: m-1
dependencies: []
references:
  - src/hooks/useKeyboard.ts
  - src/hooks/useAppModals.ts
  - src/App.tsx
  - src/components/ModalOverlay.tsx
  - src/i18n/translations.ts
  - scripts/smoke-nvda.ps1
  - README.md
  - README_UK.md
  - README_DE.md
priority: medium
ordinal: 3300
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
QuickSnippets is built to be used from the keyboard, but its shortcuts are listed only in the README, outside the app. A help dialog opened with F1 lets users look up a shortcut without leaving the app. F1 alone is enough: no help button, menu entry or tray item is needed.

The list must be readable with a screen reader, which is harder than it looks here: the app root has role="application", so NVDA stays in focus mode and does not read plain text with the arrow keys as it does on a web page. A list of paragraphs that looks fine can be silent with NVDA.

The Keyboard Shortcuts tables in README.md, README_UK.md and README_DE.md are the current reference: global, main window, and forms and dialogs.

Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A new dialog on the existing patterns (ModalOverlay, useKeyboard, translations); the hard part is checking that NVDA reads the whole list.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 F1 in the main window opens a Keyboard shortcuts dialog, with focus in the search box or in the snippet list
- [ ] #2 The dialog lists every shortcut from the README tables (global, main window, forms and dialogs) plus F1, with descriptions in the current UI language
- [ ] #3 With NVDA, the dialog name is announced when it opens, and every shortcut can be read one at a time together with its action using the arrow keys
- [ ] #4 Escape or a Close button closes the dialog, and focus returns to where it was before F1
- [ ] #5 While another dialog is open, F1 does nothing, like the other main window shortcuts
- [ ] #6 Unit tests cover opening with F1, the list, closing and the focus return; just smoke has a step that opens the help with F1, checks what NVDA says and passes
- [ ] #7 README.md, README_UK.md and README_DE.md list F1 in their Keyboard Shortcuts tables
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
