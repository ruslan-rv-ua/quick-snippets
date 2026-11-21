import type { TranslationMap } from '../i18n/translations';

/**
 * Converts an unknown IPC error value to a plain string.
 * Tauri IPC errors arrive either as `string` or as objects coerced via String().
 */
export function ipcErrorToString(err: unknown): string {
  return typeof err === 'string' ? err : String(err);
}

/**
 * Ends an error text taken from the backend as a sentence, so that a message can go on after
 * it: "Access is denied. (os error 5)" becomes "Access is denied. (os error 5)."
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return trimmed === '' || /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** `WRONG_PASSWORD` in src-tauri/src/crypto.rs: change the two together. */
export const WRONG_PASSWORD = 'Wrong password';

/**
 * Whether an error of activate_snippet or autotype_snippet means a wrong password. Any other
 * error (a locked database, damaged content, the clipboard) is not one, whatever its text.
 */
export function isWrongPassword(message: string): boolean {
  return message === WRONG_PASSWORD;
}

/**
 * `DATABASE_DAMAGED` in src-tauri/src/db.rs: change the two together. The backend gives exactly
 * this text when SQLite finds the snippet database damaged.
 */
export const DATABASE_DAMAGED = 'The snippet database is damaged';

/**
 * `SNIPPET_DAMAGED` in src-tauri/src/db.rs: change the two together. One snippet holds values the
 * app never writes (a text that is not UTF-8); the check at start-up does not see that.
 */
export const SNIPPET_DAMAGED = 'This snippet is damaged';

/** Whether a backend error means a damaged snippet database (exact match). */
export function isDatabaseDamaged(message: string): boolean {
  return message === DATABASE_DAMAGED;
}

/** Whether a backend error means one damaged snippet (exact match). */
export function isSnippetDamaged(message: string): boolean {
  return message === SNIPPET_DAMAGED;
}

/** Either kind of damage. */
export function isDamage(message: string): boolean {
  return isDatabaseDamaged(message) || isSnippetDamaged(message);
}

/**
 * The message for a failure of the backend, built with `frame` (for example
 * `tf.snippetSaveFailed`). Damage gets its reason in the language of the app and, for a damaged
 * database, the advice to restart, whose check at start-up offers to save what can be read; any
 * other error keeps the backend's own text as the reason.
 */
export function failureMessage(
  frame: (reason: string) => string,
  failure: string,
  tf: TranslationMap,
): string {
  if (isDatabaseDamaged(failure)) return `${frame(tf.databaseDamaged)} ${tf.restartToRepair}`;
  if (isSnippetDamaged(failure)) return frame(tf.snippetDamaged);
  return frame(asSentence(failure));
}

/** Content over its size limit, as the backend reports it. */
export interface ContentTooLong {
  /** Size of the text in bytes of UTF-8. */
  size: number;
  /** Most that can be saved, in bytes of UTF-8. */
  max: number;
  /** The limit is the lower one of encrypted snippets. */
  encrypted: boolean;
}

/** The text of `content_too_long` in src-tauri/src/commands.rs: change the two together. */
const CONTENT_TOO_LONG =
  /^Content too long( for an encrypted snippet)? \((\d+) bytes, max (\d+) bytes\)$/;

/**
 * Reads the size and the limit from a "content too long" error of the backend,
 * so that the dialogs can say it in the user's language. `null` for any other error.
 */
export function parseContentTooLong(message: string): ContentTooLong | null {
  const match = CONTENT_TOO_LONG.exec(message);
  if (!match) return null;
  return {
    size: Number(match[2]),
    max: Number(match[3]),
    encrypted: match[1] !== undefined,
  };
}

/** The text of `check_title` in src-tauri/src/commands.rs: change the two together. */
const TITLE_LENGTH = /^Title must be \d+ to \d+ characters \((\d+) characters\)$/;

/**
 * Reads the number of characters from a "title out of its limits" error of the backend,
 * so that the dialogs can say it in the user's language. `null` for any other error.
 */
export function parseTitleLength(message: string): number | null {
  const match = TITLE_LENGTH.exec(message);
  return match ? Number(match[1]) : null;
}
