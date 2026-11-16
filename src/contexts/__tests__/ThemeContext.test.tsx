import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ThemeProvider, null, children);

const mockSettings = (theme: string) => ({
  theme,
  language: 'en',
  start_in_tray: false,
  autostart: false,
  confirm_on_close: true,
  window_state: { x: 0, y: 0, width: 680, height: 520 },
});

const fullSettings = (theme: string) => ({
  theme,
  language: 'uk',
  start_in_tray: true,
  autostart: true,
  confirm_on_close: false,
  window_state: { x: 120, y: 80, width: 700, height: 540 },
  autotype_delay_ms: 30,
  sort_mode: 'alphabetical',
  sort_direction: 'asc',
});

/** Mocks get_settings from an in-memory store that save_settings updates. */
function mockSettingsStore(initial: ReturnType<typeof fullSettings>) {
  let stored = { ...initial };
  vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd === 'get_settings') return { ...stored };
    if (cmd === 'save_settings') {
      stored = (args as { settings: typeof stored }).settings;
      return undefined;
    }
    return undefined;
  });
  return () => stored;
}

const saveCalls = () =>
  vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'save_settings');

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    document.documentElement.className = '';
  });

  it('dark theme: no theme-light class on html', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings('dark'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(result.current.theme).toBe('dark');
  });

  it('light theme: theme-light class added to html', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings('light'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme switches between dark and light', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings('dark'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    expect(result.current.theme).toBe('dark');
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });

  it('theme persists in context after toggle', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings('light'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });

  it('toggleTheme saves the new theme and keeps every other setting', async () => {
    const initial = fullSettings('dark');
    const stored = mockSettingsStore(initial);
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(saveCalls()).toHaveLength(1);
    expect(stored()).toEqual({ ...initial, theme: 'light' });
  });

  it('two quick toggles save the final theme', async () => {
    const initial = fullSettings('dark');
    const stored = mockSettingsStore(initial);
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.toggleTheme();
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(saveCalls()).toHaveLength(2);
    expect(stored()).toEqual(initial);
  });

  it('setTheme applies the theme without saving it', async () => {
    mockSettingsStore(fullSettings('dark'));
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(saveCalls()).toHaveLength(0);
  });
});
