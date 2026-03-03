import { useCallback, useRef, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export interface WindowLifecycleHandlers {
  /** Called when window receives focus. */
  onFocus?: () => void;
  /** Called when window loses focus. */
  onBlur?: () => void;
  /** Called on Tauri window:close-request event. */
  onCloseRequested?: () => void;
}

export interface WindowLifecycle {
  /** Handler for window focus events */
  onFocus: () => void;
  /** Handler for window blur events */
  onBlur: () => void;
  /** Handler for window close request events */
  onCloseRequested: () => void;
  /** Callback to hide the window and reset state */
  hideWindow: () => void;
  /** Callback to reset state on blur */
  resetOnBlur: () => void;
}

/**
 * Manages window lifecycle events (focus, blur, close request).
 * Sets up event listeners and provides callback functions for hiding and resetting.
 */
export function useWindowLifecycle(handlers: WindowLifecycleHandlers = {}): WindowLifecycle {
  const onFocusRef = useRef(handlers.onFocus);
  const onBlurRef = useRef(handlers.onBlur);
  const onCloseRequestedRef = useRef(handlers.onCloseRequested);

  // Keep refs updated with latest handlers
  useEffect(() => {
    onFocusRef.current = handlers.onFocus;
  }, [handlers.onFocus]);

  useEffect(() => {
    onBlurRef.current = handlers.onBlur;
  }, [handlers.onBlur]);

  useEffect(() => {
    onCloseRequestedRef.current = handlers.onCloseRequested;
  }, [handlers.onCloseRequested]);

  const hideWindow = useCallback(async () => {
    try {
      await getCurrentWindow().hide();
    } catch {
      // Silently ignore errors
    }
  }, []);

  const resetOnBlur = useCallback(() => {
    onBlurRef.current?.();
  }, []);

  const onFocus = useCallback(() => {
    onFocusRef.current?.();
  }, []);

  const onBlur = useCallback(() => {
    onBlurRef.current?.();
  }, []);

  const onCloseRequested = useCallback(() => {
    onCloseRequestedRef.current?.();
  }, []);

  // Setup native window event listeners
  useEffect(() => {
    const handleFocus = (): void => onFocus();
    const handleBlur = (): void => onBlur();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onFocus, onBlur]);

  // Setup Tauri event listeners
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    // Subscribe to Tauri events
    const setupTauriEvents = async () => {
      try {
        unsubscribe = await listen('window:close-request', () => {
          onCloseRequestedRef.current?.();
        });
      } catch {
        // Ignore if event system is not available
      }
    };

    void setupTauriEvents();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return {
    onFocus,
    onBlur,
    onCloseRequested,
    hideWindow,
    resetOnBlur,
  };
}
