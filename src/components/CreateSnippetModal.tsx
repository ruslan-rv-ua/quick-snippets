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
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

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
      // Focus first invalid field so that screen readers will announce the
      // associated message (aria-describedby) instead of merely saying
      // “warning” which is what some assistive tech does when aria-invalid
      // toggles while focus remains elsewhere.
      if (errs.title) {
        titleRef.current?.focus();
      } else if (errs.content) {
        contentRef.current?.focus();
      } else if (errs.password) {
        // password mismatch – move focus to the confirmation input
        confirmRef.current?.focus();
      }
      return;
    }
    try {
      await createSnippet(title, content, password);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : String(err);
      const titleErr = msg.includes('Title already exists')
        ? t('titleDuplicate')
        : msg;
      setErrors({ title: titleErr });
      titleRef.current?.focus();
    }
  }, [validate, title, content, password, onSuccess, onClose, t]);

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
          autoComplete="off"
          aria-autocomplete="none"
          spellCheck={false}
          aria-invalid={submitted && !!errors.title ? 'true' : undefined}
          aria-describedby={submitted && errors.title ? 'create-title-err' : undefined}
        />
        {submitted && errors.title && (
          <span
            id="create-title-err"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="field-error"
          >
            {errors.title}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="create-content">{t('contentLabel')}</label>
        <textarea
          ref={contentRef}
          id="create-content"
          maxLength={65536}
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={submitted && !!errors.content ? 'true' : undefined}
          aria-describedby={submitted && errors.content ? 'create-content-err' : undefined}
        />
        {submitted && errors.content && (
          <span
            id="create-content-err"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="field-error"
          >
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
          ref={confirmRef}
          id="create-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={submitted && !!errors.password ? 'true' : undefined}
          aria-describedby={submitted && errors.password ? 'create-confirm-err' : undefined}
        />
        {submitted && errors.password && (
          <span
            id="create-confirm-err"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="field-error"
          >
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
