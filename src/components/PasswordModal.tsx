import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { activateSnippet, autotypeSnippet } from '../hooks/useIpc';

export interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippetId: number;
  snippetTitle: string;
  onSuccess: () => void;
  action?: 'copy' | 'autotype';
}

export function PasswordModal({
  isOpen,
  onClose,
  snippetId,
  snippetTitle,
  onSuccess,
  action = 'copy',
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
      // move focus back so screen reader announces the message instead of just
      // reading the ‘warning’ cue that aria-invalid triggers
      setTimeout(() => pwdRef.current?.focus(), 10);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const ipcCall = action === 'autotype' ? autotypeSnippet : activateSnippet;
      await ipcCall(snippetId, password);
      setLoading(false);
      onSuccess();
      onClose();
    } catch {
      setLoading(false);
      setPassword('');
      setErrorMsg(t('wrongPassword'));
      setTimeout(() => pwdRef.current?.focus(), 10);
    }
  }, [password, snippetId, onSuccess, onClose, t, action]);

  const handleEscape = useCallback(() => {
    setPassword('');
    onClose();
  }, [onClose]);

  useModalKeyboard(isOpen, { onEscape: handleEscape });

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
          <span
            id="pwd-error"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="field-error"
          >
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
          {t(action)}
        </button>
      </div>
    </ModalOverlay>
  );
}
