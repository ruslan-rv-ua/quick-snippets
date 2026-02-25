import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { SnippetItem } from './SnippetItem';
import type { SearchResult } from '../types';

export interface SnippetListProps {
  snippets: SearchResult[];
  activeIndex: number;
  query: string;
  onActiveIndexChange: (index: number) => void;
  onActivate: (snippet: SearchResult) => void;
}

export function SnippetList({
  snippets,
  activeIndex,
  query,
  onActiveIndexChange,
  onActivate,
}: SnippetListProps): React.ReactElement {
  const { t, tf } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const [liveText, setLiveText] = useState('');

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector(
      `[id="snippet-${snippets[activeIndex]?.id}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, snippets]);

  // Announce result count after 200ms delay
  useEffect(() => {
    if (!query) {
      setLiveText('');
      return;
    }
    const id = setTimeout(() => {
      if (snippets.length > 0) {
        setLiveText(tf.searchResults(snippets.length, query));
      } else {
        setLiveText(t('noResults'));
      }
    }, 200);
    return () => clearTimeout(id);
  }, [snippets, query, t, tf]);

  const isEmpty = snippets.length === 0;

  return (
    <div className="snippet-list-wrapper">
      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveText}
      </div>

      <div
        ref={listRef}
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
