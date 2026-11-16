---
id: TASK-21
title: Release v0.3.1
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-16T21:47:00Z'
updated_date: '2026-11-16T23:06:00Z'
labels:
  - release
  - model-sonnet
  - effort-medium
milestone: m-3
dependencies:
  - TASK-20
references:
  - DEVELOPMENT.md
  - CHANGELOG.md
  - .github/workflows/release.yml
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ships the user-visible fixes made after 0.3.0: "No results found" is announced (TASK-14), Delete in the search box erases text (TASK-15), NVDA reads editing in the search box (TASK-16), the window no longer hides while it is still active, so settings are saved (TASK-18), and the search and password dialog stay when the keyboard only moves inside the window (TASK-20). A patch release: no change to stored data.

Same procedure as v0.3.0 (DEVELOPMENT.md; see the archived TASK-8). Pushing and running workflows need the user's go-ahead, and so does the just smoke run (about two and a half minutes now; leave a minute between two runs). In v0.3.0 main was fast-forwarded and got no release merge commit; finish this release with --no-ff, as for v0.2.1.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). The documented release procedure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Version 0.3.1 in src-tauri/Cargo.toml, src-tauri/tauri.conf.json and package.json; `just final-checks` passes
- [ ] #2 CHANGELOG.md has a v0.3.1 section with user-facing notes only, and the GitHub release notes are that section
- [x] #3 `just smoke` passes on the release build (run only with the user's permission)
- [ ] #4 git flow release finished with --no-ff: main and develop contain the release and main has a release merge commit; tag v0.3.1 created by the Release workflow
- [ ] #5 The GitHub release has the ZIP and its .sha256, and the Scoop manifest shows 0.3.1 after Excavator runs
- [ ] #6 The release build is copied to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-21-<short commit>.exe
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
1. Push develop (280d32f) and check that CI passes.
2. git flow release start 0.3.1; bump the version in Cargo.toml, tauri.conf.json, package.json (and lock files); move [Unreleased] into a v0.3.1 section; commit.
3. just final-checks; npm run lint; npm run test:all.
4. npx tauri build --no-bundle; just smoke on the release exe.
5. git flow release finish 0.3.1 --no-ff --notag; push main and develop (no tags); wait for CI.
6. Run the Release workflow for 0.3.1 on main; check ZIP and .sha256; replace the generated release notes with the v0.3.1 CHANGELOG section.
7. Run Excavator in scoop-bucket; check the manifest shows 0.3.1.
8. Copy the release exe to C:\5-quicksnippets\real_db\ as quick-snippets-TASK-21-<commit>.exe.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checks on release/0.3.1 (version bump 4c81e87):
- CI for develop 280d32f: the first attempt failed in one Vitest test (App.test.tsx, "F1 opens the help with focus on the first shortcut": focus was still on the search box). The test is unchanged since v0.3.0 and passes locally every time (5 runs of App.test.tsx, plus final-checks and test:all); the rerun of the failed job passed (run 43975084408, attempt 2). Likely a timing race in slow CI, possibly the 60 ms initial-focus timer in useWindowEvents firing after F1. Not a product bug; worth a follow-up to make the test wait for the initial focus.
- just final-checks: versions match (0.3.1), tsc, clippy, Rust and Vitest tests, build OK; exe 3,851,776 bytes.
- npm run lint: pass. npm run test:all: 432 Vitest tests in 24 files, 230 Rust tests (1 ignored), all pass.
- just smoke on the release exe: 70 of 70 steps OK, NVDA checks 181 of 181. The NVDA log has 2 errors of NVDA's own script_caret_newLine (known since TASK-18, no effect on speech checks).
- CHANGELOG: [Unreleased] moved into v0.3.1 unchanged; all five entries are user-facing. No new user-facing strings in this task.
<!-- SECTION:NOTES:END -->
