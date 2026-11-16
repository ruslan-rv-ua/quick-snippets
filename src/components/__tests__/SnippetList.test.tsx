import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { SnippetList } from '../SnippetList';
import { LanguageProvider } from '../../contexts/LanguageContext';
import type { SearchResult } from '../../types';

const mockSnippets: SearchResult[] = [
  { id: 1, title: 'Alpha', score: 1, matched_positions: [], is_encrypted: false },
  { id: 2, title: 'Beta', score: 0.9, matched_positions: [], is_encrypted: true },
];

function renderList(overrides: Partial<React.ComponentProps<typeof SnippetList>> = {}) {
  return render(
    <LanguageProvider>
      <SnippetList
        snippets={mockSnippets}
        activeIndex={-1}
        query=""
        listFocused={false}
        onActiveIndexChange={vi.fn()}
        onActivate={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('SnippetList', () => {
  it('renders all provided snippets', () => {
    renderList();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows "no snippets" message when empty and no query', () => {
    renderList({ snippets: [], query: '' });
    expect(screen.getByText(/no snippets|немає сніпетів/i)).toBeInTheDocument();
  });

  it('shows "no results" message when empty with query', () => {
    renderList({ snippets: [], query: 'xyz' });
    expect(screen.getByText(/no results|нічого не знайдено/i)).toBeInTheDocument();
  });

  it('active item has active CSS class', () => {
    renderList({ activeIndex: 0 });
    const item = document.getElementById('snippet-1');
    expect(item).toHaveClass('active');
  });

  it('has aria-live="polite" region', () => {
    renderList();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeInTheDocument();
  });

  // While the screen reader is in the search box (listFocused false), nothing points it at the
  // snippets, so the live region announces each new result list. While it is on a snippet
  // (listFocused true), aria-activedescendant on the search box reads the selected snippet.
  describe('live region', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    function list(snippets: SearchResult[], query: string, activeIndex: number, listFocused = false) {
      return (
        <LanguageProvider>
          <SnippetList
            snippets={snippets}
            activeIndex={activeIndex}
            query={query}
            listFocused={listFocused}
            onActiveIndexChange={vi.fn()}
            onActivate={vi.fn()}
          />
        </LanguageProvider>
      );
    }
    const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

    /**
     * The app changes the query at once and delivers the results about 100 ms later
     * (debounce + IPC), always as a new array.
     */
    function search(query: string, results: SearchResult[], listFocused = false) {
      const view = render(list(mockSnippets, '', 0, listFocused));
      view.rerender(list(mockSnippets, query, 0, listFocused));
      act(() => { vi.advanceTimersByTime(120); });
      view.rerender(list([...results], query, results.length > 0 ? 0 : -1, listFocused));
      act(() => { vi.advanceTimersByTime(200); });
      return view;
    }

    it('says nothing for the list it starts with', () => {
      vi.useFakeTimers();
      renderList({ activeIndex: 0 });
      act(() => { vi.advanceTimersByTime(400); });
      expect(liveText()).toBe('');
    });

    it('announces the first result 200 ms after the results arrive', () => {
      vi.useFakeTimers();
      const view = render(list([], '', -1));
      view.rerender(list(mockSnippets, 'a', 0));
      expect(liveText()).toBe('');
      act(() => { vi.advanceTimersByTime(200); });
      expect(liveText()).toContain('Alpha');
    });

    it('announces "no results" when nothing matches', () => {
      vi.useFakeTimers();
      search('zzz', []);
      expect(liveText()).toMatch(/no results|нічого не знайдено/i);
    });

    it('announces the first result when the selected snippet changes', () => {
      vi.useFakeTimers();
      search('be', [mockSnippets[1]]);
      expect(liveText()).toContain('Beta');
    });

    it('announces the first result when the selected snippet stays the same', () => {
      vi.useFakeTimers();
      search('al', [mockSnippets[0]]);
      expect(liveText()).toContain('Alpha');
    });

    it('clears the region at once and announces the same first result again for a new list', () => {
      vi.useFakeTimers();
      const view = search('a', mockSnippets);
      expect(liveText()).toContain('Alpha');

      const newSnippets = [
        { id: 3, title: 'Alpha', score: 1, matched_positions: [], is_encrypted: false },
        { id: 4, title: 'Gamma', score: 0.8, matched_positions: [], is_encrypted: false },
      ];
      view.rerender(list(newSnippets, 'ab', 0));
      expect(liveText()).toBe('');
      act(() => { vi.advanceTimersByTime(200); });
      expect(liveText()).toContain('Alpha');
    });

    it('announces the first snippet when the list arrives anew after the window is shown', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list([...mockSnippets], '', 0));
      act(() => { vi.advanceTimersByTime(200); });
      expect(liveText()).toContain('Alpha');
    });

    it('says nothing while the screen reader is on a snippet: aria-activedescendant reads it', () => {
      vi.useFakeTimers();
      search('be', [mockSnippets[1]], true);
      expect(liveText()).toBe('');
    });

    it('says nothing when the arrow keys move the screen reader into the list before the results arrive', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list(mockSnippets, 'b', 0));
      view.rerender(list(mockSnippets, 'b', 1, true));
      view.rerender(list([mockSnippets[1]], 'b', 0, true));
      act(() => { vi.advanceTimersByTime(400); });
      expect(liveText()).toBe('');
    });

    it('says nothing when the window hides and the search is reset', () => {
      vi.useFakeTimers();
      const view = search('al', [mockSnippets[0]]);
      view.rerender(list([], '', -1));
      act(() => { vi.advanceTimersByTime(400); });
      expect(liveText()).toBe('');
    });

    it('says nothing for results that arrive while the window is hidden', () => {
      vi.useFakeTimers();
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      search('al', [mockSnippets[0]]);
      expect(liveText()).toBe('');
    });
  });
});
