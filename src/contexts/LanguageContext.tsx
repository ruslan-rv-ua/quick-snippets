import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { translations, type TranslationMap } from '../i18n/translations';
import type { LangCode } from '../types';
import { getSettings, getSystemLanguage } from '../hooks/useIpc';

// ── Types ─────────────────────────────────────────────────────────────────

/** Keys of TranslationMap whose values are plain strings (not functions). */
type StaticKey = {
  [K in keyof TranslationMap]: TranslationMap[K] extends string ? K : never;
}[keyof TranslationMap];

interface LanguageContextValue {
  language: LangCode;
  setLanguage: (lang: LangCode) => void;
  /** The language "Same as Windows" stands for (asked from the backend). */
  systemLanguage: LangCode;
  /** Lookup a static (non-parametrized) translation string. */
  t: (key: StaticKey) => string;
  /** Full translation map — use for parametrized strings. */
  tf: TranslationMap;
}

// ── Context ───────────────────────────────────────────────────────────────

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => void 0,
  systemLanguage: 'en',
  t: (key) => key as string,
  tf: translations.en,
});

// ── Helper ────────────────────────────────────────────────────────────────

function isLangCode(value: unknown): value is LangCode {
  return value === 'en' || value === 'uk' || value === 'de';
}

/**
 * Turns the saved language setting into the language to show. An empty or
 * unknown value means "Same as Windows": `systemLanguage` is used, which the
 * backend detects with the same function it uses for the tray menu.
 */
export function resolveLanguage(raw: string, systemLanguage: LangCode): LangCode {
  return isLangCode(raw) ? raw : systemLanguage;
}

// ── Provider ──────────────────────────────────────────────────────────────

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [language, setLanguageState] = useState<LangCode>('en');
  const [systemLanguage, setSystemLanguage] = useState<LangCode>('en');

  // Load persisted language on mount
  useEffect(() => {
    (async () => {
      // Asked at once, so the dialog can show "Same as Windows" correctly
      // later. If it fails, English is used, as the tray menu does.
      const systemPromise = Promise.resolve()
        .then(getSystemLanguage)
        .then((code): LangCode => (isLangCode(code) ? code : 'en'))
        .catch((): LangCode => 'en');
      try {
        const [s, system] = await Promise.all([
          Promise.resolve(getSettings()),
          systemPromise,
        ]);
        setSystemLanguage(system);
        if (s && typeof s.language === 'string') {
          const lang = resolveLanguage(s.language, system);
          setLanguageState(lang);
          document.documentElement.lang = lang;
        }
      } catch {
        // Fall back to 'en' on error — already the default
      }
    })();
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
    () => ({ language, setLanguage, systemLanguage, t, tf }),
    [language, setLanguage, systemLanguage, t, tf],
  );

  return React.createElement(LanguageContext.Provider, { value }, children);
}
