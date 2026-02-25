import { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';

/**
 * Returns the current language helpers from LanguageContext.
 *
 * - `language`    — active LangCode ('en' | 'uk')
 * - `setLanguage` — switch language + update `document.documentElement.lang`
 * - `t(key)`      — look up a static translation string
 * - `tf`          — full TranslationMap (use for parametrized strings)
 */
export function useLanguage() {
  return useContext(LanguageContext);
}
