import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { searchSnippets, getSortedSnippets } from './useIpc';
import type { SearchResult } from '../types';

export interface SortConfig {
  sortMode: string;
  sortDirection: string;
}

export interface SearchLogicState {
  query: string;
  setQuery: (query: string) => void;
  snippets: SearchResult[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /**
   * True while screen readers are on the selected snippet (the search box points at it with
   * aria-activedescendant), false while they are in the search box itself. The arrow keys move
   * them into the list; keys that edit the query or move the caret bring them back. The selected
   * snippet (activeIndex) is the same either way.
   */
  listFocused: boolean;
  setListFocused: (listFocused: boolean) => void;
  refreshTick: number;
  setRefreshTick: (tick: number | ((prev: number) => number)) => void;
  reset: () => void;
}

export function useSearchLogic(sortConfig?: SortConfig): SearchLogicState {
  const sortMode = sortConfig?.sortMode ?? 'modified';
  const sortDirection = sortConfig?.sortDirection ?? 'desc';

  const [query, setQuery] = useState<string>('');
  const [snippets, setSnippets] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [listFocused, setListFocused] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const debouncedQuery = useDebounce(query, 100);

  // ── Fetch snippets on debounced query change OR window show ────────────
  useEffect(() => {
    const fetchPromise =
      debouncedQuery.trim() === ''
        ? getSortedSnippets(sortMode, sortDirection)
        : searchSnippets(debouncedQuery);

    fetchPromise
      .then((results) => {
        const safeResults = Array.isArray(results) ? results : [];
        setSnippets(safeResults);
        setActiveIndex(safeResults.length > 0 ? 0 : -1);
      })
      .catch(() => void 0);
  }, [debouncedQuery, refreshTick, sortMode, sortDirection]);

  // ── Reset search logic ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQuery('');
    setSnippets([]);
    setActiveIndex(-1);
    setListFocused(false);
  }, []);

  return {
    query,
    setQuery,
    snippets,
    activeIndex,
    setActiveIndex,
    listFocused,
    setListFocused,
    refreshTick,
    setRefreshTick,
    reset,
  };
}
