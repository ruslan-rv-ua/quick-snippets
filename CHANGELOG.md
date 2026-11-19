# CHANGELOG

## [Unreleased]

### Fixed
- With "Start in tray" on, the window no longer shows up for a moment when QuickSnippets starts. Before, at every start it was on screen for about a quarter of a second and took the keyboard from the program you were in: a screen reader said "QuickSnippets" and then read your current window again, and a key pressed in that moment could be lost. Now the window stays hidden, and the keyboard stays where it was, until you press Ctrl+Alt+Space or use the tray icon.
- After a start in the tray, screen readers now read the first Ctrl+Alt+Space properly: the window, then the search box, once. Before, when QuickSnippets had been started again soon after it was closed, NVDA read the window title and the document several times and the search box twice, and once in a while it said nothing at all until the next key press.

## v0.3.3 - 2026-11-19

### Fixed
- Saving a snippet with too much text now gives a clear message. The create and edit dialogs say under "Content", in the interface language, how long the text is and how much fits, for example "Text too long for an encrypted snippet: 52300 bytes, at most 49105 allowed", and move the focus to the content field. Before, an encrypted snippet with more than 49,105 bytes of text failed with a raw database error ("CHECK constraint failed: …"), and a plain snippet with more than 65,536 bytes got a message in English only; both appeared under the title field, which got the focus. The limits themselves are unchanged: 65,536 bytes for a plain snippet and 49,105 bytes for an encrypted one, because the encrypted text takes about a third more space. A Latin letter takes 1 byte, a Cyrillic letter 2.
- Snippet titles of 3 to 50 characters are now accepted in any language, emoji included, when you create a snippet and when you rename one. Before, creating a snippet with a title of more than 25 Cyrillic letters failed with "Title too long (max 50 chars)" in English, a title of two emoji failed with a raw database error, and the title field stopped taking input early when the title had emoji. A title that is too short or too long now gets a message under "Title" in the interface language that also says how many characters it has, for example "Title must be 3–50 characters, now 57". Some emoji, such as flags or a family, count as several characters.
- Text in the "Title" and "Content" fields is no longer cut off without a word. Before, a pasted text longer than 65,536 characters was silently shortened and could be saved that way, and a pasted title was cut at 50 characters. Now the whole text stays in the field, and if it is too long, saving gives the message under "Content" (or under "Title") and moves the focus there, so you can shorten it yourself.

## v0.3.2 - 2026-11-19

### Changed
- Search box: screen readers now say it more briefly. NVDA says "Search, combo box, expanded, editable, opens list" and then the query, or "blank" when the search is empty. Before, it said "Search snippets…, combo box, expanded, has autocomplete, editable", and in an empty search box it repeated "Search snippets…" before "blank". You hear this each time the window opens and each time you go back from the list to the search box. The hint shown in the empty search box is now "Search" ("Пошук" in Ukrainian, "Suchen" in German).

### Fixed
- After you delete a snippet, or save one in the create or edit dialog, screen readers now go straight back to the snippet list: right after "Deleted" or "Saved" they read the snippet that is selected now. Before, NVDA first said "blank" or "unknown" and "application", because focus passed through the empty page on its way back from the dialog, and after a delete it sometimes read an unnamed list item, what was left of the deleted snippet.
- A dialog opened right after the window appears now keeps the focus. Before, if you pressed F1 or Ctrl+N in the first moments after QuickSnippets started, the dialog opened, but focus jumped back to the search box behind it, so the screen reader left the dialog and the keys went to the search.

## v0.3.1 - 2026-11-17

