import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard, KeyboardHandlers } from '../useKeyboard';
import { ThemeContext } from '../../contexts/ThemeContext';
import React from 'react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHandlers(overrides: Partial<KeyboardHandlers> = {}): KeyboardHandlers {
  return {
    activeIndex: 0,
    disabled: false,
    onOpenCreate: vi.fn(),
    onOpenEdit: vi.fn(),
    onOpenDelete: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onFocusSearch: vi.fn(),
    onAnnounce: vi.fn(),
    onSelectFirst: vi.fn(),
    onSelectLast: vi.fn(),
    ...overrides,
  };
}

const toggleTheme = vi.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    ThemeContext.Provider,
    { value: { theme: 'light', toggleTheme, setTheme: vi.fn() } },
    children,
  );
}

function fire(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useKeyboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── disabled flag ─────────────────────────────────────────────────────────
  it('ignores all shortcuts when disabled', () => {
    const h = makeHandlers({ disabled: true });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyN', ctrlKey: true });
    fire({ key: 'Insert' });
    expect(h.onOpenCreate).not.toHaveBeenCalled();
  });

  // ── Ctrl+N — layout-independent (uses code, not key) ─────────────────────
  it('Ctrl+N (English layout) opens Create', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyN', key: 'n', ctrlKey: true });
    expect(h.onOpenCreate).toHaveBeenCalledOnce();
  });

  it('Ctrl+N (Ukrainian layout: key="т") still opens Create via event.code', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    // Simulate Ukrainian layout: event.key is Cyrillic 'т', but code is still 'KeyN'
    fire({ code: 'KeyN', key: 'т', ctrlKey: true });
    expect(h.onOpenCreate).toHaveBeenCalledOnce();
  });

  // ── Insert ────────────────────────────────────────────────────────────────
  it('Insert opens Create', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'Insert', code: 'Insert' });
    expect(h.onOpenCreate).toHaveBeenCalledOnce();
  });

  it('Ctrl+Insert does NOT open Create (requires no Ctrl)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'Insert', code: 'Insert', ctrlKey: true });
    expect(h.onOpenCreate).not.toHaveBeenCalled();
  });

  // ── Ctrl+E — layout-independent ───────────────────────────────────────────
  it('Ctrl+E (English layout) opens Edit when item selected', () => {
    const h = makeHandlers({ activeIndex: 2 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyE', key: 'e', ctrlKey: true });
    expect(h.onOpenEdit).toHaveBeenCalledOnce();
  });

  it('Ctrl+E (Ukrainian layout: key="у") still opens Edit via event.code', () => {
    const h = makeHandlers({ activeIndex: 2 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyE', key: 'у', ctrlKey: true });
    expect(h.onOpenEdit).toHaveBeenCalledOnce();
  });

  it('Ctrl+E does NOT open Edit when no item selected', () => {
    const h = makeHandlers({ activeIndex: -1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyE', key: 'e', ctrlKey: true });
    expect(h.onOpenEdit).not.toHaveBeenCalled();
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  it('Delete opens Delete modal when item selected', () => {
    const h = makeHandlers({ activeIndex: 1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'Delete', code: 'Delete' });
    expect(h.onOpenDelete).toHaveBeenCalledOnce();
  });

  it('Delete does NOT open Delete modal when no item selected', () => {
    const h = makeHandlers({ activeIndex: -1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'Delete', code: 'Delete' });
    expect(h.onOpenDelete).not.toHaveBeenCalled();
  });

  // ── Ctrl+D ────────────────────────────────────────────────────────────────
  it('Ctrl+D opens Delete modal when item selected', () => {
    const h = makeHandlers({ activeIndex: 1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyD', key: 'd', ctrlKey: true });
    expect(h.onOpenDelete).toHaveBeenCalledOnce();
  });

  it('Ctrl+D (Ukrainian layout: key="в") opens Delete modal via event.code', () => {
    const h = makeHandlers({ activeIndex: 1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyD', key: 'в', ctrlKey: true });
    expect(h.onOpenDelete).toHaveBeenCalledOnce();
  });

  it('Ctrl+D does NOT open Delete modal when no item selected', () => {
    const h = makeHandlers({ activeIndex: -1 });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyD', key: 'd', ctrlKey: true });
    expect(h.onOpenDelete).not.toHaveBeenCalled();
  });

  // ── Delete in the search box: text editing comes first ───────────────────
  describe('Delete in the search box', () => {
    const DELETE = { key: 'Delete', code: 'Delete' };
    let box: HTMLInputElement;

    beforeEach(() => {
      box = document.createElement('input');
      box.type = 'search';
      document.body.appendChild(box);
    });
    afterEach(() => { box.remove(); });

    /** Puts `text` in the box, selects start..end (a caret when equal) and presses a key there. */
    function pressIn(text: string, start: number, end = start, init: KeyboardEventInit = DELETE) {
      box.value = text;
      box.setSelectionRange(start, end);
      const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      box.dispatchEvent(e);
      return e;
    }

    it('with text after the caret, Delete is left to the box to erase the next character', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      const e = pressIn('abc', 1);
      expect(h.onOpenDelete).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(false);
    });

    it('with selected text, Delete is left to the box, even when the selection reaches the end', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      expect(pressIn('abc', 0, 3).defaultPrevented).toBe(false);
      expect(pressIn('abc', 2, 3).defaultPrevented).toBe(false);
      expect(h.onOpenDelete).not.toHaveBeenCalled();
    });

    it('with the caret at the end of the text, Delete asks to delete the selected snippet', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      const e = pressIn('abc', 3);
      expect(h.onOpenDelete).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    });

    it('in an empty box, Delete asks to delete the selected snippet', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      pressIn('', 0);
      expect(h.onOpenDelete).toHaveBeenCalledOnce();
    });

    it('after Delete has erased text, more Delete presses at the end only edit text', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      pressIn('abc', 2); // erases "c"
      const again = pressIn('ab', 2);
      pressIn('ab', 2);
      expect(h.onOpenDelete).not.toHaveBeenCalled();
      expect(again.defaultPrevented).toBe(false);
    });

    it('another key ends the run: Delete at the end then asks to delete the snippet', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      pressIn('abc', 2); // erases "c"
      pressIn('ab', 2, 2, { key: 'ArrowDown', code: 'ArrowDown' });
      pressIn('ab', 2);
      expect(h.onOpenDelete).toHaveBeenCalledOnce();
    });

    it('a dialog ends the run too', () => {
      const h = makeHandlers({ activeIndex: 0 });
      const { rerender } = renderHook((props: KeyboardHandlers) => useKeyboard(props), { wrapper, initialProps: h });
      pressIn('abc', 2); // erases "c"
      rerender({ ...h, disabled: true });
      pressIn('ab', 2, 2, { key: 'Escape', code: 'Escape' });
      rerender({ ...h, disabled: false });
      pressIn('ab', 2);
      expect(h.onOpenDelete).toHaveBeenCalledOnce();
    });

    it('a held Delete (key auto-repeat) never asks to delete the snippet', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      pressIn('abc', 3, 3, { ...DELETE, repeat: true });
      expect(h.onOpenDelete).not.toHaveBeenCalled();
    });

    it('Ctrl+D asks to delete the snippet wherever the caret is', () => {
      const h = makeHandlers({ activeIndex: 0 });
      renderHook(() => useKeyboard(h), { wrapper });
      pressIn('abc', 2); // erases "c": Ctrl+D does not wait for another key
      pressIn('ab', 1, 1, { key: 'd', code: 'KeyD', ctrlKey: true });
      expect(h.onOpenDelete).toHaveBeenCalledOnce();
    });
  });

  // ── Ctrl+, (settings) — layout-independent ────────────────────────────────
  it('Ctrl+Comma opens Settings', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'Comma', key: ',', ctrlKey: true });
    expect(h.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('Ctrl+Comma (non-English: key is not ",") still opens Settings via event.code', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'Comma', key: 'б', ctrlKey: true }); // Cyrillic layout maps , to б
    expect(h.onOpenSettings).toHaveBeenCalledOnce();
  });

  // ── F1 (keyboard shortcuts help) ──────────────────────────────────────────
  it('F1 opens the keyboard shortcuts help and stops the default action', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    const e = new KeyboardEvent('keydown', { key: 'F1', code: 'F1', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(h.onOpenHelp).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('F1 works with focus in the search box', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', code: 'F1', bubbles: true }));
    input.remove();
    expect(h.onOpenHelp).toHaveBeenCalledOnce();
  });

  it('F1 does nothing while a dialog is open', () => {
    const h = makeHandlers({ disabled: true });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'F1', code: 'F1' });
    expect(h.onOpenHelp).not.toHaveBeenCalled();
  });

  it('Ctrl+F1 and Shift+F1 do not open the help', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'F1', code: 'F1', ctrlKey: true });
    fire({ key: 'F1', code: 'F1', shiftKey: true });
    expect(h.onOpenHelp).not.toHaveBeenCalled();
  });

  // ── Ctrl+F — layout-independent ───────────────────────────────────────────
  it('Ctrl+F focuses search', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyF', key: 'f', ctrlKey: true });
    expect(h.onFocusSearch).toHaveBeenCalledOnce();
  });

  it('Ctrl+F (Ukrainian layout: key="а") still focuses search via event.code', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyF', key: 'а', ctrlKey: true });
    expect(h.onFocusSearch).toHaveBeenCalledOnce();
  });

  // ── / shortcut — layout-independent ──────────────────────────────────────
  it('/ focuses search when target is not input', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'Slash', key: '/' });
    expect(h.onFocusSearch).toHaveBeenCalledOnce();
  });

  // ── Home / End ────────────────────────────────────────────────────────────
  it('Home selects first item (when not in input)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'Home', code: 'Home' });
    expect(h.onSelectFirst).toHaveBeenCalledOnce();
  });

  it('End selects last item (when not in input)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ key: 'End', code: 'End' });
    expect(h.onSelectLast).toHaveBeenCalledOnce();
  });

  // ── Ctrl+Shift+T — layout-independent ────────────────────────────────────
  it('Ctrl+Shift+T toggles theme', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyT', key: 'T', ctrlKey: true, shiftKey: true });
    expect(toggleTheme).toHaveBeenCalledOnce();
  });

  it('Ctrl+Shift+T (Ukrainian: key="Е") still toggles theme via event.code', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ code: 'KeyT', key: 'Е', ctrlKey: true, shiftKey: true });
    expect(toggleTheme).toHaveBeenCalledOnce();
  });

  // ── Ctrl+Shift+1-4 sort shortcuts ────────────────────────────────────────
  it('fires onSort with "created" on Ctrl+Shift+1', () => {
    const onSort = vi.fn();
    const h = makeHandlers({ onSort });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ ctrlKey: true, shiftKey: true, code: 'Digit1', key: '1' });
    expect(onSort).toHaveBeenCalledWith('created');
  });

  it('fires onSort with "modified" on Ctrl+Shift+2', () => {
    const onSort = vi.fn();
    const h = makeHandlers({ onSort });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ ctrlKey: true, shiftKey: true, code: 'Digit2', key: '2' });
    expect(onSort).toHaveBeenCalledWith('modified');
  });

  it('fires onSort with "alphabetical" on Ctrl+Shift+3', () => {
    const onSort = vi.fn();
    const h = makeHandlers({ onSort });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ ctrlKey: true, shiftKey: true, code: 'Digit3', key: '3' });
    expect(onSort).toHaveBeenCalledWith('alphabetical');
  });

  it('fires onSort with "last_used" on Ctrl+Shift+4', () => {
    const onSort = vi.fn();
    const h = makeHandlers({ onSort });
    renderHook(() => useKeyboard(h), { wrapper });
    fire({ ctrlKey: true, shiftKey: true, code: 'Digit4', key: '4' });
    expect(onSort).toHaveBeenCalledWith('last_used');
  });

  it('does not fire onSort when onSort handler is not provided', () => {
    const h = makeHandlers({ onSort: undefined });
    renderHook(() => useKeyboard(h), { wrapper });
    // Should not throw when onSort is undefined
    expect(() => {
      fire({ ctrlKey: true, shiftKey: true, code: 'Digit1', key: '1' });
    }).not.toThrow();
  });
});
