import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchLogic } from '../useSearchLogic';
import * as useIpc from '../useIpc';

vi.mock('../useIpc', () => ({
  searchSnippets: vi.fn(),
}));

describe('useSearchLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock that returns empty array
    vi.mocked(useIpc.searchSnippets).mockResolvedValue([]);
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

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
    });

    // Wait for debounce
    await waitFor(() => {
      expect(useIpc.searchSnippets).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.snippets).toEqual(mockResults);
    });
  });

  it('sets activeIndex to 0 when results are found', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(result.current.activeIndex).toBe(0);
    });
  });

  it('sets activeIndex to -1 when no results found', async () => {
    vi.mocked(useIpc.searchSnippets).mockResolvedValue([]);

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('nonexistent');
    });

    await waitFor(() => {
      expect(result.current.activeIndex).toBe(-1);
    });
  });

  it('resets state when reset is called', async () => {
    const mockResults = [
      { id: 1, title: 'Test', is_encrypted: false, score: 100, matched_positions: [0] },
    ];
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
      result.current.setActiveIndex(0);
    });

    await waitFor(() => {
      expect(result.current.snippets).toEqual(mockResults);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.query).toBe('');
    expect(result.current.snippets).toEqual([]);
    expect(result.current.activeIndex).toBe(-1);
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

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(useIpc.searchSnippets).toHaveBeenCalled();
    });

    vi.clearAllMocks();
    vi.mocked(useIpc.searchSnippets).mockResolvedValue(mockResults);

    act(() => {
      result.current.setRefreshTick((prev) => prev + 1);
    });

    await waitFor(() => {
      expect(useIpc.searchSnippets).toHaveBeenCalled();
    });
  });

  it('handles searchSnippets errors gracefully', async () => {
    vi.mocked(useIpc.searchSnippets).mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(useIpc.searchSnippets).toHaveBeenCalled();
    });

    // State should remain unchanged on error
    expect(result.current.query).toBe('test');
  });
});
