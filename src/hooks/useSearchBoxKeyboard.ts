import { useCallback } from 'react';
import type { SearchResult } from '../types';

interface UseSearchBoxKeyboardParams {
  activeIndex: number;
  snippets: SearchResult[];
  value: string;
  onNavigate: (index: number) => void;
  onSelect: (snippet: SearchResult) => void;
  onEscape: () => void;
  onSetValue: (value: string) => void;
}

export const useSearchBoxKeyboard = ({
  activeIndex,
  snippets,
  value,
  onNavigate,
  onSelect,
  onEscape,
  onSetValue,
}: UseSearchBoxKeyboardParams) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (snippets.length === 0) return;
          if (activeIndex < 0) {
            onNavigate(0);
          } else {
            onNavigate(Math.min(activeIndex + 1, snippets.length - 1));
          }
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
          break;
        }
        case 'Home': {
          e.preventDefault();
          if (snippets.length === 0) return;
          onNavigate(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          if (snippets.length === 0) return;
          onNavigate(snippets.length - 1);
          break;
        }
        case 'Enter': {
          if (activeIndex >= 0 && snippets[activeIndex]) {
            e.preventDefault();
            onSelect(snippets[activeIndex]);
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
    [activeIndex, snippets, value, onNavigate, onSelect, onEscape, onSetValue],
  );

  return { handleKeyDown };
};
