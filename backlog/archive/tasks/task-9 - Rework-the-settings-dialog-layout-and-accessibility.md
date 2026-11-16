---
id: TASK-9
title: Rework the settings dialog layout and accessibility
status: Done
assignee:
  - '@claude'
created_date: '2026-11-16T00:34:00Z'
updated_date: '2026-11-16T13:43:00Z'
labels:
  - accessibility
  - frontend
  - model-opus
  - effort-high
milestone: m-1
dependencies:
  - TASK-11
references:
  - src/components/SettingsModal.tsx
  - src/components/__tests__/SettingsModal.test.tsx
  - src/styles/theme.css
  - src/contexts/ThemeContext.tsx
  - src/contexts/LanguageContext.tsx
  - src/i18n/translations.ts
  - scripts/smoke-nvda.ps1
  - README.md
  - README_UK.md
  - README_DE.md
priority: medium
ordinal: 3200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The settings dialog (Ctrl+, or the tray menu) grew one field at a time and now reads as a flat list: a "Theme" caption over two toggle buttons, the language list, three checkboxes, the autotype delay as a bare number field, a general hint that some settings take effect after a restart (without saying which), the Cancel and Save buttons, and the app version below them. The goal is a dialog that looks tidy and attractive and stays fully usable with a screen reader. How it should look is a matter of taste: the user has not chosen a layout yet.

Found while writing this task: Cancel and Escape do not undo theme and language changes. Both apply at once and stay for the session, but only Save writes them, so the app quietly returns to the saved values at the next start. The other settings are simply discarded on Cancel.

just smoke opens this dialog with Ctrl+, and finds the autostart checkbox by its id (scripts/smoke-nvda.ps1): keep the id or update the smoke steps. Ask the user before every just smoke run, since the keyboard and mouse must stay untouched for about a minute. Read NVDA speech only through just smoke: it reads only what NVDA writes during the run, while nvda.log also holds private speech from other programs and other days.

Recommended setup: Claude Opus 5.5 (`/model opus`), effort high (`/effort high`). Visual design with a subjective goal, plus screen reader semantics that are easy to get subtly wrong inside the app's role="application" root: this needs judgment and careful checking with NVDA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before any code change, the proposed structure (groups, order, control types, labels and where hints go) is recorded in the task notes and approved by the user
- [x] #2 The dialog follows the approved structure in both light and dark themes and fits the default window size (680x520) without horizontal scrolling
- [x] #3 With NVDA, every control is announced with its visible label, role and state or value, and each hint is read together with the setting it belongs to
- [x] #4 Tab order follows the visual order, and the focus indicator is clearly visible on every control in both themes
- [x] #5 Cancel and Escape leave every setting as it was when the dialog opened, theme and language included; after Save, all changes survive a restart
- [x] #6 Unit tests cover the new structure, the labels and the Cancel behaviour; just smoke checks what NVDA says in the reworked dialog and passes
- [x] #7 The Settings sections of README.md, README_UK.md and README_DE.md match the new dialog
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
1. Branch feature/settings-dialog (git flow feature start).
2. LanguageContext: export resolveLanguage, so the dialog keeps the raw preference ("" = Same as Windows) and previews the resolved language.
3. SettingsModal: three fieldset groups with legends (cards), rows with label + hint (aria-describedby) on the left and the control on the right; theme and language selects with preview; three checkboxes; delay number field; version as the dialog description; footer with version, Cancel, Save. Render the dialog only after settings load, so focus enters it once and NVDA reads name, version, group and the theme list together.
4. Cancel, Escape and a click outside restore the theme and language shown at open; Save writes only the dialog fields through updateSettings.
5. ModalOverlay: optional describedBy and className props.
6. CSS: wider settings dialog (fits 680x520 without scrolling), group cards, rows, hints, a solid focus outline on every control in both themes. Check in a browser at 680x520 in both themes and all three languages.
7. Translations en/uk/de: group names, new labels and hints, "Same as Windows"; remove restartHint.
8. Unit tests: structure, labels and roles, hints linked to controls, Cancel/Escape restore theme and language and save nothing, Save writes only dialog fields (and "" for Same as Windows), no crash on Same as Windows.
9. Smoke: steps for what NVDA says on open and on each Tab stop (labels, roles, hints, order), and for Escape restoring theme and language.
10. README en/uk/de Settings sections, CHANGELOG [Unreleased].
11. npm run test:all, npm run lint, release build, just smoke (with the user's permission).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Proposed settings dialog structure (awaiting the user's approval)

Layout: one column, the dialog up to about 600 px wide, fitting the default 680x520 window without scrolling. Title "Settings" at the top. Three groups; each is a fieldset with a legend (NVDA reads the group name when focus enters it), drawn as a rounded card with a small muted heading above it. Inside a card each setting is one row: the label on the left with a smaller muted hint under it (if any), the control on the right; thin lines between rows. Bottom row: the app version in muted text on the left, Cancel and Save on the right. Focus: a solid 2 px accent outline around every control in both themes.

