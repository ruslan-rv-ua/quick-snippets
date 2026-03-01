import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

describe('translations', () => {
  const langCodes = Object.keys(translations) as Array<keyof typeof translations>;

  it('has en, uk and de translations', () => {
    expect(langCodes).toContain('en');
    expect(langCodes).toContain('uk');
    expect(langCodes).toContain('de');
  });

  it('en, uk and de have identical keys', () => {
    const enKeys = Object.keys(translations.en).sort();
    const ukKeys = Object.keys(translations.uk).sort();
    const deKeys = Object.keys(translations.de).sort();
    expect(ukKeys).toEqual(enKeys);
    expect(deKeys).toEqual(enKeys);
  });

  it('no empty string values in en', () => {
    for (const [key, value] of Object.entries(translations.en)) {
      if (typeof value === 'string') {
        expect(value.trim(), `en.${key} is empty`).not.toBe('');
      }
    }
  });

  it('no empty string values in uk', () => {
    for (const [key, value] of Object.entries(translations.uk)) {
      if (typeof value === 'string') {
        expect(value.trim(), `uk.${key} is empty`).not.toBe('');
      }
    }
  });

  it('no empty string values in de', () => {
    for (const [key, value] of Object.entries(translations.de)) {
      if (typeof value === 'string') {
        expect(value.trim(), `de.${key} is empty`).not.toBe('');
      }
    }
  });

  it('parametrized functions return strings', () => {
    expect(typeof translations.en.searchResults(5, 'test')).toBe('string');
    expect(typeof translations.uk.searchResults(5, 'test')).toBe('string');
    expect(typeof translations.de.searchResults(5, 'test')).toBe('string');
  });

  it('pluralization works for en (1 vs many)', () => {
    const one = translations.en.snippetCount(1);
    const many = translations.en.snippetCount(5);
    expect(one).toContain('1');
    expect(many).toContain('5');
    expect(one).not.toEqual(many);
  });

  it('pluralization works for de (1 vs many)', () => {
    const one = translations.de.snippetCount(1);
    const many = translations.de.snippetCount(5);
    expect(one).toContain('1');
    expect(many).toContain('5');
    expect(one).not.toEqual(many);
  });

  // PRD required strings presence
  const requiredKeys = [
    'searchPlaceholder', 'copySuccess', 'saveSuccess', 'deleteSuccess',
    'cancel', 'save', 'delete', 'quit', 'copy',
    'titleLabel', 'contentLabel', 'passwordLabel', 'confirmPasswordLabel',
    'titleValidation', 'contentValidation', 'passwordMismatch',
    'wrongPassword', 'decryptError', 'enterPassword',
    'createSnippet', 'editSnippet', 'deleteSnippet',
    'noSnippets', 'noResults', 'encrypted',
    'settingsTitle', 'themeLabel', 'languageLabel',
    'startInTrayLabel', 'autostartLabel', 'confirmOnCloseLabel',
    'exitConfirmTitle', 'exitConfirmMessage',
    'nothingSelected', 'hotkeyWarning',
    'decrypting', 'corruptedDb', 'corruptedSettings',
    'darkTheme', 'lightTheme', 'autoLanguage',
    'restartHint', 'cannotUndo',
  ] as const;

  for (const key of requiredKeys) {
    it(`has required key: ${key}`, () => {
      expect(translations.en).toHaveProperty(key);
      expect(translations.uk).toHaveProperty(key);
      expect(translations.de).toHaveProperty(key);
    });
  }
});
