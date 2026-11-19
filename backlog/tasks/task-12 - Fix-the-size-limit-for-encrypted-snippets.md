---
id: TASK-12
title: Fix the size limit for encrypted snippets
status: To Do
assignee: []
created_date: '2026-11-16T12:39:00Z'
updated_date: '2026-11-19T07:10:00Z'
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
- [ ] #1 No content that the create dialog accepts ends in a raw database error, for plain and encrypted snippets
- [ ] #2 The size limit for encrypted snippets that the user is told matches what can actually be stored, and the message exists in en, uk and de
- [ ] #3 If the table schema changes, existing databases (plain, legacy encrypted and v2 encrypted snippets) migrate without data loss, and Rust tests cover the migration
- [ ] #4 Tests cover the largest encrypted snippet that fits and the smallest one that does not
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
