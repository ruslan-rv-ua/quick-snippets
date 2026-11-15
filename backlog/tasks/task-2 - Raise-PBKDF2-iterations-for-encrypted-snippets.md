---
id: TASK-2
title: Raise PBKDF2 iterations for encrypted snippets
status: To Do
assignee: []
created_date: '2026-11-15T18:58:00Z'
labels:
  - security backend
dependencies: []
references:
  - >-
    https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Snippet passwords are stretched with PBKDF2-HMAC-SHA256 at 100,000 iterations (src-tauri/src/crypto.rs). Current OWASP guidance for PBKDF2-HMAC-SHA256 is 600,000. The stored blob is base64(salt || nonce || ciphertext+tag) with no format version, so existing snippets must keep decrypting after the change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New encryptions use at least 600,000 iterations
- [ ] #2 Snippets encrypted with the old 100,000-iteration format still decrypt
- [ ] #3 Old-format snippets are re-encrypted in the new format when edited (or a documented migration exists)
- [ ] #4 Rust tests cover old-format decrypt and new-format round trip
- [ ] #5 README (en/uk/de), SECURITY.md and CHANGELOG state the new iteration count
<!-- AC:END -->
