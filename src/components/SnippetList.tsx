import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { SnippetItem } from './SnippetItem';
import type { SearchResult } from '../types';

export interface SnippetListProps {
  snippets: SearchResult[];
  activeIndex: number;
  /** The text in the search box. */
  query: string;
  /** The query `snippets` was loaded for (see useSearchLogic). */
  listQuery: string;
  /** Damage of the snippet database cut `snippets` short (see useSearchLogic). */
  damaged?: boolean;
  /**
   * Counts the times the window was shown. The notice about a damaged database is read once
   * after each show: a list loaded while the window is hidden is not read, and lists loaded
   * again while it stays open (every search) do not repeat it.
   */
  shownCount?: number;
  onActiveIndexChange: (index: number) => void;
  onActivate: (snippet: SearchResult) => void;
}

export function SnippetList({
  snippets,
  activeIndex,
  query,
  listQuery,
  damaged = false,
  shownCount = 0,
  onActiveIndexChange,
  onActivate,
}: SnippetListProps): React.ReactElement {
  const { t, tf } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const [liveText, setLiveText] = useState('');
  // The notice about a damaged database, as read by screen readers (a live region of its own).
  const [damageLiveText, setDamageLiveText] = useState('');
  const damageAnnouncedRef = useRef(false);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevQueryRef = useRef(query);
  const prevSnippetsRef = useRef(snippets);
  // Results for a changed query have not arrived yet.
  const pendingRef = useRef(false);
  // Another snippet was selected since the query changed: NVDA has read it.
  const selectionChangedRef = useRef(false);
  const activeId = activeIndex >= 0 ? snippets[activeIndex]?.id : undefined;
  const lastActiveIdRef = useRef(activeId);
  // The announcement waiting for its 200 ms.
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.querySelector(
      `[id="snippet-${snippets[activeIndex]?.id}"]`,
    ) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, snippets]);

  // Search results are announced once they arrive. The app changes the query at once and
  // the results about 100 ms later (debounce + IPC), so the announcement waits for them: for
  // the list loaded for this query. The app also loads the list again each time the window is
  // shown or gets the keyboard back; such a list may arrive in between and is not the results,
  // and one that arrives after them does not cancel the announcement.
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
      pendingRef.current = true;
      selectionChangedRef.current = false;
      clearTimeout(announceTimerRef.current);
      setLiveText('');
    }
    if (activeId !== activeIdBefore) {
      selectionChangedRef.current = true;
      clearTimeout(announceTimerRef.current);
    }
    // Results in the same render as the query (tests), or in a later one (the app).
    if (!pendingRef.current || !snippetsChanged || listQuery !== query) return;
    pendingRef.current = false;

    let text = '';
    if (snippets.length === 0) {
      // An empty query with no list is the reset when the window hides, not a search. With a
      // damaged database the snippet looked for may be among those that could not be read.
      if (query.trim() !== '') text = damaged ? t('listDamaged') : t('noResults');
    } else if (!selectionChangedRef.current) {
      text = tf.snippetLabel(snippets[0].title, snippets[0].is_encrypted);
    }
    if (!text) return;
    announceTimerRef.current = setTimeout(() => {
      // Results that arrive while the window is hidden (the reset on blur) are not announced.
      if (document.hasFocus()) setLiveText(text);
    }, 200);
  }, [snippets, query, listQuery, activeId, damaged, t, tf]);

  // The window was shown again: its next damaged list is read again.
  useEffect(() => {
    damageAnnouncedRef.current = false;
    clearTimeout(damageTimerRef.current);
    setDamageLiveText('');
  }, [shownCount]);

  // A damaged list is read once after each show, when it arrives with the window on screen.
  // A complete list ends the notice, so that damage met later is read again.
  useEffect(() => {
    if (!damaged) {
      damageAnnouncedRef.current = false;
      clearTimeout(damageTimerRef.current);
      setDamageLiveText('');
      return;
    }
    if (damageAnnouncedRef.current) return;
    clearTimeout(damageTimerRef.current);
    damageTimerRef.current = setTimeout(() => {
      if (damageAnnouncedRef.current || !document.hasFocus()) return;
      damageAnnouncedRef.current = true;
      setDamageLiveText(t('listDamaged'));
    }, 200);
  }, [snippets, damaged, shownCount, t]);

  useEffect(
    () => () => {
      clearTimeout(announceTimerRef.current);
      clearTimeout(damageTimerRef.current);
    },
    [],
  );

  const isEmpty = snippets.length === 0;

  return (
    <div className="snippet-list-wrapper">
      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveText}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="damage-live">
        {damageLiveText}
      </div>

      {damaged && (
        <p id="list-damaged" className="list-notice">
          {t('listDamaged')}
        </p>
      )}

      <div
        ref={listRef}
        id="snippet-list"
        role="listbox"
        className="snippet-list"
      >
        {isEmpty && !damaged && query === '' && (
          <div className="empty-state">{t('noSnippets')}</div>
        )}
        {isEmpty && !damaged && query !== '' && (
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
