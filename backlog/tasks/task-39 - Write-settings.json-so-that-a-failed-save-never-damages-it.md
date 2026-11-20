---
id: TASK-39
title: Write settings.json so that a failed save never damages it
status: To Do
assignee: []
created_date: '2026-11-20T17:24:00Z'
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
- [ ] #1 settings.json is only ever replaced by a complete new file: a save that fails at any point leaves the old file byte for byte
- [ ] #2 Tests cover a failed write without touching the user's data, and a read-only settings.json still gives the TASK-38 message
- [ ] #3 A temporary file left by an interrupted save is not read as the settings and does not stop the next save
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
