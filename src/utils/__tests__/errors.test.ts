import { describe, it, expect } from 'vitest';
import {
  asSentence,
  DAMAGE_TOAST_MS,
  DATABASE_DAMAGED,
  failureMessage,
  failureToast,
  ipcErrorToString,
  isDamage,
  isDatabaseDamaged,
  isSnippetDamaged,
  isWrongPassword,
  parseContentTooLong,
  parseTitleLength,
  SNIPPET_DAMAGED,
  WRONG_PASSWORD,
} from '../errors';
import { translations } from '../../i18n/translations';

describe('ipcErrorToString', () => {
  it('keeps a string and turns anything else into one', () => {
    expect(ipcErrorToString('Title already exists')).toBe('Title already exists');
    expect(ipcErrorToString(new Error('boom'))).toBe('Error: boom');
  });
});

describe('asSentence', () => {
  it('adds a full stop after an error of Windows, which ends with its number', () => {
    expect(asSentence('Access is denied. (os error 5)')).toBe('Access is denied. (os error 5).');
  });

  it('keeps an error that already ends a sentence, and trims spaces', () => {
    expect(asSentence(' Disk full. ')).toBe('Disk full.');
    expect(asSentence('Wirklich?')).toBe('Wirklich?');
    expect(asSentence('Зачекайте…')).toBe('Зачекайте…');
  });

  it('leaves an empty text empty', () => {
    expect(asSentence('  ')).toBe('');
  });
});

// The backend writes these errors in content_too_long (src-tauri/src/commands.rs).
describe('parseContentTooLong', () => {
  it('reads the size and the limit of a plain snippet', () => {
    expect(parseContentTooLong('Content too long (70000 bytes, max 65536 bytes)')).toEqual({
      size: 70000,
      max: 65536,
      encrypted: false,
    });
  });

  it('reads the size and the limit of an encrypted snippet', () => {
    expect(
      parseContentTooLong('Content too long for an encrypted snippet (52300 bytes, max 49105 bytes)'),
    ).toEqual({ size: 52300, max: 49105, encrypted: true });
  });

  it('returns null for every other error', () => {
    for (const message of [
      'Title already exists',
      'Title too long (max 50 chars)',
      'Content too long (max 65536 bytes)',
      'CHECK constraint failed: length(content) <= 65536',
      '',
    ]) {
      expect(parseContentTooLong(message), message).toBeNull();
    }
  });
});

// The backend writes this error in check_title (src-tauri/src/commands.rs).
describe('parseTitleLength', () => {
  it('reads the number of characters of a title out of its limits', () => {
    expect(parseTitleLength('Title must be 3 to 50 characters (51 characters)')).toBe(51);
    expect(parseTitleLength('Title must be 3 to 50 characters (2 characters)')).toBe(2);
    expect(parseTitleLength('Title must be 3 to 50 characters (0 characters)')).toBe(0);
  });

  it('returns null for every other error', () => {
    for (const message of [
      'Title already exists',
      'Title too long (max 50 chars)',
      'Content too long (70000 bytes, max 65536 bytes)',
      'CHECK constraint failed: length(title) >= 3 AND length(title) <= 50',
      '',
    ]) {
      expect(parseTitleLength(message), message).toBeNull();
    }
  });
});

// WRONG_PASSWORD in src-tauri/src/crypto.rs: only that exact text is a wrong password.
describe('isWrongPassword', () => {
  it('is the text of the backend for a wrong password', () => {
    expect(WRONG_PASSWORD).toBe('Wrong password');
    expect(isWrongPassword('Wrong password')).toBe(true);
  });

  it.each([
    'database is locked',
    'Invalid data',
    'Query returned no rows',
    'Invalid UTF-8 content',
    'wrong password',
    'Wrong password.',
    'Error: Wrong password',
    '',
  ])('is not %j', (message) => {
    expect(isWrongPassword(message)).toBe(false);
  });
});

