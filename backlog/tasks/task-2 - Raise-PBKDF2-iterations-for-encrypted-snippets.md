---
id: TASK-2
title: Raise PBKDF2 iterations for encrypted snippets
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-15T18:58:00Z'
updated_date: '2026-11-16T01:17:00Z'
labels:
  - security
  - backend
  - model-opus
  - effort-high
milestone: m-1
dependencies: []
references:
  - >-
    https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
  - src-tauri/src/crypto.rs
  - src-tauri/src/commands.rs
  - SECURITY.md
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Snippet passwords are stretched with PBKDF2-HMAC-SHA256 at 100,000 iterations (src-tauri/src/crypto.rs). Current OWASP guidance for PBKDF2-HMAC-SHA256 is 600,000. The stored blob is base64(salt || nonce || ciphertext+tag) with no format version, so existing snippets must keep decrypting after the change.

Start with research, because this is a trade-off: every copy or autotype of an encrypted snippet waits for one key derivation, and the release build now uses opt-level = "z", which may make PBKDF2 slower. Check the current OWASP recommendation, measure the derivation time at 100,000 and 600,000 iterations in the release build, and compare ways to tell the old format from the new one: a version marker in the blob, or trying both iteration counts on decrypt (which doubles the wait for a wrong password). Also weigh Argon2id, which OWASP prefers.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). Security-sensitive design with backward compatibility for stored user data: a mistake can lock users out of their encrypted snippets, so this needs careful reasoning and thorough verification.
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. crypto.rs: add the "v2:" format (600,000 iterations, marker as GCM associated data), keep the old decrypt path at 100,000, add `is_current_format`, keep derived keys in `Zeroizing` so they are wiped on every path.
2. db.rs: add `replace_encrypted_blob` (conditional UPDATE, `updated_at` untouched).
3. commands.rs: in `activate_snippet_get_content`, re-encrypt an old-format snippet after a successful decrypt; verify before replacing; never fail the activation because of it.
4. Cargo.toml: `[profile.release.package.sha2] opt-level = 3`; check the release exe size before and after.
5. Tests: known-answer blobs (an old blob made by the unmodified v0.2.1 code; a v2 blob made by an independent .NET implementation), round trips, wrong password, tampered marker, migration and its failure paths.
6. Cross-checks outside the test suite: v0.2.1 code against a v2 blob; .NET decrypts a v2 blob made by the new code.
7. Docs: README (en, uk, de), SECURITY.md, CHANGELOG.md, CLAUDE.md module table, module docs in crypto.rs.
8. `npm run test:all`, `npm run lint`, release build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research (2026-11-16), recorded before any code change

### OWASP Password Storage Cheat Sheet (read 2026-11-16)
- Order of preference: Argon2id; scrypt if Argon2id is unavailable; bcrypt for legacy systems; PBKDF2 when FIPS-140 compliance is required.
- PBKDF2-HMAC-SHA256: 600,000 iterations (recommended). PBKDF2-HMAC-SHA512: 220,000. PBKDF2-HMAC-SHA1: 1,400,000, legacy only.
- Argon2id minimum: m=19456 KiB (19 MiB), t=2, p=1, or the equivalent m=47104 KiB (46 MiB), t=1, p=1.
- General rule: one derivation should take less than one second.
- Raising the work factor: re-hash when the user next authenticates, and store the algorithm and work factor with each hash.

### Measured key derivation time
Machine: Intel Core i5-14500 (has the SHA extensions), Windows 11, rustc 1.99.1. Measured in a standalone binary built with the crate versions from Cargo.lock (pbkdf2 0.12.2, sha2 0.10.9, hmac 0.12.1) and a copy of [profile.release] (opt-level "z", lto, codegen-units 1, panic abort, strip). Median of 15 runs.
- Release profile as it is: 100,000 iterations = 26 ms; 600,000 = 151 ms.
- Same profile at opt-level 3: 100,000 = 8 ms; 600,000 = 50 ms. So opt-level "z" makes PBKDF2 about 3 times slower.
- Release profile with only the sha2 crate at opt-level 3 ([profile.release.package.sha2]): 100,000 = 12 ms; 600,000 = 72 ms. Adding hmac, pbkdf2 and digest to the override changes nothing. Cost in the test binary: about 7 KB.
- Software SHA-256 (sha2 feature force-soft; models CPUs without the SHA extensions): release profile as it is: 100,000 = 67 ms; 600,000 = 396 ms. With the sha2 override: 35 ms and 209 ms.
- Argon2id for comparison (argon2 0.5, release profile): 19 MiB t=2 p=1 = 20 ms; 46 MiB t=1 p=1 = 29 ms.

