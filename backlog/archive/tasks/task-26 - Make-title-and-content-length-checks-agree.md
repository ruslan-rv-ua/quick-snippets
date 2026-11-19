---
id: TASK-26
title: Make title and content length checks agree
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T12:26:00Z'
updated_date: '2026-11-19T12:41:00Z'
labels:
  - bug
  - backend
  - frontend
  - model-sonnet
  - effort-high
milestone: m-5
dependencies: []
references:
  - src-tauri/src/commands.rs
  - src/components/CreateSnippetModal.tsx
  - src/components/EditSnippetModal.tsx
  - src/i18n/translations.ts
priority: medium
ordinal: 5500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-12. The create and edit dialogs, the backend and the database measure a title and the content in different units, so some input that one of them accepts is refused by another, without a clear message.

Title: the dialogs count UTF-16 code units (`title.length`, 3 to 50), `create_snippet_inner` in src-tauri/src/commands.rs counts bytes of UTF-8 (`title.len()`), and the database CHECK counts characters (`length(title)` on a TEXT column). A title of 26 to 50 Cyrillic letters is refused on create with "Title too long (max 50 chars)" in English under Title. Renaming a snippet to such a title works, because `update_snippet_inner` does not check the title. A title of two emoji passes the dialog (4 UTF-16 units) and the backend (8 bytes), but the database counts 2 characters, and the user gets a raw CHECK error.

Content: the content field has maxLength=65536 (UTF-16 code units), so a longer paste is cut off silently and the clear message added in TASK-12 never appears. Plain Latin text cut this way is saved without any warning. Since TASK-12 the backend checks the real limits before anything is stored: 65,536 bytes of UTF-8 for a plain snippet, 49,105 for an encrypted one.

The database schema stays as it is (no change to the CHECK constraints), so going back to 0.3.x stays safe. Error messages must stay translated and announced by screen readers: the field with the error gets the focus and its FieldError message.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Validation in the dialogs and the backend, plus messages that NVDA must announce.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A title of 3 to 50 characters is accepted on create and on edit in any script, Cyrillic and emoji included; any other title gets the translated title message under Title, never a backend or database error
- [x] #2 Content longer than a snippet can hold is never cut off silently: the user gets the translated message from TASK-12 under Content, and the text in the field stays as typed or pasted
- [x] #3 The database schema does not change
- [x] #4 Tests cover Cyrillic and emoji titles of 50 and 51 characters on create and edit, and content longer than 65,536 characters
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
Agreed with the user (2026-11-19): the title field has no length limit of its own; a title outside 3 to 50 characters gets a message under Title on save that also names the current count (e.g. «Назва має бути від 3 до 50 символів, зараз 57»). The content field has no limit either; a too long text gets the TASK-12 message under Content on save and stays in the field.

1. Rust tests first: create and update with Cyrillic and emoji titles of 50 (stored) and 51 characters (clear error, nothing stored or changed), two emoji refused with the clear error instead of a CHECK error.
2. Backend (commands.rs): one title check for create and update, counting Unicode code points like SQLite length() on TEXT; error "Title must be 3 to 50 characters (N characters)". db.rs unchanged.
3. Frontend tests first: count code points; parse the backend title error; titleLength(count) in en, uk, de; create and edit dialogs accept 50 and refuse 51 Cyrillic and emoji characters with the message under Title; no maxLength on title and content; content over 65,536 characters stays in the field with the TASK-12 message.
4. Frontend: shared title check in src/utils, dialogs without maxLength, translated title message with the count.
5. Smoke script: update the expected title message; add a cheap step if possible.
6. CHANGELOG, npm run test:all, npm run lint, release build, just smoke (with permission), copy to real_db.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Agreed with the user (2026-11-19)

The user chose the recommended option in all three questions: the title field has no length limit of its own (a long title gets a message on save instead of being cut); the content field has none either (a too long text stays in the field and gets the TASK-12 message on save); and the title message names the current number of characters, e.g. «Назва має бути від 3 до 50 символів, зараз 57», because some emoji (flags, families) count as several characters.

## Implementation

