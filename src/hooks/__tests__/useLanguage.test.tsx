import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { useLanguage } from '../useLanguage';

const mockSettings = {
  theme: 'dark',
  language: 'en',
  start_in_tray: false,
  autostart: false,
  confirm_on_close: true,
  window_state: { x: 0, y: 0, width: 680, height: 520 },
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LanguageProvider, null, children);

describe('useLanguage', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('t() returns correct translation for current language', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await act(async () => {});
    expect(result.current.t('copySuccess')).toBe('Copied');
  });

  it('setLanguage updates document.documentElement.lang', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await act(async () => {});
    await act(async () => {
      result.current.setLanguage('uk');
    });
    expect(document.documentElement.lang).toBe('uk');
  });

  it('switching language updates all t() calls without reload', async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings);
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await act(async () => {});
    expect(result.current.t('copySuccess')).toBe('Copied');
    await act(async () => {
      result.current.setLanguage('uk');
    });
    expect(result.current.t('copySuccess')).toBe('Скопійовано');
  });

  it('defaults to en for unknown language code', async () => {
    vi.mocked(invoke).mockResolvedValue({ ...mockSettings, language: 'fr' });
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await act(async () => {});
    expect(result.current.t('copySuccess')).toBe('Copied');
  });
});
