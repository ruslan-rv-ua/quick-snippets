import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { SnippetItem } from './SnippetItem';
import type { SearchResult } from '../types';

/** A new list that would repeat the last announcement for the same query within this time stays silent. */
const REPEAT_MS = 1500;

export interface SnippetListProps {
  snippets: SearchResult[];
  activeIndex: number;
  query: string;
  /**
   * True while screen readers are on the selected snippet (the search box points at it with
   * aria-activedescendant), false while they are in the search box.
   */
  listFocused: boolean;
  onActiveIndexChange: (index: number) => void;
  onActivate: (snippet: SearchResult) => void;
}

export function SnippetList({
  snippets,
  activeIndex,
  query,
  listFocused,
  onActiveIndexChange,
  onActivate,
}: SnippetListProps): React.ReactElement {
  const { t, tf } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const [liveText, setLiveText] = useState('');
  const prevSnippetsRef = useRef(snippets);
  // What the live region said last, for which query, and when.
  const lastAnnouncedRef = useRef<{ text: string; query: string; at: number } | null>(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector(
      `[id="snippet-${snippets[activeIndex]?.id}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, snippets]);

  // While the screen reader is in the search box, nothing points it at the snippets, so each
  // new result list is announced here once it arrives: the first result, or "no results" for
  // a query that found nothing. The app changes the query at once and the results about
  // 100 ms later (debounce + IPC); the list also arrives anew each time the window is shown.
  // While the screen reader is on a snippet, it reads the selected one through
  // aria-activedescendant on the search box, so the list stays silent here.
  useEffect(() => {
    if (snippets === prevSnippetsRef.current) return;
    prevSnippetsRef.current = snippets;
    if (listFocused) return;

    let text = '';
    if (snippets.length > 0) {
      text = tf.snippetLabel(snippets[0].title, snippets[0].is_encrypted);
    } else if (query.trim() !== '') {
      text = t('noResults');
    }
    // The same list delivered again for the same query is not announced twice: the window is
    // shown by two events (window focus and the show event), and each one reloads the list.
    const last = lastAnnouncedRef.current;
    if (text && last && last.text === text && last.query === query && Date.now() - last.at < REPEAT_MS) return;

    setLiveText('');
    // An empty query with no list is the reset when the window hides, not a search.
    if (!text) return;
    const id = setTimeout(() => {
      // Results that arrive while the window is hidden (the reset on blur) are not announced.
      if (!document.hasFocus()) return;
      lastAnnouncedRef.current = { text, query, at: Date.now() };
      setLiveText(text);
    }, 200);
    return () => clearTimeout(id);
  }, [snippets, query, listFocused, t, tf]);

  const isEmpty = snippets.length === 0;

  return (
    <div className="snippet-list-wrapper">
      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveText}
      </div>

      <div
        ref={listRef}
        id="snippet-list"
        role="listbox"
        className="snippet-list"
      >
        {isEmpty && query === '' && (
          <div className="empty-state">{t('noSnippets')}</div>
        )}
        {isEmpty && query !== '' && (
          <div className="empty-state">{t('noResults')}</div>
        )}
        {snippets.map((s, idx) => (
          <SnippetItem
            key={s.id}
            snippet={s}
            isActive={idx === activeIndex}
            onClick={() => {
              onActiveIndexChange(idx);
              onActivate(s);
            }}
          />
        ))}
      </div>
    </div>
  );
}
