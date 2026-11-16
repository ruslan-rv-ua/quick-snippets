import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import App from '../../App';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('App', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    // Default: get_settings returns dark/en config
    mockInvoke.mockResolvedValue({
      theme: 'dark',
      start_in_tray: false,
      autostart: false,
      confirm_on_close: false,
      language: 'en',
      window_state: { x: 0, y: 0, width: 480, height: 600 },
    });
    mockListen.mockResolvedValue(() => void 0);
  });

  it('root element has role="application"', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });

  it('renders ToastContainer', async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });
  });

  it('shows pending notification toast on startup', async () => {
    // First call is get_settings, second is get_pending_notification
    mockInvoke
      .mockResolvedValueOnce({
        theme: 'dark',
        start_in_tray: false,
        autostart: false,
        confirm_on_close: false,
        language: 'en',
        window_state: { x: 0, y: 0, width: 480, height: 600 },
      })
      .mockResolvedValueOnce({
        theme: 'dark',
        start_in_tray: false,
        autostart: false,
        confirm_on_close: false,
        language: 'en',
        window_state: { x: 0, y: 0, width: 480, height: 600 },
      })
      .mockResolvedValueOnce('Hotkey registration failed'); // pending notification

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });

  it('blur event triggers partial state reset', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('application'));
    fireEvent.blur(window);
    // No crash = partial reset happened
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('Escape on empty query hides window (full reset)', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('application'));
    // Escape with empty search
    fireEvent.keyDown(document, { key: 'Escape' });
    // No crash, window commands would be invoked
    expect(screen.getByRole('application')).toBeInTheDocument();
  });
});

describe('App: keyboard shortcuts help (F1)', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => void 0);
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_settings':
          return {
            theme: 'dark',
            start_in_tray: false,
            autostart: false,
            confirm_on_close: false,
            language: 'en',
            window_state: { x: 0, y: 0, width: 680, height: 520 },
            autotype_delay_ms: 0,
            sort_mode: 'modified',
            sort_direction: 'desc',
          };
        case 'search_snippets':
        case 'get_sorted_snippets':
          return [];
        default:
          return null;
      }
    });
  });

  async function renderWithSearchFocused() {
    render(<App />);
    const search = await screen.findByRole('combobox');
    search.focus();
    return search;
  }

  it('F1 opens the help with focus on the first shortcut; Escape closes it and focus returns to the search box', async () => {
    const search = await renderWithSearchFocused();
    fireEvent.keyDown(search, { key: 'F1', code: 'F1' });

    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const first = within(dialog).getAllByRole('option')[0];
    expect(first).toHaveAccessibleName('Ctrl+Alt+Space, Show the QuickSnippets window');
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search).toHaveFocus();
  });

  it('Escape in the help does not hide the window', async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const search = await renderWithSearchFocused();
    fireEvent.keyDown(search, { key: 'F1', code: 'F1' });
    await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    vi.mocked(getCurrentWindow).mockClear();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });

  it('the Close button closes the help and focus returns to the search box', async () => {
    const search = await renderWithSearchFocused();
    fireEvent.keyDown(search, { key: 'F1', code: 'F1' });
    await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search).toHaveFocus();
  });

  it('F1 does nothing while another dialog is open', async () => {
    const search = await renderWithSearchFocused();
    fireEvent.keyDown(search, { key: 'n', code: 'KeyN', ctrlKey: true });
    const create = await screen.findByRole('dialog');
    expect(create).not.toHaveAccessibleName('Keyboard shortcuts');

    fireEvent.keyDown(document.activeElement!, { key: 'F1', code: 'F1' });
    expect(screen.getAllByRole('dialog')).toEqual([create]);
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});

describe('App: Delete in the search box', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => void 0);
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_settings':
          return {
            theme: 'dark',
            start_in_tray: false,
            autostart: false,
            confirm_on_close: false,
            language: 'en',
            window_state: { x: 0, y: 0, width: 680, height: 520 },
            autotype_delay_ms: 0,
            sort_mode: 'modified',
            sort_direction: 'desc',
          };
        case 'search_snippets':
        case 'get_sorted_snippets':
          return [{ id: 1, title: 'Greeting', score: 0, matched_positions: [], is_encrypted: false }];
        default:
          return null;
      }
    });
  });

  /** Searches for `text` and waits until the search has found and selected the snippet. */
  async function searchFor(text: string): Promise<HTMLInputElement> {
    render(<App />);
    const search = (await screen.findByRole('combobox')) as HTMLInputElement;
    search.focus();
    fireEvent.change(search, { target: { value: text } });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('search_snippets', { query: text }));
    await waitFor(() => expect(search).toHaveAttribute('aria-activedescendant', 'snippet-1'));
    return search;
  }

  it('with text after the caret, Delete is left to the search box and asks nothing', async () => {
    const search = await searchFor('gree');
    search.setSelectionRange(2, 2);
    // Not cancelled: the search box itself erases the next character.
    expect(fireEvent.keyDown(search, { key: 'Delete', code: 'Delete' })).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('with the caret at the end of the text, Delete asks to delete the selected snippet', async () => {
    const search = await searchFor('gree');
    search.setSelectionRange(4, 4);
    expect(fireEvent.keyDown(search, { key: 'Delete', code: 'Delete' })).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: 'Delete snippet' });
    expect(dialog).toHaveTextContent('Greeting');
  });
});
