import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { translations, type TranslationMap } from '../i18n/translations';
import type { LangCode } from '../types';
import { getSettings } from '../hooks/useIpc';

// ── Types ─────────────────────────────────────────────────────────────────

/** Keys of TranslationMap whose values are plain strings (not functions). */
type StaticKey = {
  [K in keyof TranslationMap]: TranslationMap[K] extends string ? K : never;
}[keyof TranslationMap];

interface LanguageContextValue {
  language: LangCode;
  setLanguage: (lang: LangCode) => void;
  /** Lookup a static (non-parametrized) translation string. */
  t: (key: StaticKey) => string;
  /** Full translation map — use for parametrized strings. */
  tf: TranslationMap;
}

// ── Context ───────────────────────────────────────────────────────────────

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => void 0,
  t: (key) => key as string,
  tf: translations.en,
});

// ── Helper ────────────────────────────────────────────────────────────────

function resolveLanguage(raw: string): LangCode {
  if (raw === 'en' || raw === 'uk') return raw;
  // Auto-detect from browser locale
  const browserLang = navigator.language.slice(0, 2);
  if (browserLang === 'uk') return 'uk';
  return 'en';
}

// ── Provider ──────────────────────────────────────────────────────────────

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [language, setLanguageState] = useState<LangCode>('en');

  // Load persisted language on mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        const lang = resolveLanguage(s.language);
        setLanguageState(lang);
        document.documentElement.lang = lang;
      })
      .catch(() => {
        // Fall back to 'en' on error — already the default
      });
  }, []);

  const setLanguage = useCallback((lang: LangCode) => {
    setLanguageState(lang);
    document.documentElement.lang = lang;
  }, []);

  const tf = useMemo(() => translations[language], [language]);

  const t = useCallback(
    (key: StaticKey): string => tf[key] as string,
    [tf],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, tf }),
    [language, setLanguage, t, tf],
  );

  return React.createElement(LanguageContext.Provider, { value }, children);
}
