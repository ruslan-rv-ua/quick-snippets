---
id: TASK-17
title: Return focus cleanly after the delete confirmation closes
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T18:13:00Z'
updated_date: '2026-11-19T09:00:00Z'
labels:
  - bug
  - frontend
  - accessibility
  - model-sonnet
  - effort-high
milestone: m-4
dependencies: []
references:
  - src/components/DeleteConfirmModal.tsx
  - src/components/ModalOverlay.tsx
  - src/App.tsx
  - scripts/smoke-nvda.ps1
priority: low
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a snippet is deleted with Ctrl+D and Ctrl+Enter, NVDA says "QuickSnippets - Snippet Manager, document | unknown" before it returns to the search box and the list (just smoke step 47 in the TASK-15 run; in the TASK-14 run the same place said "blank"). Focus most likely passes through the document while the dialog closes and the deleted snippet leaves the list. A screen reader user hears noise, and the first thing said after deleting is not where they are. TASK-15 noticed it; it was so before.

Update after TASK-16 (2026-11-16): focus now returns to the search box, which points at the selected snippet, and the TASK-16 just smoke run heard "Видалено | список | елемент списку | smoke зашифрований (зашифровано)" instead of "document | unknown". Check first what is left of the problem: "список | елемент списку" before the snippet name may still be worth removing.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). A focus fix in existing dialog code, checked with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before any code change, a just smoke run records what NVDA says after deleting with Delete and with Ctrl+D, and the cause is recorded in the task notes
- [x] #2 After a snippet is deleted, NVDA no longer says "document" or "unknown": it says the deletion message once and then where focus is
- [x] #3 The other dialogs that return focus to the main window (create, edit, settings, help) are checked for the same problem in just smoke
- [x] #4 Unit tests cover where focus goes after the delete confirmation closes
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
1. scripts/smoke-nvda.ps1: a third snippet deleted with the Delete key, the Ctrl+D delete and the settings save split so that each Ctrl+Enter is its own step, Forbid with variants, and checks that forbid the document and application noise after closing the create, edit, delete, settings, help and exit dialogs.
2. Baseline just smoke on the unchanged app; record the speech and the cause (done).
3. ModalOverlay: save and restore focus in a layout effect.
4. useSearchLogic reload(); App passes it to create, edit and delete as an async onSuccess; the dialogs await it before onClose.
5. Unit tests: ModalOverlay (focus back in the same commit), DeleteConfirmModal, Create/Edit (close after onSuccess resolves), useSearchLogic reload, App (after deleting, focus comes back to a search box that already points at the remaining snippet).
6. npm run test:all, npm run lint, release build, just smoke (with the user's permission), CHANGELOG, copy to real_db, git flow bugfix finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What NVDA says now (2026-11-19, before any code change)

just smoke on the release build of fa43097 (app code identical to develop 6477360; only CI files changed since), with the script extended on this branch to 77 steps: 77 of 77 steps OK, 245 of 255 NVDA checks. The 10 failed checks are the new ones that forbid the noise below.
- Delete key, then Ctrl+Enter (new step 67): "Видалено | порожньо | додаток | додаток | список | smoke звичайний, 1 із 2".
- Ctrl+D, then Ctrl+Enter (step 69): "Видалено | порожньо | додаток | додаток | список | smoke зашифрований (зашифровано), 1 із 1". The TASK-22 run on the same build said "Видалено | невідомо | додаток | додаток | список | ..." here, TASK-16 "Видалено | список | елемент списку | ...", TASK-15 "Видалено | QuickSnippets - Snippet Manager, документ | невідомо | ...".
- Create, Ctrl+Enter (steps 4, 16, 65) and edit, Ctrl+Enter (steps 4, 5): "Збережено | порожньо | додаток | додаток | список | <snippet>". The same problem.
- Settings, Ctrl+Enter from the keyboard (new step 71): "список | smoke зашифрований (зашифровано), 1 із 1", clean.
- Escape in create, edit, the delete confirmation, settings, help and the exit confirmation (steps 9, 12, 28, 29, 34, 35, 63, 74, 77): "список | <selected snippet>", clean.
"список" is NVDA entering the list from the dialog; it is where focus is, the same after Escape.

## Cause

1. ModalOverlay saves the focused element when a dialog opens and gives focus back in the cleanup of a passive effect (useEffect). On close React first removes the dialog from the page, the browser puts focus on the document body, and the cleanup moves it to the search box later. Escape closes the dialog inside the key event; React runs passive effects of such an update in the same task, so nothing is seen in between. Ctrl+Enter in create, edit and delete closes the dialog only after the IPC call returns: that update is not a key event, React runs its passive effects in a later task, and in between Chromium can report focus on the document. NVDA then says the document ("порожньо", "невідомо" or the window title with "документ") and, when focus comes back, the application ancestors ("додаток | додаток") before the list. The settings dialog also closes after an await, but its save adds no toast and does not reload the list; there the cleanup ran before Chromium's update, so it is the same race, won this time.
2. The list is reloaded only after the dialog has closed (refreshTick, then IPC). Focus comes back to the search box while it still points at the snippet selected before the dialog: after a delete that is the deleted snippet (the "елемент списку" of the TASK-16 run), after a create the one selected before. When the list arrives the selection jumps to the first snippet and NVDA reads it again. NVDA's own delay hides this most of the time today; with focus coming back at once it would be heard every time.

## Plan of the fix

- ModalOverlay: save and restore focus in a layout effect. React then gives focus back in the same commit that removes the dialog, before its elements leave the page, so focus never rests on the document.
- useSearchLogic: reload() loads the list again and resolves once the new list is in state. Create, edit and delete await onSuccess (toast, then reload) before onClose: the dialog closes on the updated list and focus comes back once, to the snippet selected now (the first one, as before).
- Expected: "Видалено | список | <first snippet>", "Збережено | список | <first snippet>".

## Implementation (2026-11-19)

- 9405b8e (scripts/smoke-nvda.ps1, before the app change): 77 steps. A third snippet "smoke тимчасовий" is created (its Ctrl+Enter is its own step) and deleted with the Delete key; the Ctrl+D delete, the encrypted snippet save and the settings save are split so that each Ctrl+Enter that closes a dialog is its own step. The settings save now toggles "Ask before closing" from the keyboard (Tab, Space): a toggle through UI Automation may move the keyboard inside WebView2 (TASK-18) and NVDA would say "application" on its own. Forbid accepts '|'-separated variants; $FocusNoise ("додаток", "невідомо", the window title) is forbidden in every step that closes a dialog without showing the window, and the new Ctrl+Enter steps also forbid "порожньо" and the name of the snippet that must not be read (the deleted one, or the one selected before a create).
- 6e6edcd: ModalOverlay saves and restores focus in useLayoutEffect (the first focusable element still gets focus in a passive effect). useSearchLogic.reload() bumps refreshTick and resolves once that load has set the list (also when it fails). App passes "toast, then reload()" as onSuccess to the create, edit and delete dialogs; they await onSuccess before onClose, and an IPC error no longer passes through the same try block. After a delete or a save the first snippet is selected, as before.
- Tests: ModalOverlay (a layout-effect probe in a later sibling sees focus back on the opener in the commit that closes the dialog, for unmount and for isOpen=false), DeleteConfirmModal (the same probe after Ctrl+Enter and after Escape; closes only once onSuccess resolves; a failed delete keeps the dialog open), CreateSnippetModal and EditSnippetModal (close only once onSuccess resolves; a failed create keeps the dialog), useSearchLogic (reload resolves with the new list, uses the query shown, resolves on failure), App (Ctrl+D and Delete, then Ctrl+Enter: when the search box gets focus back it already points at the remaining snippet and the deleted one is gone; deleting the last snippet; Ctrl+N, Ctrl+Enter: focus comes back pointing at the new snippet). With the old ModalOverlay 4 of the new tests fail; with the old App and dialogs 7 fail.
- npm run test:all: 451 frontend tests, 230 Rust tests (1 ignored). npm run lint passes.

## Verification (2026-11-19)

just smoke on the release build of 6e6edcd (with the user's permission): 77 of 77 steps, 255 of 255 NVDA checks (before the fix the same script gave 245 of 255). No errors in the NVDA log this time.
- Delete key, then Ctrl+Enter (step 67): "Видалено | список | smoke звичайний, 1 із 2" (was "Видалено | порожньо | додаток | додаток | список | ...").
- Ctrl+D, then Ctrl+Enter (step 69): "Видалено | список | smoke зашифрований (зашифровано), 1 із 1".
- Create, Ctrl+Enter (steps 4, 16, 65): "Збережено | список | <snippet>"; for the encrypted snippet NVDA goes straight to it, not first to the one selected before. Edit, Ctrl+Enter (steps 4, 5): "Збережено | список | smoke звичайний, 1 із 1".
- Settings Ctrl+Enter (step 71) and Escape in create, edit, the delete confirmation, settings, help and the exit confirmation: "список | <selected snippet>", as before.
- The TASK-15, TASK-16 and TASK-22 steps (Delete in the search box, NVDA back on the selected snippet after a dialog, focus in a dialog opened right after startup) all passed.
Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-17-6e6edcd.exe. No new user-facing strings. CHANGELOG [Unreleased] → Fixed has an entry.

Noticed, not changed: after a delete the selection goes to the first snippet of the list, not to the neighbour of the deleted one (so it was before).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
After a delete, and after a save in the create and edit dialogs, NVDA now says "Deleted" or "Saved" and then the list and the snippet selected now. Before it said "blank" or "unknown" and "application application" first, and earlier runs heard the deleted snippet's leftover list item.

Two causes. ModalOverlay gave focus back in a passive effect cleanup; when a dialog closed after an await (Ctrl+Enter waits for IPC), React ran it in a later task, and in between focus was on the document. And the list was reloaded only after the dialog closed, so focus came back first to the deleted snippet or to the one selected before. Now ModalOverlay restores focus in a layout effect, in the same commit that removes the dialog, and the create, edit and delete dialogs close only once useSearchLogic.reload() has loaded the new list.

Verified: new unit tests (4 fail with the old ModalOverlay, 7 with the old App and dialogs), npm run test:all (451 frontend, 230 Rust), npm run lint, and just smoke on the release build of 6e6edcd with 77 of 77 steps and 255 of 255 NVDA checks; the script now has its own steps for each Ctrl+Enter that closes a dialog, a delete with the Delete key, and checks against the document and application noise after every dialog. Build: quick-snippets-TASK-17-6e6edcd.exe in real_db.
<!-- SECTION:FINAL_SUMMARY:END -->
