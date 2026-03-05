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
 * Represents a single keyboard shortcut with optional modifiers.
 */
interface Shortcut {
  ctrl?: boolean;
  shift?: boolean;
  key?: string;
  code?: string;
  requiresSelection?: boolean;
  needsInputCheck?: boolean;
  handler: () => void;
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

      // Shortcuts matrix: each shortcut has optional modifiers and a handler
      const shortcuts: Shortcut[] = [
        // Ctrl+Shift+T → toggle theme
        {
          ctrl: true,
          shift: true,
          code: 'KeyT',
          handler: () => toggleTheme(),
        },

        // Ctrl+Shift+Space → announce (screen reader)
        {
          ctrl: true,
          shift: true,
          key: ' ',
          handler: () => handlers.onAnnounce(),
        },

        // Ctrl+N → create (no Shift)
        {
          ctrl: true,
          shift: false,
          code: 'KeyN',
          handler: () => handlers.onOpenCreate(),
        },

        // Insert → create (no Ctrl, no Shift)
        {
          ctrl: false,
          shift: false,
          key: 'Insert',
          handler: () => handlers.onOpenCreate(),
        },

        // Ctrl+E → edit (only if item selected, no Shift)
        {
          ctrl: true,
          shift: false,
          code: 'KeyE',
          requiresSelection: true,
          handler: () => handlers.onOpenEdit(),
        },

        // Delete → delete (only if item selected, no Ctrl, no Shift)
        {
          ctrl: false,
          shift: false,
          key: 'Delete',
          requiresSelection: true,
          handler: () => handlers.onOpenDelete(),
        },

        // Ctrl+D → delete (only if item selected, no Shift)
        {
          ctrl: true,
          shift: false,
          code: 'KeyD',
          requiresSelection: true,
          handler: () => handlers.onOpenDelete(),
        },

        // Ctrl+, (Comma) → open settings (no Shift)
        {
          ctrl: true,
          shift: false,
          code: 'Comma',
          handler: () => handlers.onOpenSettings(),
        },

        // Ctrl+F → focus search (no Shift)
        {
          ctrl: true,
          shift: false,
          code: 'KeyF',
          handler: () => handlers.onFocusSearch(),
        },

        // / (Slash) → focus search (only when not in input/textarea, no Ctrl, no Shift)
        {
          ctrl: false,
          shift: false,
          code: 'Slash',
          needsInputCheck: true,
          handler: () => handlers.onFocusSearch(),
        },

        // Home → select first item (only when not in input/textarea, no Ctrl, no Shift)
        {
          ctrl: false,
          shift: false,
          key: 'Home',
          needsInputCheck: true,
          handler: () => handlers.onSelectFirst?.(),
        },

        // End → select last item (only when not in input/textarea, no Ctrl, no Shift)
        {
          ctrl: false,
          shift: false,
          key: 'End',
          needsInputCheck: true,
          handler: () => handlers.onSelectLast?.(),
        },
      ];

      // Try to match and execute the first matching shortcut
      for (const shortcut of shortcuts) {
        // Check if modifiers match
        const ctrlMatches = shortcut.ctrl === undefined || shortcut.ctrl === ctrl;
        const shiftMatches = shortcut.shift === undefined || shortcut.shift === shift;
        const keyMatches = shortcut.key === undefined || shortcut.key === key;
        const codeMatches = shortcut.code === undefined || shortcut.code === code;

        if (ctrlMatches && shiftMatches && keyMatches && codeMatches) {
          // Check if selection is required
          if (shortcut.requiresSelection && handlers.activeIndex < 0) {
            continue;
          }

          // Check if we need to avoid input/textarea
          if (shortcut.needsInputCheck) {
            const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') {
              continue;
            }
          }

          // All conditions met, execute the handler
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, toggleTheme]);
}
