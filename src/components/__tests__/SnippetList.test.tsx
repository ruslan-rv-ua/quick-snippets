import { describe, it, expect, vi } from 'vitest';
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
        listQuery=""
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

  it('live region updates with result count after 200ms delay', async () => {
    vi.useFakeTimers();
    // Initial render with empty query — no announcement (aria-activedescendant covers it)
    const { rerender } = render(
      <LanguageProvider>
        <SnippetList
          snippets={[]}
          activeIndex={-1}
          query=""
          listQuery=""
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
        />
      </LanguageProvider>,
    );
    // Simulate search: query changes from "" to "a"
    rerender(
      <LanguageProvider>
        <SnippetList
          snippets={mockSnippets}
          activeIndex={-1}
          query="a"
          listQuery="a"
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
    act(() => { vi.advanceTimersByTime(200); });
    const liveText = document.querySelector('[aria-live="polite"]')?.textContent || '';
    expect(liveText).not.toBe('');
    expect(liveText).toContain('Alpha');
    vi.useRealTimers();
  });

  it('re-announces first title when snippets are replaced with same first title', () => {
    vi.useFakeTimers();
    // Start with empty query
    const { rerender } = render(
      <LanguageProvider>
        <SnippetList
          snippets={[]}
          activeIndex={-1}
          query=""
          listQuery=""
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
        />
      </LanguageProvider>,
    );

    // First search: query changes from "" to "a"
    rerender(
      <LanguageProvider>
        <SnippetList
          snippets={mockSnippets}
          activeIndex={-1}
          query="a"
          listQuery="a"
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
        />
      </LanguageProvider>,
    );

    act(() => { vi.advanceTimersByTime(200); });
    const firstAnnounce = document.querySelector('[aria-live="polite"]')?.textContent || '';
    expect(firstAnnounce).toContain('Alpha');

    // Rerender with a new array instance but same first title — live region
    // should be cleared immediately and then re-populated after delay.
    const newSnippets = [
      { id: 3, title: 'Alpha', score: 1, matched_positions: [], is_encrypted: false },
      { id: 4, title: 'Gamma', score: 0.8, matched_positions: [], is_encrypted: false },
    ];

    rerender(
      <LanguageProvider>
        <SnippetList
          snippets={newSnippets}
          activeIndex={-1}
          query="ab"
          listQuery="ab"
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
        />
      </LanguageProvider>,
    );

    // Immediately after prop change live region must be cleared
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');

    // After delay it should announce the first title again
    act(() => { vi.advanceTimersByTime(200); });
    const secondAnnounce = document.querySelector('[aria-live="polite"]')?.textContent || '';
    expect(secondAnnounce).toContain('Alpha');
    vi.useRealTimers();
  });
  // The app changes the query at once and the results about 100 ms later (debounce + IPC).
  describe('when results arrive after the query', () => {
    /** The list `snippets`, loaded for `listQuery`, while the search box holds `query`. */
    function list(snippets: SearchResult[], query: string, activeIndex: number, listQuery = query) {
      return (
        <LanguageProvider>
          <SnippetList
            snippets={snippets}
            activeIndex={activeIndex}
            query={query}
            listQuery={listQuery}
            onActiveIndexChange={vi.fn()}
            onActivate={vi.fn()}
          />
        </LanguageProvider>
      );
    }
    const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

    function search(query: string, results: SearchResult[]) {
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list(mockSnippets, query, 0, ''));
      act(() => { vi.advanceTimersByTime(120); });
      view.rerender(list(results, query, results.length > 0 ? 0 : -1));
      act(() => { vi.advanceTimersByTime(200); });
      return view;
    }

    it('announces "no results" when nothing matches', () => {
      vi.useFakeTimers();
      search('zzz', []);
      expect(liveText()).toMatch(/no results|нічого не знайдено/i);
      vi.useRealTimers();
    });

    // NVDA reads it through aria-activedescendant on the list, and as the newly selected
    // option of the controlled list while it is in the search box.
    it('stays silent when the selected snippet changes (NVDA reads it itself)', () => {
      vi.useFakeTimers();
      search('be', [mockSnippets[1]]);
      expect(liveText()).toBe('');
      vi.useRealTimers();
    });

    it('announces the first result when the active snippet stays the same', () => {
      vi.useFakeTimers();
      search('al', [mockSnippets[0]]);
      expect(liveText()).toContain('Alpha');
      vi.useRealTimers();
    });

    it('says nothing when the window hides and the search is reset', () => {
      vi.useFakeTimers();
      const view = search('al', [mockSnippets[0]]);
      view.rerender(list([], '', -1));
      act(() => { vi.advanceTimersByTime(400); });
      expect(liveText()).toBe('');
      vi.useRealTimers();
    });

    it('says nothing for results that arrive while the window is hidden', () => {
      vi.useFakeTimers();
      const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      search('al', [mockSnippets[0]]);
      expect(liveText()).toBe('');
      hasFocus.mockRestore();
      vi.useRealTimers();
    });

    it('says nothing when the same list arrives again for the same query (the window is shown)', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list([...mockSnippets], '', 0));
      act(() => { vi.advanceTimersByTime(400); });
      expect(liveText()).toBe('');
      vi.useRealTimers();
    });

    // The app also loads the list again each time the window is shown or gets the keyboard back.
    it('waits for the results: a list loaded again for the previous query in the meantime is not them', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list(mockSnippets, 'al', 0, ''));
      act(() => { vi.advanceTimersByTime(50); });
      view.rerender(list([...mockSnippets], 'al', 0, ''));
      act(() => { vi.advanceTimersByTime(300); });
      expect(liveText()).toBe('');
      view.rerender(list([mockSnippets[0]], 'al', 0));
      act(() => { vi.advanceTimersByTime(200); });
      expect(liveText()).toContain('Alpha');
      vi.useRealTimers();
    });

    it('still announces the first result when the results are loaded again right after they arrived', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list(mockSnippets, 'al', 0, ''));
      act(() => { vi.advanceTimersByTime(120); });
      view.rerender(list([mockSnippets[0]], 'al', 0));
      act(() => { vi.advanceTimersByTime(100); });
      view.rerender(list([{ ...mockSnippets[0] }], 'al', 0));
      act(() => { vi.advanceTimersByTime(100); });
      expect(liveText()).toContain('Alpha');
      vi.useRealTimers();
    });

    it('stays silent when another snippet was selected while the results were awaited (NVDA read it)', () => {
      vi.useFakeTimers();
      const view = render(list(mockSnippets, '', 0));
      view.rerender(list(mockSnippets, 'a', 0, ''));
      // Down: the second snippet is selected, then the results select the first one again.
      view.rerender(list(mockSnippets, 'a', 1, ''));
      act(() => { vi.advanceTimersByTime(120); });
      view.rerender(list([...mockSnippets], 'a', 0));
      act(() => { vi.advanceTimersByTime(200); });
      expect(liveText()).toBe('');
      vi.useRealTimers();
    });
  });
});
