import React, { useEffect, useRef, useCallback } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { quitApp } from '../hooks/useIpc';

export interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExitConfirmModal({
  isOpen,
  onClose,
}: ExitConfirmModalProps): React.ReactElement | null {
  const { t } = useLanguage();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void quitApp();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} titleId="exit-modal-title">
      <h2 id="exit-modal-title">{t('exitConfirmTitle')}</h2>
      <p className="settings-hint" style={{ margin: '4px 0' }}>
        {t('exitConfirmMessage')}
      </p>

      <div className="modal-actions">
        <button
          ref={cancelRef}
          type="button"
          className="btn-secondary"
          onClick={handleClose}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn-destructive"
          onClick={() => void quitApp()}
        >
          {t('quit')}
        </button>
      </div>
    </ModalOverlay>
  );
}
