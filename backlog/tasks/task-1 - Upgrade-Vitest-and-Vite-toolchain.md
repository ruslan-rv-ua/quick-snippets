---
id: TASK-1
title: Upgrade Vitest and Vite toolchain
status: Done
assignee:
  - '@claude'
created_date: '2026-11-15T18:58:00Z'
updated_date: '2026-11-16T00:55:00Z'
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
- [x] #1 Research findings (breaking changes of each major, peer and Node.js requirements) and the chosen upgrade path are recorded in the task notes before any upgrade
- [x] #2 `npm audit` reports no high or critical vulnerabilities
- [x] #3 All frontend tests pass under the new Vitest
- [x] #4 `npx tauri build --no-bundle` succeeds and the app starts
- [x] #5 vite.config.ts and test setup updated for any breaking changes
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
1. Stage 1: vitest + @vitest/coverage-v8 5.1.0, jsdom 31.0.1, vite ^6.4; run tests and fix failures.
2. Stage 2: vite 8.3.8 + @vitejs/plugin-react 6.3.0; vite.config.ts reference vitest/config, minify true (Oxc).
3. Verify: npm audit, npm run test:all, npm run lint, npx tauri build --no-bundle, start own copy of the exe.
4. CHANGELOG [Unreleased], git flow feature finish into develop.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Research findings (before upgrade, 2026-11-16)

Target versions: vitest 5.1.0, @vitest/coverage-v8 5.1.0, vite 8.3.8, @vitejs/plugin-react 6.3.0, jsdom 31.0.1. @tauri-apps/cli 2.12.x has no Node or Vite constraint (it only runs beforeDevCommand/beforeBuildCommand); no known incompatibility.

Node.js: vitest 5 needs ^22.12 || ^24 || >=26; jsdom 31 needs ^22.22.2 || ^24.15.0 || >=26; vite 8 and plugin-react 6 need ^20.19 || >=22.12. CI `lts/*` resolves to Node 26.13.1 (Nov 2026), local is 26.13.0, so both fit. No CI change needed.

Peers: vitest 5 requires vite ^6.4 || ^7 || ^8 as a peer; @vitest/coverage-v8 must equal the vitest version exactly; plugin-react 6 requires vite ^8 (so they move together); vite 8 makes esbuild an optional peer. No minimum TypeScript version, ~5.8.3 stays.

Breaking changes that matter here:
- Vitest 4: coverage.all/extensions removed (not used); vi.restoreAllMocks only restores spies; mocks called with `new` need function/class implementations; workspace -> projects. Config typing: use `/// <reference types="vitest/config" />` instead of `vitest`.
- Vitest 5: clearMocks defaults to true (call history cleared before each test); vi.mock inside functions/blocks throws (ours are top level); fake timers also fake Temporal; unawaited resolves/rejects fail (ours are awaited); config is no longer searched in parent folders.
- Vite 7: Node 20.19+, new default target (ours is explicit); Sass legacy API and splitVendorChunkPlugin removed (not used).
- Vite 8: Rolldown + Oxc replace esbuild/Rollup. build.minify "esbuild" is deprecated and needs esbuild installed separately. esbuild/rollupOptions renamed to oxc/rolldownOptions (not used).
- plugin-react 5: node_modules no longer excluded, no auto dedupe of react. plugin-react 6: needs Vite 8, Babel option removed (we call react() with no options).
- jsdom 27-31: click() fires PointerEvent; Window data properties became accessors (check the window.crypto override in setup.ts); new CSSOM and computed style engine; in 31 focus loss on an element that stops being focusable is asynchronous and document.hasFocus() changed (may affect focus tests).

Chosen path: two stages, so a failure points at its cause.
1. vitest + coverage-v8 5.1.0 and jsdom 31.0.1 on vite 6.4; fix clearMocks, Temporal, focus or crypto issues.
2. vite 8.3.8 + plugin-react 6.3.0 together; switch the config reference to vitest/config and build.minify from "esbuild" to true (Oxc minifier) so no extra esbuild dependency is needed; then tsc, tests, tauri build and app start.

Sources: vitest.dev/guide/migration, v4.vitest.dev/guide/migration, vite.dev/guide/migration, v7.vite.dev/guide/migration, github.com/vitejs/vite-plugin-react plugin-react CHANGELOG, github.com/jsdom/jsdom/releases, npm registry, nodejs.org/dist/index.json.

## Implementation results (2026-11-16)

- Stage 1 (vitest/coverage-v8 5.1.0, jsdom 31.0.1, vite 6.4): all 320 frontend tests passed with no changes. None of the expected clearMocks, Temporal, focus or window.crypto issues appeared.
- Stage 2 (vite 8.3.8, plugin-react 6.3.0): tests passed, but `tsc` lost the jest-dom matcher types (toBeInTheDocument etc.) because Vitest 5 no longer picks up the jest-namespace typings. Fix: tsconfig `types` and setup.ts now use `@testing-library/jest-dom/vitest`.
- vite.config.ts: `/// <reference types="vitest/config" />`; `build.minify` is now `!TAURI_ENV_DEBUG` (Oxc minifier) instead of "esbuild". esbuild is no longer installed.
- CLAUDE.md now says Vitest v5. CI needs no change (lts/* = Node 26).
- Verified: npm audit 0 vulnerabilities; npm run test:all (320 frontend + 169 Rust) passes; npm run test:coverage works; npm run lint passes; npx tauri build --no-bundle builds a 3.8 MB exe; own copy started, its UI Automation tree shows the search box and snippet list, then closed.
- DoD #4: no new user-facing strings. DoD #5: no change to focus, dialogs or announcements, so `just smoke` was not needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Upgraded the dev/test toolchain: vitest and @vitest/coverage-v8 3 -> 5.1.0, vite 6 -> 8.3.8, @vitejs/plugin-react 4 -> 6.3.0, jsdom 26 -> 31.0.1, in two stages after reading every skipped major's migration guide. Config changes: vitest/config type reference, Oxc minifier instead of "esbuild" (Vite 8), and jest-dom's Vitest entry point for matcher types. No test code changes were needed. npm audit now reports 0 vulnerabilities; test:all, lint, coverage and the portable release build pass, and the built app starts and renders. Only dev tooling changed; the shipped exe is the same size. Risk: Node.js 22.22+/24.15+/26+ is now required for tests (CI lts/* is 26).
<!-- SECTION:FINAL_SUMMARY:END -->
