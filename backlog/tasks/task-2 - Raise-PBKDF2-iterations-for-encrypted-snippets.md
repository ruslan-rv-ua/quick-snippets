---
id: TASK-2
title: Raise PBKDF2 iterations for encrypted snippets
status: Done
assignee:
  - '@claude'
created_date: '2026-11-15T18:58:00Z'
updated_date: '2026-11-16T01:43:00Z'
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
- [x] #1 Research findings are recorded in the task notes before the code change: current OWASP numbers, measured key derivation time at 100,000 and 600,000 iterations in the release build, and the chosen way to tell old and new formats apart, with the reason
- [x] #2 New encryptions meet the current OWASP minimum for the chosen algorithm (600,000 iterations for PBKDF2-HMAC-SHA256 at the time of writing)
- [x] #3 Snippets encrypted with the old 100,000-iteration format still decrypt
- [x] #4 Old-format snippets are re-encrypted in the new format when edited (or a documented migration exists)
- [x] #5 Rust tests cover old-format decrypt and new-format round trip
- [x] #6 README (en/uk/de), SECURITY.md and CHANGELOG state the new key derivation parameters
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

## Implementation and validation (2026-11-16)

### What was built
- crypto.rs: `encrypt` writes "v2:" + base64(salt || nonce || ciphertext+tag) with 600,000 iterations and "v2:" as GCM associated data. `decrypt` reads v2 and, for anything without the marker, the legacy format with 100,000 iterations. `is_current_format` tells them apart. Derived keys live in `Zeroizing` buffers, so they are wiped on every path (before, a wrong password skipped the wipe).
- db.rs: `replace_encrypted_blob`, an UPDATE that only succeeds while the row still holds the old blob; `updated_at` is not touched.
- commands.rs: `activate_snippet_get_content` (used by copy and auto-type) re-encrypts a legacy snippet after a successful decrypt. The new blob is decrypted and compared first. Any failure keeps the old blob and the activation still succeeds.
- Cargo.toml: sha2 at opt-level 3 in release; sha2 in dev and this crate in test builds optimised so the tests stay fast.

### Measurements on the real build
- Real library in the release profile (`cargo test --release --lib timing_report -- --ignored --nocapture`): 600,000 iterations = 78 ms with the sha2 override and 164 ms without it; 100,000 = 13 ms and 28 ms.
- Release exe (`npx tauri build --no-bundle`): develop 3,837,952 bytes; this change without the sha2 override 3,838,464; with it 3,846,144. Total growth 8,192 bytes.
- Rust test suite: 163 s without the debug/test overrides, 4 s with them (16 s before this task).

### Cross-checks outside the test suite
- A blob made by the unmodified `encrypt` from the v0.2.1 tag is decrypted by the new code and by an independent .NET implementation. It is the `LEGACY_BLOB` test vector.
- A v2 blob made by .NET (`Rfc2898DeriveBytes.Pbkdf2` with SHA-256 and 600,000 iterations, `AesGcm` with "v2:" as associated data) is decrypted by the new code. It is the `V2_BLOB` test vector. A v2 blob made by the new code is decrypted by .NET, and rejected by .NET with a wrong password.
- The unmodified `decrypt` from v0.2.1 on a v2 blob returns InvalidData. The password dialog of every release (v0.1.0, v0.1.2, v0.2.0, v0.2.1 checked) shows "Wrong password" for any error.

### Going back to 0.2.x (for the v0.3.0 release notes)
Safe for the data, with one limit. 0.2.x cannot open an encrypted snippet that 0.3.0 created or re-encrypted: it shows "Wrong password" even with the right password. 0.2.x changes nothing in the database in that case (no write on a failed activation; rename keeps the blob), and 0.3.0 or later opens the snippet again. Unencrypted snippets and encrypted snippets not yet opened in 0.3.0 keep working in 0.2.x. The database schema is unchanged. Advice: back up `quick-snippets-data` before upgrading if a return to 0.2.x is possible.

