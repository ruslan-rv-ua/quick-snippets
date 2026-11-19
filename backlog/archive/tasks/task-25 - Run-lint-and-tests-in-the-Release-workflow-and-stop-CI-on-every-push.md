---
id: TASK-25
title: Run lint and tests in the Release workflow and stop CI on every push
status: Done
assignee:
  - '@claude'
created_date: '2026-11-19T07:24:00Z'
updated_date: '2026-11-19T08:04:00Z'
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
- [x] #1 The Release workflow runs `npm run lint`, `npm run test` and `npm run test:rust` before the release build, and a failing check stops it before any tag or release is created
- [x] #2 CI runs only for pull requests and when started by hand, no longer on every push to develop or main
- [x] #3 Both workflows use action versions that no longer trigger the Node.js 20 deprecation warning
- [x] #4 The changed Release workflow is checked without publishing a real release, and CI started by hand passes
- [x] #5 DEVELOPMENT.md and CLAUDE.md (Release & CI) describe where the checks run now, and the release procedure no longer waits for CI on develop
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
1. release.yml: add a dry_run input; build the frontend, then run npm run lint, npm run test and npm run test:rust before the Tauri build; skip the tag and the GitHub release on a dry run; add clippy to the toolchain.
2. ci.yml: keep only pull_request and workflow_dispatch triggers.
3. Update actions in both workflows to the latest major versions on Node.js 24: actions/checkout v7, actions/setup-node v7, softprops/action-gh-release v3 (Swatinem/rust-cache v2 already points to 2.9.3 on Node.js 24; dtolnay/rust-toolchain is a composite action).
4. DEVELOPMENT.md and CLAUDE.md (Release & CI): where the checks run now, how to do a dry run, no waiting for CI on develop.
5. Update TASK-23 and TASK-24 so the release procedure no longer waits for CI.
6. Local npm run test:all and npm run lint.
7. With the user's go-ahead: push the feature branch, run Release as a dry run (dry_run plus prerelease plus a version that git refuses as a tag name, as a safety net) and CI by hand on the feature branch; confirm no tag or release appeared.
8. Finish the feature with --no-ff into develop.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation (commit 13e5aed on feature/release-checks):
- release.yml: new dry_run input and a run-name that shows "(dry run)". After npm ci it builds the frontend (dist/ is needed by clippy and cargo test), then runs npm run lint, npm run test and npm run test:rust, then the Tauri build. The tag step moved after packaging, so a failed run leaves no tag. Tag and GitHub Release steps have if: !inputs.dry_run; GitHub adds success() to such conditions, so any failed check skips them. clippy added to the toolchain.
- ci.yml: triggers are pull_request and workflow_dispatch only.
- Actions: actions/checkout v4 -> v7, actions/setup-node v4 -> v7, softprops/action-gh-release v2 -> v3 (all node24). Swatinem/rust-cache@v2 already points to 2.9.3 (node24); dtolnay/rust-toolchain is a composite action.
- DEVELOPMENT.md: release section lists the checks, a dry run section with the gh command, CI section; the release procedure says not to wait for CI. CLAUDE.md Release & CI updated the same way.
- TASK-23 and TASK-24 descriptions: do not wait for CI after pushing; Release runs the checks itself.

Verification:
- Local: npm run test:all (435 Vitest, 230 Rust) and npm run lint pass.
- Pushing feature/release-checks started no CI run.
- Release dry run 44483375005 on feature/release-checks (version 0.0.0..dryrun, dry_run and prerelease on): lint, Vitest, Rust tests (230 passed), build and package passed; "Create and push tag" and "Create GitHub Release" were skipped; 8 min 14 s (the Rust cache was cold). No annotations, so no Node.js 20 warning. Tags and releases on GitHub unchanged afterwards (latest is still v0.3.1).
- CI started by hand, run 44483378809: passed in 2 min 14 s, no annotations.

Not exercised: the tag push with checkout v7 and the release step of action-gh-release v3; the first real release (TASK-23) runs them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Release workflow now runs npm run lint, npm run test and npm run test:rust on a clean machine before the build and creates the tag only after checks, build and packaging; a new dry_run input skips the tag and the release. CI runs only for pull requests and by hand. Actions moved to Node.js 24 versions (checkout v7, setup-node v7, action-gh-release v3). DEVELOPMENT.md, CLAUDE.md, TASK-23 and TASK-24 no longer wait for CI on develop. Verified locally (test:all, lint) and on GitHub with a Release dry run (checks and package passed, tag and release skipped, no new tag or release) and a manual CI run, both without the Node.js 20 warning. No CHANGELOG entry: nothing changes for users. Not yet exercised: the tag push and release step, which the v0.3.2 release will run.
<!-- SECTION:FINAL_SUMMARY:END -->
