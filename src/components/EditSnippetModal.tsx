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
import { updateSnippet } from '../hooks/useIpc';
import { ipcErrorToString, parseContentTooLong } from '../utils/errors';
import type { SnippetView } from '../types';

export interface EditSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: SnippetView | null;
  /** Called after the save; the dialog closes once a returned promise settles. */
  onSuccess: () => void | Promise<void>;
}

interface FormErrors {
  title?: string;
  content?: string;
}

export function EditSnippetModal({
  isOpen,
  onClose,
  snippet,
  onSuccess,
}: EditSnippetModalProps): React.ReactElement | null {
  const { t, tf } = useLanguage();
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Populate fields when snippet changes
  useEffect(() => {
    if (isOpen && snippet) {
      setTitle(snippet.title);
      setContent(snippet.content);
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen, snippet]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (title.length < 3 || title.length > 50) errs.title = t('titleValidation');
    if (!snippet?.is_encrypted && content.length === 0) errs.content = t('contentValidation');
    return errs;
  }, [title, content, snippet, t]);

  const handleSubmit = useCallback(async () => {
    if (!snippet) return;
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.title) {
        titleRef.current?.focus();
      } else if (errs.content) {
        contentRef.current?.focus();
      }
      return;
    }
    try {
      await updateSnippet(snippet.id, title, content);
    } catch (err: unknown) {
      const msg = ipcErrorToString(err);
      // The backend measures the text in bytes; only a plain snippet's text can be edited.
      const tooLong = parseContentTooLong(msg);
      if (tooLong) {
        setErrors({ content: tf.contentTooLong(tooLong.size, tooLong.max, tooLong.encrypted) });
        contentRef.current?.focus();
        return;
      }
      const titleErr = msg.includes('Title already exists')
        ? t('titleDuplicate')
        : msg;
      setErrors({ title: titleErr });
      titleRef.current?.focus();
      return;
    }
    // Focus returns to the list as it is after the save.
    await onSuccess();
    onClose();
  }, [validate, snippet, title, content, onSuccess, onClose, t, tf]);

  useModalKeyboard(isOpen, { onEscape: onClose, onCtrlEnter: handleSubmit });

  if (!isOpen || !snippet) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} titleId="edit-modal-title">
      <h2 id="edit-modal-title">{t('editSnippet')}</h2>

      <div className="form-field">
        <label htmlFor="edit-title">{t('titleLabel')}</label>
        <input
          ref={titleRef}
          id="edit-title"
          type="text"
          maxLength={50}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          aria-autocomplete="none"
          spellCheck={false}
          aria-invalid={submitted && !!errors.title ? 'true' : undefined}
        />
        <FieldError id="edit-title-err" message={submitted ? errors.title : undefined} />
      </div>

      <div className="form-field">
        <label htmlFor="edit-content">{t('contentLabel')}</label>
        {snippet.is_encrypted ? (
          <div className="modal-snippet-name" style={{ fontStyle: 'italic' }}>
            {t('encrypted')}
          </div>
        ) : (
          <>
            <textarea
              ref={contentRef}
              id="edit-content"
              maxLength={65536}
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-invalid={submitted && !!errors.content ? 'true' : undefined}
            />
            <FieldError id="edit-content-err" message={submitted ? errors.content : undefined} />
          </>
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
