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
 * All letter/symbol shortcuts use `event.code` (physical key position) rather than
 * `event.key` so they work regardless of the active OS keyboard layout (e.g. Ukrainian).
 * Special keys (Insert, Delete, Home, End, Space, Enter, Escape) use `event.key`
 * because they are layout-independent already.
 *
 *  Ctrl+N / Insert     → openCreate
 *  Ctrl+E              → openEdit   (only if activeIndex >= 0)
 *  Delete / Ctrl+D     → openDelete (only if activeIndex >= 0)
 *  Ctrl+,              → openSettings
 *  Ctrl+Shift+T        → toggleTheme
 *  Ctrl+F / /          → focusSearch
 *  Ctrl+Shift+Space    → announce (screen reader)
 */
export function useKeyboard(handlers: KeyboardHandlers): void {
  const { toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip all shortcuts when disabled (e.g. a modal is open)
      if (handlers.disabled) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;   // layout-dependent; used only for special keys
      const code = e.code; // layout-independent physical key; used for letters/symbols

      // Ctrl+Shift+T → toggle theme
      if (ctrl && shift && code === 'KeyT') {
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
      if (ctrl && !shift && code === 'KeyN') {
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
      if (ctrl && !shift && code === 'KeyE') {
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

      // Ctrl+D → delete
      if (ctrl && !shift && code === 'KeyD') {
        if (handlers.activeIndex >= 0) {
          e.preventDefault();
          handlers.onOpenDelete();
        }
        return;
      }

      // Ctrl+, → settings
      if (ctrl && !shift && code === 'Comma') {
        e.preventDefault();
        handlers.onOpenSettings();
        return;
      }

      // Ctrl+F → focus search
      if (ctrl && !shift && code === 'KeyF') {
        e.preventDefault();
        handlers.onFocusSearch();
        return;
      }

      // / → focus search (only when not in an input)
      if (code === 'Slash' && !ctrl && !shift) {
        const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          handlers.onFocusSearch();
        }
        return;
      }

      // Home / End → jump to first / last snippet (only when not in an input)
      if (!ctrl && !shift && (key === 'Home' || key === 'End')) {
        const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase();
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
