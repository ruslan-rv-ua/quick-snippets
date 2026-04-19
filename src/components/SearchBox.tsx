import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useSearchBoxKeyboard } from '../hooks/useSearchBoxKeyboard';
import type { SearchResult } from '../types';

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  snippets: SearchResult[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onActivate: (snippet: SearchResult) => void;
  onAutotype?: (snippet: SearchResult) => void;
  sortLabel?: string;
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
    onAutotype,
    sortLabel,
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

  const { handleKeyDown } = useSearchBoxKeyboard({
    activeIndex,
    snippets,
    value,
    onNavigate: onActiveIndexChange,
    onSelect: onActivate,
    onAutotype,
    onEscape: () => {}, // not used in current logic, but kept for interface completeness
    onSetValue: onChange,
  });

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
        role="combobox"
        aria-haspopup="listbox"
        aria-controls="snippet-list"
        aria-expanded={snippets.length > 0}
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
      {sortLabel && (
        <span
          className="sort-label"
          aria-hidden="true"
        >
          {sortLabel}
        </span>
      )}
    </div>
  );
});
