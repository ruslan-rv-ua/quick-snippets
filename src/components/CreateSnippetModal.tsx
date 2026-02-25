import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { createSnippet } from '../hooks/useIpc';

export interface CreateSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  title?: string;
  content?: string;
  password?: string;
}

export function CreateSnippetModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSnippetModalProps): React.ReactElement | null {
  const { t } = useLanguage();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      setSubmitted(false);
      // Focus will be handled by ModalOverlay's first-focusable logic
    }
  }, [isOpen]);

  // Focus title on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (title.length < 3 || title.length > 50) errs.title = t('titleValidation');
    if (content.length === 0) errs.content = t('contentValidation');
    if (password && password !== confirmPassword) errs.password = t('passwordMismatch');
    return errs;
  }, [title, content, password, confirmPassword, t]);

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Focus first invalid field
      if (errs.title) titleRef.current?.focus();
      return;
    }
    try {
      await createSnippet(title, content, password);
      onSuccess();
      onClose();
    } catch {
      // ignore
    }
  }, [validate, title, content, password, onSuccess, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} titleId="create-modal-title">
      <h2 id="create-modal-title">{t('createSnippet')}</h2>

      <div className="form-field">
        <label htmlFor="create-title">{t('titleLabel')}</label>
        <input
          ref={titleRef}
          id="create-title"
          type="text"
          maxLength={50}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={submitted && !!errors.title ? 'true' : undefined}
          aria-describedby={submitted && errors.title ? 'create-title-err' : undefined}
        />
        {submitted && errors.title && (
          <span id="create-title-err" role="alert" className="field-error">
            {errors.title}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="create-content">{t('contentLabel')}</label>
        <textarea
          id="create-content"
          maxLength={65536}
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={submitted && !!errors.content ? 'true' : undefined}
          aria-describedby={submitted && errors.content ? 'create-content-err' : undefined}
        />
        {submitted && errors.content && (
          <span id="create-content-err" role="alert" className="field-error">
            {errors.content}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="create-password">{t('passwordLabel')}</label>
        <input
          id="create-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="create-confirm">{t('confirmPasswordLabel')}</label>
        <input
          id="create-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={submitted && !!errors.password ? 'true' : undefined}
          aria-describedby={submitted && errors.password ? 'create-confirm-err' : undefined}
        />
        {submitted && errors.password && (
          <span id="create-confirm-err" role="alert" className="field-error">
            {errors.password}
          </span>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('cancel')}
        </button>
        <button type="button" className="btn-primary" onClick={handleSubmit}>
          {t('save')}
        </button>
      </div>
    </ModalOverlay>
  );
}
