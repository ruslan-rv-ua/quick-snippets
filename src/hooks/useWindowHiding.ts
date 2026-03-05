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
  setShowPassword: (show: boolean) => void;
  setShowCreate: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowExit: (show: boolean) => void;
}

export interface UseWindowHidingReturn {
  hideWindow: () => void;
}

/**
 * Encapsulates all window hiding/showing logic:
 * - Full reset + hide window when Escape is pressed on empty query
 * - Partial reset when window loses focus (clears query, search state, password modal)
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
    setShowPassword,
    setShowCreate,
    setShowSettings,
    setShowExit,
  } = params;

  // ── Full reset + hide window ──────────────────────────────────────────
  const hideWindow = useCallback(() => {
    reset();
    closeAll();
    getCurrentWindow().hide().catch(() => void 0);
  }, [reset, closeAll]);

  // ── Partial reset (blur) ──────────────────────────────────────────────
  const partialReset = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    setShowPassword(false);
    // Other modals stay open
  }, [setQuery, setActiveIndex, setShowPassword]);

  // ── Focus search box when no modal is open ────────────────────────────
  const focusSearch = useCallback(() => {
    if (!anyModalOpen) searchRef.current?.focus();
  }, [anyModalOpen, searchRef]);

  // ── Window events (focus, blur, tray, hotkey) ─────────────────────────
  useWindowEvents({
    onInitialFocus: () => searchRef.current?.focus(),
    onShow: () => {
      focusSearch();
      setRefreshTick((n) => n + 1);
    },
    onBlur: partialReset,
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
