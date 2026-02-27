import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SearchBox } from '../SearchBox';
import type { SearchResult } from '../../types';

const mockSnippets: SearchResult[] = [
  { id: 1, title: 'Alpha', score: 1, matched_positions: [], is_encrypted: false },
  { id: 2, title: 'Beta', score: 0.9, matched_positions: [], is_encrypted: false },
  { id: 3, title: 'Gamma', score: 0.8, matched_positions: [], is_encrypted: false },
];

function renderSearchBox(overrides: Partial<React.ComponentProps<typeof SearchBox>> = {}) {
  const defaults: React.ComponentProps<typeof SearchBox> = {
    value: '',
    onChange: vi.fn(),
    snippets: [],
    activeIndex: -1,
    onActiveIndexChange: vi.fn(),
    onActivate: vi.fn(),
    ...overrides,
  };
  return render(<SearchBox {...defaults} />);
}

describe('SearchBox', () => {
  it('has type="search"', () => {
    renderSearchBox();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('has aria-label for search placeholder', () => {
    renderSearchBox();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label');
  });

  it('has autocomplete="off" and spellcheck="false"', () => {
    renderSearchBox();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('sets aria-activedescendant to active snippet id', () => {
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0 });
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-activedescendant', 'snippet-1');
  });

  it('clears aria-activedescendant when activeIndex is -1', () => {
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1 });
    const input = screen.getByRole('searchbox');
    expect(input.getAttribute('aria-activedescendant') ?? '').toBe('');
  });

  it('ArrowDown calls onActiveIndexChange with index+1', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  it('ArrowUp calls onActiveIndexChange with index-1', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowUp' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('Home calls onActiveIndexChange with first index', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Home' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('End calls onActiveIndexChange with last index', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'End' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  it('ArrowDown at last item does not wrap (stays at last)', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 2, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  it('ArrowUp at first item does not wrap (stays at first)', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowUp' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('ArrowDown/Up when activeIndex=-1 selects first item', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('Enter calls onActivate with active snippet', () => {
    const onActivate = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActivate });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith(mockSnippets[1]);
  });

  it('Enter with no active snippet does nothing', () => {
    const onActivate = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1, onActivate });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('Escape on non-empty query clears query and stops propagation', () => {
    const onChange = vi.fn();
    const parentHandler = vi.fn();
    const { container } = renderSearchBox({ value: 'hello', onChange });
    container.addEventListener('keydown', parentHandler);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape', bubbles: true });
    expect(onChange).toHaveBeenCalledWith('');
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('Escape on empty query does not stop propagation', () => {
    const onChange = vi.fn();
    const parentHandler = vi.fn();
    const { container } = renderSearchBox({ value: '', onChange });
    container.addEventListener('keydown', parentHandler);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape', bubbles: true });
    expect(parentHandler).toHaveBeenCalled();
  });

  it('Tab is prevented (preventDefault called)', () => {
    renderSearchBox();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    screen.getByRole('searchbox').dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
