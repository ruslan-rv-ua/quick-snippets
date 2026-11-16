import { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SearchBoxHandle } from '../components/SearchBox';
import { useWindowEvents } from './useWindowEvents';

export interface UseWindowHidingParams {
  reset: () => void;
  closeAll: () => void;
  anyModalOpen: boolean;
  query: string;
  searchRef: React.RefObject<SearchBoxHandle | null>;
  setRefreshTick: (tick: number | ((prev: number) => number)) => void;
  setQuery: (query: string) => void;
  setActiveIndex: (index: number) => void;
  /** Screen readers start in the search box when the window is shown again. */
  setListFocused?: (listFocused: boolean) => void;
  setShowPassword: (show: boolean) => void;
  setShowCreate: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowExit: (show: boolean) => void;
  setAutotypeMode?: (mode: boolean) => void;
}

export interface UseWindowHidingReturn {
  hideWindow: () => void;
}

/**
 * Encapsulates all window hiding/showing logic:
 * - Full reset + hide window when Escape is pressed on empty query
 * - Partial reset when the backend hides the window because the user left it (clears query,
 *   search state, password modal); not when the keyboard only moves inside the window
 * - Focus search box when window gains focus
 * - Handles tray and close request events
 */
export function useWindowHiding(params: UseWindowHidingParams): UseWindowHidingReturn {
  const {
    reset,
    closeAll,
    anyModalOpen,
    query,
    searchRef,
    setRefreshTick,
    setQuery,
    setActiveIndex,
    setListFocused,
    setShowPassword,
    setShowCreate,
    setShowSettings,
    setShowExit,
    setAutotypeMode,
  } = params;

  // ── Full reset + hide window ──────────────────────────────────────────
  const hideWindow = useCallback(() => {
    reset();
    closeAll();
    getCurrentWindow().hide().catch(() => void 0);
  }, [reset, closeAll]);

  // ── Partial reset (window hidden after the user left it) ──────────────────────────────────────────────
  const partialReset = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    // With a dialog open, the screen reader still returns to the selected snippet when it closes.
    if (!anyModalOpen) setListFocused?.(false);
    setShowPassword(false);
    setAutotypeMode?.(false); // RC-1: reset autotype mode when the window hides
    // Other modals stay open
  }, [setQuery, setActiveIndex, setListFocused, setShowPassword, setAutotypeMode, anyModalOpen]);

  // ── Focus search box when no modal is open ────────────────────────────
  const focusSearch = useCallback(() => {
    if (!anyModalOpen) searchRef.current?.focus();
  }, [anyModalOpen, searchRef]);

  // ── Window events (focus, hidden, tray, hotkey) ─────────────────────────
  useWindowEvents({
    onInitialFocus: () => searchRef.current?.focus(),
    onShow: () => {
      focusSearch();
      setRefreshTick((n) => n + 1);
    },
    onHidden: partialReset,
    onTrayCreate: () => setShowCreate(true),
    onTraySettings: () => setShowSettings(true),
    onCloseRequest: () => setShowExit(true),
  });

  // ── Escape key on empty query → hide window ───────────────────────────
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && query === '' && !anyModalOpen) {
        hideWindow();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [query, hideWindow, anyModalOpen]);

  return {
    hideWindow,
  };
}