### Fixed
- Search: screen readers now say "No results found" when a search finds nothing. Before, they stayed silent, because the announcement was cancelled when the results arrived. When the found snippet is the same one that was selected before, its name is now read too; a newly selected snippet is still read once, as before.
- Search box: Delete now erases the character after the cursor, or the selected text, as in any text field. Before, it asked to delete the selected snippet instead whenever the list was not empty. Delete still asks to delete the selected snippet when no text follows the cursor, for example in an empty search box, and Ctrl+D does so wherever the cursor is. Right after Delete has erased text, press another key first, for example an arrow key: this way, holding Delete down never opens the delete confirmation, also with a screen reader. The keyboard shortcuts help (F1) and the READMEs describe this.
- Search box: screen readers now read editing in the search box while a snippet is selected, as in any text field: Left and Right read the character at the cursor, Ctrl+Left and Ctrl+Right the word, Backspace the erased character, and Delete the character after the cursor. Before, NVDA stayed silent, because it treated the selected snippet as focused. Up, Down, Home and End still move through the list and read the selected snippet; the first key that moves the cursor or changes the text after them says the search box once. The snippet stays selected while you edit, and Enter still copies it. When the window opens, the screen reader is now in the search box and then reads the first snippet, so a search typed right away is read as you type.
- The window no longer hides while it is still the active window. This could happen now and then when an assistive or automation tool pressed a button or a check box for you through the Windows accessibility interface (UI Automation): the keyboard was left outside the window content, and 0.2 s later the window disappeared with the dialog still open, so the next keys, for example Ctrl+Enter to save the settings, went nowhere. The window now stays open and takes the keyboard back 0.2 s later. It still hides 0.2 s after you switch to another window.
- The search and the password dialog now stay as they were when the keyboard only moves inside the window, for example after an assistive or automation tool pressed a button for you through UI Automation. Before, the typed search was cleared and an open password dialog closed, together with the password typed in it, although the window stayed open. The search is still cleared and the password dialog still closes when the window hides because you switched to another window.

## v0.3.0 - 2026-11-16

### Before you upgrade
- Encrypted snippets are stored in a new format (see Security below). Upgrading is safe: snippets from 0.2.1 or earlier keep opening with their password.
- **Going back to a version before 0.3.0**: older versions cannot read the new format. An encrypted snippet that was created or re-encrypted by this version shows "Wrong password" there, even with the right password. Nothing is damaged, and 0.3.0 or later opens it again. Unencrypted snippets, and encrypted snippets not yet opened in this version, keep working in older versions. If you might go back, back up the `quick-snippets-data` folder before upgrading.

### Security
- Encrypted snippets: the encryption key is now derived from the password with PBKDF2-HMAC-SHA256 at 600,000 iterations instead of 100,000. This is the current OWASP minimum for this algorithm and makes password guessing six times more expensive.
- Encrypted snippets are stored in a new format. Snippets encrypted by 0.2.1 or earlier still open with their password, and each one moves to the new format the first time it is copied or auto-typed. The new data is checked before it replaces the old, and if anything fails the snippet stays as it was. A snippet that is never opened stays in the old format, because the move needs its password.

### Added
- **Keyboard shortcuts help on F1.** F1 in the main window opens a list of all keyboard shortcuts with what each one does, in the interface language: global, main window, and forms and dialogs. Screen readers read it one shortcut at a time with the Up and Down arrows, keys and action together, and say the group name when you move into the next group; Home and End go to the first and last shortcut. Escape or Close closes the help, and focus returns to where it was. F1 does nothing while another dialog is open.

### Changed
- Checking the password of an encrypted snippet takes longer, by design: about 0.1 s on a recent desktop CPU (was about 0.03 s) and up to about half a second on old ones. The first use of a snippet from an older version takes about twice as long, once.
- **Settings dialog reworked.** The settings are in three groups: "Appearance and language", "Startup and closing" and "Auto-type". Screen readers say the group name when focus enters a group. Each setting is one row with its label, a short hint where it helps, and the control; the hint is read right after the setting. The theme is now a list, like the language. The dialog fits the default 680×520 window without scrolling, and every control shows a clear focus outline in both themes.
- Settings: the general hint "Some settings take effect after restart" is gone. Instead, "Start with Windows" and "Start minimized to the tray" say when they take effect; every other setting applies on Save.
- Settings: screen readers read the app version right after the dialog title. It is still shown at the bottom of the dialog.
- Settings: clearer names. "Auto (system)" is now "Same as Windows"; "Start in system tray" is "Start minimized to the tray"; "Confirm before closing" is "Ask before closing the app"; "Autotype delay (ms)" is "Delay between characters, ms".
- Settings: Save changes only the settings shown in the dialog; other saved settings, such as the sort order, stay as they are.

