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
});
