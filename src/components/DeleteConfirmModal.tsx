import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { FieldError } from './FieldError';
import { useLanguage } from '../hooks/useLanguage';
import { deleteSnippet } from '../hooks/useIpc';
import { asSentence, ipcErrorToString } from '../utils/errors';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippetTitle: string;
  snippetId: number;
  /** Called after the delete; the dialog closes once a returned promise settles. */
  onSuccess: () => void | Promise<void>;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  snippetTitle,
  snippetId,
  onSuccess,
}: DeleteConfirmModalProps): React.ReactElement | null {
  const { t, tf } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Guards against a second delete while one runs (a locked database answers after 5 s).
  const busyRef = useRef(false);
  // The backend's error of the last failed delete, shown above the buttons.
  const [failure, setFailure] = useState<string | null>(null);

  // Focus Cancel on open
  useEffect(() => {
    if (isOpen) {
      busyRef.current = false;
      setFailure(null);
      setTimeout(() => cancelRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    // Empty the live region first, so that a repeated failure is announced again.
    setFailure(null);
    try {
      await deleteSnippet(snippetId);
    } catch (err: unknown) {
      // The dialog stays open and focus stays where it is: the message above the buttons
      // is a live region (FieldError), read once. A toast outside this aria-modal dialog
      // was gone after 2 s.
      setFailure(ipcErrorToString(err));
      busyRef.current = false;
      return;
    }
    // The list behind the dialog no longer has the snippet when focus returns to it.
    await onSuccess();
    busyRef.current = false;
    onClose();
  }, [snippetId, onSuccess, onClose]);

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

      <FieldError
        id="delete-error"
        message={failure === null ? undefined : tf.snippetDeleteFailed(asSentence(failure))}
      />

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
