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
  /**
   * True while screen readers should be on the selected snippet: only then does the search box
   * point at it with aria-activedescendant. While it is false they stay in the search box and
   * read caret movement and erasing as in any text field; the snippet stays selected.
   */
  listFocused: boolean;
  onListFocusChange: (listFocused: boolean) => void;
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
    listFocused,
    onListFocusChange,
  },
  ref,
) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // With aria-activedescendant set, Chromium reports the snippet as the focused object, and
  // NVDA then treats the keys that move the caret as keys for the snippet and says nothing.
  const activeSnippetId =
    listFocused && activeIndex >= 0 && snippets[activeIndex]
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
    onListFocus: onListFocusChange,
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
        aria-controls="snippet-list"
        aria-expanded={snippets.length > 0}
        // No aria-label: the name comes from the placeholder. With a separate label Chromium also
        // exposes the placeholder, and NVDA says it a second time while the field is empty.
        // No aria-autocomplete: the list holds results, not completions of the typed text, and
        // NVDA would add "has autocomplete" every time it comes back to the search box.
        // aria-haspopup="false": the snippet list is always on screen, it is not a popup. A combo
        // box otherwise defaults to "listbox", which NVDA reads as "opens list" (aria-controls
        // still ties the search box to the list).
        aria-haspopup="false"
        aria-activedescendant={activeSnippetId}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          // Typing, paste and erasing keep the screen reader in the search box.
          onListFocusChange(false);
          onChange(e.target.value);
        }}
        onBlur={(e) => {
          // Focus moves to a dialog: when it comes back, the screen reader goes to the selected
          // snippet, as before the dialog. Set only once focus has left, so the search box does
          // not point at the snippet while it still has focus. (No related target: the window
          // itself lost focus.)
          if (e.relatedTarget) onListFocusChange(true);
        }}
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
