import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

export interface WindowEventHandlers {
  /** Called on native window focus and Tauri `window:show` event. */
  onShow?: () => void;
  /** Called on native window blur. */
  onBlur?: () => void;
  /** Called once on mount (delayed 60 ms for webview activation). */
  onInitialFocus?: () => void;
  /** Called on Tauri `tray:create-snippet` event. */
  onTrayCreate?: () => void;
  /** Called on Tauri `tray:open-settings` event. */
  onTraySettings?: () => void;
  /** Called on Tauri `window:close-request` event. */
  onCloseRequest?: () => void;
}

/**
 * Sets up all window-level event listeners: native focus/blur,
 * Tauri events from tray/hotkey, and an initial focus timer.
 *
 * Uses refs internally so subscriptions are created once and always
 * invoke the latest callback — avoids costly re-subscriptions when
 * caller callbacks change due to re-renders.
 */
export function useWindowEvents(handlers: WindowEventHandlers): void {
  // Keep refs up-to-date without recreating any subscriptions.
  const showRef = useRef(handlers.onShow);
  const blurRef = useRef(handlers.onBlur);
  const initialRef = useRef(handlers.onInitialFocus);
  const trayCreateRef = useRef(handlers.onTrayCreate);
  const traySettingsRef = useRef(handlers.onTraySettings);
  const closeRequestRef = useRef(handlers.onCloseRequest);

  useEffect(() => { showRef.current = handlers.onShow; });
  useEffect(() => { blurRef.current = handlers.onBlur; });
  useEffect(() => { initialRef.current = handlers.onInitialFocus; });
  useEffect(() => { trayCreateRef.current = handlers.onTrayCreate; });
  useEffect(() => { traySettingsRef.current = handlers.onTraySettings; });
  useEffect(() => { closeRequestRef.current = handlers.onCloseRequest; });

  // Initial focus — runs once on mount
  useEffect(() => {
    const focusTimer = setTimeout(() => initialRef.current?.(), 60);
    return () => clearTimeout(focusTimer);
  }, []);

  // Native window focus / blur
  useEffect(() => {
    const handleFocus = (): void => showRef.current?.();
    const handleBlur = (): void => blurRef.current?.();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Tauri events (subscribed once, always call latest refs)
  useEffect(() => {
    const u1 = listen('tray:create-snippet', () => trayCreateRef.current?.());
    const u2 = listen('tray:open-settings', () => traySettingsRef.current?.());
    const u3 = listen('window:close-request', () => closeRequestRef.current?.());
    const u4 = listen('window:show', () => showRef.current?.());
    return () => {
      void u1.then((fn) => fn());
      void u2.then((fn) => fn());
      void u3.then((fn) => fn());
      void u4.then((fn) => fn());
    };
  }, []);
}
