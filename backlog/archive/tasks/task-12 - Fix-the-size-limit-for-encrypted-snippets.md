---
id: TASK-12
title: Fix the size limit for encrypted snippets
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T12:39:00Z'
updated_date: '2026-11-19T12:21:00Z'
labels:
  - bug
  - backend
  - frontend
  - model-sonnet
  - effort-high
milestone: m-5
dependencies: []
references:
  - src-tauri/src/db.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/crypto.rs
  - src/components/CreateSnippetModal.tsx
  - src/i18n/translations.ts
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An encrypted snippet holds less content than the app allows. The create dialog caps content at 65,536 characters (maxLength) and the backend at 65,536 bytes (MAX_CONTENT_LENGTH in src-tauri/src/commands.rs), but the snippets table checks length(content) <= 65536 against the stored text. For an encrypted snippet that text is "v2:" plus the base64 of salt, nonce, ciphertext and tag, so only about 49,105 bytes of plaintext fit. Larger content fails with a raw SQLite error instead of a clear message. The limit existed before 0.3.0 (about 49,108 bytes with the legacy format); TASK-2 found it while adding the v2 format.

SQLite cannot change a CHECK constraint in place: raising the limit means rebuilding the table, which holds the only copy of the user's snippets.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`) for a fix in validation and messages. If the fix rebuilds the table, use Claude Opus 5.5 (`/model opus`) instead: a mistake there loses user data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No content that the create dialog accepts ends in a raw database error, for plain and encrypted snippets
- [x] #2 The size limit for encrypted snippets that the user is told matches what can actually be stored, and the message exists in en, uk and de
- [x] #3 If the table schema changes, existing databases (plain, legacy encrypted and v2 encrypted snippets) migrate without data loss, and Rust tests cover the migration
- [x] #4 Tests cover the largest encrypted snippet that fits and the smallest one that does not
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Agreed approach (user, 2026-11-19): the database schema stays as it is. The backend checks the real limit before anything is written, and the dialogs show a translated message with the text's size and the limit under the Content field.

1. Rust tests first: create plain 65,536 bytes ok and 65,537 refused; create encrypted 49,105 bytes ok (stored blob 65,535 bytes) and 49,106 refused with a clear error, not a database error; update plain at the same limits. The error names the size and the limit.
2. Backend (commands.rs): MAX_ENCRYPTED_CONTENT_LENGTH = 49,105, checked before encryption; error text "Content too long ... (N bytes, max M bytes)". crypto.rs and db.rs unchanged.
3. Frontend tests first: create and edit dialogs show the message with size and limit under Content in en, uk and de, focus the Content field, leave the Title error empty.
4. Frontend: parse the backend error, new strings contentTooLong and encryptedContentTooLong (en, uk, de, Ukrainian plural of "байт").
5. CHANGELOG [Unreleased] Fixed; npm run test:all and npm run lint.
6. Release build, just smoke with the user's permission, copy the exe to C:\5-quicksnippets\real_db\.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Agreed approach (2026-11-19)

The user chose the first of two ways: keep the database as it is and check the real limit before anything is written (the other way was to rebuild the table so that an encrypted snippet holds 64 KB too). For the message the user chose the text's size together with the limit, e.g. «Текст задовгий для зашифрованого сніпета: 52300 байтів, можна до 49105». The schema and the stored data do not change, so going back to 0.3.x stays safe.

## Before the change

- Encrypted: create_snippet_inner allowed 65,536 bytes and then encrypted. Above 49,105 bytes the v2 blob is longer than 65,536 bytes and the INSERT failed with "CHECK constraint failed: length(content) <= 65536"; the dialog showed that under Title and focused Title. The new tests confirmed it on the old code.
- Plain: the textarea's maxLength counts UTF-16 units (65,536), the backend bytes of UTF-8. 32,769 or more Cyrillic letters gave "Content too long (max 65536 bytes)" in English under Title. The edit dialog went the same way (update_snippet_inner).

## Implementation

