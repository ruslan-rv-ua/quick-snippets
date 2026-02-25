import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100));
    expect(result.current).toBe('hello');
  });

  it('debounces value changes', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'ab' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('ab');
    vi.useRealTimers();
  });

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ value: 'abc' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('abc');
    vi.useRealTimers();
  });
});
