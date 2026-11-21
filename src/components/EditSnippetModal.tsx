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
import { failureMessage, ipcErrorToString, parseContentTooLong, parseTitleLength } from '../utils/errors';
import { countCharacters, isTitleLengthValid } from '../utils/title';
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
  // The backend's error of the last failed save when it is not about a field (for example a
  // locked database): shown above the buttons, not under Title.
  const [failure, setFailure] = useState<string | null>(null);

  // Populate fields when snippet changes
  useEffect(() => {
    if (isOpen && snippet) {
      setTitle(snippet.title);
      setContent(snippet.content);
      setErrors({});
      setFailure(null);
      setSubmitted(false);
    }
  }, [isOpen, snippet]);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    // Counted as the database counts it: an emoji is one character, not two UTF-16 units.
    if (!isTitleLengthValid(title)) errs.title = tf.titleLength(countCharacters(title));
    if (!snippet?.is_encrypted && content.length === 0) errs.content = t('contentValidation');
    return errs;
  }, [title, content, snippet, t, tf]);

  const handleSubmit = useCallback(async () => {
    if (!snippet) return;
    setSubmitted(true);
    // Empty the live region first, so that a repeated failure is announced again.
    setFailure(null);
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
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-invalid={submitted && !!errors.content ? 'true' : undefined}
            />
            <FieldError id="edit-content-err" message={submitted ? errors.content : undefined} />
          </>
        )}
      </div>

      <FieldError
        id="edit-error"
        message={failure === null ? undefined : failureMessage(tf.snippetSaveFailed, failure, tf)}
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