- c3ff754, commands.rs: MAX_ENCRYPTED_CONTENT_LENGTH = 49_105 (its v2 blob is 65,535 bytes; 49,106 bytes give 65,539), checked before encrypting. content_too_long() writes "Content too long[ for an encrypted snippet] (N bytes, max M bytes)" for create and update. crypto.rs and db.rs are unchanged.
- c3ff754, frontend: parseContentTooLong (src/utils/errors.ts) reads that error; contentTooLong(size, max, encrypted) in en, uk (with the plural of «байт») and de. The create and edit dialogs show it under Content, set aria-invalid on Content, leave the Title error empty and focus Content. The numbers have no digit grouping, so screen readers say each as one number.
- Rust tests: plain 65,536 bytes stored and 65,537 refused; 32,768 Cyrillic letters stored and 32,769 refused (the limit counts bytes); encrypted 49,105 bytes of Cyrillic stored as a 65,535-byte blob that decrypts back, 49,106 refused with the clear error and nothing stored; 65,536 bytes with a password refused; the limit pinned to the format and the column (the database stores encrypt(49,105 bytes), and refuses encrypt(49,106 bytes), 65,539 bytes, with its CHECK); update over the limit keeps the old content. 5 of them failed on the old code.
- Vitest: parseContentTooLong; contentTooLong in three languages and the Ukrainian plural; the create dialog (plain and encrypted message under Content, focus moves there from Title and from the confirmation field); the edit dialog. All 8 failed on the old code.
- a6ead14, scripts/smoke-nvda.ps1: a new step after the password mismatch pastes 50,000 bytes of Cyrillic text with a password and presses Ctrl+Enter in the confirmation field. It expects «Текст задовгий для зашифрованого сніпета: 50000 байтів, можна до 49105» once and focus on Content, and forbids the Title error, the mismatch message, "CHECK constraint" and "Content too long".
- 44aad23: CHANGELOG [Unreleased], Fixed.
- npm run test:all: 462 frontend tests in 25 files, 235 Rust tests (1 ignored). npm run lint passes.

## Noticed, not changed (outside TASK-12)

- Titles: create_snippet_inner checks title.len() in bytes (max 50), while the dialog and the database count characters. A title of 26 to 50 Cyrillic letters is refused on create with "Title too long (max 50 chars)" in English under Title. Renaming in the edit dialog works, because update_snippet_inner does not check the title. A title of two emoji passes the dialog (4 UTF-16 units) and the backend (8 bytes), but the database CHECK counts 2 characters and the user gets a raw CHECK error.
- The content textarea keeps maxLength=65536 (UTF-16 units): a longer paste is cut off silently instead of getting the new message.

## Verification (2026-11-19)

- Release build of 44aad23 (app code as in c3ff754; the later commits change only scripts/smoke-nvda.ps1 and Backlog): 3,852,288 bytes, 512 bytes more than the local TASK-23 build of 9271639.
- just smoke, first run (with the user's permission): 78 of 78 steps, 278 of 278 NVDA checks, no errors in the NVDA log. The new step heard «Текст задовгий для зашифрованого сніпета: 50000 байтів, можна до 49105» once, then «Вміст, редактор, неправильне введення, багатор…»: the report cuts a step's speech at 500 characters.
- b46c6db splits that step in two (paste the text, then Ctrl+Enter), expects «Вміст» and forbids twenty words of the pasted text in a row. Second run on the same exe (with the user's permission, several minutes later): 79 of 79 steps, 280 of 280 NVDA checks. The Ctrl+Enter step: "Текст задовгий для зашифрованого сніпета: 50000 байтів, можна до 49105 | Вміст, редактор, неправильне введення, багаторядковий, секрет секрет секрет xx". The message comes first, then the field and only the line at the cursor. The NVDA log had one error of NVDA's own script_caret_newLine, known from the TASK-18, TASK-19 and TASK-21 runs.
- The smoke test does not cover the plain-snippet message or the edit dialog: they take the same code path and are covered by the Vitest and Rust tests.
- AC #3: the schema did not change (no diff in db.rs or crypto.rs against develop), so there is no migration to cover.
- Build copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-12-44aad23.exe (same SHA-256 as the build).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Saving a snippet with too much text now gives a clear, translated message under Content, and focus moves there. Before, an encrypted snippet over 49,105 bytes failed with a raw database error ("CHECK constraint failed"), and a plain snippet over 65,536 bytes got an English backend message; both were shown under Title.

Agreed approach (user): the schema stays as it is. The backend checks the real limit before anything is written: 65,536 bytes of UTF-8 for a plain snippet, 49,105 for an encrypted one (the largest whose v2 blob, 65,535 bytes, fits the CHECK of the content column). The error names the size and the limit, and the create and edit dialogs say it in en, uk or de, e.g. «Текст задовгий для зашифрованого сніпета: 52300 байтів, можна до 49105». crypto.rs, db.rs and the stored formats are unchanged, so going back to 0.3.x stays safe.

Verified: boundary tests (49,105 stored and 49,106 refused for encrypted, 65,536 and 65,537 for plain, also in Cyrillic); npm run test:all (462 Vitest, 235 Rust); npm run lint; just smoke twice on the release build, the second run 79 of 79 steps and 280 of 280 NVDA checks, with a new step for the message.

Follow-ups, not done: create_snippet_inner checks the title in bytes, so a title of 26 to 50 Cyrillic letters is refused on create with an English message; the content field's maxLength silently cuts a longer paste.
<!-- SECTION:FINAL_SUMMARY:END -->
