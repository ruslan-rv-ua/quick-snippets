import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchLogic } from '../useSearchLogic';
import * as useIpc from '../useIpc';

vi.mock('../useIpc', () => ({
  searchSnippets: vi.fn(),
  getSortedSnippets: vi.fn(),
}));

describe('useSearchLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks that return empty array
    vi.mocked(useIpc.searchSnippets).mockResolvedValue([]);
    vi.mocked(useIpc.getSortedSnippets).mockResolvedValue([]);
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useSearchLogic());

    expect(result.current.query).toBe('');
    expect(result.current.snippets).toEqual([]);
    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.refreshTick).toBe(0);
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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue([]);

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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);
      vi.mocked(useIpc.getSortedSnippets).mockResolvedValue([]);

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
    vi.mocked(useIpc.getSortedSnippets).mockResolvedValue(mockResults);

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
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
      vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

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
});