### Fixed
- The theme chosen with Ctrl+Shift+T is now saved and stays after a restart. Before, it lasted only until the app closed, unless Settings was saved in between. Only the theme is changed in the settings file. In the Settings dialog the theme is still saved only by Save.
- Settings changed by shortcuts (theme and sort order) are now saved one after another, so two quick shortcuts can no longer undo each other's change.
- Settings: Cancel, Esc and a click outside the dialog now bring back the theme and language that were shown when the dialog opened. Before, a theme or language picked in the dialog stayed on screen until the next start, although it was not saved.
- Settings: choosing "Auto (system)" in the language list no longer turns the window blank. Save now keeps this choice; before, it replaced it with the language detected at that moment.
- Settings: the language list shows its drop-down arrow. The arrow was an embedded image, which the app's content security policy blocked.
- Screen readers: the Save button in Settings stays available while it saves, so focus no longer drops out of the dialog.
- With the language set to "Same as Windows", the tray menu and the window now always use the same language: the Windows display language if it is English, Ukrainian or German, otherwise English. Before, the tray menu followed the Windows regional format and knew only Ukrainian, so on a German Windows the window was German and the tray menu English.

## v0.2.1 - 2026-11-16

### Added
- `just smoke`: local smoke test of the release exe with NVDA. It drives the real app with the keyboard, checks each result, and reports what NVDA said at every step (`scripts/smoke-nvda.ps1`).

### Changed
- Smaller release executable (5.3 MB → 3.8 MB): PNG-compressed app icon, unused Tauri plugin commands no longer compiled in, an unused dependency removed, and `opt-level = "z"`.
- The main window no longer has direct access to the clipboard, global-shortcut, and autostart plugins; these features run in the Rust backend.
- CI: lint and all tests now run on every push to `develop`/`main` and on pull requests.
- Scoop: the manifest is now updated by Excavator in the `scoop-bucket` repository; `update-scoop.yml` was removed from this repository.

### Fixed
- Screen readers: validation errors in the create and edit dialogs (title length, empty content, passwords do not match) are now always announced with their text, once. Before, the first error in a dialog could be read as just "alert", and every message was followed by the word "alert".
- Screen readers: the "Wrong password" message is now announced. The password field is no longer disabled while checking, so focus stays in it (NVDA no longer says "unavailable").
- Screen readers: a new notification no longer re-reads older ones still on screen (NVDA said "Saved Copied" after copying right after a save).
- READMEs: correct release ZIP name and the Scoop data folder location.
- READMEs: Ctrl+Alt+Space shows the window; it does not hide it.

## v0.2.0 - 2026-04-19

### Added
- **Snippet sorting**: sort the snippet list by creation date, modification date, alphabetical order, or last used time. Switch modes with `Ctrl+Shift+1`–`Ctrl+Shift+4`; pressing the same shortcut again toggles ascending/descending order. The active sort mode is shown as a label next to the search field. Sort preference is saved and restored on app restart.
- Snippets that have never been used appear at the bottom of the list when sorting by "last used", regardless of sort direction.
- **Auto-type**: press `Shift+Enter` on any selected snippet to type its content directly into the previously active window — no clipboard involved. Works for both plain and encrypted snippets.
- **Autotype delay** setting (0–1000 ms, default: 1 ms) — configurable inter-character delay for auto-type. Increase to 10–50 ms if characters are dropped or appear out of order in the target application.
- Screen reader compatibility for auto-type: primary method uses `PostMessage(WM_CHAR)`, bypassing `WH_KEYBOARD_LL` hooks used by NVDA and JAWS. The `SendInput` fallback enforces a minimum 50 ms inter-character delay.
- Tabs (`\t`) and all newline variants (`\n`, `\r`, `\r\n`) in auto-typed text are sent as real `VK_TAB` / `VK_RETURN` key events.
- Emoji and non-BMP characters are auto-typed correctly via UTF-16 surrogate pairs.

