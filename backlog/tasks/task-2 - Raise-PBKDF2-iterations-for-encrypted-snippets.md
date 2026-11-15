---
id: TASK-2
title: Raise PBKDF2 iterations for encrypted snippets
status: To Do
assignee: []
created_date: '2026-11-15T18:58:00Z'
updated_date: '2026-11-15T23:17:00Z'
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

Start with research, because this is a trade-off: every copy or autotype of an encrypted snippet waits for one key derivation, and the release build now uses opt-level = "z", which may make PBKDF2 slower. Check the current OWASP recommendation, measure the derivation time at 100,000 and 600,000 iterations in the release build, and compare ways to tell the old format from the new one: a version marker in the blob, or trying both iteration counts on decrypt (which doubles the wait for a wrong password). Also weigh Argon2id, which OWASP prefers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research findings are recorded in the task notes before the code change: current OWASP numbers, measured key derivation time at 100,000 and 600,000 iterations in the release build, and the chosen way to tell old and new formats apart, with the reason
- [ ] #2 New encryptions meet the current OWASP minimum for the chosen algorithm (600,000 iterations for PBKDF2-HMAC-SHA256 at the time of writing)
- [ ] #3 Snippets encrypted with the old 100,000-iteration format still decrypt
- [ ] #4 Old-format snippets are re-encrypted in the new format when edited (or a documented migration exists)
- [ ] #5 Rust tests cover old-format decrypt and new-format round trip
- [ ] #6 README (en/uk/de), SECURITY.md and CHANGELOG state the new key derivation parameters
<!-- AC:END -->
