---
id: TASK-3
title: Decide whether to add end-to-end UI tests with tauri-driver
status: Done
assignee:
  - '@claude'
created_date: '2026-11-15T19:12:00Z'
updated_date: '2026-11-16T16:29:00Z'
labels:
  - testing
  - accessibility
  - investigation
  - model-opus
  - effort-high
milestone: m-2
dependencies:
  - TASK-4
references:
  - https://v2.tauri.app/develop/tests/webdriver/
  - scripts/smoke-nvda.ps1
  - .github/workflows/ci.yml
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Changes to Tauri capabilities, plugins or build settings (for example removeUnusedCommands) can break features that unit tests do not see, because Vitest mocks all Tauri APIs. `just smoke` (scripts/smoke-nvda.ps1) now covers most flows on the real exe with NVDA, but it needs the user to keep hands off the keyboard and cannot run in CI. This task decides whether tauri-driver end-to-end tests are worth adding on top of it; TASK-6 builds them only if the answer is go.

Research: whether tauri-driver works here (msedgedriver must match the installed WebView2 runtime, on the developer machine and on windows-latest), what WebDriver cannot reach (the global hotkey, the tray, autotype into another window), and whether accessible names and focus can be checked through it. Ask the user before any run that opens windows or sends keys on their desktop.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). A short research task that ends in a judgment call; the stronger model pays off here, and the build itself (TASK-6) can then run on a cheaper one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Findings are recorded in the task notes: whether tauri-driver works on Windows here and on windows-latest in CI, with the msedgedriver and WebView2 versions checked
- [x] #2 Findings say what WebDriver cannot reach (global hotkey, tray, autotype) and whether accessible names and focus can be checked through it
- [x] #3 A go or no-go decision with reasons is recorded; on go TASK-6 is updated with the findings, on no-go TASK-6 is archived
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
1. Read TASK-3 and TASK-6 and the current test layers: Vitest, cargo test, just smoke (scripts/smoke-nvda.ps1) and CI.
2. Go through the user-visible fixes of v0.2.1 and v0.3.0 (and the older fix commits) and note which test layer found each one and which would have found it earlier.
3. Check primary sources, with dates: Tauri WebDriver docs, tauri-driver releases, the WebdriverIO Tauri service, Microsoft docs on Edge WebDriver and WebView2, GitHub runner docs and images.
4. Check versions on this machine (WebView2 Runtime, Edge, drivers) without installing anything.
5. Map the NVDA checks of just smoke to what WebDriver can and cannot check.
6. Compare alternatives, record the findings and a go or no-go decision; ask the user before changing TASK-6.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Findings, part 1: what the current tests catch (checked 2026-11-16)

Current test layers:
- Vitest 5 with jsdom: 386 tests in 24 files. Every Tauri API is mocked in src/test/setup.ts, so nothing reaches Rust or a real web engine. The tests already check accessibility in the DOM: 99 role-and-name queries, 14 toHaveFocus and 25 activeElement checks, 20 checks of aria-live or aria-atomic, 11 accessible name or description checks.
- cargo test: 217 tests of db, crypto, search, settings, paths and tray helpers. They call the functions directly, without the Tauri runtime.
- just smoke (scripts/smoke-nvda.ps1): a copy of the release exe in a temp folder with its own data, 35 steps and 105 NVDA checks. It covers the real keyboard, the global hotkey, focus through UI Automation, clipboard, autotype into its own window, settings.json and the autostart registry value. Local only, hands off for about a minute.
- CI (ci.yml on windows-latest): frontend build, lint, both unit suites. The last 8 runs took 1.8 to 2.5 minutes. CI never builds the Tauri app. The release workflow, which does a release build, took 3.9 to 6.9 minutes.

User-visible fixes in v0.2.1 and who found them:
1. Validation errors read as just "alert" and followed by the word "alert" (b0b5352, TASK-4). Found by just smoke. It is NVDA behaviour inside role="application"; the DOM looked correct. WebDriver cannot see it.
2. "Wrong password" not announced, and the field was disabled while checking, so NVDA said "unavailable" (c26e711). Found by just smoke. WebDriver could see focus leave the field only by sampling during the check; it cannot see the missing announcement.
3. A new toast re-read the older ones (aria-atomic, c26e711). Found by just smoke. WebDriver cannot see it.
4. "Wrong password" said twice, by the live region and by a description change (465b282). Found by just smoke. WebDriver cannot see it.
5. Capabilities trimmed, removeUnusedCommands on, unused plugin packages removed (42e3c00, f60a5d8). No regression; just smoke ran on that build before the release.

