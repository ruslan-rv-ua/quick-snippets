import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import App from '../../App';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

/** The handler the app registered last for the backend's `window:hidden` event. */
function hiddenListener(): (() => void) | undefined {
  const calls = mockListen.mock.calls.filter(([event]) => event === 'window:hidden');
  const call = calls[calls.length - 1];
  const handler = call?.[1] as ((e: unknown) => void) | undefined;
  return handler ? () => handler({ event: 'window:hidden', id: 0, payload: null }) : undefined;
}

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

  describe('the delayed initial focus after the window content loads', () => {
    /**
     * Holds back the 60 ms initial-focus timer that useWindowEvents starts on mount, so a test
     * can run it at a chosen moment. Returns a function that runs the held timer.
     */
    function holdInitialFocusTimer(): { restore: () => void; run: () => void } {
      const realSetTimeout = globalThis.setTimeout;
      let held: (() => void) | undefined;
      const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
        fn: (...args: unknown[]) => void,
        ms?: number,
        ...args: unknown[]
      ) => {
        if (ms === 60 && !held) {
          held = () => fn(...args);
          return 0;
        }
        return realSetTimeout(fn, ms, ...args);
      }) as unknown as typeof setTimeout);
      return {
        restore: () => spy.mockRestore(),
        run: () => {
          expect(held).toBeDefined();
          act(() => held?.());
        },
      };
    }

    async function renderHoldingInitialFocus() {
      const timer = holdInitialFocusTimer();
      try {
        render(<App />);
        const search = await screen.findByRole('combobox');
        return { search, runInitialFocus: timer.run };
      } finally {
        timer.restore();
      }
    }

    it('moves focus to the search box when no dialog is open', async () => {
      const { search, runInitialFocus } = await renderHoldingInitialFocus();
      expect(search).not.toHaveFocus();
      runInitialFocus();
      expect(search).toHaveFocus();
    });

    it('does not take focus from the help opened with F1 before it runs', async () => {
      const { runInitialFocus } = await renderHoldingInitialFocus();
      fireEvent.keyDown(document.body, { key: 'F1', code: 'F1' });
      const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
      const first = within(dialog).getAllByRole('option')[0];
      expect(first).toHaveFocus();

      runInitialFocus();
      expect(first).toHaveFocus();
    });

    it('does not take focus from the new snippet dialog opened with Ctrl+N before it runs', async () => {
      const { search, runInitialFocus } = await renderHoldingInitialFocus();
      fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN', ctrlKey: true });
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
      const focused = document.activeElement;

      runInitialFocus();
      expect(document.activeElement).toBe(focused);
      expect(search).not.toHaveFocus();
    });
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
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true'));
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

