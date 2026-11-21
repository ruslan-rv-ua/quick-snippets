/**
 * Typed wrappers around Tauri IPC commands.
 * One function per Rust `#[tauri::command]`, all returning Promise.
 */
import { invoke } from '@tauri-apps/api/core';
import type { SnippetListResult, SnippetView, Settings, SaveSettingsOutcome } from '../types';

// ── Snippets ──────────────────────────────────────────────────────────────

export function searchSnippets(query: string): Promise<SnippetListResult> {
  return invoke<SnippetListResult>('search_snippets', { query });
}

export function getSortedSnippets(
  sortMode: string,
  sortDirection: string,
): Promise<SnippetListResult> {
  return invoke<SnippetListResult>('get_sorted_snippets', {
    sortMode,
    sortDirection,
  });
}

export function getSnippetById(id: number): Promise<SnippetView> {
  return invoke<SnippetView>('get_snippet_by_id', { id });
}

/**
 * Create a new snippet. Pass an empty string for `password` to create
 * an unencrypted snippet.
 */
export function createSnippet(
  title: string,
  content: string,
  password: string,
): Promise<void> {
  return invoke<void>('create_snippet', { title, content, password });
}

/**
 * Activate (copy-to-clipboard) a snippet.
 * For encrypted snippets, `password` must be provided.
 * IPC response is always `void` — plaintext is never returned.
 */
export function activateSnippet(id: number, password: string): Promise<void> {
  return invoke<void>('activate_snippet', { id, password });
}

/**
 * Auto-type a snippet into the active OS input field via SendInput.
 * For encrypted snippets, `password` must be provided.
 * IPC response is always `void` — plaintext is never returned.
 */
export function autotypeSnippet(id: number, password: string): Promise<void> {
  return invoke<void>('autotype_snippet', { id, password });
}

export function updateSnippet(
  id: number,
  title: string,
  content: string,
): Promise<void> {
  return invoke<void>('update_snippet', { id, title, content });
}

export function deleteSnippet(id: number): Promise<void> {
  return invoke<void>('delete_snippet', { id });
}

// ── Settings ──────────────────────────────────────────────────────────────

export function getSettings(): Promise<Settings> {
  return invoke<Settings>('get_settings');
}

/**
 * The language "Same as Windows" stands for. The tray menu uses the same
 * answer, so the window and the tray always speak one language.
 */
export function getSystemLanguage(): Promise<string> {
  return invoke<string>('get_system_language');
}

/**
 * Saves the settings. The result says when Windows refused to turn "Start with Windows" on
 * or off: that setting then keeps its previous value, everything else is saved.
 */
export function saveSettings(settings: Settings): Promise<SaveSettingsOutcome> {
  return invoke<SaveSettingsOutcome>('save_settings', { settings });
}

// Read-modify-write updates run one after another, so two quick updates
// (e.g. Ctrl+Shift+T pressed twice, or a theme and a sort shortcut) cannot
// read the same old settings and overwrite each other's change.
let settingsUpdateQueue: Promise<unknown> = Promise.resolve();

/**
 * Changes only the given fields of the saved settings and keeps the rest.
 * Updates are serialised; a failed update does not block later ones.
 * The result is that of `saveSettings`.
 */
export function updateSettings(patch: Partial<Settings>): Promise<SaveSettingsOutcome> {
  const run = settingsUpdateQueue.then(async () => {
    const current = await getSettings();
    return saveSettings({ ...current, ...patch });
  });
  settingsUpdateQueue = run.catch(() => undefined);
  return run;
}

// ── Notifications ─────────────────────────────────────────────────────────

/**
 * Returns a one-shot pending notification message (if any) set by the
 * Rust backend, then clears it. Returns null when there is none.
 */
export function getPendingNotification(): Promise<string | null> {
  return invoke<string | null>('get_pending_notification');
}

/**
 * Tells the backend that the page has its first list. The main window is created hidden;
 * without "Start in tray" the backend shows it only after this, so it appears complete.
 */
export function frontendReady(): Promise<void> {
  return invoke<void>('frontend_ready');
}

export function quitApp(): Promise<void> {
  return invoke<void>('quit_app');
}

/**
 * Reset the close-confirmation-pending flag in the Rust backend.
 * Must be called when the user dismisses (cancels) the exit dialog,
 * so that blur-to-hide behaviour resumes normally.
 */
export function cancelClose(): Promise<void> {
  return invoke<void>('cancel_close');
}

