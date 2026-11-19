---
id: TASK-25
title: Run lint and tests in the Release workflow and stop CI on every push
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-19T07:24:00Z'
updated_date: '2026-11-19T07:52:00Z'
labels:
  - tooling
  - release
  - model-sonnet
  - effort-medium
milestone: m-4
dependencies: []
references:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - DEVELOPMENT.md
  - CLAUDE.md
priority: medium
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The project is developed solo. Every task already runs `npm run test:all` and `npm run lint` locally, the managing session runs them again, and `just smoke` checks the real exe with NVDA. CI (.github/workflows/ci.yml) repeats lint and tests on every push to develop and main: in its last 26 runs it found no real defect, only the flaky F1 help test (TASK-22) twice. Meanwhile the Release workflow (.github/workflows/release.yml) builds and publishes the exe without running lint or tests on a clean machine.

The user decided on 2026-11-19: run the checks in the Release workflow before the build, and run CI only by hand and for pull requests (the repository is public, so outside pull requests still get checked). GitHub also warns that actions/checkout@v4 and actions/setup-node@v4 run on the deprecated Node.js 20; update them in both workflows. A flaky test would now stop a release, which is one more reason to do TASK-22 first.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort medium (`/effort medium`). A small workflow change; the careful part is checking the Release workflow without publishing a real release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Release workflow runs `npm run lint`, `npm run test` and `npm run test:rust` before the release build, and a failing check stops it before any tag or release is created
- [ ] #2 CI runs only for pull requests and when started by hand, no longer on every push to develop or main
- [ ] #3 Both workflows use action versions that no longer trigger the Node.js 20 deprecation warning
- [ ] #4 The changed Release workflow is checked without publishing a real release, and CI started by hand passes
- [ ] #5 DEVELOPMENT.md and CLAUDE.md (Release & CI) describe where the checks run now, and the release procedure no longer waits for CI on develop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes only (no tooling, test, CI or build details)
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. release.yml: add a dry_run input; build the frontend, then run npm run lint, npm run test and npm run test:rust before the Tauri build; skip the tag and the GitHub release on a dry run; add clippy to the toolchain.
2. ci.yml: keep only pull_request and workflow_dispatch triggers.
3. Update actions in both workflows to the latest major versions on Node.js 24: actions/checkout v7, actions/setup-node v7, softprops/action-gh-release v3 (Swatinem/rust-cache v2 already points to 2.9.3 on Node.js 24; dtolnay/rust-toolchain is a composite action).
4. DEVELOPMENT.md and CLAUDE.md (Release & CI): where the checks run now, how to do a dry run, no waiting for CI on develop.
5. Update TASK-23 and TASK-24 so the release procedure no longer waits for CI.
6. Local npm run test:all and npm run lint.
7. With the user's go-ahead: push the feature branch, run Release as a dry run (dry_run plus prerelease plus a version that git refuses as a tag name, as a safety net) and CI by hand on the feature branch; confirm no tag or release appeared.
8. Finish the feature with --no-ff into develop.
<!-- SECTION:PLAN:END -->
