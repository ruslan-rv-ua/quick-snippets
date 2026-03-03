import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { updateSnippet } from '../hooks/useIpc';
import { ipcErrorToString } from '../utils/errors';
import type { SnippetView } from '../types';

export interface EditSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: SnippetView | null;
  onSuccess: () => void;
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
  const { t } = useLanguage();
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
  }, [validate, snippet, title, content, onSuccess, onClose, t]);

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
          aria-describedby={submitted && errors.title ? 'edit-title-err' : undefined}
        />
        {submitted && errors.title && (
          <span
            id="edit-title-err"
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
              aria-describedby={submitted && errors.content ? 'edit-content-err' : undefined}
            />
            {submitted && errors.content && (
              <span
                id="edit-content-err"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="field-error"
              >
                {errors.content}
              </span>
            )}
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
