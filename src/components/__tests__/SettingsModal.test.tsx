import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { act } from 'react';
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
  window_state: { x: 120, y: 80, width: 700, height: 540 },
  autotype_delay_ms: 1,
  sort_mode: 'alphabetical',
  sort_direction: 'asc',
};

/**
 * A backend in memory: get_settings returns the stored settings and
 * save_settings replaces them. Returns every saved settings object.
 */
function mockBackend(initial: Partial<Settings> = {}): Settings[] {
  let stored: Settings = { ...defaultSettings, ...initial };
  const saved: Settings[] = [];
  mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
    if (cmd === 'get_settings') return { ...stored };
    if (cmd === 'save_settings') {
      stored = (args as { settings: Settings }).settings;
      saved.push(stored);
      return undefined;
    }
    return undefined;
  });
  return saved;
}

function Harness({
  open,
  onClose,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onError?: (msg: string) => void;
}) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SettingsModal isOpen={open} onClose={onClose} onError={onError} />
      </LanguageProvider>
    </ThemeProvider>
  );
}

/**
 * Renders the app's providers, lets them load the saved theme and language
 * (as at app start), then opens the dialog, like Ctrl+, does.
 */
async function openSettings(initial: Partial<Settings> = {}) {
  const saved = mockBackend(initial);
  const onClose = vi.fn();
  const onError = vi.fn();
  const utils = render(<Harness open={false} onClose={onClose} onError={onError} />);
  await act(async () => {});
  utils.rerender(<Harness open={true} onClose={onClose} onError={onError} />);
  const dialog = await screen.findByRole('dialog');
  return { ...utils, dialog, saved, onClose, onError };
}

const isLight = () => document.documentElement.classList.contains('theme-light');

