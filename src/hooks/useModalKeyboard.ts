import { useEffect } from 'react';

export interface ModalKeyboardOptions {
  /** Called when the user presses Escape. */
  onEscape?: () => void;
  /** Called when the user presses Ctrl+Enter (or Cmd+Enter on macOS). */
  onCtrlEnter?: () => void;
}

/**
 * Registers keyboard shortcuts common to modal dialogs.
 *
 *  Escape        → onEscape
 *  Ctrl+Enter    → onCtrlEnter
 *
 * The listeners are attached only while `isOpen` is `true`.
 */
export function useModalKeyboard(
  isOpen: boolean,
  { onEscape, onCtrlEnter }: ModalKeyboardOptions,
): void {
  useEffect(() => {
    if (!isOpen) return;

    function handler(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onCtrlEnter?.();
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onEscape, onCtrlEnter]);
}
