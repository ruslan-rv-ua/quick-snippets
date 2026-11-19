import { describe, it, expect } from 'vitest';
import { countCharacters, isTitleLengthValid, TITLE_MAX_CHARS, TITLE_MIN_CHARS } from '../title';

// The database counts a title in characters (Unicode code points), not in UTF-16 units.
describe('countCharacters', () => {
  it('counts Latin and Cyrillic letters one each', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('Жовтень')).toBe(7);
  });

  it('counts an emoji outside the BMP as one character, not two UTF-16 units', () => {
    expect('😀'.length).toBe(2);
    expect(countCharacters('😀')).toBe(1);
    expect(countCharacters('😀'.repeat(50))).toBe(50);
  });

  it('counts each code point of a joined emoji, as the database does', () => {
    // man, ZWJ, woman, ZWJ, girl
    expect(countCharacters('👨‍👩‍👧')).toBe(5);
  });

  it('counts an empty title as 0', () => {
    expect(countCharacters('')).toBe(0);
  });
});

describe('isTitleLengthValid', () => {
  it('accepts 3 to 50 characters in any script', () => {
    expect([TITLE_MIN_CHARS, TITLE_MAX_CHARS]).toEqual([3, 50]);
    for (const title of ['abc', 'Ж'.repeat(50), '😀'.repeat(50), '😀'.repeat(3)]) {
      expect(isTitleLengthValid(title)).toBe(true);
    }
  });

  it('refuses fewer than 3 or more than 50 characters', () => {
    for (const title of ['', 'ab', '😀😀', 'Ж'.repeat(51), '😀'.repeat(51), 'a'.repeat(51)]) {
      expect(isTitleLengthValid(title)).toBe(false);
    }
  });
});
