---
id: TASK-1
title: Upgrade Vitest and Vite toolchain
status: To Do
assignee: []
created_date: '2026-11-15T18:58:00Z'
labels:
  - tooling security
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
npm audit still reports 7 vulnerabilities (2 critical: vitest/tinypool prototype pollution, @vitest/mocker path traversal) that need major upgrades: vitest 3 -> 5, @vitest/coverage-v8 3 -> 5, vite 6 -> 8, @vitejs/plugin-react 4 -> 6, jsdom 26 -> 31. They affect only dev/test tooling, not the shipped exe, but they run on the developer machine and in CI. Major versions may change config or test APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `npm audit` reports no high or critical vulnerabilities
- [ ] #2 All frontend tests pass under the new Vitest
- [ ] #3 `npx tauri build --no-bundle` succeeds and the app starts
- [ ] #4 vite.config.ts and test setup updated for any breaking changes
<!-- AC:END -->