- 75d15fe, commands.rs: TITLE_MIN_CHARS = 3, TITLE_MAX_CHARS = 50 and check_title(), which counts Unicode code points (title.chars().count()) as SQLite length() does on the TEXT column. create_snippet_inner and update_snippet_inner (also for encrypted snippets) call it before anything is stored; error "Title must be 3 to 50 characters (N characters)". The old byte check and its English messages are gone. db.rs and crypto.rs are unchanged.
- 75d15fe, frontend: src/utils/title.ts (countCharacters via Array.from, isTitleLengthValid); parseTitleLength in src/utils/errors.ts reads the backend error. The translation titleValidation became titleLength(count) in en, uk and de. Both dialogs validate with the same count, show titleLength under Title, translate the backend's title error, and the title input and the content textarea no longer have maxLength.
- 094e18d, scripts/smoke-nvda.ps1: the title message now ends with ", зараз N" (exact names TitleEmpty and TitleTooLong; TitleInvalid stays the common start for Forbid). New step 8 pastes a title of 51 Cyrillic letters and expects «…, зараз 51» once, focus on Title, and forbids "Title too long" and "CHECK constraint". The plain snippet's title is now «smoke звичайний сніпет із довгою назвою» (39 characters, 68 bytes), which the old backend refused on create. The search order is unaffected: the fuzzy score counts matched characters, not the title length.
- 190d2a9: CHANGELOG [Unreleased], Fixed (two entries).

## Tests (written first, red on the old code)

- Rust (7 of the 11 new tests failed on the old code): create with 50 Cyrillic letters and 50 emoji stored, 51 of either refused with the clear error and nothing stored, two emoji refused with the clear error instead of a CHECK error, three emoji stored; update with 50 Cyrillic and 50 emoji stored, 51 refused with title and content unchanged, two emoji refused, an encrypted snippet's title checked too; the limits pinned to the database (3 and 50 emoji, 50 Cyrillic stored by db::create_snippet, 2 and 51 emoji and 51 Cyrillic refused by its CHECK).
- Vitest (19 failed on the old code): countCharacters and isTitleLengthValid; parseTitleLength; titleLength in three languages; create dialog with 50 and 51 Cyrillic and emoji characters, two emoji, no maxLength, the backend title error translated; edit dialog with 50 and 51 Cyrillic and emoji characters for plain and encrypted snippets; content of 70,000 (create) and 65,537 Cyrillic (edit) characters stays in the field, is sent whole and gets the size message under Content.

## Verification (2026-11-19)

- npm run test:all: 489 Vitest tests in 26 files, 245 Rust tests (1 ignored). npm run lint passes.
- AC #3: no diff in src-tauri/src/db.rs or crypto.rs against develop.
- Release build of 190d2a9: 3,852,800 bytes (512 more than TASK-12's build).
- just smoke with the user's permission: 80 of 80 steps, 284 of 284 NVDA checks. Step 7 (create, empty title): «Назва має бути від 3 до 50 символів, зараз 0». Step 8 (51 Cyrillic letters): «Назва має бути від 3 до 50 символів, зараз 51», nothing else. Step 13 (edit, empty title) as step 7. The NVDA log had the one known error of NVDA's own script_caret_newLine, as in TASK-12 and earlier runs.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-26-190d2a9.exe (same SHA-256 as the build).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Titles of 3 to 50 characters are now accepted in any script, Cyrillic and emoji included, on create and on rename, and no field cuts text silently any more.

Before, the dialogs counted UTF-16 units, the backend bytes (only on create) and the database characters: a title of 26 to 50 Cyrillic letters was refused on create with an English message, two emoji ended in a raw CHECK error, and the fields' maxLength silently cut a long pasted title or content.

Now the backend (check_title, create and update) and the dialogs (src/utils/title.ts) count Unicode code points like SQLite length(). A title out of its limits gets a translated message under Title with the current count, e.g. «Назва має бути від 3 до 50 символів, зараз 57» (the user's choice); the backend's title error is translated too. The title and content fields have no maxLength: a too long text stays in the field and gets the TASK-12 message under Content on save. The database schema is unchanged.

Verified: npm run test:all (489 Vitest, 245 Rust), npm run lint, just smoke 80 of 80 steps and 284 of 284 NVDA checks with a new step for a 51-letter title.
<!-- SECTION:FINAL_SUMMARY:END -->
