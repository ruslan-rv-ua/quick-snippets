import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds toast with correct properties', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Hello', 'success');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removes toast after default duration (2000ms)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Default', 'info');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes toast after custom duration (5000ms for warning)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('Warn', 'warning', 5000);
    });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports success/warning/error/info types', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('S', 'success');
      result.current.addToast('W', 'warning');
      result.current.addToast('E', 'error');
      result.current.addToast('I', 'info');
    });
    const types = result.current.toasts.map((t) => t.type);
    expect(types).toContain('success');
    expect(types).toContain('warning');
    expect(types).toContain('error');
    expect(types).toContain('info');
  });

  it('multiple toasts stack correctly', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('First', 'info');
      result.current.addToast('Second', 'success');
    });
    expect(result.current.toasts).toHaveLength(2);
  });
});
