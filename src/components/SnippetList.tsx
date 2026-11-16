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
  const prevQueryRef = useRef(query);
  const prevSnippetsRef = useRef(snippets);
  // Results for a changed query have not arrived yet.
  const pendingRef = useRef(false);
  // The snippet that was selected before the query changed.
  const activeIdBeforeRef = useRef<number | undefined>(undefined);
  const activeId = activeIndex >= 0 ? snippets[activeIndex]?.id : undefined;
  const lastActiveIdRef = useRef(activeId);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector(
      `[id="snippet-${snippets[activeIndex]?.id}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, snippets]);

  // Search results are announced once they arrive. The app changes the query at once and
  // the results about 100 ms later (debounce + IPC), so the announcement waits for them.
  // NVDA already reads a newly selected snippet: through aria-activedescendant on the search
  // box while it is on the list, and as the newly selected option of the list the search box
  // controls while it is in the search box. So the live region speaks only what nothing else
  // does: "no results", or the first result when the selected snippet stayed the same.
  // Sort/refresh changes are already covered by aria-activedescendant + toast.
  useEffect(() => {
    const queryChanged = query !== prevQueryRef.current;
    const snippetsChanged = snippets !== prevSnippetsRef.current;
    prevQueryRef.current = query;
    prevSnippetsRef.current = snippets;
    const activeIdBefore = lastActiveIdRef.current;
    lastActiveIdRef.current = activeId;

    if (queryChanged) {
      if (!pendingRef.current) activeIdBeforeRef.current = activeIdBefore;
      pendingRef.current = true;
      setLiveText('');
    }
    // Results in the same render as the query (tests), or in a later one (the app).
    if (!pendingRef.current || !snippetsChanged) return;
    pendingRef.current = false;

    let text = '';
    if (snippets.length === 0) {
      // An empty query with no list is the reset when the window hides, not a search.
      if (query.trim() !== '') text = t('noResults');
    } else if (activeId === activeIdBeforeRef.current) {
      text = tf.snippetLabel(snippets[0].title, snippets[0].is_encrypted);
    }
    if (!text) return;
    const id = setTimeout(() => {
      // Results that arrive while the window is hidden (the reset on blur) are not announced.
      if (document.hasFocus()) setLiveText(text);
    }, 200);
    return () => clearTimeout(id);
  }, [snippets, query, activeId, t, tf]);

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
