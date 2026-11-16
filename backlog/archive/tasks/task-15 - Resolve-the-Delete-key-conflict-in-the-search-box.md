---
id: TASK-15
title: Resolve the Delete key conflict in the search box
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T17:32:00Z'
updated_date: '2026-11-16T18:08:00Z'
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
- [x] #1 Before any code change, the chosen behaviour (when Delete edits the search text and how a snippet is deleted from the keyboard) is recorded in the task notes and approved by the user
- [x] #2 With text after the caret in the search box, Delete removes the next character, as in any text field
- [x] #3 A selected snippet can still be deleted from the keyboard, and the README tables (en, uk, de) and the F1 help describe the keys that do it
- [x] #4 Unit tests cover Delete in the search box with and without text after the caret, and the just smoke delete steps pass with the new behaviour
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
1. src/hooks/useKeyboard.ts: Delete is left to a text field that has text to erase (text after the caret or a selection). Track a run of Delete presses that erased text, ended by any other key; inside such a run, and on key auto-repeat, Delete never opens the confirmation. Ctrl+D unchanged.
2. Unit tests: useKeyboard.test.ts (caret inside the text, selection, caret at the end, empty box, run after erasing, another key ends the run, auto-repeat) and an App test with the real search box.
3. F1 help rows (src/i18n/translations.ts, en/uk/de) and the Keyboard Shortcuts tables in README.md, README_UK.md, README_DE.md: say when Delete deletes the snippet; keys stay in sync for the KeyboardHelpModal test.
4. CHANGELOG.md [Unreleased]: the user-visible fix.
5. scripts/smoke-nvda.ps1: steps for Delete inside the query (erases a character, no dialog), Delete again right after erasing (no dialog), Delete at the end after another key (confirmation); keep the Ctrl+D step. Update DEVELOPMENT.md if it lists the steps.
6. npm run test:all, npm run lint, release build, just smoke (with the user's permission), copy the exe to C:\5-quicksnippets\real_db\.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Proposed behaviour of the Delete key (for the user's approval)

Today: focus stays in the search box, and a snippet is selected whenever the list is not empty. Delete without modifiers opens the delete confirmation whenever a snippet is selected, so it never edits the search text. With NVDA, Delete says "Delete snippet, dialog | Cancel, button" (just smoke step 43), even with the caret in the middle of the query.

Option 1 (recommended): Delete edits the search text whenever there is something to delete: text after the caret, or selected text. Only when the caret is at the end of the text (or the box is empty) and nothing is selected does Delete open the delete confirmation for the selected snippet. A held Delete (key auto-repeat) never opens it, only a separate press does. Ctrl+D opens it as before.
- NVDA, caret inside the text: the next character is removed and NVDA reads the character now after the caret, or "blank" when the text ends there. No dialog.
- NVDA, caret at the end or empty box: "Delete snippet, dialog | Cancel, button", as now.
- Why: the documented Delete shortcut keeps working, and no text editing is lost, because Delete at the end of the text does nothing in any text field.

Option 2: Delete always edits the text, as in any text field; only Ctrl+D deletes a snippet.
- NVDA: inside the text, the next character; at the end or in an empty box, "blank" and nothing happens. Ctrl+D: the dialog.
- The most predictable, but the documented Delete shortcut stops deleting snippets.

Option 3: Delete deletes the snippet only when the search box is empty; with any text in the box, Delete only edits it.
- NVDA: empty box, the dialog; with text, the next character or "blank".
- After a search (text in the box) only Ctrl+D deletes.

## Decision (approved by the user on 2026-11-16, before any code change)

Option 1, with a rule for a held Delete (the user's second choice: "until another key"):
- Delete in the search box erases text whenever there is something to erase: text after the caret, or selected text. The app does not intercept it then.
- When nothing follows the caret (caret at the end of the text, or the box is empty) and nothing is selected, Delete opens the delete confirmation for the selected snippet, as before.
- Once a Delete press has erased text, further Delete presses in a row only edit text: at the end of the text nothing happens (NVDA: "blank"), however long the user waits. Any other key (for example an arrow key) ends the run, and the next Delete at the end of the text opens the confirmation again. Reason: with NVDA a held key reaches the app as separate presses, so holding cannot be told apart from quick presses. This keeps a held Delete from opening the dialog with and without NVDA. A key auto-repeat never opens it either.
- Ctrl+D always opens the confirmation (unchanged).

## Implementation and verification (2026-11-16)

- Code: commit d6a93b3 on bugfix/search-delete-key. src/hooks/useKeyboard.ts leaves Delete to a text field that has text to erase (text after the caret or a selection) and keeps a ref for a run of Delete presses that erased text. Any other key, and any key while a dialog is open, ends the run. Inside a run, and on key auto-repeat, Delete never opens the confirmation. Ctrl+D is unchanged.
- F1 help and READMEs: the row is now "Ctrl+D or Delete" (uk "Ctrl+D або Delete", de "Strg+D oder Entf") and says when Delete deletes the snippet. Each README has a short note under the main-window table about erasing and the run rule.
- Tests: 9 new tests in useKeyboard.test.ts and 2 in App.test.tsx with the real search box. npm run test:all: 401 frontend tests and 217 Rust tests (1 ignored, as before). npm run lint passes.
- just smoke on the release exe built from d6a93b3: 54 of 54 steps, 140 of 140 NVDA checks. Step 43: Delete inside the query erases a character, no dialog. Step 44: Delete twice right after that erases the last character, then does nothing at the end. Step 45: after another key, Delete at the end of the query opens the confirmation with focus on Cancel. Step 46: Escape closes it, a second Escape clears the search. Step 47 (Ctrl+D) unchanged.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-15-d6a93b3.exe.

What NVDA actually says (differs from the proposal above): while a snippet is selected, NVDA treats the selected snippet as focused (aria-activedescendant), so it does not read the character after Delete, nor "blank" at the end of the text. When Delete changes the query, NVDA reads the selected snippet's name as the results arrive. A Delete at the end of the text inside a run is silent.

Noticed outside this task (no task created):
- NVDA is silent when the caret moves in the search box while a snippet is selected (Left, Right, Delete), because the selected snippet is reported as focused. This was already so before this task.
- After Ctrl+D and Ctrl+Enter (step 47), NVDA said "QuickSnippets - Snippet Manager, document | unknown" before it returned to the list. In the TASK-14 run the same place said "blank". Most likely focus passes through the document while the dialog closes; the Delete change does not touch this path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delete in the search box now erases text as in any text field whenever there is text after the caret or a selection; only with nothing to erase does it ask to delete the selected snippet. After Delete has erased text, more Delete presses in a row only edit text until another key is pressed, so a held Delete never opens the confirmation, also with NVDA, which sends a held key as separate presses. Ctrl+D is unchanged. The user chose and approved this behaviour before the code change (see notes). The F1 help, the three README tables and CHANGELOG [Unreleased] describe it.

Verified: npm run test:all (401 frontend and 217 Rust tests), npm run lint, and just smoke with 54 of 54 steps and 140 of 140 NVDA checks on the release exe from d6a93b3, copied to real_db as quick-snippets-TASK-15-d6a93b3.exe.

Risk: right after erasing text with Delete, a user has to press another key (or use Ctrl+D) before Delete deletes a snippet. Follow-up candidates are in the notes; no tasks were created.
<!-- SECTION:FINAL_SUMMARY:END -->
