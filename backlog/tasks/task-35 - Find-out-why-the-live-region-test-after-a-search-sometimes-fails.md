---
id: TASK-35
title: Find out why the live region test after a search sometimes fails
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-20T01:27:00Z'
updated_date: '2026-11-20T03:41:00Z'
labels:
  - testing frontend accessibility investigation model-opus effort-medium
milestone: m-6
dependencies: []
references:
  - src/components/__tests__/App.test.tsx
  - src/App.tsx
  - src/components/SnippetList.tsx
priority: medium
ordinal: 3750
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-31. The frontend test `src/components/__tests__/App.test.tsx` > "App: where the screen reader is" > "when a search keeps the same snippet selected, the live region says it" (line 396) sometimes fails with `expected '' to be 'Greeting'`. During TASK-31 (2026-11-20) it failed in 2 of 9 runs of `npm run test`, 2 of 7 on develop after the merge; the check run after TASK-31 passed (496 of 496). src/ had not changed since 11ffa3c, so the flakiness is older than TASK-31.

The test opens the app, waits until the first snippet ("Greeting") is selected, types "g", waits until `search_snippets` is called, and then waits for the live region of the list (`.snippet-list-wrapper [aria-live]`, see src/components/SnippetList.tsx) to say "Greeting", with the default waitFor timeout of 1 s, after the 100 ms search debounce.

First find out which it is: a test that is too slow when the computer is busy, or an app that can really miss this announcement, for example when an answer from the start-up (App.tsx loads the list twice before `frontend_ready`) arrives after the answer to the search, or when the live region is emptied before the check. A real miss would mean that NVDA users sometimes do not hear the selected snippet after a search; then fix the app, not only the test. Repeat the run many times (for example `npx vitest run src/components/__tests__/App.test.tsx` in a loop), also while the processor is busy (for example during a Rust build), and give the failure rate before and after.

The Release workflow runs `npm run test` before the build, and CI runs it on pull requests: a flaky failure stops a release (safely, before the tag exists) and needs a rerun. Planned before TASK-30 by the user's choice (2026-11-20). Present the cause and the solutions through the question dialog before changing code.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort medium (`/effort medium`). A timing problem that may hide a missed announcement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The cause is found and written in the task notes: a test that is too slow, or the way the app misses the announcement
- [x] #2 The user chose the fix through the question dialog; if the app can miss the announcement, the app is fixed, not only the test
- [x] #3 The test passes in at least 50 runs in a row, also while the processor is busy, and still fails when the announcement is removed from the app
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
1. Reproduce: run src/components/__tests__/App.test.tsx in a loop, idle and with the processor busy; a temporary diagnostic test logs the order of list answers, the 200 ms announcement timer and the live region.
2. Present the cause and the options through the question dialog (done: the user chose to fix the app).
3. useSearchLogic: remember the query each list was loaded for (listQuery) and pass it through App to SnippetList.
4. SnippetList: announce only when the list for the current query arrives, not a list loaded again for another reason; keep the timer in a ref and cancel it only for a new query, another selected snippet or unmount.
5. Tests: SnippetList unit tests and App tests for a reload while a search waits and right after its results; they must fail on develop.
6. Verify: 50+ runs in a row idle and with the processor busy, the test fails with the announcement removed; npm run test:all, npm run lint; release build, just smoke (ask first), copy to real_db; CHANGELOG Fixed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Investigation (2026-11-20)

- Before the fix, `npx vitest run src/components/__tests__/App.test.tsx` failed in 1 of 30 runs with the processor idle and in 4 of 30 runs with it busy (20 busy node processes on 20 logical processors), always this test with `expected '' to be 'Greeting'`. TASK-31 had seen 2 of 9 and 2 of 7 runs of `npm run test`.
- A temporary diagnostic test (not committed) repeated the scenario 25 times per run and logged the order of the list answers, the 200 ms announcement timer and the live region. It failed in 4 of 25 repeats, every time in the same order.
- Cause: SnippetList announces the first result 200 ms after the results arrive when the search keeps the same snippet selected (live region `.snippet-list-wrapper [aria-live]`). It took any new list after a query change for the results, and the cleanup of its effect cancelled the waiting 200 ms timer whenever a new list arrived. The test types "g" as soon as the first snippet is selected, while the lists of the start-up are not always all rendered (App.tsx loads the list twice before frontend_ready, and the window focus of renderShownApp loads it once more). In every failed repeat the last start-up list, loaded for the empty query, was rendered in the same act() as the typed "g": SnippetList took it for the results and set the timer; the search answer 100 ms later re-ran the effect, its cleanup cancelled the timer, and the live region stayed empty. In the passing repeats that list was rendered before the test typed.
- Not only the test: the app can miss the announcement too. The case of the test does not happen in the app, where the window appears only after the start-up loads (frontend_ready). But the app loads the list again each time the window is shown or gets the keyboard back (onShow, from the DOM focus event and from window:show). Two exact App scenarios lost the announcement every time on develop: such a reload answering while a search waits for its results, and a reload within 200 ms after the results. In everyday use this needs an unlucky moment: typing right as the window appears on a busy computer, or the keyboard coming back to the page during a search.