### Facts about the stored format
- The crypto code is the same in every release from v0.1.0 to v0.2.1 (non-comment lines compared per tag; crate versions in Cargo.lock are equal too). So there is exactly one old format: standard base64 with padding of salt(16) || nonce(12) || ciphertext+tag, PBKDF2-HMAC-SHA256 with 100,000 iterations.
- No release rewrites an encrypted blob. Editing an encrypted snippet changes the title only (db::update_snippet), and the edit dialog never asks for the password. So "re-encrypt when edited" is not possible; the password is known only during copy and auto-type.
- The password dialog shows "Wrong password" for every backend error, including "Invalid data".
- The table has CHECK (length(content) <= 65536) and that limit applies to the stored base64 text. An encrypted snippet therefore already fits at most 49,108 bytes of plaintext.

### Telling old from new: options compared
1. Try both iteration counts on decrypt (600,000 first, then 100,000). No format change. But a wrong password costs 700,000 iterations (about 177 ms instead of 151 ms), an old snippet costs 700,000 on every use until it is re-encrypted, every later parameter change adds one more trial, and the data never says how it was encrypted.
2. Version marker as bytes inside the base64 payload. One derivation always. But a random salt of an old blob can begin with the same bytes; that snippet would then be read as new and fail, unless a second trial is added anyway.
3. Version marker as a text prefix that is not valid base64: "v2:" followed by the base64 payload. An old blob is pure standard base64 and can never contain ":", so old and new cannot be confused in either direction. One derivation always. A later parameter change gets "v3:".

### Chosen approach
- Format: option 3. New blobs are "v2:" + base64(salt(16) || nonce(12) || ciphertext+tag). "v2" means PBKDF2-HMAC-SHA256 with 600,000 iterations and AES-256-GCM, with the marker bytes "v2:" passed to GCM as associated data. The iteration count is fixed by the version and is not stored, so nothing in the database can request an extreme count. A blob without the marker is decrypted exactly as before, with 100,000 iterations.
- Algorithm: stay with PBKDF2-HMAC-SHA256 and raise it to the OWASP minimum of 600,000. Reason: it reuses the primitives that already protect user data, adds no dependency, and keeps the change to the lockout-critical code as small as possible. Argon2id is OWASP's first choice, is memory-hard and was faster here (20 ms at the OWASP minimum), but it means a new dependency and a second algorithm to keep forever for old data. The version marker makes a later move to Argon2id ("v3:") a small change; that is a separate decision for the owner.
- Migration (acceptance criterion 4, "documented migration"): after an old-format snippet is decrypted with the correct password during copy or auto-type, it is re-encrypted as v2. The new blob is decrypted again and compared with the plaintext before it replaces the old one, and the UPDATE is conditional on the stored blob still being the old one. Any failure leaves the old blob in place and the copy still succeeds. `updated_at` is not changed. One-time cost per old snippet: 100,000 + 600,000 + 600,000 iterations.
- Speed: compile the sha2 crate at opt-level 3 in the release profile. This brings 600,000 iterations from 151 ms to 72 ms on this machine (396 ms to 209 ms without SHA hardware support). Exe size impact to be checked on a real release build.
- Going back to 0.2.x: a v2 blob is not valid base64, so 0.2.x answers "Invalid data" and the dialog shows "Wrong password". Nothing is damaged, because 0.2.x never rewrites encrypted blobs; installing 0.3.0 or later again restores access. Old snippets that were not used in 0.3.0 stay in the old format and keep working in 0.2.x. To be confirmed by running the v0.2.1 crypto code against a v2 blob.
<!-- SECTION:NOTES:END -->