### Known Limitations
- Auto-type does not work into applications running with elevated privileges (UAC / Run as administrator) unless QuickSnippets is also elevated.

### Changed
- `just final-checks` now verifies version sync across `package.json`, `tauri.conf.json`, and `Cargo.toml` before running other checks.
- Added `just build-fast` recipe (alias `bf`) for quick builds using `release-fast` Cargo profile.
- Release workflow: `workflow_dispatch` only (removed automatic `push tag` trigger), auto-creates git tag.
- Release ZIP now includes `LICENSE` and `README.md` alongside the `.exe`.
- Scoop bucket update is now a separate manual workflow (`update-scoop.yml`) with SHA256 verification.
- Removed `notify-scoop-bucket.yml` (replaced by `update-scoop.yml`).

---

## v0.1.2 - 2026-03-05

### Security
- Comprehensive hardening: eliminated plaintext heap leaks with Zeroizing buffers for clipboard operations
- Refactored key derivation to use reference-based output parameters, preventing uncertain copy-on-return of sensitive data
- Added explicit content length validation (max 65,536 bytes) for all snippet content with readable error messages
- Removed unnecessary dialog permissions from capabilities configuration
- Implemented Content Security Policy (CSP) in both Tauri configuration and HTML meta tags to prevent XSS attacks
- Added comprehensive security documentation: Security.md with responsible disclosure process and Security Model section in README

---

## v0.1.1 - 2026-03-02

**Added**
- `Ctrl+D` as an alternative shortcut for deleting the selected snippet (in addition to
  the existing `Delete` key). Like all letter shortcuts, it is layout-independent.
- German (Deutsch) localization — complete translation of all UI strings and parametrized messages.
- Language selector in Settings now includes Deutsch as a third option.
- Auto-detect falls back to German when the system locale is `de`.
- `README.uk.md` — Ukrainian version of the readme.
- `README.de.md` — German version of the readme.
- Language links in `README.md`.

**Fixed**
- Keyboard shortcuts (Ctrl+N, Ctrl+E, Ctrl+F, Ctrl+,, Ctrl+Shift+T, /) now work
  regardless of the active OS keyboard layout (e.g. Ukrainian). Root cause: switched
  from `event.key` (layout-dependent) to `event.code` (physical key position) for all
  letter and symbol shortcuts.
- `Ctrl+Enter` in the Exit Confirmation dialog now always quits the app, even when the
  Cancel button is focused (previously bare Enter was blocked by the Cancel focus guard).
- `Ctrl+Enter` in the Delete Confirmation dialog now confirms deletion, consistent with
  all other modal dialogs.

---

## v0.1.0 - 2026-02-27

Summary: Initial public MVP release of QuickSnippets — a portable Windows launcher for secure text snippets with local encryption, search, and a basic set of UI/UX features.

**Added**
- Portable desktop application for Windows (Tauri + React + TypeScript).
- Local encrypted snippets storage (AES-256-GCM) with key derivation PBKDF2‑HMAC‑SHA256.
- UI: create, edit, delete snippets, modal dialogs (CreateSnippetModal, EditSnippetModal, DeleteConfirmModal, SettingsModal, PasswordModal).
- Search and filtering of snippets (fuzzy search) and snippet list components (SnippetList, SnippetItem).
- Interactive hints/toasts (Toast, ToastContainer) and accessibility/localization (English and Ukrainian).
- Launcher behavior: single‑instance (relaunch focuses the already open window) and automatic hide on blur (blur → hide).
- Tray, global hotkeys and other Tauri integrations (initialization in main.rs).

**Security**
- Cryptography: AES‑256‑GCM + PBKDF2‑HMAC‑SHA256 (100000 iterations), unique salt and nonce for each encryption.
- Critical security invariant: decrypted snippet content is NEVER sent to the frontend. All clipboard operations are performed exclusively in the Rust process.
- Sensitive buffers (keys, plaintext) must be zeroized after use.
- IPC responses for critical commands return only `Ok(())` or `Err(...)`, without plaintext.
