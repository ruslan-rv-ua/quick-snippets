import { useCallback } from 'react';
import type { SearchResult } from '../types';

interface UseSearchBoxKeyboardParams {
  activeIndex: number;
  snippets: SearchResult[];
  value: string;
  onNavigate: (index: number) => void;
  onSelect: (snippet: SearchResult) => void;
  onAutotype?: (snippet: SearchResult) => void;
  onEscape: () => void;
  onSetValue: (value: string) => void;
  /**
   * Moves screen readers onto the selected snippet (true) or back into the search box (false):
   * the list keys move them into the list, keys that move the caret or edit the text bring them
   * back, so the screen reader reads the text as in any text field. Text changes (typing, paste,
   * Delete) are reported by the search box's change handler.
   */
  onListFocus?: (listFocused: boolean) => void;
}

export const useSearchBoxKeyboard = ({
  activeIndex,
  snippets,
  value,
  onNavigate,
  onSelect,
  onAutotype,
  onEscape,
  onSetValue,
  onListFocus,
}: UseSearchBoxKeyboardParams) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Ctrl+A selects the whole query (by physical key, so it works in any keyboard layout).
      if (e.ctrlKey && !e.altKey && e.code === 'KeyA') onListFocus?.(false);
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (snippets.length === 0) return;
          if (activeIndex < 0) {
            onNavigate(0);
          } else {
            onNavigate(Math.min(activeIndex + 1, snippets.length - 1));
          }
          onListFocus?.(true);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (snippets.length === 0) return;
          if (activeIndex < 0) {
            onNavigate(0);
          } else {
            onNavigate(Math.max(activeIndex - 1, 0));
          }
          onListFocus?.(true);
          break;
        }
        case 'Home': {
          e.preventDefault();
          if (snippets.length === 0) return;
          onNavigate(0);
          onListFocus?.(true);
          break;
        }
        case 'End': {
          e.preventDefault();
          if (snippets.length === 0) return;
          onNavigate(snippets.length - 1);
          onListFocus?.(true);
          break;
        }
        // Caret movement and erasing: the screen reader goes back to the search box.
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!e.altKey && !e.metaKey) onListFocus?.(false);
          break;
        }
        case 'Backspace': {
          onListFocus?.(false);
          break;
        }
        case 'Enter': {
          if (activeIndex >= 0 && snippets[activeIndex]) {
            e.preventDefault();
            if (e.shiftKey && onAutotype) {
              onAutotype(snippets[activeIndex]);
            } else {
              onSelect(snippets[activeIndex]);
            }
          }
          break;
        }
        case 'Escape': {
          if (value !== '') {
            // Use stopImmediatePropagation so the native DOM listener on the
            // React-root container fires before any sibling listeners (e.g.
            // test helpers attached after render).
            e.nativeEvent.stopImmediatePropagation();
            onSetValue('');
            onListFocus?.(false);
          }
          // if empty — let it bubble to parent
          break;
        }
        case 'Tab': {
          e.preventDefault();
          break;
        }
      }
    },
    [activeIndex, snippets, value, onNavigate, onSelect, onAutotype, onEscape, onSetValue, onListFocus],
  );

  return { handleKeyDown };
};
