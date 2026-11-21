import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchLogic } from '../useSearchLogic';
import * as useIpc from '../useIpc';
import type { SearchResult, SnippetListResult } from '../../types';

/** A list as the backend returns it. */
function listOf(items: SearchResult[], damaged = false): SnippetListResult {
  return { items, damaged };
}

vi.mock('../useIpc', () => ({
  searchSnippets: vi.fn(),
  getSortedSnippets: vi.fn(),
}));

describe('useSearchLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks that return empty array
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf([]));
    vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([]));
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useSearchLogic());

    expect(result.current.query).toBe('');
    expect(result.current.snippets).toEqual([]);
    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.listFocused).toBe(false);
    expect(result.current.refreshTick).toBe(0);
  });

  it('reset brings the screen reader back to the search box', () => {
    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setListFocused(true);
    });
    expect(result.current.listFocused).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.listFocused).toBe(false);
  });

  it('updates query on setQuery', () => {
    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.query).toBe('test');
  });

  it('updates activeIndex on setActiveIndex', () => {
    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setActiveIndex(5);
    });

    expect(result.current.activeIndex).toBe(5);
  });

  it('calls searchSnippets when debounced query changes', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('test');
      });

      // Advance timers by debounce delay (100ms)
      await act(async () => {
        vi.advanceTimersByTime(100);
        // Let microtasks (promise callbacks) run
        await vi.runAllTimersAsync();
      });

      expect(useIpc.searchSnippets).toHaveBeenCalledWith('test');
      expect(result.current.snippets).toEqual(mockResults);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets activeIndex to 0 when results are found', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(result.current.activeIndex).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets activeIndex to -1 when no results found', async () => {
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf([]));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(result.current.activeIndex).toBe(-1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets state when reset is called', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('test');
        result.current.setActiveIndex(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(result.current.snippets).toEqual(mockResults);

      act(() => {
        result.current.reset();
      });

      expect(result.current.query).toBe('');
      expect(result.current.snippets).toEqual([]);
      expect(result.current.activeIndex).toBe(-1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('increments refreshTick on setRefreshTick', () => {
    const { result } = renderHook(() => useSearchLogic());

    expect(result.current.refreshTick).toBe(0);

    act(() => {
      result.current.setRefreshTick((prev) => prev + 1);
    });

    expect(result.current.refreshTick).toBe(1);
  });

  it('refetches when refreshTick changes', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(useIpc.searchSnippets).toHaveBeenCalledWith('test');

      vi.clearAllMocks();
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));
      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([]));

      act(() => {
        result.current.setRefreshTick((prev) => prev + 1);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(useIpc.searchSnippets).toHaveBeenCalledWith('test');
    } finally {
      vi.useRealTimers();
    }
  });

  describe('reload', () => {
    const greeting = { id: 1, title: 'Greeting', is_encrypted: false, score: 0, matched_positions: [] };
    const goodbye = { id: 2, title: 'Goodbye', is_encrypted: false, score: 0, matched_positions: [] };

    it('loads the list again and resolves once the new list is in state, first snippet selected', async () => {
      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([greeting, goodbye]));
      const { result } = renderHook(() => useSearchLogic());
      await act(async () => {});
      act(() => result.current.setActiveIndex(1));
      expect(result.current.snippets).toEqual([greeting, goodbye]);

      // The selected snippet was deleted.
      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([greeting]));
      let done = false;
      let reloaded: Promise<void> = Promise.resolve();
      act(() => {
        reloaded = result.current.reload().then(() => { done = true; });
      });
      expect(done).toBe(false);
      await act(async () => reloaded);

      expect(done).toBe(true);
      expect(result.current.snippets).toEqual([greeting]);
      expect(result.current.activeIndex).toBe(0);
    });

    it('loads the results for the query shown', async () => {
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf([goodbye]));
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useSearchLogic());
        act(() => result.current.setQuery('good'));
        await act(async () => {
          await vi.runAllTimersAsync();
        });
        vi.mocked(useIpc.searchSnippets).mockClear();

        let reloaded: Promise<void> = Promise.resolve();
        act(() => {
          reloaded = result.current.reload();
        });
        await act(async () => reloaded);
        expect(useIpc.searchSnippets).toHaveBeenCalledTimes(1);
        expect(useIpc.searchSnippets).toHaveBeenCalledWith('good');
      } finally {
        vi.useRealTimers();
      }
    });

    // A list loaded again before the search runs is not its results (see SnippetList).
    it('remembers the query each list was loaded for', async () => {
      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([greeting, goodbye]));
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf([greeting]));
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useSearchLogic());
        await act(async () => {
          await vi.runAllTimersAsync();
        });
        expect(result.current.listQuery).toBe('');

        act(() => result.current.setQuery('gre'));
        let reloaded: Promise<void> = Promise.resolve();
        act(() => {
          reloaded = result.current.reload();
        });
        await act(async () => reloaded);
        expect(useIpc.searchSnippets).not.toHaveBeenCalled();
        expect(result.current.listQuery).toBe('');

        await act(async () => {
          await vi.runAllTimersAsync();
        });
        expect(useIpc.searchSnippets).toHaveBeenCalledWith('gre');
        expect(result.current.snippets).toEqual([greeting]);
        expect(result.current.listQuery).toBe('gre');
      } finally {
        vi.useRealTimers();
      }
    });

    it('resolves when loading fails, so a dialog still closes', async () => {
      const { result } = renderHook(() => useSearchLogic());
      await act(async () => {});
      vi.mocked(useIpc.getSortedSnippets).mockRejectedValue(new Error('IPC failed'));

      let reloaded: Promise<void> = Promise.resolve();
      act(() => {
        reloaded = result.current.reload();
      });
      await act(async () => reloaded);
      expect(useIpc.getSortedSnippets).toHaveBeenCalledTimes(2);
    });
  });

  it('handles searchSnippets errors gracefully', async () => {
    vi.mocked(useIpc.searchSnippets).mockRejectedValue(new Error('Search failed'));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      // searchSnippets should have been called, but state remains unchanged on error
      expect(useIpc.searchSnippets).toHaveBeenCalled();
      expect(result.current.query).toBe('test');
      // snippets should remain empty array and activeIndex should be -1 (error case)
      expect(result.current.snippets).toEqual([]);
      expect(result.current.activeIndex).toBe(-1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls getSortedSnippets when query is empty', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 0, matched_positions: [] },
    ];
    vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useSearchLogic({ sortMode: 'alphabetical', sortDirection: 'asc' }),
      );

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(useIpc.getSortedSnippets).toHaveBeenCalledWith('alphabetical', 'asc');
      expect(result.current.snippets).toEqual(mockResults);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls searchSnippets when query is non-empty', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useSearchLogic({ sortMode: 'alphabetical', sortDirection: 'asc' }),
      );

      // Initial render fetches sorted (empty query)
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });
      vi.mocked(useIpc.getSortedSnippets).mockClear();
      vi.mocked(useIpc.searchSnippets).mockClear();
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(listOf(mockResults));

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
      });

      expect(useIpc.searchSnippets).toHaveBeenCalledWith('test');
      expect(useIpc.getSortedSnippets).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // TASK-33: the backend says when damage of the database cut the list short.
  it('keeps whether the list is damaged, and reset clears it', async () => {
    const items = [{ id: 1, title: 'Test', is_encrypted: false, score: 0, matched_positions: [] }];
    vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf(items, true));

    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useSearchLogic());
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(result.current.snippets).toEqual(items);
      expect(result.current.listDamaged).toBe(true);

      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf(items, false));
      await act(async () => {
        void result.current.reload();
        await vi.runAllTimersAsync();
      });
      expect(result.current.listDamaged).toBe(false);

      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(listOf([], true));
      await act(async () => {
        void result.current.reload();
        await vi.runAllTimersAsync();
      });
      expect(result.current.listDamaged).toBe(true);
      act(() => {
        result.current.reset();
      });
      expect(result.current.listDamaged).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
