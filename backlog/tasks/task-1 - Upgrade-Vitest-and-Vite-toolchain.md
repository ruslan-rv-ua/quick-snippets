---
id: TASK-1
title: Upgrade Vitest and Vite toolchain
status: To Do
assignee: []
created_date: '2026-11-15T18:58:00Z'
updated_date: '2026-11-15T23:33:00Z'
labels:
  - tooling
  - security
  - model-sonnet
  - effort-high
milestone: m-1
dependencies: []
references:
  - package.json
  - vite.config.ts
  - src/test/setup.ts
  - .github/workflows/ci.yml
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
npm audit still reports 7 vulnerabilities (2 critical: vitest/tinypool prototype pollution, @vitest/mocker path traversal) that need major upgrades: vitest 3 -> 5, @vitest/coverage-v8 3 -> 5, vite 6 -> 8, @vitejs/plugin-react 4 -> 6, jsdom 26 -> 31. They affect only dev/test tooling, not the shipped exe, but they run on the developer machine and in CI. Major versions may change config or test APIs.

Start with research, before changing anything: read the migration guides for every major version being skipped (Vitest 4 and 5, Vite 7 and 8, @vitejs/plugin-react 5 and 6, jsdom 27 to 31), check that the new versions work with each other and with @tauri-apps/cli, and check the Node.js version each one needs (CI uses the current LTS). Then decide whether to upgrade in one step or in stages.

Recommended setup: Claude Sonnet 5.5 (`/model sonnet`), effort high (`/effort high`). Everyday coding work, but several major versions at once: high effort for reading the migration guides carefully and verifying tests, build and app start.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research findings (breaking changes of each major, peer and Node.js requirements) and the chosen upgrade path are recorded in the task notes before any upgrade
- [ ] #2 `npm audit` reports no high or critical vulnerabilities
- [ ] #3 All frontend tests pass under the new Vitest
- [ ] #4 `npx tauri build --no-bundle` succeeds and the app starts
- [ ] #5 vite.config.ts and test setup updated for any breaking changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `npm run test:all` passes
- [ ] #2 `npm run lint` passes
- [ ] #3 CHANGELOG.md [Unreleased] updated for user-visible changes
- [ ] #4 New user-facing strings exist in en, uk and de (src/i18n/translations.ts)
- [ ] #5 After changes to focus, dialogs or screen reader announcements: release exe rebuilt and `just smoke` passes (ask the user before running it)
<!-- DOD:END -->
