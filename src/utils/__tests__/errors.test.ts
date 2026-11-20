import { describe, it, expect } from 'vitest';
import {
  asSentence,
  ipcErrorToString,
  isWrongPassword,
  parseContentTooLong,
  parseTitleLength,
  WRONG_PASSWORD,
} from '../errors';

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
