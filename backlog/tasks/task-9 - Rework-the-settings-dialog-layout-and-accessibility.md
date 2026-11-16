---
id: TASK-9
title: Rework the settings dialog layout and accessibility
status: To Do
assignee: []
created_date: '2026-11-16T00:34:00Z'
updated_date: '2026-11-16T00:38:00Z'
labels:
  - accessibility
  - frontend
  - model-opus
  - effort-high
milestone: m-1
dependencies:
  - TASK-11
references:
  - src/components/SettingsModal.tsx
  - src/components/__tests__/SettingsModal.test.tsx
  - src/styles/theme.css
  - src/contexts/ThemeContext.tsx
  - src/contexts/LanguageContext.tsx
  - src/i18n/translations.ts
  - scripts/smoke-nvda.ps1
  - README.md
  - README_UK.md
  - README_DE.md
priority: medium
ordinal: 3200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The settings dialog (Ctrl+, or the tray menu) grew one field at a time and now reads as a flat list: a "Theme" caption over two toggle buttons, the language list, three checkboxes, the autotype delay as a bare number field, a general hint that some settings take effect after a restart (without saying which), the Cancel and Save buttons, and the app version below them. The goal is a dialog that looks tidy and attractive and stays fully usable with a screen reader. How it should look is a matter of taste: the user has not chosen a layout yet.

Found while writing this task: Cancel and Escape do not undo theme and language changes. Both apply at once and stay for the session, but only Save writes them, so the app quietly returns to the saved values at the next start. The other settings are simply discarded on Cancel.

just smoke opens this dialog with Ctrl+, and finds the autostart checkbox by its id (scripts/smoke-nvda.ps1): keep the id or update the smoke steps. Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). Visual design with a subjective goal, plus screen reader semantics that are easy to get subtly wrong inside the app's role="application" root: this needs judgment and careful checking with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, the proposed structure (groups, order, control types, labels and where hints go) is recorded in the task notes and approved by the user
- [ ] #2 The dialog follows the approved structure in both light and dark themes and fits the default window size (680x520) without horizontal scrolling
- [ ] #3 With NVDA, every control is announced with its visible label, role and state or value, and each hint is read together with the setting it belongs to
- [ ] #4 Tab order follows the visual order, and the focus indicator is clearly visible on every control in both themes
- [ ] #5 Cancel and Escape leave every setting as it was when the dialog opened, theme and language included; after Save, all changes survive a restart
- [ ] #6 Unit tests cover the new structure, the labels and the Cancel behaviour; just smoke checks what NVDA says in the reworked dialog and passes
- [ ] #7 The Settings sections of README.md, README_UK.md and README_DE.md match the new dialog
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
