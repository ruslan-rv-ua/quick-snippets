import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSettings, updateSettings } from '../hooks/useIpc';

// ── Types ─────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  /** Switches the theme and saves it (the Ctrl+Shift+T shortcut). */
  toggleTheme: () => void;
  /**
   * Shows the given theme without saving it. Used by the settings dialog,
   * which saves the theme only when the user presses Save.
   */
  setTheme: (theme: Theme) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const LIGHT_CLASS = 'theme-light';

function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.classList.add(LIGHT_CLASS);
  } else {
    document.documentElement.classList.remove(LIGHT_CLASS);
  }
}

function parseTheme(raw: string): Theme {
  return raw === 'light' ? 'light' : 'dark';
}

// ── Context ───────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => void 0,
  setTheme: () => void 0,
});

// ── Provider ──────────────────────────────────────────────────────────────

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [theme, setThemeState] = useState<Theme>('dark');

  // Load persisted theme on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await Promise.resolve(getSettings());
        if (s && typeof s.theme === 'string') {
          const t = parseTheme(s.theme);
          setThemeState(t);
          applyTheme(t);
        }
      } catch {
        // Fall back to dark on error — already the default
      }
    })();
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains(LIGHT_CLASS)
      ? 'dark'
      : 'light';
    setTheme(next);
    // Keep the choice after a restart; only the theme field changes.
    updateSettings({ theme: next }).catch(() => void 0);
  }, [setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
