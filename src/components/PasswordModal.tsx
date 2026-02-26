import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { activateSnippet } from '../hooks/useIpc';

export interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippetId: number;
  snippetTitle: string;
  onSuccess: () => void;
}

export function PasswordModal({
  isOpen,
  onClose,
  snippetId,
  snippetTitle,
  onSuccess,
}: PasswordModalProps): React.ReactElement | null {
  const { t } = useLanguage();
  const pwdRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg('');
      setLoading(false);
      setTimeout(() => pwdRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!password) {
      setErrorMsg(t('enterPassword'));
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await activateSnippet(snippetId, password);
      setLoading(false);
      onSuccess();
      onClose();
    } catch {
      setLoading(false);
      setPassword('');
      setErrorMsg(t('wrongPassword'));
      setTimeout(() => pwdRef.current?.focus(), 10);
    }
  }, [password, snippetId, onSuccess, onClose, t]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPassword('');
        onClose();
        return;
      }
      if (e.key === 'Enter' && (e.target as HTMLElement).id === 'pwd-input') {
        void handleSubmit();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} titleId="pwd-modal-title">
      <h2 id="pwd-modal-title">{t('enterPassword')}</h2>

      <div className="modal-snippet-name">
        {snippetTitle}
      </div>

      <div className="form-field">
        <label htmlFor="pwd-input">{t('passwordLabel')}</label>
        <input
          ref={pwdRef}
          id="pwd-input"
          type="password"
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          aria-invalid={!!errorMsg ? 'true' : undefined}
          aria-describedby={errorMsg ? 'pwd-error' : undefined}
        />
        {errorMsg && (
          <span id="pwd-error" role="alert" className="field-error">
            {errorMsg}
          </span>
        )}
      </div>

      {loading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {t('decrypting')}
        </p>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={loading}
          onClick={onClose}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={() => void handleSubmit()}
        >
          {t('copy')}
        </button>
      </div>
    </ModalOverlay>
  );
}
