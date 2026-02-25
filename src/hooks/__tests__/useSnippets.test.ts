import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnippets } from '../useSnippets';

describe('useSnippets', () => {
  it('initial state: empty query, empty snippets, activeIndex=-1', () => {
    const { result } = renderHook(() => useSnippets());
    expect(result.current.query).toBe('');
    expect(result.current.snippets).toEqual([]);
    expect(result.current.activeIndex).toBe(-1);
  });

  it('setQuery updates query', () => {
    const { result } = renderHook(() => useSnippets());
    act(() => { result.current.setQuery('hello'); });
    expect(result.current.query).toBe('hello');
  });

  it('setActiveIndex updates activeIndex', () => {
    const { result } = renderHook(() => useSnippets());
    act(() => { result.current.setActiveIndex(3); });
    expect(result.current.activeIndex).toBe(3);
  });

  it('resetState clears query, activeIndex, snippets', () => {
    const { result } = renderHook(() => useSnippets());
    act(() => {
      result.current.setQuery('test');
      result.current.setActiveIndex(2);
    });
    act(() => { result.current.resetState(); });
    expect(result.current.query).toBe('');
    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.snippets).toEqual([]);
  });
});