Group 1 "Appearance and language" (uk "Вигляд і мова", de "Darstellung und Sprache")
1. Theme (uk "Тема", de "Design"): a radio group Dark / Light (uk "Темна" / "Світла", de "Dunkel" / "Hell"), drawn as a two-part segmented control. One Tab stop; the arrow keys switch the theme and show it at once. No hint.
2. Language (uk "Мова", de "Sprache"): a list with Same as Windows (uk "Як у Windows", de "Wie in Windows"), English, Українська, Deutsch. The interface language changes at once. No hint.

Group 2 "Startup and closing" (uk "Запуск і закриття", de "Start und Beenden")
3. Checkbox "Start with Windows" (uk "Запускати разом з Windows", de "Mit Windows starten"). Hint: "Takes effect the next time you sign in to Windows." (uk "Діє з наступного входу в Windows.")
4. Checkbox "Start minimized to the tray" (uk "Запускати згорнутим у трей", de "Minimiert im Infobereich starten"). Hint: "Takes effect at the next start. Open the window with Ctrl+Alt+Space." (uk "Діє з наступного запуску. Вікно відкривається клавішами Ctrl+Alt+Space.")
5. Checkbox "Ask before closing the app" (uk "Питати перед закриттям програми", de "Vor dem Beenden nachfragen"). Hint: "Applies to Alt+F4 and the window's close button." (uk "Стосується Alt+F4 і кнопки закриття вікна.")

Group 3 "Auto-type" (uk "Автодрук", de "Automatisch tippen")
6. Number field "Delay between characters, ms" (uk "Затримка між символами, мс", de "Verzögerung zwischen Zeichen, ms"), 0 to 1000, step 1. Hint: "0 is the fastest. If characters go missing, try 10 to 50." (uk "0 — найшвидше. Якщо символи губляться, спробуйте 10–50.")

Removed: the general hint "Some settings take effect after restart". The two hints above say which settings wait for the next start; all others apply on Save.

Buttons: Cancel and Save. Ctrl+Enter saves from any control, Escape cancels.
Hints are linked with aria-describedby, so NVDA reads each hint right after the label, role and state of its control.
Tab order: Theme, Language, Start with Windows, Start minimized, Ask before closing, Delay, Cancel, Save, then back to Theme. On open, focus goes to the selected theme.

Expected NVDA speech (Ukrainian NVDA): on open "Налаштування, діалог", then "Вигляд і мова, групування, Тема, групування, Темна, радіокнопка, позначено, 1 із 2". Tab: "Мова, комбінований список, Українська, згорнуто". Tab: "Запуск і закриття, групування, Запускати разом з Windows, прапорець, не позначено, Діє з наступного входу в Windows."

Behaviour: Cancel, Escape and a click outside the dialog bring back the theme and language that were shown when the dialog opened and drop all other changes; nothing is written. Save writes only the dialog's own fields (theme, language, the three checkboxes, the delay) through updateSettings, so the sort order and the window size stay as they are.

Open questions for the user: checkboxes or switches for the three on/off settings; whether NVDA reads the app version when the dialog opens; whether the "Auto (system)" language bug below is fixed in this task.

Found while preparing:
- Choosing "Auto (system)" in the language list throws in LanguageContext (translations[''] is undefined) and the whole window goes blank. Reproduced with a throwaway unit test.
- When the saved language is auto (""), Save replaces it with the detected language, because the dialog saves the resolved language from LanguageContext.
- The focus trap treats every radio button as a Tab stop. With a radio group, Shift+Tab from the checked radio would leave the dialog; the rework must handle this.

## Approval (2026-11-16)

The user approved the proposed structure with these decisions:
- Theme: a list (select), like Language, instead of radio buttons. NVDA: "Тема, комбінований список, Темна, згорнуто". Arrow keys switch and show the theme at once. Chosen after comparing a list, radio buttons, a single "Dark theme" checkbox and the current toggle buttons.
- The three on/off settings stay checkboxes (not switches): the dialog has Save and Cancel.
- NVDA reads the app version when the dialog opens: the version text is the dialog's description ("Налаштування, діалог, QuickSnippets версія …").
- Fix the "Auto (system)" language option in this task (renamed "Same as Windows" / "Як у Windows" / "Wie in Windows"); Save keeps "" for it.
- All four hints stay as proposed.

## Implementation