### Not done / observations
- `just smoke` was not run: it takes the keyboard, and Definition of Done item 5 applies only after changes to focus, dialogs or announcements, which this task does not make. Worth running on the release build before v0.3.0, since it creates and opens an encrypted snippet.
- The re-encryption of a legacy snippet was not exercised by hand in the real exe with a database from 0.2.1; it is covered by Rust tests only.
- Existing limit, not caused by this task: content validation allows 65,536 bytes, but the table CHECK counts the stored base64 text, so an encrypted snippet fits about 49,100 bytes of plaintext and a larger one fails with a raw SQLite error. The v2 marker lowers that limit by 3 bytes (49,105). A legacy snippet in that 3-byte window stays in the legacy format and keeps working (tested).
- Argon2id (OWASP's first choice, 20 ms here) is a possible later step as "v3:"; owner's decision.

### Independent review and final checks (2026-11-16)
- A separate reviewer read the diff against the v0.2.1 code and found no way to lock a user out or to overwrite a good blob. It confirmed both test vectors with its own .NET run. Its low-severity points were handled: the verify-before-replace step is now a separate function with tests for a blob that decrypts to other content and for a blob that does not decrypt; tests were added for a database file on disk that is closed and reopened, and for the largest snippet that still fits the new format (49,105 bytes); two weak tests were made exact; the CHANGELOG wording about key wiping was narrowed and the 3-byte smaller limit was added.
- Left as it is: the expanded AES key inside the `Aes256Gcm` object is not wiped on drop (the `zeroize` feature of `aes-gcm` is off). Same as in 0.2.1.
- Final runs on commit 37f1dc4: `npm run test:all` passes (320 frontend tests, 213 Rust tests, 1 ignored timing report); `npm run lint` passes; the 213 Rust tests also pass in the release profile (`cargo test --release --lib`).
- Acceptance criterion 1: the research notes were committed (d1b12ad) before the code change (37f1dc4).
- Definition of Done 4: no user-facing strings were added. Definition of Done 5: not applicable, because nothing in focus handling, dialogs or screen reader announcements changed; `just smoke` was not run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Encrypted snippets now derive their key with PBKDF2-HMAC-SHA256 at 600,000 iterations, the current OWASP minimum, instead of 100,000.

What changed
- New stored format: "v2:" + base64(salt || nonce || ciphertext+tag). The marker is authenticated as AES-GCM associated data. A blob without the marker is the old format and is decrypted as before, with 100,000 iterations. ":" is not a base64 character, so the two formats cannot be confused.
- An old-format snippet is re-encrypted after a successful copy or auto-type, the only moment its password is known. The new blob is decrypted and compared before a conditional UPDATE replaces the old one; any failure keeps the old blob and the copy still works. Renaming does not re-encrypt.
- Release build: the sha2 crate is compiled at opt-level 3. One derivation takes 78 ms instead of 164 ms on an i5-14500 (0.2.1: 28 ms); the exe grows by 8 KB. Debug and test builds got overrides so the Rust tests take 4 s.
- Docs: README (en, uk, de), SECURITY.md, CHANGELOG.md, CLAUDE.md.

Why PBKDF2 and a text marker: see the research notes. In short, PBKDF2 keeps the change to the lockout-critical code minimal and adds no dependency; the marker costs one derivation per attempt and leaves room for "v3:" (for example Argon2id) later.

Verification
- `npm run test:all` and `npm run lint` pass; the Rust tests also pass in the release profile.
- Known-answer tests: a blob made by the unmodified v0.2.1 code, a v2 blob made by an independent .NET implementation, RFC 7914 PBKDF2 vectors. .NET also decrypts blobs made by the new code.
- An independent review of the diff found no lockout or data-loss path.

Going back to 0.2.x
- The data stays intact, but 0.2.x cannot open an encrypted snippet that 0.3.0 created or re-encrypted: it shows "Wrong password". 0.3.0 or later opens it again. Unencrypted snippets and encrypted snippets not yet opened in 0.3.0 keep working in 0.2.x. Release notes should advise a backup of `quick-snippets-data` before upgrading.

Not done and follow-up ideas (none started)
- `just smoke` was not run and the re-encryption was not tried by hand in the real exe with a 0.2.1 database. Worth doing on the release build for v0.3.0.
- Existing limit: an encrypted snippet fits about 49,100 bytes, not the 65,536 the validation message suggests; a larger one fails with a raw SQLite error.
- Possible later hardening: Argon2id as "v3:"; the `zeroize` feature of `aes-gcm`.
<!-- SECTION:FINAL_SUMMARY:END -->
