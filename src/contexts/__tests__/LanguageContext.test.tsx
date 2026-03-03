import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, render, act, screen } from '@testing-library/react';
import React, { useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LanguageContext, LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../i18n/translations';

// ── Helpers ───────────────────────────────────────────────────────────────

const makeSettings = (language: string) => ({
  theme: 'dark',
  language,
  start_in_tray: false,
  autostart: false,
  confirm_on_close: true,
  window_state: { x: 0, y: 0, width: 680, height: 520 },
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LanguageProvider, null, children);

// ── Tests ─────────────────────────────────────────────────────────────────

describe('LanguageContext', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    document.documentElement.lang = '';
  });

  // 1. Provider renders children correctly
  it('renders children without crashing', () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    render(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement('span', { 'data-testid': 'child' }, 'hello'),
      ),
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByTestId('child').textContent).toBe('hello');
  });

  // 2. Default language is 'en' before settings load
  it('provides default language "en" before settings load', () => {
    // Never resolves during this synchronous check
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    expect(result.current.language).toBe('en');
  });

  // 3. Language loads from settings
  it('loads language from settings on mount', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('uk'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.language).toBe('uk');
  });

  // 4. setLanguage updates context value
  it('setLanguage updates the language in context', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.language).toBe('en');
    await act(async () => {
      result.current.setLanguage('uk');
    });
    expect(result.current.language).toBe('uk');
  });

  // 5. setLanguage updates document.documentElement.lang
  it('setLanguage updates document.documentElement.lang', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.setLanguage('de');
    });
    expect(document.documentElement.lang).toBe('de');
  });

  // 6. Loading settings sets document.documentElement.lang
  it('sets document.documentElement.lang from loaded settings', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('uk'));
    renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(document.documentElement.lang).toBe('uk');
  });

  // 7. t() returns correct static translation for loaded language
  it('t() returns correct translation for english', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.t('copySuccess')).toBe(translations.en.copySuccess);
  });

  it('t() returns correct translation after switching to ukrainian', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.setLanguage('uk');
    });
    expect(result.current.t('copySuccess')).toBe(translations.uk.copySuccess);
  });

  it('t() returns correct translation after switching to german', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.setLanguage('de');
    });
    expect(result.current.t('copySuccess')).toBe(translations.de.copySuccess);
  });

  // 8. tf is the full translation map for the current language
  it('tf is the full translation map for the active language', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('uk'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.tf).toEqual(translations.uk);
  });

  // 9. tf updates when language changes
  it('tf updates when language is changed', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.tf).toEqual(translations.en);
    await act(async () => {
      result.current.setLanguage('uk');
    });
    expect(result.current.tf).toEqual(translations.uk);
  });

  // 10. Multiple consumers see the same context value
  it('multiple consumers receive the same context value', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('en'));
    const { result: r1 } = renderHook(() => useContext(LanguageContext), { wrapper });
    const { result: r2 } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    // Both wrappers are independent, but each should resolve to the same language
    expect(r1.current.language).toBe(r2.current.language);
    expect(r1.current.tf).toEqual(r2.current.tf);
  });

  // 11. Multiple consumers within the same provider see consistent values
  it('two hooks inside the same provider share context', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('uk'));

    function useDouble() {
      const ctx1 = useContext(LanguageContext);
      const ctx2 = useContext(LanguageContext);
      return { ctx1, ctx2 };
    }

    const { result } = renderHook(() => useDouble(), { wrapper });
    await act(async () => {});
    expect(result.current.ctx1.language).toBe('uk');
    expect(result.current.ctx2.language).toBe('uk');
    // Same reference (memoised value object)
    expect(result.current.ctx1).toBe(result.current.ctx2);
  });

  // 12. Unknown language code falls back to 'en'
  it('falls back to "en" for unknown language code from settings', async () => {
    vi.mocked(invoke).mockResolvedValue(makeSettings('fr'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.language).toBe('en');
  });

  // 13. Error in getSettings is handled gracefully (stays on default 'en')
  it('stays on default "en" if getSettings throws', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('IPC error'));
    const { result } = renderHook(() => useContext(LanguageContext), { wrapper });
    await act(async () => {});
    expect(result.current.language).toBe('en');
  });

  // 14. Using context outside provider returns default values (no throw)
  it('using context outside provider returns default language "en"', () => {
    // No wrapper — uses the createContext default value
    const { result } = renderHook(() => useContext(LanguageContext));
    expect(result.current.language).toBe('en');
    expect(result.current.t('copySuccess')).toBe('copySuccess'); // default t returns key
  });
});
