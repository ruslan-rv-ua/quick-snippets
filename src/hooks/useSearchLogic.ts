import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { searchSnippets } from './useIpc';
import type { SearchResult } from '../types';

export interface SearchLogicState {
  query: string;
  setQuery: (query: string) => void;
  snippets: SearchResult[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  refreshTick: number;
  setRefreshTick: (tick: number | ((prev: number) => number)) => void;
  reset: () => void;
}

export function useSearchLogic(): SearchLogicState {
  const [query, setQuery] = useState<string>('');
  const [snippets, setSnippets] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const debouncedQuery = useDebounce(query, 100);

  // ── Fetch snippets on debounced query change OR window show ────────────
  useEffect(() => {
    searchSnippets(debouncedQuery)
      .then((results) => {
        const safeResults = Array.isArray(results) ? results : [];
        setSnippets(safeResults);
        setActiveIndex(safeResults.length > 0 ? 0 : -1);
      })
      .catch(() => void 0);
  }, [debouncedQuery, refreshTick]);

  // ── Reset search logic ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQuery('');
    setSnippets([]);
    setActiveIndex(-1);
  }, []);

  return {
    query,
    setQuery,
    snippets,
    activeIndex,
    setActiveIndex,
    refreshTick,
    setRefreshTick,
    reset,
  };
}
