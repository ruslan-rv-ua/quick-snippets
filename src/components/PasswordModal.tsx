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
  // Guards against a second submit while decryption runs; a ref, so the check
  // never sees a stale `loading` value captured by an older callback.
  const busyRef = useRef(false);

  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      busyRef.current = false;
      setPassword('');
      setErrorMsg('');
      setLoading(false);
      setTimeout(() => pwdRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (busyRef.current) return;
    if (!password) {
      setErrorMsg(t('enterPassword'));
      setTimeout(() => pwdRef.current?.focus(), 10);
      return;
    }
    busyRef.current = true;
    setLoading(true);
    // Empty the live region first, so the same message is announced again next time.
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
      // Focus stays in the field (it is never disabled); this only matters when the
      // password was submitted with the button.
      setTimeout(() => pwdRef.current?.focus(), 10);
    } finally {
      busyRef.current = false;
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
        {/* Never disabled: a disabled field drops focus, and NVDA then says
            "unavailable" and re-reads the whole dialog. */}
        <input
          ref={pwdRef}
          id="pwd-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          aria-invalid={!!errorMsg ? 'true' : undefined}
          // No aria-describedby to pwd-error: the live region below announces the message,
          // and a description change on the focused field made NVDA say it a second time.
        />
        {/* Always rendered, empty until an error: screen readers announce text changes
            in an existing live region. A newly inserted role="alert" was read by NVDA
            as just "alert", without its text, because the app root has role="application". */}
        <span
          id="pwd-error"
          aria-live="assertive"
          aria-atomic="true"
          className="field-error"
        >
          {errorMsg}
        </span>
      </div>

      {loading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {t('decrypting')}
        </p>
      )}

      <div className="modal-actions">
        {/* aria-disabled instead of disabled: the buttons keep focus while decrypting. */}
        <button
          type="button"
          className="btn-secondary"
          aria-disabled={loading || undefined}
          onClick={() => { if (!busyRef.current) onClose(); }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          aria-disabled={loading || undefined}
          onClick={() => void handleSubmit()}
        >
          {t(action)}
        </button>
      </div>
    </ModalOverlay>
  );
}
