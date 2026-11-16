---
id: TASK-16
title: Let NVDA read caret movement in the search box while a snippet is selected
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T18:13:00Z'
updated_date: '2026-11-16T19:13:00Z'
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
- [x] #1 Before any code change, the cause and the proposed fix are recorded in the task notes and approved by the user
- [x] #2 With a snippet selected, NVDA gives the usual text field feedback in the search box: the character or word the caret moves to, and what Backspace and Delete erase or leave at the caret
- [x] #3 Up and Down still move the selection, and NVDA reads the selected snippet as today
- [x] #4 just smoke has steps that check what NVDA says for caret movement and for Up and Down with a snippet selected, and passes
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
1. State: listFocused (NVDA on the selected snippet, aria-activedescendant set) in useSearchLogic; reset() and the blur reset (when no dialog is open) clear it.
2. SearchBox and useSearchBoxKeyboard: aria-activedescendant only while listFocused. Up, Down, Home, End (with results) set it; Left and Right (also with Ctrl or Shift), Backspace, Ctrl+A (by physical key), any change of the text and Escape clearing the query clear it. Focus leaving the search box for another element (a dialog) sets it, so NVDA returns to the selected snippet when the dialog closes.
3. App: the sort shortcuts set it; Ctrl+F clears it.
4. SnippetList keeps the TASK-14 rule for the live region ("No results found", or the first result when the selected snippet stayed the same), because NVDA reads a newly selected snippet itself; results that arrive while the window has no focus are not announced.
5. Unit tests: SearchBox, SnippetList, useSearchLogic, App.
6. scripts/smoke-nvda.ps1: Right and Backspace keys; ExpectSaid (a whole utterance); steps for the window opening, caret keys, Backspace and Up/Down with a snippet selected; speech checks for the Delete steps; a richer failure message in the autostart step.
7. CHANGELOG [Unreleased] Fixed.
8. npm run test:all, npm run lint, release build, just smoke (with the user's permission), copy to C:\5-quicksnippets\real_db\, git flow bugfix finish --no-ff.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Cause (2026-11-16)

The search box (input with role="combobox" in src/components/SearchBox.tsx) keeps DOM focus. Whenever the list is not empty it carries aria-activedescendant="snippet-<id>" for the selected snippet (useSearchLogic sets activeIndex to 0 whenever there are results). Chromium (WebView2) then reports that option in the listbox of SnippetList.tsx as the focused object: UI Automation puts HasKeyboardFocus on the list item, and NVDA gets a focus event on the option. NVDA binds its text field scripts (character on Left/Right, word on Ctrl+Left/Right, erased character on Backspace, character at the caret on Delete) only to an editable focus object. The option is not editable, so NVDA passes these keys to the app and says nothing; when the query changes it reads the snippet that becomes active, or the live region. The search box gets NVDA focus only while the list is empty (no active descendant), for example after a search with no results.

## What NVDA says now

just smoke on the release build of d6a93b3 (same app code as develop df4c14f), with 13 observation-only steps added in a temporary copy of the script outside the repo: 67 of 67 steps, 140 of 140 NVDA checks. A first run stopped at the autostart step because focus left the app for a moment; the second run passed.
- Query "smoke зв" pasted, both snippets found: "smoke зашифрований (зашифровано)" (the new first result).
- Down: "smoke звичайний". Up: "smoke зашифрований (зашифровано)".
- Left, Left, Right, Ctrl+Left, Ctrl+Left, Ctrl+Right, Right (seven separate steps): NVDA said nothing at all.
- Backspace erasing a character: "smoke зашифрований (зашифровано)" (first result of the new query), nothing about the erased character.
- Delete in the middle of "звич" (existing step): "smoke звичайний | smoke звичайний". Delete at the end inside a run: nothing about the text.
- When the search box gets NVDA focus (existing steps): "Пошук сніпетів…, комбінований список, згорнуто or розгорнуто, містить автоматичне заповнення, можливо редагувати", then the query, or the placeholder and "порожньо".
- Home and End in the search box are list keys (first and last snippet, documented in F1 help and README), not caret keys.

## Proposed fix (for the user's approval)

Separate the selected snippet (highlight, aria-selected, what Enter, Shift+Enter, Ctrl+E, Delete and Ctrl+D act on) from where NVDA is (aria-activedescendant). This is the WAI-ARIA editable combobox pattern: arrow keys move visual focus into the list, keys that edit text move it back to the text box.
- Up, Down, Home, End in the search box, the sort shortcuts (Ctrl+Shift+1 to 4) and coming back from any dialog put NVDA on the selected snippet (aria-activedescendant set), as today.
- Keys that move the caret or edit the text put NVDA back in the search box (aria-activedescendant removed): Left and Right with or without Ctrl or Shift, Backspace, Ctrl+A, typing, paste, Delete when it erases (Delete with nothing to erase still opens the delete confirmation), Escape clearing the query. The snippet stays selected and highlighted; Enter still copies it.
- While NVDA is in the search box, the result of a changed query is announced through the existing live region: the first result's name, or "Нічого не знайдено".
- When the window opens: option A (recommended), NVDA is in the search box and the live region says the first snippet's name; option B, NVDA is on the first snippet as today.

How NVDA will sound:
- In the search box: Left and Right read the character at the caret, Ctrl+Left and Ctrl+Right the word, Backspace the erased character, Delete the character now after the caret or "порожньо" at the end. When the results arrive: the first result's name, or "Нічого не знайдено".
- The first editing key after Up or Down: NVDA handles this key while it is still on the snippet, so it cannot read the character for it. It says the search box once instead, for example "Пошук сніпетів…, комбінований список, розгорнуто, містить автоматичне заповнення, можливо редагувати, smoke зв". From the next key on, as above.
- Up and Down while NVDA is on the list: the snippet name, as today.
- The first Up or Down after editing: NVDA's own text field handling first reads the query (or "порожньо" for an empty box), then "список" and the snippet, for example "smoke зв | список | smoke звичайний". NVDA does this for arrow keys in any text field; a web page cannot switch it off.
- Window opens, option A: "...Пошук сніпетів…, порожньо", then the first snippet's name. Option B: as today ("...порожньо | список | smoke звичайний"), but the first character typed after opening also brings the whole search box announcement.
- Delete with nothing to erase while NVDA is in the search box: NVDA may say "порожньо" before "Видалити сніпет, діалог | Скасувати, кнопка".

Alternative (not recommended): keep aria-activedescendant as it is and let the app announce the character or word at the caret through the live region. Up and Down stay exactly as today, but this only imitates NVDA: no "пробіл" for a space, no capital letter indication, a short delay, braille does not follow the caret, and other screen readers may speak twice.

Keys, F1 help and README stay unchanged. No new strings: the live region uses existing ones.

## Decision (approved by the user on 2026-11-16, before any code change)

The user chose the recommended fix ("NVDA follows the action") and option A for the window opening: NVDA is in the search box when the window opens, and the live region says the first snippet's name.

## Implementation (2026-11-16)

- 30ee917: listFocused in useSearchLogic (reset clears it); SearchBox sets aria-activedescendant only while it is true; useSearchBoxKeyboard sets it on Up, Down, Home, End (with results) and clears it on Left/Right (also with Ctrl or Shift, not Alt), Backspace, Ctrl+A (by physical key) and Escape clearing the query; any text change clears it; Ctrl+F clears it; the sort shortcuts set it. SnippetList announces each new result list while listFocused is false (first result, or "No results found" for a query), only while the document has focus.
- just smoke on the build of 30ee917 (run 1, with the user's permission) stopped at the autostart step, the same intermittent failure as the first baseline run on the old build (right after the settings dialog opened NVDA said "порожньо" and the settings were not saved). Before that it showed two problems of the change: when the window opened, the first snippet was announced twice (the window is shown by two events, window focus and window:show, and each reloads the list), and opening a dialog from the search box first read "список" and the snippet, because aria-activedescendant was set while the search box still had focus.
- 29f759d fixes both: a list that repeats the last announcement for the same query within 1.5 s is not announced again; the search box moves the screen reader to the selected snippet on blur, once focus has gone to another element (a dialog), instead of an effect on anyModalOpen; the blur reset keeps it on the snippet while a dialog is open. The autostart step of just smoke now reports where the window, the dialog and the keyboard were if it fails.
- Tests: SearchBox (where the screen reader is: list keys, caret keys, Backspace, Ctrl+A, typing, Escape, blur), SnippetList (live region rules, repeated list, hidden window), useSearchLogic (reset), App (window opening, Down/Left, typing and Enter, coming back from a dialog, sort and Ctrl+F, showing the window again). npm run test:all: 433 frontend tests, 217 Rust tests (1 ignored). npm run lint passes.

- just smoke on the build of 29f759d (run 2, with the user's permission): 64 of 64 steps OK, 167 of 171 NVDA checks. The caret checks all passed: Left and Right "з | Зошит", "в | Візок" (the character, then the phonetic description from NVDA's delayed character descriptions), Ctrl+arrows "зв | smoke | зв", Backspace "пробіл", Delete in the middle "ч | Чайник", Delete at the end "порожньо". The first Left after Down said the search box once, as proposed. Down or Up from the search box said only "список" and the snippet: NVDA did not repeat the query, unlike the proposal predicted. The 4 failed checks were all a snippet name said twice whenever the selected snippet changed while NVDA was in the search box (window opening, search, Escape, paste, Backspace): NVDA itself reads the newly selected option of the list the search box controls, so the live region announcement was a duplicate.
- 587ad7c: SnippetList goes back to the TASK-14 rule (announce "No results found", or the first result when the selected snippet stayed the same; nothing on a reload without a query change), keeps the window focus check, and no longer needs listFocused. The changelog no longer says the first Up or Down repeats the query.

## Verification (2026-11-16)

- just smoke on the release build of 587ad7c (with the user's permission): 64 of 64 steps, 171 of 171 NVDA checks (before this task: 54 steps, 140 checks). NVDA now says, every snippet name once: window opening "...Пошук сніпетів…, порожньо | smoke зашифрований (зашифровано)"; a query pasted while NVDA is on a snippet: the search box with the query, then the first result; Down "список | smoke звичайний"; the first Left after it: the search box once; Left and Right "з | Зошит", "в | Візок"; Ctrl+arrows "зв | smoke | зв"; Backspace "пробіл"; Delete "ч | Чайник" in the middle and "порожньо" at the end; Up and Down from the search box "список | smoke зашифрований (зашифровано) | smoke звичайний".
- npm run test:all: 429 frontend tests, 217 Rust tests (1 ignored). npm run lint passes.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-16-587ad7c.exe.
- No new user-facing strings; keys, F1 help and README are unchanged.

Noticed, not changed (no tasks created):
- Settings dialog: right after it opens, focus sometimes leaves the window content for a moment (NVDA says "порожньо", then "додаток | додаток" and the dialog again). Twice focus did not come back (the first baseline run on the old build and the first run on the new code), the settings were not saved and the autostart step failed. It happened when Ctrl+Alt+Space was pressed while the window was already open. The autostart step now reports where the window, the dialog and the keyboard were if it fails.
- After Ctrl+D and Ctrl+Enter (TASK-17) NVDA now says "Видалено | список | елемент списку | smoke зашифрований (зашифровано)" instead of "Видалено | QuickSnippets - Snippet Manager, документ | невідомо | ...": focus returns to the search box, which points at the selected snippet. TASK-17 should start from this.
- The search box announcement is long ("Пошук сніпетів…, комбінований список, розгорнуто, містить автоматичне заповнення, можливо редагувати" and the query). It is now heard once when NVDA leaves the list for the search box; it could be shortened separately.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
NVDA now reads caret movement and erasing in the search box while a snippet is selected. Cause: the search box pointed at the selected snippet with aria-activedescendant, so Chromium reported the snippet as focused and NVDA did not apply its text field handling to Left, Right, Ctrl+arrows, Backspace and Delete.

Fix (approved by the user before the code change): the selected snippet and where the screen reader is are now separate. Up, Down, Home, End and the sort shortcuts put NVDA on the selected snippet, as before; keys that move the caret or change the text, Escape clearing the query and Ctrl+F bring it back to the search box, while the snippet stays selected for Enter. After a dialog NVDA returns to the selected snippet. The window opens with NVDA in the search box. The live region keeps the TASK-14 rule, because NVDA reads a newly selected option of the list the search box controls by itself.

Verified: npm run test:all (429 frontend, 217 Rust tests), npm run lint, and just smoke with 64 of 64 steps and 171 of 171 NVDA checks on the release build of 587ad7c, copied to real_db as quick-snippets-TASK-16-587ad7c.exe.

Trade-off: the first key that moves the caret or edits the text after Up or Down says the search box once instead of the character. Follow-up candidates are in the notes: focus sometimes leaves the settings dialog after Ctrl+Alt+Space while the window is open, and TASK-17's speech after deleting has changed.
<!-- SECTION:FINAL_SUMMARY:END -->
