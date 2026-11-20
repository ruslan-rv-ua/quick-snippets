---
id: TASK-39
title: Write settings.json so that a failed save never damages it
status: Done
assignee:
  - '@claude'
created_date: '2026-11-20T17:24:00Z'
updated_date: '2026-11-20T17:53:00Z'
labels:
  - bug
  - backend
  - data-safety
  - model-sonnet
  - effort-medium
milestone: m-7
dependencies: []
references:
  - src-tauri/src/settings.rs
  - src-tauri/src/commands.rs
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while verifying TASK-38. `save_settings_to_path` in src-tauri/src/settings.rs writes settings.json with `std::fs::write`, which empties the file first and then writes it. A write that fails after the file was opened (for example a full disk, an I/O error, or a data folder on a drive that goes away) can leave settings.json cut short or empty. Since TASK-38 the settings dialog then says "Nothing was changed" («Нічого не змінено»), which would be wrong, and the next start could not read the settings. A read-only or locked file fails before anything is written, so that case is fine already.

Write the new settings to a temporary file in the same folder first, then replace settings.json with it, so that settings.json is always either the old file or the new one, never a mix. The data folder can be a Scoop persist junction, so the temporary file stays in the same folder. Every save of the settings goes through this function (also the window position and the sort order). A temporary file left by an interrupted save must not be read as the settings or block the next save. Present the solutions through the question dialog before changing code. Planned before the v0.3.5 release by the user's choice (2026-11-20).

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small change in how one file is written, with care for the user's settings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 settings.json is only ever replaced by a complete new file: a save that fails at any point leaves the old file byte for byte
- [x] #2 Tests cover a failed write without touching the user's data, and a read-only settings.json still gives the TASK-38 message
- [x] #3 A temporary file left by an interrupted save is not read as the settings and does not stop the next save
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `npm run test:all` passes
- [x] #2 `npm run lint` passes
- [x] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [x] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [x] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The user's choice (question dialog, 2026-11-20, verbatim answers)

- "TASK-39: як записувати settings.json, щоб невдале збереження не псувало файл? ..." = "Тимчасовий файл + скидання на диск (рекомендовано)" (new settings go to settings.json.tmp in the same folder, flushed to disk, then renamed over settings.json in one step; saves from different places run one after another).
- "Що робити з settings.json.tmp, який лишився після обірваного збереження ...?" = "Перезаписати наступним збереженням (рекомендовано)" (never read as settings; a failed save removes its own temporary file; a leftover one is written over by the next save; always the same name).
- "Як поводитися з settings.json, що лише для читання (або зайнятий іншою програмою)? ..." = "Спершу перевірити старий файл (рекомендовано)" (open settings.json for writing without changing it first; if Windows refuses, stop with the same Windows reason as before and create no temporary file; a later failed replace removes the temporary file).
- "Наприкінці потрібен just smoke на новій release-збірці ... Дозволяєте?" = "Так, smoke наприкінці (рекомендовано). але запитай мого дозволу" (ask again right before the run).

The other options offered: "Тимчасовий файл без скидання", "Заміна через ReplaceFileW"; "Ще й видаляти при запуску"; "Лише прибрати після невдачі"; "Без smoke".

## Why

save_settings_to_path wrote settings.json with std::fs::write, which empties the file first: a write failing after the file was opened (full disk, I/O error, a drive that goes away) could leave it cut short or empty, while the settings dialog (TASK-38) said "Nothing was changed" and the next start could not read the settings.

## What changed (commits d6afc44, d49410d)

- src-tauri/src/settings.rs: save_settings_to_path calls the new replace_file. It (1) opens settings.json for writing without changing it, so a read-only file or one held by another program fails with the Windows reason before anything is written and no temporary file is created; (2) writes settings.json.tmp in the same folder (temp_path_for; under Scoop the data folder is a junction, a rename stays within one volume), created anew so a leftover is written over (a read-only leftover is made writable and removed), and flushes it (sync_all); (3) renames it over settings.json (std::fs::rename). A failed step removes the temporary file; settings.json stays byte for byte. A static mutex makes saves run one at a time (the dialog save does not hold the settings lock, the window-position save does, and both use the same temporary file). Nothing reads settings.json.tmp. Every save goes through it: dialog, window position, sort order, defaults at first start and after a reset.
- Rust tests (temporary folders only): no temporary file after a save; a write failing half-way and before any byte keeps the old file byte for byte and removes the temp file; no settings file is created when the first write fails; read-only settings.json gives "os error 5", file unchanged, no temp file; a file held with no sharing gives "os error 32", unchanged; a cut-short leftover temp file is not read and the next save works; a read-only leftover does not stop a save; 4 threads saving 20 times each leave a complete file.
- scripts/smoke-nvda.ps1: the read-only steps (86, 87) also check that no settings.json.tmp appears. DEVELOPMENT.md says so.
- CHANGELOG [Unreleased] Fixed: one entry. CLAUDE.md: settings.rs row describes the save.
- No frontend change, no new strings (the TASK-38 message is unchanged).

## Checks

- npm run test:all: 525 frontend, 331 Rust (was 321; 1 ignored as before). npm run lint passes.
- Mutation checks: writing in place again (the old behaviour) fails 5 of the new tests; without the first check of the old file the held-file test fails (a read-only file is still refused by the rename and the temp file removed, so that test alone passes then).
- Release build of d6afc44: 3,866,112 bytes.
- just smoke with the user's permission (2026-11-20, about 19:49 to 19:52): 88 of 88 steps, 333 of 333 NVDA checks, exit code 0. Step 86 (read-only settings.json, Ctrl+Enter) and 87 (Escape) OK: message read once, file unchanged, no settings.json.tmp. I read only the summary lines of the output and deleted my captured copy.
- The user's autostart values: report before "entry absent; mark Binary 02 00 00 00 00 00 00 00 00 00 00 00", "Після тесту відновлено як до тесту"; my own read afterwards: Run\QuickSnippets absent, mark 02 00 00 00 00 00 00 00 00 00 00 00.
- Copied to C:\5-quicksnippets\real_db\quick-snippets-TASK-39-d6afc44.exe, SHA-256 6E7B0D9495A1C37F077D334370633C655019BAA598A8F9C176DF7E98E0B20D9C, the same as the build.
- just smoke-tray not run: window creation and showing unchanged.

## Noticed, no task created

- The rename gives settings.json a new file: attributes, its own permissions or a hard link on the old file are not kept (the data folder is a normal folder or a Scoop junction, so this does not matter there).
- TASK-38 note 1 still holds: if the first write succeeds, Windows refuses autostart and the second write fails, the dialog says "Nothing was changed" while the file holds the refused value. Practically unreachable.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
settings.json was written with std::fs::write, which empties the file first, so a save failing half-way could leave it cut short while the settings dialog said "Nothing was changed".

By the user's choice (all recommended options): every save now opens the old file for writing first (read-only or held: the same Windows error, nothing written, no temporary file), writes settings.json.tmp in the same folder, flushes it and renames it over settings.json; a failure removes the temporary file and leaves the old file byte for byte; a leftover temporary file is never read and is written over; saves run one at a time.

Verified: Rust tests in temporary folders (failing write, read-only and held file, leftovers, parallel saves) and mutation checks; npm run test:all (525 + 331) and lint; just smoke on release build d6afc44 with permission: 88/88 steps, 333/333 NVDA checks; the user's autostart values unchanged; copied to real_db as quick-snippets-TASK-39-d6afc44.exe.
<!-- SECTION:FINAL_SUMMARY:END -->
