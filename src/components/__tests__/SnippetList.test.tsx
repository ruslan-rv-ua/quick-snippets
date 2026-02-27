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
    renderList({ snippets: mockSnippets, query: 'a' });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
    act(() => { vi.advanceTimersByTime(200); });
    const liveText = document.querySelector('[aria-live="polite"]')?.textContent || '';
    expect(liveText).not.toBe('');
    expect(liveText).toContain('Alpha');
    vi.useRealTimers();
  });
});
