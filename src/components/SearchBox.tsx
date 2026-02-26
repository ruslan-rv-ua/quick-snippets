import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import type { SearchResult } from '../types';

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  snippets: SearchResult[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onActivate: (snippet: SearchResult) => void;
}

export interface SearchBoxHandle {
  focus: () => void;
}

export const SearchBox = forwardRef<SearchBoxHandle, SearchBoxProps>(function SearchBox(
  {
    value,
    onChange,
    snippets,
    activeIndex,
    onActiveIndexChange,
    onActivate,
  },
  ref,
) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const activeSnippetId =
    activeIndex >= 0 && snippets[activeIndex]
      ? `snippet-${snippets[activeIndex].id}`
      : '';

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (snippets.length === 0) return;
          if (activeIndex < 0) {
            onActiveIndexChange(0);
          } else {
            onActiveIndexChange(Math.min(activeIndex + 1, snippets.length - 1));
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (snippets.length === 0) return;
          if (activeIndex < 0) {
            onActiveIndexChange(0);
          } else {
            onActiveIndexChange(Math.max(activeIndex - 1, 0));
          }
          break;
        }
        case 'Enter': {
          if (activeIndex >= 0 && snippets[activeIndex]) {
            e.preventDefault();
            onActivate(snippets[activeIndex]);
          }
          break;
        }
        case 'Escape': {
          if (value !== '') {
            // Use stopImmediatePropagation so the native DOM listener on the
            // React-root container fires before any sibling listeners (e.g.
            // test helpers attached after render).
            e.nativeEvent.stopImmediatePropagation();
            onChange('');
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
    [activeIndex, snippets, value, onChange, onActiveIndexChange, onActivate],
  );

  return (
    <div className="search-box">
      {/* Magnifying-glass icon — decorative, hidden from assistive tech */}
      <svg
        className="search-icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        role="searchbox"
        aria-label={t('searchPlaceholder')}
        aria-autocomplete="list"
        aria-activedescendant={activeSnippetId}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('searchPlaceholder')}
      />
    </div>
  );
});
