---
id: TASK-15
title: Resolve the Delete key conflict in the search box
status: To Do
assignee: []
created_date: '2026-11-16T17:32:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-2
dependencies: []
references:
  - src/hooks/useKeyboard.ts
  - src/components/SearchBox.tsx
  - src/components/SnippetList.tsx
  - src/i18n/translations.ts
  - scripts/smoke-nvda.ps1
  - README.md
  - README_UK.md
  - README_DE.md
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the main window the Delete key opens the delete confirmation for the selected snippet (src/hooks/useKeyboard.ts: Delete without modifiers, only with a selection). Focus stays in the search box while the arrow keys move the selection (aria-activedescendant), and a snippet is selected whenever the list is not empty. So Delete pressed while editing the search text never removes the character after the caret: it asks to delete a snippet instead. That is surprising in a text field, especially with a screen reader. TASK-14 noticed it while adding just smoke steps for deleting.

Ctrl+D also deletes the selected snippet, and the README tables and the F1 help list both keys. Possible directions: Delete edits the text while there is text after the caret and asks to delete the snippet otherwise, or Delete always edits the text and another key deletes the snippet. The user has not chosen yet.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A small change in keyboard handling, but it changes a documented shortcut and needs checking with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, the chosen behaviour (when Delete edits the search text and how a snippet is deleted from the keyboard) is recorded in the task notes and approved by the user
- [ ] #2 With text after the caret in the search box, Delete removes the next character, as in any text field
- [ ] #3 A selected snippet can still be deleted from the keyboard, and the README tables (en, uk, de) and the F1 help describe the keys that do it
- [ ] #4 Unit tests cover Delete in the search box with and without text after the caret, and the just smoke delete steps pass with the new behaviour
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
