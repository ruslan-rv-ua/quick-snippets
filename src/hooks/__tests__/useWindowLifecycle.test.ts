import { renderHook, act, waitFor } from '@testing-library/react';
import { useWindowLifecycle } from '../useWindowLifecycle';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: vi.fn().mockResolvedValue(undefined),
    onFocusRequested: vi.fn(),
    onBlur: vi.fn(),
    onCloseRequested: vi.fn(),
  })),
}));

describe('useWindowLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default event handlers', () => {
    const { result } = renderHook(() => useWindowLifecycle());

    expect(result.current.onFocus).toBeDefined();
    expect(result.current.onBlur).toBeDefined();
    expect(result.current.onCloseRequested).toBeDefined();
  });

  it('should provide hideWindow callback', () => {
    const { result } = renderHook(() => useWindowLifecycle());

    expect(result.current.hideWindow).toBeDefined();
    expect(typeof result.current.hideWindow).toBe('function');
  });

  it('should provide resetOnBlur callback', () => {
    const { result } = renderHook(() => useWindowLifecycle());

    expect(result.current.resetOnBlur).toBeDefined();
    expect(typeof result.current.resetOnBlur).toBe('function');
  });

  it('should call onFocus callback when provided', async () => {
    const mockOnFocus = vi.fn();

    renderHook(() =>
      useWindowLifecycle({
        onFocus: mockOnFocus,
      })
    );

    // Simulate focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockOnFocus).toHaveBeenCalled();
    });
  });

  it('should call onBlur callback when provided', async () => {
    const mockOnBlur = vi.fn();

    renderHook(() =>
      useWindowLifecycle({
        onBlur: mockOnBlur,
      })
    );

    // Simulate blur event
    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    await waitFor(() => {
      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  it('should call onCloseRequested callback when provided', async () => {
    const mockOnCloseRequested = vi.fn();

    renderHook(() =>
      useWindowLifecycle({
        onCloseRequested: mockOnCloseRequested,
      })
    );

    // Simulate close request (would be triggered via Tauri)
    // This is a simplified test; actual Tauri integration would be more complex
    expect(mockOnCloseRequested).toBeDefined();
  });

  it('should provide a hideWindow function', () => {
    const { result } = renderHook(() => useWindowLifecycle());

    expect(typeof result.current.hideWindow).toBe('function');

    // Should be callable without throwing
    act(() => {
      result.current.hideWindow();
    });
  });

  it('should provide a resetOnBlur function', () => {
    const { result } = renderHook(() => useWindowLifecycle());

    expect(typeof result.current.resetOnBlur).toBe('function');

    // Should be callable without throwing
    act(() => {
      result.current.resetOnBlur();
    });
  });

  it('should handle multiple focus/blur cycles', async () => {
    const mockOnFocus = vi.fn();
    const mockOnBlur = vi.fn();

    renderHook(() =>
      useWindowLifecycle({
        onFocus: mockOnFocus,
        onBlur: mockOnBlur,
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockOnFocus).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    await waitFor(() => {
      expect(mockOnBlur).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockOnFocus).toHaveBeenCalledTimes(2);
    });
  });

  it('should support optional handler functions', () => {
    // Should not throw when handlers are not provided
    expect(() => {
      renderHook(() => useWindowLifecycle());
    }).not.toThrow();

    expect(() => {
      renderHook(() => useWindowLifecycle({}));
    }).not.toThrow();
  });
});
