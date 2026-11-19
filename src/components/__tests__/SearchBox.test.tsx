import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SearchBox } from '../SearchBox';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../i18n/translations';
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
    listFocused: true,
    onListFocusChange: vi.fn(),
    ...overrides,
  };
  return render(<SearchBox {...defaults} />);
}

describe('SearchBox', () => {
  it('has type="search"', () => {
    renderSearchBox();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  // NVDA reads every word of this name and the states each time it comes back to the search box.
  // A separate aria-label makes Chromium expose the placeholder too, and NVDA then says the name
  // twice in an empty field; aria-autocomplete adds "has autocomplete".
  it('is named by its short placeholder only, without aria-autocomplete', () => {
    render(
      <LanguageProvider>
        <SearchBox
          value=""
          onChange={vi.fn()}
          snippets={[]}
          activeIndex={-1}
          onActiveIndexChange={vi.fn()}
          onActivate={vi.fn()}
          listFocused={false}
          onListFocusChange={vi.fn()}
        />
      </LanguageProvider>,
    );
    // Chromium names the field by its placeholder; the test library's name calculation does not.
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('placeholder', 'Search');
    expect(input).not.toHaveAttribute('aria-label');
    expect(input).not.toHaveAttribute('aria-labelledby');
    expect(input).not.toHaveAttribute('aria-autocomplete');
    // The list is always on screen, not a popup; with the combo box default ("listbox") NVDA
    // adds "opens list".
    expect(input).toHaveAttribute('aria-haspopup', 'false');
  });

  it('the search box name is one short word in every language', () => {
    expect(translations.en.searchPlaceholder).toBe('Search');
    expect(translations.uk.searchPlaceholder).toBe('Пошук');
    expect(translations.de.searchPlaceholder).toBe('Suchen');
  });

  it('keeps the combo box attributes the list keys rely on', () => {
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0 });
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-controls', 'snippet-list');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('has autocomplete="off" and spellcheck="false"', () => {
    renderSearchBox();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('sets aria-activedescendant to active snippet id', () => {
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0 });
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-activedescendant', 'snippet-1');
  });

  it('clears aria-activedescendant when activeIndex is -1', () => {
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1 });
    const input = screen.getByRole('combobox');
    expect(input.getAttribute('aria-activedescendant') ?? '').toBe('');
  });

  it('ArrowDown calls onActiveIndexChange with index+1', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  it('ArrowUp calls onActiveIndexChange with index-1', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('Home calls onActiveIndexChange with first index', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Home' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('End calls onActiveIndexChange with last index', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'End' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  it('ArrowDown at last item does not wrap (stays at last)', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 2, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  it('ArrowUp at first item does not wrap (stays at first)', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 0, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowUp' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('ArrowDown/Up when activeIndex=-1 selects first item', () => {
    const onActiveIndexChange = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1, onActiveIndexChange });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
  });

  it('Enter calls onActivate with active snippet', () => {
    const onActivate = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActivate });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith(mockSnippets[1]);
  });

  it('Enter with no active snippet does nothing', () => {
    const onActivate = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1, onActivate });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('Shift+Enter calls onAutotype with active snippet', () => {
    const onAutotype = vi.fn();
    const onActivate = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: 1, onActivate, onAutotype });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', shiftKey: true });
    expect(onAutotype).toHaveBeenCalledWith(mockSnippets[1]);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('Shift+Enter with no active snippet does nothing', () => {
    const onAutotype = vi.fn();
    renderSearchBox({ snippets: mockSnippets, activeIndex: -1, onAutotype });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', shiftKey: true });
    expect(onAutotype).not.toHaveBeenCalled();
  });

  it('Escape on non-empty query clears query and stops propagation', () => {
    const onChange = vi.fn();
    const parentHandler = vi.fn();
    const { container } = renderSearchBox({ value: 'hello', onChange });
    container.addEventListener('keydown', parentHandler);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape', bubbles: true });
    expect(onChange).toHaveBeenCalledWith('');
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('Escape on empty query does not stop propagation', () => {
    const onChange = vi.fn();
    const parentHandler = vi.fn();
    const { container } = renderSearchBox({ value: '', onChange });
    container.addEventListener('keydown', parentHandler);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape', bubbles: true });
    expect(parentHandler).toHaveBeenCalled();
  });

  it('Tab is prevented (preventDefault called)', () => {
    renderSearchBox();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    screen.getByRole('combobox').dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  // Screen readers are either on the selected snippet (aria-activedescendant) or in the search
  // box. With aria-activedescendant set, NVDA treats the snippet as focused and says nothing
  // when the caret moves, so keys that work on the text bring it back to the search box.
  describe('where the screen reader is', () => {
    it('in the search box, the search box does not point at the selected snippet', () => {
      renderSearchBox({ snippets: mockSnippets, activeIndex: 1, listFocused: false });
      expect(screen.getByRole('combobox').getAttribute('aria-activedescendant') ?? '').toBe('');
    });

    it.each(['ArrowDown', 'ArrowUp', 'Home', 'End'])('%s moves it onto the selected snippet', (key) => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ snippets: mockSnippets, activeIndex: 1, listFocused: false, onListFocusChange });
      fireEvent.keyDown(screen.getByRole('combobox'), { key });
      expect(onListFocusChange).toHaveBeenCalledWith(true);
    });

    it('list keys do not move it when the list is empty', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ snippets: [], listFocused: false, onListFocusChange });
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
        fireEvent.keyDown(screen.getByRole('combobox'), { key });
      }
      expect(onListFocusChange).not.toHaveBeenCalled();
    });

    it.each([
      ['Left', { key: 'ArrowLeft' }],
      ['Right', { key: 'ArrowRight' }],
      ['Ctrl+Left', { key: 'ArrowLeft', ctrlKey: true }],
      ['Shift+Right', { key: 'ArrowRight', shiftKey: true }],
      ['Backspace', { key: 'Backspace' }],
      ['Ctrl+A in a Ukrainian layout', { key: 'ф', code: 'KeyA', ctrlKey: true }],
    ])('%s brings it back to the search box and still works on the text', (_name, init) => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ value: 'hello', snippets: mockSnippets, activeIndex: 0, onListFocusChange });
      // Not cancelled: the search box moves the caret or erases as usual.
      expect(fireEvent.keyDown(screen.getByRole('combobox'), init)).toBe(true);
      expect(onListFocusChange).toHaveBeenCalledWith(false);
    });

    it('Alt+Left leaves it where it is', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ value: 'hello', snippets: mockSnippets, activeIndex: 0, onListFocusChange });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowLeft', altKey: true });
      expect(onListFocusChange).not.toHaveBeenCalled();
    });

    it('typing, paste or erasing brings it back to the search box', () => {
      const onListFocusChange = vi.fn();
      const onChange = vi.fn();
      renderSearchBox({ value: 'hello', snippets: mockSnippets, activeIndex: 0, onChange, onListFocusChange });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hell' } });
      expect(onListFocusChange).toHaveBeenCalledWith(false);
      expect(onChange).toHaveBeenCalledWith('hell');
    });

    it('Escape that clears the query brings it back to the search box', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ value: 'hello', snippets: mockSnippets, activeIndex: 0, onListFocusChange });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
      expect(onListFocusChange).toHaveBeenCalledWith(false);
    });

    it('focus moving to another element (a dialog) sends it to the selected snippet for when focus comes back', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ snippets: mockSnippets, activeIndex: 0, listFocused: false, onListFocusChange });
      const other = document.createElement('button');
      document.body.appendChild(other);
      fireEvent.blur(screen.getByRole('combobox'), { relatedTarget: other });
      expect(onListFocusChange).toHaveBeenCalledWith(true);
      other.remove();
    });

    it('the window losing focus leaves it where it is', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ snippets: mockSnippets, activeIndex: 0, listFocused: false, onListFocusChange });
      fireEvent.blur(screen.getByRole('combobox'), { relatedTarget: null });
      expect(onListFocusChange).not.toHaveBeenCalled();
    });

    it('Escape on an empty query and Enter leave it where it is', () => {
      const onListFocusChange = vi.fn();
      renderSearchBox({ value: '', snippets: mockSnippets, activeIndex: 0, onListFocusChange });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
      expect(onListFocusChange).not.toHaveBeenCalled();
    });
  });
});
