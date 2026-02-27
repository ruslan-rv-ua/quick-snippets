import { useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export interface KeyboardHandlers {
  activeIndex: number;
  /** When true, all keyboard shortcuts are suppressed (e.g. a modal is open). */
  disabled?: boolean;
  onOpenCreate: () => void;
  onOpenEdit: () => void;
  onOpenDelete: () => void;
  onOpenSettings: () => void;
  onFocusSearch: () => void;
  onAnnounce: () => void;
  onSelectFirst?: () => void;
  onSelectLast?: () => void;
}

/**
 * Registers global keyboard shortcuts for the main window.
 *
 *  Ctrl+N / Insert  → openCreate
 *  Ctrl+E           → openEdit   (only if activeIndex >= 0)
 *  Delete           → openDelete (only if activeIndex >= 0)
 *  Ctrl+,           → openSettings
 *  Ctrl+Shift+T     → toggleTheme
 *  Ctrl+F / /       → focusSearch
 *  Ctrl+Shift+Space → announce (screen reader)
 */
export function useKeyboard(handlers: KeyboardHandlers): void {
  const { toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip all shortcuts when disabled (e.g. a modal is open)
      if (handlers.disabled) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Ctrl+Shift+T → toggle theme
      if (ctrl && shift && key === 'T') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Ctrl+Shift+Space → announce
      if (ctrl && shift && key === ' ') {
        e.preventDefault();
        handlers.onAnnounce();
        return;
      }

      // Ctrl+N → create
      if (ctrl && !shift && key === 'n') {
        e.preventDefault();
        handlers.onOpenCreate();
        return;
      }

      // Insert → create
      if (!ctrl && !shift && key === 'Insert') {
        e.preventDefault();
        handlers.onOpenCreate();
        return;
      }

      // Ctrl+E → edit
      if (ctrl && !shift && key === 'e') {
        e.preventDefault();
        if (handlers.activeIndex >= 0) handlers.onOpenEdit();
        return;
      }

      // Delete → delete
      if (!ctrl && !shift && key === 'Delete') {
        if (handlers.activeIndex >= 0) {
          e.preventDefault();
          handlers.onOpenDelete();
        }
        return;
      }

      // Ctrl+, → settings
      if (ctrl && !shift && key === ',') {
        e.preventDefault();
        handlers.onOpenSettings();
        return;
      }

      // Ctrl+F → focus search
      if (ctrl && !shift && key === 'f') {
        e.preventDefault();
        handlers.onFocusSearch();
        return;
      }

      // / → focus search (only when not in an input)
      if (key === '/' && !ctrl && !shift) {
        const tag = (e.target as HTMLElement).tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          handlers.onFocusSearch();
        }
        return;
      }

      // Home / End → jump to first / last snippet (only when not in an input)
      if (!ctrl && !shift && (key === 'Home' || key === 'End')) {
        const tag = (e.target as HTMLElement).tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          if (key === 'Home') handlers.onSelectFirst && handlers.onSelectFirst();
          if (key === 'End') handlers.onSelectLast && handlers.onSelectLast();
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, toggleTheme]);
}