- SettingsModal rewritten: three fieldset groups with legends (drawn as cards), each setting one row with the label and an optional hint (aria-describedby) on the left and the control on the right. Theme and language are selects; the three on/off settings are checkboxes; the delay is a number field (0 to 1000). The footer holds the version, Cancel and Save. Ids are unchanged (settings-lang, settings-tray, settings-autostart, settings-confirm, settings-autotype-delay); new: settings-theme, settings-cancel, settings-save.
- The dialog renders only after get_settings and the version load, so focus enters it once and NVDA reads the title, the version (dialog description), the group and the theme list together. On a load error the dialog reports it and closes.
- Cancel, Escape and a click outside restore the theme and language shown at open (ThemeContext.setTheme, LanguageContext.setLanguage). Escape is ignored while a save runs, so what is shown matches what is saved. Save writes only the dialog fields through updateSettings; "Same as Windows" is saved as "".
- LanguageContext exports resolveLanguage; choosing "Same as Windows" no longer crashes (it set the language to "", and translations[""] is undefined).
- Save uses aria-disabled while saving instead of disabled, so focus does not drop out of the dialog.
- ModalOverlay: new describedBy and className props; the unused busy prop is removed.
- CSS: .settings-dialog (max-width 600 px), group cards, rows with inset dividers, a tinted row on focus, a solid 2 px accent outline on every control. The select arrow was a data: SVG that the CSP (default-src 'self') blocks, so it never showed; it is now drawn with CSS on a .select-wrap wrapper.
- Translations en/uk/de: group names, new labels, four hints, "Same as Windows"; restartHint removed.
- Smoke: new steps for the settings dialog (speech on open and at every Tab stop, Tab order including the wrap, Escape restoring theme and language with settings.json unchanged, reopening), settings.json checks after Save, a new -ExpectAny parameter for role and state words in uk/en/de, test delay 7 ms, and a report hint when description checks fail.
- README en/uk/de: the Settings section follows the dialog groups. CHANGELOG [Unreleased]: Changed and Fixed entries.

## Verification

- npm run test:all: 23 files / 353 frontend tests and 213 Rust tests pass (1 ignored). npm run lint passes.
- Mutation check: with the theme restore removed from Cancel, five SettingsModal tests fail.
- Browser pane (Chromium, same CSP) at 680x520: the dialog fits without any scrolling (scrollWidth = clientWidth = 598, scrollHeight = clientHeight = 467; page scrollWidth 680) in en, uk and de, in both themes. Tab order theme, language, autostart, tray, confirm, delay, Cancel, Save, then theme again; every control matches :focus-visible with a solid 2 px accent outline (dark rgb(88,166,255), light rgb(9,105,218)), checked through all eight stops in both themes. Escape restored theme and language with no save; Save with "Same as Windows" wrote language "".
- just smoke on the rebuilt release exe: 29 of 29 steps and 67 of 67 NVDA checks pass. NVDA said, for example: "Налаштування, діалог, QuickSnippets версія 0.2.1 | Вигляд і мова, групування | Тема, комбінований список, Темна, згорнуто"; "Запуск і закриття, групування | Запускати разом з Windows, прапорець, не позначено, Діє з наступного входу в Windows."; "Затримка між символами, мс, кнопка прокрутки, можливо редагувати, 0 — найшвидше. Якщо символи губляться, спробуйте 10–50., виділено 7".
- The first smoke run failed 5 checks: NVDA read no hints and no version, because the user's NVDA had "Report object descriptions" off. The user turned it on and chose to keep the hints as descriptions; the second run passed. Hints and the version are heard only with that NVDA setting on; the smoke report now says so when these checks fail.
- "After Save, changes survive a restart" is checked through the saved file: smoke reads settings.json after Save (autostart on, then off; theme, language and delay unchanged), and the existing tests cover loading settings at startup. The app was not restarted by hand.

## Follow-ups (not done here)

- Rust detect_language knows only uk and en, while the WebView side also detects de: with "Same as Windows" on a German Windows the window is German and the tray menu English.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The settings dialog is rebuilt to the structure the user approved: three named groups ("Appearance and language", "Startup and closing", "Auto-type"), one row per setting with its label, a short hint where it helps and the control, and a footer with the version, Cancel and Save. The theme is a list like the language; the on/off settings are checkboxes; NVDA reads the version after the dialog title and each hint after its setting (both are object descriptions, so NVDA needs "Report object descriptions" on). The general restart hint is replaced by hints on the two settings that wait for the next start.

Cancel, Escape and a click outside now bring back the theme and language shown at open and save nothing; Save writes only the dialog's fields. "Auto (system)", now "Same as Windows", no longer blanks the window and is kept on Save. The select arrow, blocked by the CSP until now, is drawn with CSS. The dialog fits 680x520 without scrolling in both themes and all three languages, with a clear focus outline on every control.

Verified by 353 frontend and 213 Rust tests, lint, a browser check at 680x520, and just smoke on the rebuilt release exe (29/29 steps, 67/67 NVDA checks). Follow-up outside this task: Rust language detection does not know German, so the tray menu stays English on a German Windows with "Same as Windows".
<!-- SECTION:FINAL_SUMMARY:END -->
