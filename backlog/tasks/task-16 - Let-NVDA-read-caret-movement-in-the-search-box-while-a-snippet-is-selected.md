---
id: TASK-16
title: Let NVDA read caret movement in the search box while a snippet is selected
status: To Do
assignee: []
created_date: '2026-11-16T18:13:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-opus
  - effort-high
milestone: m-2
dependencies: []
references:
  - src/components/SearchBox.tsx
  - src/components/SnippetList.tsx
  - src/hooks/useKeyboard.ts
  - scripts/smoke-nvda.ps1
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The search box keeps focus while the arrow keys move the selection in the snippet list, and the selected snippet is exposed through aria-activedescendant. While a snippet is selected, NVDA treats it as the focused object, so it says nothing when the caret moves in the search box (Left, Right, Ctrl+Left, Ctrl+Right, Home, End) or when Backspace or Delete erase a character. A screen reader user editing the query gets no feedback on what they change. TASK-15 noticed it in just smoke; it was so before.

The fix needs care: Up and Down must still read the selected snippet, which is how the list works today, and Delete now erases text in the search box (TASK-15).

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). The screen reader semantics of a search box that points at a list item with aria-activedescendant are easy to get subtly wrong; this needs judgment and checking with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, the cause and the proposed fix are recorded in the task notes and approved by the user
- [ ] #2 With a snippet selected, NVDA gives the usual text field feedback in the search box: the character or word the caret moves to, and what Backspace and Delete erase or leave at the caret
- [ ] #3 Up and Down still move the selection, and NVDA reads the selected snippet as today
- [ ] #4 just smoke has steps that check what NVDA says for caret movement and for Up and Down with a snippet selected, and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