User-visible fixes in v0.3.0 and who found them:
6. The theme chosen with Ctrl+Shift+T was lost after a restart (232fe67, TASK-11). Found by reading the code. Frontend logic, now covered by unit tests. WebDriver would need a test that restarts the app.
7. Settings: Cancel and Escape did not bring back theme and language, Save overwrote other settings, two quick shortcuts undid each other (TASK-9, TASK-11). Frontend logic found by reading the code; unit tests cover it now.
8. "Auto (system)" in the language list blanked the window (TASK-9). Found while preparing the task and reproduced with a unit test.
9. The language list arrow never showed, because it was a data: SVG that the CSP blocks (TASK-9). Found by eye in a Chromium browser pane. jsdom does not apply the CSP and just smoke cannot see images. A WebDriver suite would catch it only with an explicit console or CSP check, or screenshots. This is the only fix in the two releases that needed a real web engine.
10. The Save button was disabled while saving, so focus dropped out of the dialog (TASK-9). Avoided by design, the same pattern as fix 2; no test found it.
11. The help title was said twice (6b54193, TASK-10). Heard with NVDA. A computed-label check could notice it, but a unit test can assert the same name.
12. Tray menu language on a German Windows (cc6783c, TASK-13). Rust logic, now covered by Rust unit tests; WebDriver cannot reach the tray.

Older fixes that only a run of the real exe shows: b0a7fd9 (2026-02-26) the capability lacked core:window:allow-hide, allow-show and allow-set-focus, so Escape did not hide the window; 7253304 the release exe crashed depending on the working folder. Both happened before 0.1.0. A WebDriver suite would catch them, and so does just smoke today (step 1 hides the window with Escape; the exe runs from a temp folder). 1d1b418 (shortcuts broken with a Ukrainian layout) cannot be reproduced with WebDriver, which builds key codes from a US layout; just smoke sends real scan codes.

Summary: v0.2.1 and v0.3.0 had no regressions from capabilities, plugins or build settings. Four fixes were NVDA speech problems that only just smoke found and WebDriver cannot see. Most of the rest were frontend logic that unit tests now cover. One (the CSP-blocked arrow) needed a real web engine, and a cheap unit test of the CSS against the CSP covers that class.

## Findings, part 2: tauri-driver and WebView2, here and on windows-latest (checked 2026-11-16)

Tools and docs:
- tauri-driver 2.1.0 (crates.io, 2026-09-26) is the current stable; 3.0.0-alpha.1 came out the same day. The changelog from 2.0.4 to 2.1.0 has no Windows changes.
- The Tauri WebDriver docs (v2.tauri.app/develop/tests/webdriver, last updated 2026-06-29) now recommend WebdriverIO with @wdio/tauri-service and an embedded WebDriver server inside the app. tauri-driver used directly is for Windows and Linux. The manual setup page says the Edge Driver must match, a mismatch can make the suite hang while connecting, and recommends msedgedriver-tool (last commit 2025-06-03).
- Microsoft: the Edge WebDriver must match the WebView2 Runtime the app uses, and the first three parts of the version must match (learn.microsoft.com/microsoft-edge/webdriver, updated 2026-07-30; webview2/how-to/webdriver, updated 2026-09-11).
- Since Stable 152, Microsoft Edge ships a major version every 2 weeks, and the WebView2 Runtime follows the Stable cadence (Edge release schedule, updated 2026-11-05; WebView2 distribution docs, updated 2026-10-02). A local msedgedriver goes stale about every two weeks; 158 is due the week of 2026-11-19.

This machine: WebView2 Runtime 157.0.4341.46 (per machine), Edge 157.0.4341.60, no msedgedriver and no tauri-driver installed, PowerShell not elevated, Tauri 2.10.2, wry 0.54.2, tauri-cli 2.10.0. A matching driver would be msedgedriver 157.0.4341.x.

Blocker in the app: run() in src-tauri/src/lib.rs calls std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--force-renderer-accessibility") (3e9e28d, so NVDA works after starting in the tray). It replaces any value set by whoever launched the app. msedgedriver gives a launched WebView2 app its remote debugging port through this variable (reported by two Tauri projects in November 2026, etiennedelange/logbook#30 and tukuyomil032/MC-Vector#257, and it matches the WebView2 docs, which name this variable for --remote-debugging-port). So tauri-driver cannot connect to the current exe: session creation would time out. Not verified by a run here. A fix means either appending to the variable instead of replacing it (this touches the NVDA start-in-tray fix) or a test-only build that adds --remote-debugging-port=0 to the browser arguments.

