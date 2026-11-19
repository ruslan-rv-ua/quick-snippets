---
id: TASK-19
title: Shorten what NVDA says for the search box
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T19:17:00Z'
updated_date: '2026-11-19T11:06:00Z'
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
- [x] #1 Before any code change, what NVDA says now and the proposed shorter announcement are recorded in the task notes and approved by the user
- [x] #2 NVDA announces the search box more briefly, and the search box still works with NVDA as now: typing, caret keys, Up and Down into the list, Enter
- [x] #3 just smoke checks the new announcement and passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. git flow feature start search-box-speech
2. SearchBox: drop aria-label (the name comes from the placeholder) and aria-autocomplete; keep role combobox, aria-haspopup="listbox", aria-controls, aria-expanded and aria-activedescendant; searchPlaceholder "Search" / "Пошук" / "Suchen"
3. Vitest: the placeholder is the short name, no aria-label or aria-autocomplete, the combo box attributes stay
4. smoke-nvda.ps1: search box steps expect the name once with the combo box role and forbid "has autocomplete" and the old long name
5. CHANGELOG, test:all, lint, release build, just smoke, copy to real_db
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Before the change (just smoke, 2026-11-19, build 6e6edcd = current develop)

Run stopped at step 36 (autostart in settings: the known brief focus loss after a UI Automation toggle, "порожньо | додаток | додаток"); steps 1-35 ran, 139 of 139 NVDA checks passed.

What NVDA says for the search box:
- Window opens (steps 1, 2), empty field: "Пошук сніпетів…, комбінований список, згорнуто, містить автоматичне заповнення, можливо редагувати, Пошук сніпетів…, порожньо".
- Back in the main window with snippets in the list (steps 18, 19, 26): the same with "розгорнуто", then the first snippet.
- First caret key after Up or Down (TASK-16 notes): "Пошук сніпетів…, комбінований список, розгорнуто, містить автоматичне заповнення, можливо редагувати, smoke зв" (the query; no second name).

Where each part comes from:
- "Пошук сніпетів…": aria-label (name), the same text as the placeholder.
- "комбінований список" and "можливо редагувати": role="combobox" on a text input (an editable combo box).
- "згорнуто" or "розгорнуто": aria-expanded (true while the list has snippets).
- "містить автоматичне заповнення": aria-autocomplete="list".
- the second "Пошук сніпетів…" before "порожньо": the placeholder, which NVDA reads for an empty field. Chromium exposes it separately because the name comes from aria-label; when the name comes from the placeholder itself, Chromium does not expose it a second time.

## Approved shorter announcement (user, 2026-11-19, before any code change)

Name and placeholder become "Пошук" (en "Search", de "Suchen"); aria-autocomplete="list" is removed; aria-label is removed so the name comes from the placeholder and NVDA does not read the placeholder a second time. Role combobox, aria-expanded, aria-controls, aria-haspopup and aria-activedescendant stay as they are.
- Window opens: "Пошук, комбінований список, згорнуто, можливо редагувати, порожньо".
- Back from the list: "Пошук, комбінований список, розгорнуто, можливо редагувати, smoke зв".
Why it breaks nothing: the arrows, reading the selected snippet (TASK-16), Delete (TASK-15), focus return (TASK-17) and startup focus (TASK-22) depend on the combobox role, aria-controls and aria-activedescendant, which do not change. aria-autocomplete="list" promised text completions; the list holds results and Enter copies the snippet, so removing it is also more accurate.

## First smoke run after the change (build cdb82ea)

77 of 77 steps, 273 of 273 NVDA checks. NVDA now says "Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо" when the window opens and "Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, smoke зв" back from the list. The doubled name and "містить автоматичне заповнення" are gone, but "відкриває список" is new: without aria-autocomplete, NVDA reads aria-haspopup="listbox". That value is the default for a combo box, so the explicit attribute is removed too (same meaning, no "opens list"); smoke now forbids "відкриває список" in the search box steps.

## Second smoke run (build 3d7ccf9, no explicit aria-haspopup)

77 of 77 steps, 272 of 279 NVDA checks. Chromium still exposes the combo box default (aria-haspopup "listbox"), so NVDA still says "відкриває список" (6 failed checks). The seventh: in step 47 NVDA read "Сортування: Найновіші Сортування: Найстаріші" as one phrase, so "Найновіші" counted twice; a live region timing glitch unrelated to the search box (not seen in the first run).
User chose (2026-11-19) to remove "відкриває список": aria-haspopup="false", because the snippet list is always on screen and is not a popup. aria-controls still ties the search box to the list.

## Third smoke run (build e20dfc6, aria-haspopup="false")

77 of 77 steps, 272 of 279 NVDA checks: "відкриває список" was still said. Reason, from NVDA's source: IAccessible._get_states drops HASPOPUP only while AUTOCOMPLETE is reported; Ia2Web._get_states then turns HASPOPUP into "opens list" from the IA2 "haspopup" attribute, and Chromium exposes "listbox" for every combo box, even with aria-haspopup="false". So without changing the role NVDA always says either "містить автоматичне заповнення" or "відкриває список".
User chose (2026-11-19) "відкриває список", the shorter one. aria-haspopup="listbox" is back as it was; aria-label and aria-autocomplete stay removed. The approved announcement is now "Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, smoke зв" (window opens: "згорнуто" ... "порожньо").
Step 47 (Ctrl+Shift+1 twice) failed in runs 2 and 3: NVDA read the toast region as "Сортування: Найновіші Сортування: Найстаріші". Not seen in run 1 (explicit aria-haspopup="listbox"); the next run shows whether it is tied to that.

## Final check (build 4b45cd4)

just smoke: 77 of 77 steps, 273 of 273 NVDA checks (before this task: 255 checks; the six search box steps now also check the role and forbid the old words). Step 47 was clean again, as in the first run with the same explicit aria-haspopup. One error in the NVDA log, the known script_caret_newLine for Enter in a text field.
NVDA now says: window opens "Пошук, комбінований список, згорнуто, можливо редагувати, відкриває список, порожньо"; back from the list "Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список, smoke зв". Typing, Left/Right, Ctrl+Left/Right, Backspace, Delete, Up/Down into the list, Escape and Enter behave as before (smoke steps 44-63).
npm run test:all: 453 Vitest, 230 Rust. npm run lint passes. Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-19-4b45cd4.exe.
Idea from the user discussion, no task created: a short smoke mode that runs only the search box steps (with its own setup of two snippets) would make iterations like this one faster.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
NVDA reads the search box more briefly. Before: "Пошук сніпетів…, комбінований список, розгорнуто, містить автоматичне заповнення, можливо редагувати" and the query, and in an empty field the name a second time before "порожньо". Now: "Пошук, комбінований список, розгорнуто, можливо редагувати, відкриває список" and the query or "порожньо".

Changes: the search box name is its placeholder, now one word ("Search", "Пошук", "Suchen"); aria-label is removed, so Chromium no longer exposes the placeholder separately and NVDA stops repeating it; aria-autocomplete is removed (the list holds results, not completions). The role and the attributes the list keys rely on are unchanged. NVDA says "відкриває список" whenever "has autocomplete" is not reported (Chromium exposes a listbox popup for every combo box, aria-haspopup="false" included), so one of the two is always heard; the user chose the shorter one.

Verified: just smoke 77/77 steps and 273/273 NVDA checks on build 4b45cd4; npm run test:all (453 + 230) and npm run lint pass. Risk: if a future NVDA or Chromium version reports the popup differently, the announcement may change; the smoke search box steps will show it.
<!-- SECTION:FINAL_SUMMARY:END -->
