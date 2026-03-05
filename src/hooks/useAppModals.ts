import { useCallback } from 'react';
import type { SearchResult } from '../types';
import { getSnippetById } from './useIpc';
import { useModalState, type ModalState } from './useModalState';

/**
 * Options for useAppModals hook.
 */
export interface UseAppModalsOptions {
  snippets: SearchResult[];
  activeIndex: number;
  addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * Manages all modal state and modal-related callbacks for the app.
 * Encapsulates logic for opening/closing different modals.
 */
export function useAppModals(options: UseAppModalsOptions): ModalState & {
  openEdit: () => Promise<void>;
  openDelete: () => void;
} {
  const modals = useModalState();

  /**
   * Open the edit modal for the active (focused) snippet.
   * Fetches full snippet data before opening.
   */
  const openEdit = useCallback(async () => {
    const active = options.snippets[options.activeIndex];
    if (!active) return;
    try {
      const sv = await getSnippetById(active.id);
      modals.setEditSnippet(sv);
      modals.setShowEdit(true);
    } catch (err) {
      options.addToast(String(err), 'error');
    }
  }, [options.snippets, options.activeIndex, modals, options]);

  /**
   * Open the delete confirm modal for the active snippet.
   */
  const openDelete = useCallback(() => {
    const active = options.snippets[options.activeIndex];
    if (!active) return;
    modals.setDeleteId(active.id);
    modals.setDeleteTitle(active.title);
    modals.setShowDelete(true);
  }, [options.snippets, options.activeIndex, modals]);

  return {
    // Spread all modal state from useModalState
    showCreate: modals.showCreate,
    setShowCreate: modals.setShowCreate,
    showEdit: modals.showEdit,
    setShowEdit: modals.setShowEdit,
    showDelete: modals.showDelete,
    setShowDelete: modals.setShowDelete,
    showPassword: modals.showPassword,
    setShowPassword: modals.setShowPassword,
    showSettings: modals.showSettings,
    setShowSettings: modals.setShowSettings,
    showExit: modals.showExit,
    setShowExit: modals.setShowExit,
    editSnippet: modals.editSnippet,
    setEditSnippet: modals.setEditSnippet,
    deleteId: modals.deleteId,
    setDeleteId: modals.setDeleteId,
    deleteTitle: modals.deleteTitle,
    setDeleteTitle: modals.setDeleteTitle,
    passwordSnippet: modals.passwordSnippet,
    setPasswordSnippet: modals.setPasswordSnippet,
    anyModalOpen: modals.anyModalOpen,
    closeAll: modals.closeAll,

    // Modal-related callbacks
    openEdit,
    openDelete,
  };
}
