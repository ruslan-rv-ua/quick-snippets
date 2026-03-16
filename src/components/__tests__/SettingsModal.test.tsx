import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React, { act } from 'react';
import { SettingsModal } from '../SettingsModal';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import type { Settings } from '../../types';

const mockInvoke = vi.mocked(invoke);

const defaultSettings: Settings = {
  theme: 'dark',
  start_in_tray: false,
  autostart: false,
  confirm_on_close: true,
  language: 'en',
  window_state: { x: 0, y: 0, width: 480, height: 600 },
};

function renderModal(overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  mockInvoke.mockResolvedValue(defaultSettings);
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <SettingsModal
          isOpen={true}
          onClose={vi.fn()}
          {...overrides}
        />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('shows "..." loading state with aria-busy="true"', async () => {
    let resolveSetting!: (v: Settings) => void;
    let settingPromise: Promise<Settings> | null = null;
    mockInvoke.mockImplementation(() => {
      settingPromise = new Promise<Settings>((r) => { resolveSetting = r; });
      return settingPromise;
    });
    render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      resolveSetting(defaultSettings);
      if (settingPromise) await settingPromise;
    });
  });

  it('loads settings from get_settings IPC on open', async () => {
    mockInvoke.mockResolvedValue(defaultSettings);
    render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_settings');
    });
  });

  it('theme toggle buttons have role="group"', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole('group')).toBeInTheDocument();
    });
  });

  it('active theme button has aria-pressed="true"', async () => {
    renderModal();
    await waitFor(() => {
      const pressed = screen.getAllByRole('button').find(
        (b) => b.getAttribute('aria-pressed') === 'true',
      );
      expect(pressed).toBeDefined();
    });
  });

  it('inactive theme button has aria-pressed="false"', async () => {
    renderModal();
    await waitFor(() => {
      const notPressed = screen.getAllByRole('button').find(
        (b) => b.getAttribute('aria-pressed') === 'false',
      );
      expect(notPressed).toBeDefined();
    });
  });

  it('language select has Auto/English/Українська options', async () => {
    renderModal();
    await waitFor(() => {
      const sel = screen.getByRole('combobox') as HTMLSelectElement;
      const opts = Array.from(sel.options).map((o) => o.text);
      expect(opts).toContain('Auto (system)');
      expect(opts.some((o) => /english/i.test(o))).toBe(true);
      expect(opts.some((o) => /українська/i.test(o))).toBe(true);
    });
  });

  it('renders start_in_tray checkbox', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/tray|трей/i)).toBeInTheDocument();
    });
  });

  it('renders autostart checkbox', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/autostart|windows/i)).toBeInTheDocument();
    });
  });

  it('renders confirm_on_close checkbox', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/confirm.*clos|підтверджувати/i)).toBeInTheDocument();
    });
  });

  it('shows restart hint text', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/restart|перезапуску/i)).toBeInTheDocument();
    });
  });

  it('Save button disabled during save operation (double-click protection)', async () => {
    mockInvoke.mockResolvedValueOnce(defaultSettings);
    // make save hang 
    mockInvoke.mockReturnValue(new Promise<void>(() => { /* never resolves */ }));

    render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save|зберегти/i })).not.toBeDisabled();
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save|зберегти/i })).toBeDisabled();
    });
  });

  it('Escape closes without saving', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await waitFor(() => screen.getByRole('combobox'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('displays app version in footer', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/QuickSnippets version \d+\.\d+\.\d+/)).toBeInTheDocument();
    });
  });

  it('calls save_settings IPC on save', async () => {
    mockInvoke.mockResolvedValue(defaultSettings);
    render(
      <ThemeProvider>
        <LanguageProvider>
          <SettingsModal isOpen={true} onClose={vi.fn()} />
        </LanguageProvider>
      </ThemeProvider>,
    );
    await waitFor(() => screen.getByRole('combobox'));
    mockInvoke.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.anything());
    });
  });
});