describe('SettingsModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    document.documentElement.classList.remove('theme-light');
    document.documentElement.lang = '';
  });

  // ── Opening ─────────────────────────────────────────────────────────────

  it('shows nothing until the settings are loaded, then the dialog', async () => {
    const pending: Array<(s: Settings) => void> = [];
    mockInvoke.mockImplementation(() => new Promise<Settings>((r) => { pending.push(r); }));
    render(<Harness open={true} onClose={vi.fn()} />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => { pending.forEach((resolve) => resolve(defaultSettings)); });
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('puts the focus on the theme list when it opens', async () => {
    await openSettings();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Theme' }));
  });

  it('is described by the app version, so screen readers read it after the title', async () => {
    const { dialog } = await openSettings();
    expect(dialog).toHaveAccessibleDescription('QuickSnippets version 0.1.2');
  });

  it('has no description when the version is unknown', async () => {
    vi.mocked(getVersion).mockRejectedValueOnce(new Error('no version'));
    const { dialog } = await openSettings();
    expect(dialog).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(/QuickSnippets version/)).toBeNull();
  });

  it('reports a load error and closes', async () => {
    mockInvoke.mockRejectedValue('settings are broken');
    const onClose = vi.fn();
    const onError = vi.fn();
    render(<Harness open={true} onClose={onClose} onError={onError} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onError).toHaveBeenCalledWith('settings are broken');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── Structure ───────────────────────────────────────────────────────────

  it('has three named groups in order', async () => {
    await openSettings();
    const names = screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);
    expect(names).toEqual(['Appearance and language', 'Startup and closing', 'Auto-type']);
  });

  it('puts each control in its group, with its label and role', async () => {
    await openSettings();
    const appearance = screen.getByRole('group', { name: 'Appearance and language' });
    expect(within(appearance).getByRole('combobox', { name: 'Theme' })).toBeInTheDocument();
    expect(within(appearance).getByRole('combobox', { name: 'Language' })).toBeInTheDocument();

    const startup = screen.getByRole('group', { name: 'Startup and closing' });
    expect(within(startup).getByRole('checkbox', { name: 'Start with Windows' })).toBeInTheDocument();
    expect(within(startup).getByRole('checkbox', { name: 'Start minimized to the tray' })).toBeInTheDocument();
    expect(within(startup).getByRole('checkbox', { name: 'Ask before closing the app' })).toBeInTheDocument();

    const autotype = screen.getByRole('group', { name: 'Auto-type' });
    expect(within(autotype).getByRole('spinbutton', { name: 'Delay between characters, ms' })).toBeInTheDocument();
  });

  it('lists the controls in Tab order: groups top to bottom, then Cancel and Save', async () => {
    const { dialog } = await openSettings();
    const order = Array.from(
      dialog.querySelectorAll<HTMLElement>('select, input, button'),
    ).map((el) => el.id);
    expect(order).toEqual([
      'settings-theme',
      'settings-lang',
      'settings-autostart',
      'settings-tray',
      'settings-confirm',
      'settings-autotype-delay',
      'settings-cancel',
      'settings-save',
    ]);
    expect(dialog.querySelector('[tabindex]:not([tabindex="-1"])')).toBeNull();
  });

  it('links each hint to its setting, so it is read with the setting', async () => {
    await openSettings();
    expect(screen.getByRole('checkbox', { name: 'Start with Windows' }))
      .toHaveAccessibleDescription('Takes effect the next time you sign in to Windows.');
    expect(screen.getByRole('checkbox', { name: 'Start minimized to the tray' }))
      .toHaveAccessibleDescription('Takes effect at the next start. Open the window with Ctrl+Alt+Space.');
    expect(screen.getByRole('checkbox', { name: 'Ask before closing the app' }))
      .toHaveAccessibleDescription("Applies to Alt+F4 and the window's close button.");
    expect(screen.getByRole('spinbutton', { name: 'Delay between characters, ms' }))
      .toHaveAccessibleDescription('0 is the fastest. If characters go missing, try 10–50.');
    expect(screen.getByRole('combobox', { name: 'Theme' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('combobox', { name: 'Language' })).not.toHaveAttribute('aria-describedby');
  });

  it('no longer shows a general restart hint', async () => {
    await openSettings();
    expect(screen.queryByText(/after restart/i)).toBeNull();
  });

  it('shows the saved values', async () => {
    await openSettings({
      theme: 'light',
      language: 'de',
      autostart: true,
      start_in_tray: true,
      confirm_on_close: false,
      autotype_delay_ms: 30,
    });
    // The dialog is in German now: the saved language is German.
    expect(screen.getByRole('combobox', { name: 'Design' })).toHaveValue('light');
    expect(screen.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de');
    expect(screen.getByRole('checkbox', { name: 'Mit Windows starten' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Minimiert im Infobereich starten' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vor dem Beenden nachfragen' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Verzögerung zwischen Zeichen, ms' })).toHaveValue(30);
  });

  it('labels the language options, with "Same as Windows" first', async () => {
    await openSettings();
    const list = screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement;
    expect(Array.from(list.options).map((o) => [o.value, o.text])).toEqual([
      ['', 'Same as Windows'],
      ['en', 'English'],
      ['uk', 'Українська'],
      ['de', 'Deutsch'],
    ]);
  });

  it('shows "Same as Windows" when the saved language is empty', async () => {
    await openSettings({ language: '' });
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('');
  });

  // ── Preview ─────────────────────────────────────────────────────────────

  it('shows a theme chosen in the list at once, without saving it', async () => {
    const { saved } = await openSettings();
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'light' } });
    expect(isLight()).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('shows a language chosen in the list at once, without saving it', async () => {
    const { saved } = await openSettings();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'uk' } });
    expect(screen.getByRole('dialog', { name: 'Налаштування' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uk');
    expect(saved).toHaveLength(0);
  });

  it('"Same as Windows" shows the Windows language and keeps the dialog working', async () => {
    // jsdom reports the browser language as en-US.
    await openSettings({ language: 'uk' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Мова' }), { target: { value: '' } });
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('');
    expect(document.documentElement.lang).toBe('en');
  });

  // ── Cancel ──────────────────────────────────────────────────────────────

  async function changeEverything() {
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'light' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start with Windows' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Delay between characters, ms' }), { target: { value: '40' } });
    // Last: the labels turn German.
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'de' } });
    expect(isLight()).toBe(true);
    expect(document.documentElement.lang).toBe('de');
  }

  it('Cancel brings back the theme and language from before and saves nothing', async () => {
    const { saved, onClose } = await openSettings();
    await changeEverything();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(isLight()).toBe(false);
    expect(document.documentElement.lang).toBe('en');
    expect(saved).toHaveLength(0);
  });

  it('Escape brings back the theme and language from before and saves nothing', async () => {
    const { saved, onClose } = await openSettings();
    await changeEverything();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(isLight()).toBe(false);
    expect(document.documentElement.lang).toBe('en');
    expect(saved).toHaveLength(0);
  });

  it('a click outside the dialog cancels like Escape', async () => {
    const { container, saved, onClose } = await openSettings();
    await changeEverything();
    fireEvent.click(container.ownerDocument.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(isLight()).toBe(false);
    expect(document.documentElement.lang).toBe('en');
    expect(saved).toHaveLength(0);
  });

  it('Cancel restores a light theme and a German interface too', async () => {
    await openSettings({ theme: 'light', language: 'de' });
    expect(isLight()).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Design' }), { target: { value: 'dark' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sprache' }), { target: { value: 'uk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(isLight()).toBe(true);
    expect(document.documentElement.lang).toBe('de');
  });

  it('opening again shows the saved values, not the cancelled ones', async () => {
    const { rerender, onClose } = await openSettings();
    await changeEverything();
    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(<Harness open={false} onClose={onClose} />);
    rerender(<Harness open={true} onClose={onClose} />);
    await screen.findByRole('dialog');
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('dark');
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
    expect(screen.getByRole('checkbox', { name: 'Start with Windows' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Delay between characters, ms' })).toHaveValue(1);
  });

  // ── Save ────────────────────────────────────────────────────────────────

  it('Save writes the dialog fields and keeps the other settings', async () => {
    const { saved, onClose } = await openSettings();
    await changeEverything();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Minimiert im Infobereich starten' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vor dem Beenden nachfragen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved).toEqual([
      {
        ...defaultSettings,
        theme: 'light',
        language: 'de',
        autostart: true,
        start_in_tray: true,
        confirm_on_close: false,
        autotype_delay_ms: 40,
      },
    ]);
    // What was shown stays: it is now saved.
    expect(isLight()).toBe(true);
    expect(document.documentElement.lang).toBe('de');
  });

  it('Save keeps "Same as Windows" as an empty language', async () => {
    const { saved } = await openSettings({ language: 'uk' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Мова' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].language).toBe('');
  });

  it('Save keeps "Same as Windows" when nothing was changed', async () => {
    const { saved } = await openSettings({ language: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toEqual({ ...defaultSettings, language: '' });
  });

  it('Ctrl+Enter saves from any control', async () => {
    const { saved, onClose } = await openSettings();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ask before closing the app' }));
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved[0].confirm_on_close).toBe(false);
  });

  it('marks Save as unavailable while saving and saves once', async () => {
    const { onClose } = await openSettings();
    let finish!: () => void;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') return { ...defaultSettings };
      if (cmd === 'save_settings') return new Promise<void>((r) => { finish = r; });
      return undefined;
    });
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'));
    // Still focusable, so focus stays in the dialog.
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await act(async () => { finish(); });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'save_settings')).toHaveLength(1);
  });

  it('ignores Escape while saving, so what is shown matches what is saved', async () => {
    const { onClose } = await openSettings();
    let finish!: () => void;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') return { ...defaultSettings };
      if (cmd === 'save_settings') return new Promise<void>((r) => { finish = r; });
      return undefined;
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), { target: { value: 'light' } });
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(isLight()).toBe(true);
    await act(async () => { finish(); });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(isLight()).toBe(true);
  });

  it('reports a save error and stays open', async () => {
    const { onClose, onError } = await openSettings();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_settings') return { ...defaultSettings };
      if (cmd === 'save_settings') throw 'disk is full';
      return undefined;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('disk is full'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-disabled');
  });

  it('keeps the delay between 0 and 1000', async () => {
    await openSettings();
    const delay = screen.getByRole('spinbutton', { name: 'Delay between characters, ms' });
    fireEvent.change(delay, { target: { value: '5000' } });
    expect(delay).toHaveValue(1000);
    fireEvent.change(delay, { target: { value: '-3' } });
    expect(delay).toHaveValue(0);
    fireEvent.change(delay, { target: { value: '12.7' } });
    expect(delay).toHaveValue(12);
  });
});
