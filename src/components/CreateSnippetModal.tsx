import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { FieldError } from './FieldError';
import { useLanguage } from '../hooks/useLanguage';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { createSnippet } from '../hooks/useIpc';
import { ipcErrorToString } from '../utils/errors';

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
      // Focus the first invalid field; its FieldError live region announces the message.
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
      const msg = ipcErrorToString(err);
      const titleErr = msg.includes('Title already exists')
        ? t('titleDuplicate')
        : msg;
      setErrors({ title: titleErr });
      titleRef.current?.focus();
    }
  }, [validate, title, content, password, onSuccess, onClose, t]);

  useModalKeyboard(isOpen, { onEscape: onClose, onCtrlEnter: handleSubmit });

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
        />
        <FieldError id="create-title-err" message={submitted ? errors.title : undefined} />
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
        />
        <FieldError id="create-content-err" message={submitted ? errors.content : undefined} />
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
        />
        <FieldError id="create-confirm-err" message={submitted ? errors.password : undefined} />
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
