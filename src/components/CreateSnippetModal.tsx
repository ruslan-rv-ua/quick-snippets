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
import { asSentence, ipcErrorToString, parseContentTooLong, parseTitleLength } from '../utils/errors';
import { countCharacters, isTitleLengthValid } from '../utils/title';

export interface CreateSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the save; the dialog closes once a returned promise settles. */
  onSuccess: () => void | Promise<void>;
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
  const { t, tf } = useLanguage();
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  // The backend's error of the last failed save when it is not about a field (for example a
  // locked database): shown above the buttons, not under Title.
  const [failure, setFailure] = useState<string | null>(null);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setContent('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      setFailure(null);
      setSubmitted(false);
      // Focus will be handled by ModalOverlay's first-focusable logic
    }
  }, [isOpen]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    // Counted as the database counts it: an emoji is one character, not two UTF-16 units.
    if (!isTitleLengthValid(title)) errs.title = tf.titleLength(countCharacters(title));
    if (content.length === 0) errs.content = t('contentValidation');
    if (password && password !== confirmPassword) errs.password = t('passwordMismatch');
    return errs;
  }, [title, content, password, confirmPassword, t, tf]);

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    // Empty the live region first, so that a repeated failure is announced again.
    setFailure(null);
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
    } catch (err: unknown) {
      const msg = ipcErrorToString(err);
      // The backend measures the text in bytes, and an encrypted snippet holds less.
      const tooLong = parseContentTooLong(msg);
      if (tooLong) {
        setErrors({ content: tf.contentTooLong(tooLong.size, tooLong.max, tooLong.encrypted) });
        contentRef.current?.focus();
        return;
      }
      const titleCount = parseTitleLength(msg);
      if (titleCount !== null) {
        setErrors({ title: tf.titleLength(titleCount) });
        titleRef.current?.focus();
        return;
      }
      if (msg.includes('Title already exists')) {
        setErrors({ title: t('titleDuplicate') });
        titleRef.current?.focus();
        return;
      }
      // Not about a field: the dialog keeps everything and focus stays where it is; the
      // message above the buttons is a live region (FieldError), read once.
      setFailure(msg);
      return;
    }
    // Focus returns to the list as it is after the save, with the new snippet in it.
    await onSuccess();
    onClose();
  }, [validate, title, content, password, onSuccess, onClose, t, tf]);

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

      <FieldError
        id="create-error"
        message={failure === null ? undefined : tf.snippetSaveFailed(asSentence(failure))}
      />

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
