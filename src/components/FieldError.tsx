import React from 'react';

export interface FieldErrorProps {
  id: string;
  /** Empty or undefined while the field is valid. */
  message?: string;
}

/**
 * Validation message under a form field, announced by screen readers.
 *
 * Always rendered, empty until there is an error: screen readers announce text
 * changes in an existing live region. A newly inserted role="alert" was read by
 * NVDA as just "alert", without its text, because the app root has
 * role="application". The field must not point at this element with
 * aria-describedby: a description change on the focused field made NVDA say the
 * message a second time.
 */
export function FieldError({ id, message }: FieldErrorProps): React.ReactElement {
  return (
    <span id={id} aria-live="assertive" aria-atomic="true" className="field-error">
      {message ?? ''}
    </span>
  );
}
