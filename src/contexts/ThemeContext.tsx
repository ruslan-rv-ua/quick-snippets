import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSettings } from '../hooks/useIpc';

// ── Types ─────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
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
    getSettings()
      .then((s) => {
        const t = parseTheme(s.theme);
        setThemeState(t);
        applyTheme(t);
      })
      .catch(() => {
        // Fall back to dark on error — already the default
      });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
