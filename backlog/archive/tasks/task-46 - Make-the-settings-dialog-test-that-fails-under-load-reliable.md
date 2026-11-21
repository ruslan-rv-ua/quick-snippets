---
id: TASK-46
title: Make the settings dialog test that fails under load reliable
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T11:45:00Z'
updated_date: '2026-11-21T18:55:00Z'
labels:
  - test
  - frontend
  - model-sonnet
  - effort-medium
milestone: m-2
dependencies: []
references:
  - src/components/__tests__/SettingsModal.test.tsx
  - src/components/__tests__/App.test.tsx
  - src/components/__tests__/DeleteConfirmModal.test.tsx
  - src/test/settle.ts
priority: low
ordinal: 9200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the managing session while checking TASK-45. A frontend test in `src/components/__tests__/SettingsModal.test.tsx` named "opening the dialog again shows no old message" (two tests have that name: one for the autostart message, one for the save message) failed once in TASK-33's checks and once in TASK-45's, both times while the computer was busy with other work (a build running in parallel); run again without that load, every test passed. The Release workflow runs `npm run test` before the build, so such a failure stops a release run (before any tag or release exists) and the run has to be started again.

Find out which of the two fails and why it depends on load (for example a wait with a short time limit, or state left from the previous opening of the dialog), reproduce the failure under load if possible (for example during a parallel build or with many test workers), and make the test reliable without weakening what it checks. Only test code should change; if the dialog itself turns out to have a timing bug, show the user the solutions through the question dialog before changing it.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The notes say which test failed, why it depends on load, and how the failure was reproduced (or why it could not be)
- [x] #2 The test passes in repeated runs while the computer is busy, and it still fails when the dialog shows the old message after being opened again
- [x] #3 The other tests with the same kind of dependency that the user added to this task (7 in App.test.tsx, 1 in DeleteConfirmModal.test.tsx) pass with React's scheduler delayed by 1 to 100 ms and while the computer is busy
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
1. Find which test fails and why, before any code change (done: key handlers and the first focus are set in effects; React 19 runs effects in a later scheduler step than the commit, and waitFor/findBy can return in between).
2. Show the solutions through the question dialog (done: «Лише тест (Рекомендовано)»; the App tests and four more added to this task by the user).
3. src/test/settle.ts: `await act(async () => {})`, called right after an action the mocked backend answers, so the answer and the effects of its updates are processed inside act.
4. SettingsModal.test.tsx: openSettings settles after opening; the three tests that press Escape or Ctrl+Enter after a Save settle after it.
5. App.test.tsx: the four openApp helpers settle after renderShownApp and focus the search box inside act.
6. DeleteConfirmModal.test.tsx: run the dialog's own 10 ms focus timer (fake setTimeout) before clicking Delete.
7. CLAUDE.md, Frontend Testing: when to use settle.
8. Verify: the scheduler-delay probe (1 to 100 ms) on the whole suite, deliberate breakages, old and new tests in turns under real CPU load (with the user's yes right before), npm run test:all, npm run lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause (found 2026-11-21, before any code change):
- Two tests share the name "opening the dialog again shows no old message" (autostart message and save message). Both press Escape right after `await waitFor(...)` has seen the message of a Save. TASK-38 saw a third one fail the same way: "a second failure empties the message first, so that it is announced again" (1040 ms: its Ctrl+Enter was ignored and waitFor ran out).
- `useModalKeyboard` adds the document keydown listener in a `useEffect` that depends on the handlers; `handleCancel` and `handleSave` change with `saving`. After the Save's answer, React commits the message and `saving = false` first and runs that effect in a later step: React 19 calls `requestPaint()` at every commit, and the scheduler then yields before the passive effects (scheduler 0.27: `shouldYieldToHost` is true while `needsPaint`), so they run in the next `setImmediate`.
- Testing Library's waitFor (no act) returns after the MutationObserver check plus `setTimeout(0)`. When that timer runs before the scheduler's next `setImmediate`, the test presses Escape while the old listener is still attached; its `handleCancel` still sees `saving = true` and ignores the key, so `onClose` is not called: "expected vi.fn() to be called 1 times, but got 0 times".
- Odds measured with a small Node probe (no load): the timer wins in 0.13-0.2 % of cases. This file has 6 such places, so about 1 run in 100 can fail even without load; load makes the window longer.

Reproduced deterministically without load (probe outside the repo: an extra setup file that delays only the React scheduler's setImmediate by 5 ms, same test file, same code): 6 of 49 tests fail: both "opening the dialog again shows no old message" ("expected vi.fn() to be called 1 times, but got 0 times"), "a second failure empties the message first..." (waitFor 1055 ms), "puts the focus on the theme list when it opens", "a failed save: ... focus stays ..." and "Ctrl+Enter from a control: focus stays on that control" (these three depend on the same gap after the dialog opens: the first focus is also set in an effect). With the delay set to 0 all 49 pass.
The same probe on the whole suite also fails 4 tests of App.test.tsx ("App: where focus goes after a dialog changes the list": the delete dialog tests with Ctrl+Enter); outside this task.

User's choices (question dialog, 2026-11-21, verbatim):
- Solution: «Лише тест (Рекомендовано)». The other option was «Тест і обробник клавіш» (also make useModalKeyboard always call the newest handler; would have needed a release build, a copy to real_db and just smoke).
- The 4 App.test.tsx delete dialog tests with the same dependency: «Додати в цю задачу». The other options were «Окрема задача (Рекомендовано)» and «Лише згадати».

Scope added later (question dialog, 2026-11-21, verbatim): «Усі чотири тут (Рекомендовано)». The other options were «Лише три App-тести», «Окрема задача» and «Лише згадати». The four: three more App.test.tsx tests with the same cause, found by running the whole suite with the scheduler delayed by 20 and 50 ms ("Down moves it onto the selected snippet; Left brings it back, and the snippet stays selected", "opening a damaged snippet for editing says so in the language of the app", "opening a snippet for editing: says so, and the dialog does not open": their openApp copies return before React has run the effects of the startup loads), and DeleteConfirmModal.test.tsx "focus stays on Delete when the button was clicked" (another cause: the dialog moves focus to Cancel again 10 ms after it opens; a test that takes longer saw focus leave Delete; with delays of 1, 2 and 50 ms it failed).

## Changes (test code only; commits 92095d1 tests, 2b43554 CLAUDE.md)
- src/test/settle.ts (new): `settle()` = `await act(async () => {})`, called right after the action the mocked backend answers (rendering the app, opening a dialog, Save). The answer's promise callbacks then run inside act, and act also runs the effects of their updates (renders and passive effects go to React's act queue, which act empties before it resolves). It does not wrap the action: a click inside an outer async act no longer renders at once (a nested act does not flush), so its update could merge with the answer's, and the empty message the "second failure/refusal" tests look for would never be committed.
- SettingsModal.test.tsx: openSettings settles after the providers' load and after opening (getByRole instead of findByRole); the three tests that press Escape or Ctrl+Enter after a Save use settle and expect instead of waitFor. Reopening in the two "opening the dialog again shows no old message" tests still uses findByRole, which checks the dialog as it first appears.
- App.test.tsx: the four openApp helpers (where the screen reader is; where focus goes after a dialog changes the list; a damaged snippet database; a failed copy, auto-type, opening for editing or reading of the settings) settle after renderShownApp, focus the search box inside act and check the selection with expect.
- DeleteConfirmModal.test.tsx, "focus stays on Delete when the button was clicked": the dialog's 10 ms timer that puts focus on Cancel again is run (fake setTimeout and clearTimeout only, while the dialog opens) before the test focuses Delete and clicks.
- CLAUDE.md, Frontend Testing: one bullet on when to use settle.
- No app code changed: no CHANGELOG entry (tests only), no release build, no copy to real_db, no just smoke.

## Verification (2026-11-21)
- Probe (scratchpad, not in the repo): an extra setup file delays only the React scheduler's setImmediate by N ms. Whole suite after the change: 625 of 625 pass with 1, 2, 5, 10, 20, 50 and 100 ms. Before: 1 failure at 1 and 2 ms, 10 at 5 ms, 3 at 20 ms, 4 at 50 ms. The probe's counter confirmed it was active in passing runs (21, 47 and 153 delayed steps in the three files).
- Deliberate breakages, the app code restored after each (git diff of the app code empty afterwards): without `setAutostartError(null)` on close, the autostart "opening the dialog again shows no old message" fails (toBeEmptyDOMElement); without `setSaveError(null)`, the save-message one fails; with focus moved to Cancel after a failed delete, "focus stays on Delete when the button was clicked" fails.
- Under real CPU load, with the user's «Так, запускай (Рекомендовано)» right before. A first attempt (same answer) did not load the computer: my load processes exited at once (Start-Process split the node -e script), so the user was asked again and it was run once more. 20 busy node processes at below-normal priority, the tests at the same priority; the old (develop) and new versions of the three files in turns, 5 pairs, each set 10 copies (4 SettingsModal, 2 App, 4 DeleteConfirmModal; 394 tests). Old: 2 of 5 runs failed, 6 tests: "opening the dialog again shows no old message" once ("expected vi.fn() to be called 1 times, but got 0 times"), "a second failure empties the message first, so that it is announced again" twice (waitFor ran out), "focus stays on Delete when the button was clicked" three times. New: 0 of 5 runs failed. All 20 load processes ran, none was left afterwards. The temporary copies (task46-probe-tmp in the repo, outside src) were removed.
- New version without load: 10 runs in a row of the same 10 copies, all 394 tests passed each time.
- `npm run test:all`: 625 frontend tests (26 files), 389 Rust tests (1 ignored). `npm run lint` passes. No act() warnings in the output.
- The user's autostart values, read only, at the end: the Run entry QuickSnippets absent, the StartupApproved mark 02 00 00 00 00 00 00 00 00 00 00 00. The app was not started at all.

Definition of Done #3 to #5 are checked as satisfied or not applicable: CHANGELOG gets no entry because only tests changed; there is no new user-facing string; nothing changed in focus, dialogs or what screen readers read, so no release build and no `just smoke`.

## Noticed, no task created
1. In the app itself, Escape or Ctrl+Enter pressed in the few milliseconds between the screen update after a Save and React's effects still reaches the old handler (the settings dialog then ignores it as if saving). A person cannot press that fast; the user chose to leave the app as it is («Лише тест (Рекомендовано)»). If it is ever changed: useModalKeyboard keeps the newest handlers in a ref updated in a layout effect and adds the listener once per opening.
2. The probe covers one kind of timing only (React's step late by 1 to 100 ms); other timer orders are not covered.

## Merge (2026-11-21)
Merged into develop with git flow feature finish --no-ff: feature/reliable-dialog-tests (merge 129429b; tests 92095d1, CLAUDE.md 2b43554, Backlog a9288a5). The tree of develop after the merge is the tree of the branch (git diff a9288a5 129429b is empty); the test code is the code that npm run test:all, npm run lint, the probe and the load runs checked. Nothing pushed, no tag, version unchanged; not archived: left to the managing session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Test-only change; the app is unchanged (no changelog entry, release build, real_db copy or smoke).

Cause: the settings dialog test "opening the dialog again shows no old message" (both tests of that name) and six other tests pressed a key or checked focus right after waitFor/findBy had seen the backend's answer on screen. The dialogs and the main window set their key handlers and a dialog's first focus in effects (useModalKeyboard, useKeyboard, ModalOverlay); React 19 runs effects in a later scheduler step than the screen update, so on a busy computer the key reached the handler from before the answer. In the settings dialog that is the handler of the save in progress, which ignores Escape and Ctrl+Enter ("expected vi.fn() to be called 1 times, but got 0 times"). One more test raced the delete dialog's own 10 ms focus timer.

Fix: new src/test/settle.ts (`await act(async () => {})` right after the action), used in SettingsModal.test.tsx and in the four openApp helpers of App.test.tsx; DeleteConfirmModal.test.tsx runs the dialog's timer before clicking. CLAUDE.md says when to use settle.

Verified: the whole suite with React's scheduler delayed by 1 to 100 ms (625 of 625; before up to 10 failures); old and new tests in turns under CPU load (old 2 of 5 runs failed, including this test; new 0 of 5); 10 more runs without load; deliberate breakages are still caught; npm run test:all and npm run lint pass.
<!-- SECTION:FINAL_SUMMARY:END -->
