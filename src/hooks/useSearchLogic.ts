import { useState, useEffect, useCallback, useRef } from 'react';
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
  /**
   * The query the list in `snippets` was loaded for. It catches up with `query` once the results
   * for it arrive (debounce + IPC). A list loaded again for another reason (each time the window
   * is shown or gets the keyboard back) keeps the query it was loaded for, so it is not mistaken
   * for the results of a query typed in the meantime.
   */
  listQuery: string;
  /**
   * Damage of the snippet database cut the list in `snippets` short (see SnippetListResult):
   * the window says so instead of "no snippets yet" or "no results".
   */
  listDamaged: boolean;
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
  /**
   * Loads the list again and resolves once the new list is in state (also when loading fails).
   * A dialog that changed a snippet closes only then, so focus comes back once, to a snippet
   * that is in the list now: not first to a deleted one or to the one selected before.
   */
  reload: () => Promise<void>;
  reset: () => void;
}

export function useSearchLogic(sortConfig?: SortConfig): SearchLogicState {
  const sortMode = sortConfig?.sortMode ?? 'modified';
  const sortDirection = sortConfig?.sortDirection ?? 'desc';

  const [query, setQuery] = useState<string>('');
  const [snippets, setSnippets] = useState<SearchResult[]>([]);
  const [listQuery, setListQuery] = useState<string>('');
  const [listDamaged, setListDamaged] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [listFocused, setListFocused] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const debouncedQuery = useDebounce(query, 100);
  // Callers of reload() waiting for the next load.
  const reloadWaitersRef = useRef<Array<() => void>>([]);

  // ── Fetch snippets on debounced query change OR window show ────────────
  useEffect(() => {
    // Those who asked for this load; a reload() called later waits for the load it starts.
    const waiters = reloadWaitersRef.current;
    reloadWaitersRef.current = [];
    const fetchPromise =
      debouncedQuery.trim() === ''
        ? getSortedSnippets(sortMode, sortDirection)
        : searchSnippets(debouncedQuery);

    fetchPromise
      .then((result) => {
        const safeResults = Array.isArray(result?.items) ? result.items : [];
        setSnippets(safeResults);
        setListDamaged(result?.damaged === true);
        setListQuery(debouncedQuery);
        setActiveIndex(safeResults.length > 0 ? 0 : -1);
      })
      .catch(() => void 0)
      .finally(() => waiters.forEach((resolve) => resolve()));
  }, [debouncedQuery, refreshTick, sortMode, sortDirection]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        reloadWaitersRef.current.push(resolve);
        setRefreshTick((n) => n + 1);
      }),
    [],
  );

  // ── Reset search logic ─────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQuery('');
    setSnippets([]);
    setListDamaged(false);
    setActiveIndex(-1);
    setListFocused(false);
  }, []);

  return {
    query,
    setQuery,
    snippets,
    listQuery,
    listDamaged,
    activeIndex,
    setActiveIndex,
    listFocused,
    setListFocused,
    refreshTick,
    setRefreshTick,
    reload,
    reset,
  };
}
