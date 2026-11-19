import { describe, it, expect } from 'vitest';
import { ipcErrorToString, parseContentTooLong } from '../errors';

describe('ipcErrorToString', () => {
  it('keeps a string and turns anything else into one', () => {
    expect(ipcErrorToString('Title already exists')).toBe('Title already exists');
    expect(ipcErrorToString(new Error('boom'))).toBe('Error: boom');
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
