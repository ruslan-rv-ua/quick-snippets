import { renderHook, act } from '@testing-library/react';
import { useModalManager } from '../useModalManager';
import type { SnippetView, SearchResult } from '../../types';

describe('useModalManager', () => {
  it('should initialize all modals as closed', () => {
    const { result } = renderHook(() => useModalManager());

    expect(result.current.modals.create.isOpen).toBe(false);
    expect(result.current.modals.edit.isOpen).toBe(false);
    expect(result.current.modals.delete.isOpen).toBe(false);
    expect(result.current.modals.password.isOpen).toBe(false);
    expect(result.current.modals.settings.isOpen).toBe(false);
    expect(result.current.modals.exit.isOpen).toBe(false);
  });

  it('should initialize all modals data as null/empty', () => {
    const { result } = renderHook(() => useModalManager());

    expect(result.current.modals.edit.data).toBeNull();
    expect(result.current.modals.delete.data).toEqual({ id: 0, title: '' });
    expect(result.current.modals.password.data).toBeNull();
  });

  it('should open a modal by name', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('create');
    });

    expect(result.current.modals.create.isOpen).toBe(true);
    expect(result.current.anyModalOpen).toBe(true);
  });

  it('should close a modal by name', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('create');
    });

    expect(result.current.modals.create.isOpen).toBe(true);

    act(() => {
      result.current.closeModal('create');
    });

    expect(result.current.modals.create.isOpen).toBe(false);
    expect(result.current.anyModalOpen).toBe(false);
  });

  it('should open multiple modals independently', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('create');
      result.current.openModal('settings');
    });

    expect(result.current.modals.create.isOpen).toBe(true);
    expect(result.current.modals.settings.isOpen).toBe(true);
    expect(result.current.modals.edit.isOpen).toBe(false);
    expect(result.current.anyModalOpen).toBe(true);
  });

  it('should set data for edit modal', () => {
    const { result } = renderHook(() => useModalManager());

    const snippetData: SnippetView = {
      id: 1,
      title: 'Test Snippet',
      content: 'Test content',
      is_encrypted: false,
      created_at: '2026-03-03T00:00:00Z',
      updated_at: '2026-03-03T00:00:00Z',
    };

    act(() => {
      result.current.setData('edit', snippetData);
    });

    expect(result.current.modals.edit.data).toEqual(snippetData);
  });

  it('should set data for delete modal', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.setData('delete', { id: 42, title: 'Delete me' });
    });

    expect(result.current.modals.delete.data).toEqual({ id: 42, title: 'Delete me' });
  });

  it('should set data for password modal', () => {
    const { result } = renderHook(() => useModalManager());

    const snippetData: SearchResult = {
      id: 1,
      title: 'Encrypted Snippet',
      score: 100,
      matched_positions: [],
      is_encrypted: true,
    };

    act(() => {
      result.current.setData('password', snippetData);
    });

    expect(result.current.modals.password.data).toEqual(snippetData);
  });

  it('should clear all modals with closeAll', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('create');
      result.current.openModal('edit');
      result.current.openModal('settings');
    });

    expect(result.current.anyModalOpen).toBe(true);

    act(() => {
      result.current.closeAll();
    });

    expect(result.current.modals.create.isOpen).toBe(false);
    expect(result.current.modals.edit.isOpen).toBe(false);
    expect(result.current.modals.settings.isOpen).toBe(false);
    expect(result.current.anyModalOpen).toBe(false);
  });

  it('should compute anyModalOpen correctly', () => {
    const { result } = renderHook(() => useModalManager());

    expect(result.current.anyModalOpen).toBe(false);

    act(() => {
      result.current.openModal('create');
    });

    expect(result.current.anyModalOpen).toBe(true);

    act(() => {
      result.current.closeModal('create');
    });

    expect(result.current.anyModalOpen).toBe(false);
  });

  it('should allow opening and closing the same modal multiple times', () => {
    const { result } = renderHook(() => useModalManager());

    act(() => {
      result.current.openModal('create');
    });
    expect(result.current.modals.create.isOpen).toBe(true);

    act(() => {
      result.current.closeModal('create');
    });
    expect(result.current.modals.create.isOpen).toBe(false);

    act(() => {
      result.current.openModal('create');
    });
    expect(result.current.modals.create.isOpen).toBe(true);
  });

  it('should not affect data when closing a modal', () => {
    const { result } = renderHook(() => useModalManager());

    const snippetData: SnippetView = {
      id: 1,
      title: 'Test',
      content: 'content',
      is_encrypted: false,
      created_at: '2026-03-03T00:00:00Z',
      updated_at: '2026-03-03T00:00:00Z',
    };

    act(() => {
      result.current.setData('edit', snippetData);
      result.current.openModal('edit');
    });

    const dataBefore = result.current.modals.edit.data;

    act(() => {
      result.current.closeModal('edit');
    });

    // Data should remain after close (caller decides to clear it)
    expect(result.current.modals.edit.data).toEqual(dataBefore);
  });
});
