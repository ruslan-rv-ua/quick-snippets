// TypeScript types synchronized with Rust structs

export type LangCode = 'en' | 'uk' | 'de';

/**
 * @internal
 * Raw snippet row mirroring the Rust DB struct.
 * Content is a byte array and is NEVER transmitted to the frontend.
 * Use {@link SnippetView} for all IPC/UI code.
 */
export interface Snippet {
  id: number;
  title: string;
  content: Uint8Array;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Snippet as sent by the backend to the frontend.
 * content is always an empty string for encrypted snippets —
 * plaintext is NEVER transmitted over IPC.
 */
export interface SnippetView {
  id: number;
  title: string;
  content: string;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

/** Fuzzy search result returned by `search_snippets`. */
export interface SearchResult {
  id: number;
  title: string;
  score: number;
  matched_positions: number[];
  is_encrypted: boolean;
}

/** Persisted window position/size. */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Application settings (mirrors settings.rs `Settings`). */
export interface Settings {
  theme: string;
  start_in_tray: boolean;
  autostart: boolean;
  confirm_on_close: boolean;
  /** BCP-47 language tag ("en" | "uk") or "" for auto-detect. */
  language: string;
  window_state: WindowState;
  /** Inter-character delay in milliseconds for autotype (0 = no delay). */
  autotype_delay_ms: number;
  sort_mode: string;
  sort_direction: string;
}
