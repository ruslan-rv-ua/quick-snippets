/**
 * Typed wrappers around Tauri IPC commands.
 * One function per Rust `#[tauri::command]`, all returning Promise.
 */
import { invoke } from '@tauri-apps/api/core';
import type { SearchResult, SnippetView, Settings } from '../types';

// ── Snippets ──────────────────────────────────────────────────────────────

export function searchSnippets(query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('search_snippets', { query });
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

export function saveSettings(settings: Settings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

// ── App ───────────────────────────────────────────────────────────────────

export function getPendingNotification(): Promise<string | null> {
  return invoke<string | null>('get_pending_notification');
}

export function quitApp(): Promise<void> {
  return invoke<void>('quit_app');
}