windows-latest:
- GitHub-hosted Windows VMs "run as administrators with User Account Control (UAC) disabled" (docs.github.com, GitHub-hosted runners reference).
- Since WebView2 Runtime 150 (Stable 2026-07-02), an elevated host ignores WEBVIEW2_* environment variables, HKCU policies and command-line overrides; only the HKLM policy and arguments the app passes through the API still work. Microsoft calls it a security hardening, by design (MicrosoftEdge/WebView2Feedback#5640, closed 2026-07-09; #5645).
- Result: msedgedriver sessions time out on GitHub runners. WebdriverIO's own CI hit this (webdriverio/desktop-mobile#542, 2026-07-23 to 2026-09-18) and now runs the drivers de-elevated with gsudo (PR #637). wry declined to pass the variable through the API (tauri-apps/wry#1783, July 2026); the maintainer said an "automation" cargo feature probably has to wait until v3.
- The windows-latest image (Windows2025-VS2026, 20261103.298.1) lists Microsoft Edge 156.0.4314.58 and Edge Driver 156.0.4314.58 but not the WebView2 Runtime version, so a job would read it from the registry and download the matching driver on every run.

The embedded route: tauri-plugin-wdio-webdriver 1.5.1 (2026-10-24; 2.0.0-next.0 on 2026-11-08) runs a W3C WebDriver HTTP server on 127.0.0.1:4445 inside the app. It needs no msedgedriver, is not hit by the elevation change and implements computed role, computed label, active element and actions. Its README says to register it only in debug builds ("Never include it in production builds") and to add "wdio-webdriver:default" to the capabilities. The tested exe would then differ from the shipped one exactly where this task expected risk: plugins, capabilities and build profile.

What WebDriver cannot reach:
- The global hotkey Ctrl+Alt+Space. WebDriver input is synthetic input inside the web view and does not pass through Windows, so RegisterHotKey never fires.
- The tray icon and its menu: native Windows UI outside the web view.
- Autotype: the text goes to another window through PostMessage or SendInput, and WebDriver sees only the web view. The test process can host its own target window, as just smoke does, but moving Windows focus there is outside WebDriver.
- Windows focus and visibility: hide on blur after 200 ms, show by hotkey or a second launch, the UI Automation tree after starting in the tray (TASK-5).
- Keyboard layouts: key codes come from a US layout.
- The clipboard: no WebDriver command; the test process can read it itself.

Accessible names and focus through WebDriver:
- Yes for names, roles and DOM focus. WebDriver 2 (W3C Working Draft 2026-11-09) has Get Computed Role, Get Computed Label and Get Active Element, and msedgedriver and the embedded plugin implement them. The values come from the web engine's own computation, not from what NVDA says.
- No for descriptions (no command; only through a script), and no for speech: how many times something is said, whether a live region is announced, the extra "alert", group names when focus enters a group, the "Report object descriptions" setting.
- The unit tests already check names, roles and focus, so WebDriver would mostly repeat them in a real engine. Of the 105 NVDA checks in just smoke, the "said once" counts, the forbidden phrases and the descriptions cannot move to WebDriver; names, roles and focus can, roughly.

## Findings, part 3: cost, alternatives and decision

Cost of building TASK-6 as written:
- A second test stack next to Vitest: WebdriverIO 10.2 with @wdio/tauri-service 1.5.1, or tauri-driver plus msedgedriver. Either an app change (the environment variable) plus a driver that must match a WebView2 that changes every two weeks, or a debug-only plugin with a debug-only capability file.
- CI: today 2 to 2.5 minutes without a Tauri build. An E2E job adds a Tauri build (the release workflow takes 3.9 to 6.9 minutes with cache), driver setup and the suite: roughly 6 to 10 minutes per push. On GitHub runners the msedgedriver route also needs de-elevation.
- Locally the window still opens and can take focus. Hide-on-blur and the single instance make the run fragile if the user touches anything, so it is not really hands-free either.
- Upkeep: a third set of UI tests to change with every UI change, for one developer. The embedded plugin went from 1.0 (May 2026) to 2.0-next (November 2026), and Microsoft's elevation change already broke the msedgedriver route once this year.

Alternatives and what each gives:
1. Keep just smoke as the end-to-end check and extend it. It already drives the real release exe with real NVDA, keyboard, hotkey, clipboard, autotype and registry. Missing flows: search, delete with confirmation, sort shortcuts, exit confirmation, theme after a restart, first show after starting in the tray (TASK-5). Cost: script steps only, no new tools. Limit: local, hands off, run only with the user's permission.
2. Run just smoke without NVDA in CI on windows-latest. The script already runs without NVDA and then checks only the app. Every push or pull request would get a run of the real release exe: capabilities, plugins, build settings and the IPC contract between frontend and Rust, with no app change. Unknown: whether the hosted runner's desktop accepts simulated keys and foreground changes (standard Windows runners ran FlaUI UI tests in actions/runner-images#7227, 2023), so it needs a trial CI job. Cost: a release build in CI (about 4 to 7 minutes), or run it only on pull requests and before releases.
3. Cheap checks in the unit tests: axe-core 4.14.1 (2026-11-16) on the rendered dialogs in Vitest (names, roles, valid ARIA); a test that the CSS and index.html use nothing the CSP blocks (data: images, external fonts), the one bug class above that needed a real engine; optionally a test that the capability file grants the window permissions the frontend uses (the February 2026 Escape bug). Small, and runs in the current CI.
4. Guidepup 0.40.0 (2026-11-01) drives a real NVDA on Windows Server 2022 and 2025 runners, and @guidepup/virtual-screen-reader 0.33.0 simulates speech in jsdom. A possible later step for speech checks in CI, but it means porting just smoke to a fresh NVDA setup whose settings differ from the user's (for example object descriptions). Not now.
5. Playwright over CDP: the same debugging port and elevation problems and no Tauri support. Not recommended.

Decision: no-go for tauri-driver end-to-end tests, and do it differently.
- Gain would be small: in two releases WebDriver would have caught at most one bug earlier (the CSP-blocked arrow, and only with a console check), while the bugs that really happened were NVDA speech problems it cannot see or frontend logic that unit tests cover.
- Cost would be high and recurring: an app change or a different test build, a driver to keep in step with a WebView2 that updates every two weeks, the elevation problem on GitHub runners that Tauri does not plan to fix before v3, 6 to 10 minute CI runs, and a third set of UI tests.
- For accessibility it would add names, roles and focus in a real engine, which unit tests already approximate, and nothing for speech.
- The recommended way instead: extend just smoke (alternative 1), try it without NVDA in CI (alternative 2), and add the cheap unit checks (alternative 3).
- Revisit if Tauri ships an automation feature that works on elevated runners (talked about for v3), if just smoke cannot run in CI and the project gets more contributors, or if regressions from capabilities, plugins or build settings start to slip through.

## Outcome (2026-11-16)

- The user chose: archive TASK-6 (done, with a note pointing here), create TASK-14 for the missing just smoke flows (search, delete, sorting, quitting, theme after a restart), and no trial run. The CI run of just smoke without NVDA and the unit-test checks (axe-core, CSS against the CSP) were not turned into tasks.
- No trial run of tauri-driver: the user declined it because it would not change the decision. So "cannot connect to the current exe" rests on the code in lib.rs, the WebView2 docs and two external reports, not on a run here.
- No code changed. npm run test:all passed (386 frontend tests in 24 files, 217 Rust tests, 1 ignored) and npm run lint passed. No user-visible change, so CHANGELOG.md stays as it is; no new strings; no change to focus, dialogs or announcements, so just smoke was not needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision: no-go for tauri-driver end-to-end tests; keep just smoke as the end-to-end check of the real release exe with NVDA and extend it (TASK-14). TASK-6 is archived with the user's approval.

Why: in v0.2.1 and v0.3.0 such tests would have caught at most one bug earlier (the CSP-blocked list arrow, and only with a console check). The bugs that really happened were NVDA speech problems, which WebDriver cannot hear, or frontend logic that unit tests now cover; none came from capabilities, plugins or build settings. The cost would be high: the app replaces WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS, which msedgedriver needs, so it needs an app change or a separate test build; msedgedriver must match a WebView2 that now updates every two weeks (157.0.4341.46 here); since WebView2 150 (July 2026) elevated GitHub runners ignore that variable, and Tauri does not plan a fix before v3; the embedded WebdriverIO plugin avoids that but must stay out of release builds, so it tests a different exe. WebDriver reaches neither the global hotkey, the tray nor autotype; it can check names, roles and DOM focus, which unit tests already do, but no speech.

Checked against primary sources dated 2026 (Tauri docs, crates.io, Microsoft Edge and WebView2 docs, WebView2Feedback, GitHub runner docs and images, W3C WebDriver 2) and the git history; versions read on this machine without installing anything. Not verified by a trial run (declined by the user). Other options recorded but not turned into tasks: just smoke without NVDA in CI, axe-core and a CSS-against-CSP check in unit tests, Guidepup later. npm run test:all and npm run lint pass; no code changed.
<!-- SECTION:FINAL_SUMMARY:END -->