// Screen readers are either on the selected snippet (the search box points at it with
// aria-activedescendant) or in the search box, where NVDA reads caret movement and erasing.
describe('App: where the screen reader is', () => {
  const snippets = [
    { id: 1, title: 'Greeting', score: 0, matched_positions: [], is_encrypted: false },
    { id: 2, title: 'Goodbye', score: 0, matched_positions: [], is_encrypted: false },
  ];

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
          // A new array each time, as from IPC.
          return snippets.map((s) => ({ ...s }));
        default:
          return null;
      }
    });
  });

  const resultsLiveText = () => document.querySelector('.snippet-list-wrapper [aria-live]')?.textContent ?? '';
  const pointsAt = (search: HTMLElement) => search.getAttribute('aria-activedescendant') ?? '';

  /** Opens the app with the search box focused and waits until the first snippet is selected. */
  async function openApp(): Promise<HTMLInputElement> {
    render(<App />);
    const search = (await screen.findByRole('combobox')) as HTMLInputElement;
    search.focus();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true'));
    return search;
  }

  // NVDA reads the newly selected option of the list the search box controls by itself, so
  // the live region stays silent.
  it('when the window opens, it is in the search box with the first snippet selected', async () => {
    const search = await openApp();
    expect(pointsAt(search)).toBe('');
    expect(resultsLiveText()).toBe('');
  });

  it('Down moves it onto the selected snippet; Left brings it back, and the snippet stays selected', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    await waitFor(() => expect(pointsAt(search)).toBe('snippet-2'));

    expect(fireEvent.keyDown(search, { key: 'ArrowLeft' })).toBe(true);
    await waitFor(() => expect(pointsAt(search)).toBe(''));
    expect(screen.getByRole('option', { name: 'Goodbye' })).toHaveAttribute('aria-selected', 'true');
  });

  it('after typing on the list, it is back in the search box; Enter copies the selected snippet', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    await waitFor(() => expect(pointsAt(search)).toBe('snippet-2'));

    fireEvent.change(search, { target: { value: 'g' } });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('search_snippets', { query: 'g' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true'));
    expect(pointsAt(search)).toBe('');
    // A newly selected snippet: NVDA reads it itself.
    expect(resultsLiveText()).toBe('');

    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('activate_snippet', { id: 1, password: '' }));
  });

  it('when a search keeps the same snippet selected, the live region says it', async () => {
    const search = await openApp();
    fireEvent.change(search, { target: { value: 'g' } });
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('search_snippets', { query: 'g' }));
    expect(pointsAt(search)).toBe('');
    await waitFor(() => expect(resultsLiveText()).toBe('Greeting'));
  });

  it('coming back from a dialog, it is on the selected snippet', async () => {
    const search = await openApp();
    expect(pointsAt(search)).toBe('');
    fireEvent.keyDown(search, { key: 'n', code: 'KeyN', ctrlKey: true });
    const dialog = await screen.findByRole('dialog');
    // Set only after focus has left the search box, so it is not announced on the way.
    await waitFor(() => expect(search).not.toHaveFocus());
    await waitFor(() => expect(pointsAt(search)).toBe('snippet-1'));

    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search).toHaveFocus();
    expect(pointsAt(search)).toBe('snippet-1');
  });

  it('a sort shortcut moves it onto the first snippet; Ctrl+F brings it back to the search box', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(pointsAt(search)).toBe('snippet-1'));

    fireEvent.keyDown(search, { key: 'f', code: 'KeyF', ctrlKey: true });
    await waitFor(() => expect(pointsAt(search)).toBe(''));
  });

  it('when the window is shown again, it is back in the search box', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    await waitFor(() => expect(pointsAt(search)).toBe('snippet-2'));

    // The backend hides the window after the user left it, then shows it again.
    act(() => hiddenListener()?.());
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true'));
    expect(pointsAt(search)).toBe('');
  });
});

describe('App: the keyboard moves inside the window, or the window hides', () => {
  const snippets = [
    { id: 1, title: 'Greeting', score: 0, matched_positions: [], is_encrypted: false },
    { id: 2, title: 'Secret', score: 0, matched_positions: [], is_encrypted: true },
  ];

  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => void 0);
    mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
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
        case 'search_snippets': {
          const query = (args as { query: string }).query.toLowerCase();
          return snippets.filter((s) => s.title.toLowerCase().includes(query)).map((s) => ({ ...s }));
        }
        case 'get_sorted_snippets':
          return snippets.map((s) => ({ ...s }));
        default:
          return null;
      }
    });
  });

  /** Opens the app and types a query that finds only the secret snippet. */
  async function searchSecret(): Promise<HTMLInputElement> {
    render(<App />);
    const search = (await screen.findByRole('combobox')) as HTMLInputElement;
    search.focus();
    fireEvent.change(search, { target: { value: 'sec' } });
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Greeting' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('option', { name: /Secret/ })).toHaveAttribute('aria-selected', 'true'));
    return search;
  }

  async function openPasswordDialog(search: HTMLInputElement): Promise<HTMLInputElement> {
    fireEvent.keyDown(search, { key: 'Enter' });
    await screen.findByRole('dialog');
    const input = document.getElementById('pwd-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'typed' } });
    return input;
  }

  it('a blur alone keeps the query and the selection', async () => {
    const search = await searchSecret();
    fireEvent.blur(window);
    fireEvent.focus(window);
    await new Promise((r) => setTimeout(r, 150));
    expect(search.value).toBe('sec');
    expect(screen.queryByRole('option', { name: 'Greeting' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Secret/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('a blur alone keeps the password dialog and what was typed in it', async () => {
    const search = await searchSecret();
    const input = await openPasswordDialog(search);
    fireEvent.blur(window);
    fireEvent.focus(window);
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(input.value).toBe('typed');
    expect(search.value).toBe('sec');
  });

  it('when the window hides, the query is cleared and the whole list is back', async () => {
    const search = await searchSecret();
    act(() => hiddenListener()?.());
    await waitFor(() => expect(search.value).toBe(''));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toBeInTheDocument());
  });

  it('when the window hides, the password dialog closes', async () => {
    const search = await searchSecret();
    await openPasswordDialog(search);
    act(() => hiddenListener()?.());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search.value).toBe('');
  });
});
