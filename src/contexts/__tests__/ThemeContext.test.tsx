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
});