## Decision (question dialog, 2026-11-20)

The user chose «Виправити програму (рекомендовано)». The other option was «Виправити лише тест» (the test would wait for the end of the start-up before typing; the weakness of the app would stay).

## Changes (commits 3a007a7 and 0bee596 on feature/search-announcement-reload)

- `src/hooks/useSearchLogic.ts`: new `listQuery`, the query the list in `snippets` was loaded for, set together with the list. A list loaded again before the search runs keeps the query it was loaded for.
- `src/App.tsx` passes it to SnippetList.
- `src/components/SnippetList.tsx`: only the list loaded for the current query counts as the results; a list loaded again for another reason in between is shown but not announced. The 200 ms timer is kept in a ref and cancelled only by a new query, another selected snippet or unmount, so a list loaded again after the results no longer cancels it. It stays silent when another snippet was selected while the results were awaited: NVDA has read it (before, the live region said the snippet the results selected a second time). "No results" and the rule "speak only what NVDA does not read itself" are unchanged.
- Tests: 3 new SnippetList tests (a list loaded again for the previous query while waiting; the results loaded again right after they arrived; another snippet selected while waiting), 2 new App tests (the whole list loaded again while a search waits, held until after the typing; the results loaded again before the announcement; the search mock of this describe now filters by title), 1 new useSearchLogic test (listQuery). All 6 fail on the code of develop. The test of this task is unchanged.
- CHANGELOG [Unreleased] Fixed: one entry (moved after the two autostart entries in 0bee596).
- No new user-facing strings; src/i18n/translations.ts unchanged.

## Verification on the branch

- With the processor idle: `npx vitest run src/components/__tests__/App.test.tsx` 60 runs in a row, 0 failed (before: 1 of 30); `npx vitest run` (all 502 tests) 20 runs in a row, 0 failed.
- Announcement removed (the timer's `setLiveText(text)` replaced, then restored): the test of this task failed in 3 of 3 runs with `expected '' to be 'Greeting'`; in the two files 9 tests failed (6 SnippetList, 3 App).
- The diagnostic test on the fixed code: 100 of 100 repeats passed (before: 21 of 25); in 13 of them the old race happened (the last start-up list rendered together with the typed "g") and the announcement still came. Its two App scenarios passed 4 of 4 each (on develop: failed every time).

## Verification under load, build and smoke (2026-11-20)

- With the processor busy (20 busy node processes on 20 logical processors, and the release build at the start): `npx vitest run src/components/__tests__/App.test.tsx` 60 runs in a row, 0 failed (before the fix: 4 of 30), 7.6 to 9.4 s per run instead of about 4.5 s idle; `npx vitest run` 20 runs in a row, 0 failed, 11.6 to 18.2 s per run instead of about 5.4 s.
- `npm run test` 502 passed; `npm run test:rust` 299 passed, 1 ignored; `npm run lint` passes.
- Release build of 0bee596 (`npx tauri build --no-bundle`, 20.11.2026 05:13) copied to `C:\5-quicksnippets\real_db\quick-snippets-TASK-35-0bee596.exe`, SHA-256 6822989CB55CC9D6A1E9008C8F02C6F56E9A2310ECC2B6003E5BC0E5985AFBAC, the same as the build.
- `just smoke` on that build with the user's permission: 82 of 82 steps, 301 of 301 NVDA checks, 172 s. The search steps pass (46, 48, 55, 60, 62), among them step 60, where the live region says the first found snippet after Backspace. The autostart values were restored as before the test (no Run entry; the old Task Manager mark 02 00 00 00 00 00 00 00 00 00 00 00). `just smoke-tray` not run: the change does not touch how the window is created, started in the tray or shown.
- Definition of Done #4: the task adds no strings to the interface (src/i18n/translations.ts unchanged).
<!-- SECTION:NOTES:END -->
