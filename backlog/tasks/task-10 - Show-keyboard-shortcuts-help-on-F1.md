---
id: TASK-10
title: Show keyboard shortcuts help on F1
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T00:34:00Z'
updated_date: '2026-11-16T14:06:00Z'
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
- [x] #1 F1 in the main window opens a Keyboard shortcuts dialog, with focus in the search box or in the snippet list
- [x] #2 The dialog lists every shortcut from the README tables (global, main window, forms and dialogs) plus F1, with descriptions in the current UI language
- [x] #3 With NVDA, the dialog name is announced when it opens, and every shortcut can be read one at a time together with its action using the arrow keys
- [x] #4 Escape or a Close button closes the dialog, and focus returns to where it was before F1
- [x] #5 While another dialog is open, F1 does nothing, like the other main window shortcuts
- [x] #6 Unit tests cover opening with F1, the list, closing and the focus return; just smoke has a step that opens the help with F1, checks what NVDA says and passes
- [x] #7 README.md, README_UK.md and README_DE.md list F1 in their Keyboard Shortcuts tables
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
1. KeyboardHelpModal: ModalOverlay dialog with one listbox; shortcuts in three role="group" sections (global, main window, forms and dialogs). Roving focus: each option gets real focus, Up/Down/Home/End/PageUp/PageDown move it, so NVDA in focus mode reads "keys, action" one at a time and announces the group name when entering a group. No aria-describedby. Close button; Escape and Ctrl+Enter close.
2. Shortcut data in one module (src/utils/shortcuts.ts) with translated key names and actions; spoken label where a key is a punctuation sign NVDA skips (Ctrl+, -> Ctrl+Comma).
3. F1 in useKeyboard (key F1, no modifiers), wired in App through useModalState (showHelp, anyModalOpen, closeAll); ModalOverlay restores focus to the search box.
4. i18n en/uk/de, CSS for the two-column list.
5. Unit tests: F1 opens, list contents, keys, Escape/Close, focus return, F1 ignored while another dialog is open.
6. README x3 (F1 row), CHANGELOG, smoke-nvda.ps1 step: F1 opens help, Down/End read items with group names, Tab to Close, Escape returns focus.
7. npm run test:all, npm run lint, release build, just smoke (with user's permission), copy build to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in commit e160cc5 on feature/keyboard-help.

Decisions:
- The shortcuts are a listbox, not text: the app root has role="application", so NVDA stays in focus mode. Each row is an option named "keys, action" that gets real DOM focus (roving tabindex); Up/Down/Home/End move it, no wrapping. The three groups are role="group" with aria-label; NVDA says the group name when focus enters it. No aria-describedby, so it works without "Report object descriptions".
- Keys with a comma or slash have a spoken form (Ctrl+Comma / Ctrl+кома / Strg+Komma, "or Slash"), because NVDA skips those signs at its default punctuation level.
- Rows live in translations.ts (helpShortcuts, en/uk/de). A unit test compares them with the Keyboard Shortcuts tables of README.md, README_UK.md and README_DE.md (same groups, order and key text), so the help and the READMEs cannot drift apart.
- Escape, Ctrl+Enter and Close close the help; ModalOverlay returns focus. showHelp is part of anyModalOpen and closeAll, so F1 does nothing in other dialogs and Escape in the help does not hide the window.
- The F1 action in the help is worded as it really works: Escape clears the search, and with an empty search hides the window.

Verification:
- npm run test:all: 378 frontend tests and 213 Rust tests pass. npm run lint passes.
- Looked at the dialog in the Vite dev server at 680x520, dark and light theme: the list scrolls inside the dialog and Close stays visible.
- just smoke on the release exe built from e160cc5: 35 of 35 steps, 105 of 105 NVDA checks. NVDA on F1: "Гарячі клавіші, діалог | Гарячі клавіші, список | Глобальні (з будь-якої програми), групування | Ctrl+Alt+Space, Показати вікно QuickSnippets". Down read all 21 rows with their actions and the group names "Головне вікно" and "Форми й діалоги"; Ctrl+, was read as "Ctrl+кома". Tab reached "Закрити, кнопка"; Escape returned focus to the main window; F1 in the Create dialog did nothing.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-10-e160cc5.exe.

Possible tweak: NVDA says the title twice on opening (dialog name, then the list, which is labelled by the title).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
F1 in the main window now opens a Keyboard shortcuts dialog listing every shortcut from the README tables plus F1, in the interface language, in three groups (global, main window, forms and dialogs). Because the app root has role="application", the list is a listbox of focusable options named "keys, action", so NVDA reads one shortcut at a time with the arrow keys and announces each group; nothing relies on object descriptions. Escape, Ctrl+Enter or Close closes it and focus returns to where it was; F1 does nothing while another dialog is open. Tests cover opening, the list, keys, closing and focus return, and check the help rows against all three READMEs; just smoke has six new steps and passes (35/35 steps, 105/105 NVDA checks). README (3 languages) and CHANGELOG updated.
<!-- SECTION:FINAL_SUMMARY:END -->
