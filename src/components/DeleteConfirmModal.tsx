import React, { useEffect, useRef, useCallback } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { deleteSnippet } from '../hooks/useIpc';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippetTitle: string;
  snippetId: number;
  onSuccess: () => void;
  onError: (err: string) => void;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  snippetTitle,
  snippetId,
  onSuccess,
  onError,
}: DeleteConfirmModalProps): React.ReactElement | null {
  const { t } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteSnippet(snippetId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      onError(String(err));
    }
  }, [snippetId, onSuccess, onClose, onError]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      // Ctrl+Enter confirms delete (consistent with other modals)
      // Bare Enter intentionally does NOT confirm delete (safety)
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); void handleDelete(); }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, handleDelete]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} titleId="delete-modal-title">
      <h2 id="delete-modal-title">{t('deleteSnippet')}</h2>

      <div className="delete-preview">
        «{snippetTitle}»
      </div>

      <p className="settings-hint">
        {t('cannotUndo')}
      </p>

      <div className="modal-actions">
        <button
          ref={cancelRef}
          type="button"
          className="btn-secondary"
          onClick={onClose}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn-destructive"
          onClick={handleDelete}
        >
          {t('delete')}
        </button>
      </div>
    </ModalOverlay>
  );
}