// TASK-33: the fixed texts of src-tauri/src/db.rs (DATABASE_DAMAGED, SNIPPET_DAMAGED).
describe('damage', () => {
  it('knows the exact texts of the backend', () => {
    expect(DATABASE_DAMAGED).toBe('The snippet database is damaged');
    expect(SNIPPET_DAMAGED).toBe('This snippet is damaged');
    expect(isDatabaseDamaged(DATABASE_DAMAGED)).toBe(true);
    expect(isSnippetDamaged(SNIPPET_DAMAGED)).toBe(true);
    expect(isDamage(DATABASE_DAMAGED) && isDamage(SNIPPET_DAMAGED)).toBe(true);
  });

  it.each([
    ['the own text of SQLite', 'database disk image is malformed'],
    ['a locked database', 'database is locked'],
    ['other letters', 'the snippet database is damaged'],
    ['more text', 'The snippet database is damaged.'],
    ['a wrong password', WRONG_PASSWORD],
  ])('%s is no damage the app recognises', (_, text) => {
    expect(isDamage(text)).toBe(false);
  });

  it('builds the message: damage in words of the app, any other error as the backend gives it', () => {
    const tf = translations.en;
    expect(failureMessage(tf.snippetSaveFailed, DATABASE_DAMAGED, tf)).toBe(
      'Could not save the snippet. Reason: the snippet database is damaged. Nothing was changed. ' +
        'Restart QuickSnippets: at start-up it checks the database and offers to save the snippets that can still be read.',
    );
    expect(failureMessage(tf.snippetCopyFailed, SNIPPET_DAMAGED, tf)).toBe(
      'Could not copy the snippet. Reason: this snippet is damaged and cannot be read.',
    );
    expect(failureMessage(tf.snippetDeleteFailed, 'database is locked', tf)).toBe(
      'Could not delete the snippet. Reason: database is locked.',
    );
  });

  it('has the words in every language', () => {
    for (const lang of ['en', 'uk', 'de'] as const) {
      const tf = translations[lang];
      for (const text of [tf.databaseDamaged, tf.restartToRepair, tf.snippetDamaged, tf.listDamaged]) {
        expect(text.trim()).not.toBe('');
        expect(text).toMatch(/[.!?]$/);
      }
    }
    expect(translations.uk.listDamaged).not.toBe(translations.en.listDamaged);
    expect(translations.de.listDamaged).not.toBe(translations.en.listDamaged);
  });
});

// TASK-42: the toast of a failed action in the main window.
describe('failureToast', () => {
  const tf = translations.en;

  it.each([
    ['a locked database', 'database is locked', 'Could not copy the snippet. Reason: database is locked.'],
    ['a snippet no longer in the database', 'Query returned no rows', 'Could not copy the snippet. Reason: Query returned no rows.'],
    [
      'a clipboard held by another program',
      'The native clipboard is not accessible due to being held by another party.',
      'Could not copy the snippet. Reason: The native clipboard is not accessible due to being held by another party.',
    ],
  ])('%s: what failed, with the reason as it is, as long as any toast', (_, failure, message) => {
    expect(failureToast(tf.snippetCopyFailed, failure, tf)).toEqual({ message, duration: undefined });
  });

  it('damage: in words of the app, and longer, for the advice', () => {
    expect(failureToast(tf.snippetOpenFailed, DATABASE_DAMAGED, tf)).toEqual({
      message: failureMessage(tf.snippetOpenFailed, DATABASE_DAMAGED, tf),
      duration: DAMAGE_TOAST_MS,
    });
    expect(failureToast(tf.snippetAutotypeFailed, SNIPPET_DAMAGED, tf)).toEqual({
      message: 'Could not type the snippet. Reason: this snippet is damaged and cannot be read.',
      duration: DAMAGE_TOAST_MS,
    });
  });

  it('every frame of the main window, in every language, starts with what failed and takes the reason', () => {
    const starts = {
      en: ['Could not copy', 'Could not type', 'Could not open the snippet', 'Could not open the settings'],
      uk: ['Не вдалося скопіювати', 'Не вдалося надрукувати', 'Не вдалося відкрити сніпет', 'Не вдалося відкрити налаштування'],
      de: [
        'Das Snippet ließ sich nicht kopieren',
        'Das Snippet ließ sich nicht automatisch tippen',
        'Das Snippet ließ sich nicht öffnen',
        'Die Einstellungen ließen sich nicht öffnen',
      ],
    };
    for (const lang of ['en', 'uk', 'de'] as const) {
      const t = translations[lang];
      const frames = [t.snippetCopyFailed, t.snippetAutotypeFailed, t.snippetOpenFailed, t.settingsOpenFailed];
      frames.forEach((frame, i) => {
        const message = frame('REASON.');
        expect(message.startsWith(starts[lang][i])).toBe(true);
        expect(message.endsWith('REASON.')).toBe(true);
      });
    }
  });
});
