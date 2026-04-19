import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    { value: { theme: 'light', toggleTheme } },
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
