---
id: TASK-19
title: Shorten what NVDA says for the search box
status: To Do
assignee: []
created_date: '2026-11-16T19:17:00Z'
updated_date: '2026-11-19T07:10:00Z'
labels:
  - accessibility
  - frontend
  - model-sonnet
  - effort-high
milestone: m-4
dependencies: []
references:
  - src/components/SearchBox.tsx
  - src/i18n/translations.ts
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 2500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When NVDA moves into the search box it says "Пошук сніпетів…, комбінований список, розгорнуто, містить автоматичне заповнення, можливо редагувати" and then the query. Since TASK-16 this is heard each time NVDA leaves the list for the search box (the first caret key after Up or Down) and when the window opens. Part of it comes from the role and states of the search box (combobox, expanded, autocomplete), part from the placeholder text. A shorter announcement saves screen reader users time on every search, but the role must stay right, because the arrow keys and the list depend on it.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A small markup change whose effect has to be checked with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Before any code change, what NVDA says now and the proposed shorter announcement are recorded in the task notes and approved by the user
- [ ] #2 NVDA announces the search box more briefly, and the search box still works with NVDA as now: typing, caret keys, Up and Down into the list, Enter
- [ ] #3 just smoke checks the new announcement and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
