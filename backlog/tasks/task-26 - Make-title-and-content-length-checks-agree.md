---
id: TASK-26
title: Make title and content length checks agree
status: To Do
assignee: []
created_date: '2026-11-19T12:26:00Z'
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
- [ ] #1 A title of 3 to 50 characters is accepted on create and on edit in any script, Cyrillic and emoji included; any other title gets the translated title message under Title, never a backend or database error
- [ ] #2 Content longer than a snippet can hold is never cut off silently: the user gets the translated message from TASK-12 under Content, and the text in the field stays as typed or pasted
- [ ] #3 The database schema does not change
- [ ] #4 Tests cover Cyrillic and emoji titles of 50 and 51 characters on create and edit, and content longer than 65,536 characters
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
