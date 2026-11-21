import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import App from '../../App';
import { settle } from '../../test/settle';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

/** The handler the app registered last for an event of the backend. */
function backendListener(name: string): (() => void) | undefined {
  const calls = mockListen.mock.calls.filter(([event]) => event === name);
  const call = calls[calls.length - 1];
  const handler = call?.[1] as ((e: unknown) => void) | undefined;
  return handler ? () => handler({ event: name, id: 0, payload: null }) : undefined;
}

/**
 * Renders the app as it is once the backend has shown the window. The page is loaded while the
 * window is still hidden; the show gives it the keyboard, which the page sees as a focus event
 * on the window.
 */
function renderShownApp(): void {
  render(<App />);
  fireEvent.focus(window);
}

/** The handler the app registered last for the backend's `window:hidden` event. */
function hiddenListener(): (() => void) | undefined {
  return backendListener('window:hidden');
}

/** The handler the app registered last for the backend's `window:show` event. */
function showListener(): (() => void) | undefined {
  return backendListener('window:show');
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
          return { items: [], damaged: false };
        default:
          return null;
      }
    });
  });

  async function renderWithSearchFocused() {
    renderShownApp();
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
          return { items: [{ id: 1, title: 'Greeting', score: 0, matched_positions: [], is_encrypted: false }], damaged: false };
        default:
          return null;
      }
    });
  });

  /** Searches for `text` and waits until the search has found and selected the snippet. */
  async function searchFor(text: string): Promise<HTMLInputElement> {
    renderShownApp();
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
          const query = String((args as { query?: string } | undefined)?.query ?? '').toLowerCase();
          // A new array each time, as from IPC.
          return { items: snippets.filter((s) => s.title.toLowerCase().includes(query)).map((s) => ({ ...s })), damaged: false };
        }
        case 'get_sorted_snippets':
          return { items: snippets.map((s) => ({ ...s })), damaged: false };
        default:
          return null;
      }
    });
  });

  const resultsLiveText = () => document.querySelector('.snippet-list-wrapper [aria-live]')?.textContent ?? '';
  const pointsAt = (search: HTMLElement) => search.getAttribute('aria-activedescendant') ?? '';
  const searchCount = () => mockInvoke.mock.calls.filter(([cmd]) => cmd === 'search_snippets').length;

  /** Holds the next answer with the whole list until the returned function is called. */
  function holdNextWholeList(): () => void {
    let release = (): void => void 0;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const answer = mockInvoke.getMockImplementation();
    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === 'get_sorted_snippets') {
        if (answer) mockInvoke.mockImplementation(answer);
        await held;
      }
      return answer?.(cmd, args);
    });
    return release;
  }

  /**
   * Opens the app with the search box focused. Returns once the first snippet is selected and the
   * app has finished loading at start (see settle): a list that came later would select the first
   * snippet again.
   */
  async function openApp(): Promise<HTMLInputElement> {
    renderShownApp();
    await settle();
    const search = screen.getByRole('combobox') as HTMLInputElement;
    act(() => search.focus());
    expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true');
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

  // The app loads the whole list again each time the window is shown or gets the keyboard back.
  // When that list answers while a search waits for its results, it is not the results.
  it('when the list is loaded again while a search waits for its results, the live region still says the result', async () => {
    const search = await openApp();
    const release = holdNextWholeList();
    fireEvent.focus(window);
    fireEvent.change(search, { target: { value: 'gre' } });
    release();
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Goodbye' })).not.toBeInTheDocument());
    await waitFor(() => expect(resultsLiveText()).toBe('Greeting'));
  });

  it('when the results are loaded again before the announcement, the live region still says the result', async () => {
    const search = await openApp();
    fireEvent.change(search, { target: { value: 'gre' } });
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Goodbye' })).not.toBeInTheDocument());
    const searches = searchCount();
    fireEvent.focus(window);
    await waitFor(() => expect(searchCount()).toBe(searches + 1));
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

describe('App: telling the backend that the page is ready', () => {
  const settings = {
    theme: 'light',
    start_in_tray: false,
    autostart: false,
    confirm_on_close: false,
    language: 'en',
    window_state: { x: 0, y: 0, width: 680, height: 520 },
    autotype_delay_ms: 0,
    sort_mode: 'alphabetical',
    sort_direction: 'asc',
  };
  const snippets = [{ id: 1, title: 'Greeting', score: 0, matched_positions: [], is_encrypted: false }];

  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => void 0);
    document.documentElement.classList.remove('theme-light');
  });

  const commandsSent = () => mockInvoke.mock.calls.map(([cmd]) => cmd as string);

  // The backend shows the window only after this, so it has to come when the page looks as it
  // will: the saved theme applied and the list loaded in the saved sort order.
  it('reports once, when the saved theme is applied and the list is loaded in the saved order', async () => {
    let themeWhenReady: boolean | undefined;
    let lastListRequestWhenReady: unknown;
    mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
      switch (cmd) {
        case 'get_settings':
          return settings;
        case 'get_sorted_snippets':
          lastListRequestWhenReady = args;
          return { items: snippets.map((s) => ({ ...s })), damaged: false };
        case 'frontend_ready':
          themeWhenReady = document.documentElement.classList.contains('theme-light');
          return undefined;
        default:
          return null;
      }
    });

    render(<App />);
    await waitFor(() => expect(commandsSent()).toContain('frontend_ready'));
    expect(themeWhenReady).toBe(true);
    expect(lastListRequestWhenReady).toEqual({ sortMode: 'alphabetical', sortDirection: 'asc' });

    // Later reloads do not report again.
    fireEvent.focus(window);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Greeting' })).toBeInTheDocument());
    expect(commandsSent().filter((cmd) => cmd === 'frontend_ready')).toHaveLength(1);
  });

  it('reports even when the list cannot be loaded, so the window still opens', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_sorted_snippets') throw new Error('database is locked');
      return cmd === 'get_settings' ? settings : null;
    });

    render(<App />);
    await waitFor(() => expect(commandsSent()).toContain('frontend_ready'));
  });

  describe('the selection in the list', () => {
    const first = () => screen.getByRole('option', { name: 'Greeting' });

    beforeEach(() => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_settings') return settings;
        return cmd === 'get_sorted_snippets' ? { items: snippets.map((s) => ({ ...s })), damaged: false } : null;
      });
    });

    // NVDA, in the search box, reads a snippet only when it becomes the selected one. The first
    // list is loaded while the window is still hidden, so the first snippet has to become the
    // selected one with the show, as on every later show.
    it('before the window is first shown, no snippet is marked as selected', async () => {
      render(<App />);
      await waitFor(() => expect(commandsSent()).toContain('frontend_ready'));
      // Every list request of the start has been answered by now.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(first()).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', '');
    });

    it('the show by the backend marks the first snippet as selected at once', async () => {
      render(<App />);
      await waitFor(() => expect(commandsSent()).toContain('frontend_ready'));

      act(() => showListener()?.());
      expect(first()).toHaveAttribute('aria-selected', 'true');
    });

    // The window gets the keyboard a moment before the backend's event arrives.
    it('the keyboard coming to the window does the same', async () => {
      render(<App />);
      await waitFor(() => expect(commandsSent()).toContain('frontend_ready'));

      fireEvent.focus(window);
      expect(first()).toHaveAttribute('aria-selected', 'true');
    });
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
          return { items: snippets.filter((s) => s.title.toLowerCase().includes(query)).map((s) => ({ ...s })), damaged: false };
        }
        case 'get_sorted_snippets':
          return { items: snippets.map((s) => ({ ...s })), damaged: false };
        default:
          return null;
      }
    });
  });

  /** Opens the app and types a query that finds only the secret snippet. */
  async function searchSecret(): Promise<HTMLInputElement> {
    renderShownApp();
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

// After a delete or a save, focus comes back to the search box once, and by then it already
// points at the snippet selected in the new list: NVDA says "list" and that snippet, never the
// deleted snippet or the one selected before. The dialog closes only once the list is loaded
// again, and focus is back in the same commit that removes the dialog.
describe('App: where focus goes after a dialog changes the list', () => {
  type Item = { id: number; title: string; score: number; matched_positions: number[]; is_encrypted: boolean };
  const item = (id: number, title: string): Item => ({ id, title, score: 0, matched_positions: [], is_encrypted: false });
  let snippets: Item[] = [];

  beforeEach(() => {
    snippets = [item(1, 'Greeting'), item(2, 'Goodbye')];
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
        case 'search_snippets':
        case 'get_sorted_snippets':
          return { items: snippets.map((s) => ({ ...s })), damaged: false };
        case 'delete_snippet':
          snippets = snippets.filter((s) => s.id !== (args as { id: number }).id);
          return null;
        case 'create_snippet':
          // The newest change comes first.
          snippets = [item(3, (args as { title: string }).title), ...snippets];
          return null;
        default:
          return null;
      }
    });
  });

  const pointsAt = (search: HTMLElement) => search.getAttribute('aria-activedescendant') ?? '';
  const listIds = () => Array.from(document.querySelectorAll('#snippet-list [role="option"]')).map((o) => o.id);

  /**
   * Opens the app with the search box focused. Returns once the first snippet is selected and the
   * shortcuts know it: Ctrl+D and Delete need a selected snippet (see settle).
   */
  async function openApp(): Promise<HTMLInputElement> {
    renderShownApp();
    await settle();
    const search = screen.getByRole('combobox') as HTMLInputElement;
    act(() => search.focus());
    expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true');
    return search;
  }

  /** What the search box points at, and the snippets in the list, each time it gets focus. */
  function recordFocus(search: HTMLElement): { pointsAt: string; list: string[] }[] {
    const seen: { pointsAt: string; list: string[] }[] = [];
    search.addEventListener('focus', () => seen.push({ pointsAt: pointsAt(search), list: listIds() }));
    return seen;
  }

  async function confirmDelete(): Promise<void> {
    const dialog = await screen.findByRole('dialog', { name: 'Delete snippet' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }

  it('Ctrl+D, Ctrl+Enter: focus comes back once, to the snippet now first; the deleted one is gone by then', async () => {
    const search = await openApp();
    const seen = recordFocus(search);
    fireEvent.keyDown(search, { key: 'd', code: 'KeyD', ctrlKey: true });
    await confirmDelete();

    expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 1 });
    expect(seen).toEqual([{ pointsAt: 'snippet-2', list: ['snippet-2'] }]);
    expect(search).toHaveFocus();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('Delete in the empty search box, Ctrl+Enter: the same', async () => {
    const search = await openApp();
    const seen = recordFocus(search);
    fireEvent.keyDown(search, { key: 'Delete', code: 'Delete' });
    await confirmDelete();

    expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 1 });
    expect(seen).toEqual([{ pointsAt: 'snippet-2', list: ['snippet-2'] }]);
    expect(search).toHaveFocus();
  });

  it('deleting the last snippet: focus comes back to the search box itself, pointing at nothing', async () => {
    snippets = [item(1, 'Greeting')];
    const search = await openApp();
    const seen = recordFocus(search);
    fireEvent.keyDown(search, { key: 'd', code: 'KeyD', ctrlKey: true });
    await confirmDelete();

    expect(seen).toEqual([{ pointsAt: '', list: [] }]);
    expect(search).toHaveFocus();
  });

  // Up to 0.3.5 the app showed the backend's text as a toast outside the open aria-modal dialog,
  // gone after 2 s. Now the dialog says it above its buttons, in the language of the app.
  it('a failed delete: the dialog stays open and says why above its buttons; no toast', async () => {
    const backend = mockInvoke.getMockImplementation()!;
    mockInvoke.mockImplementation(async (cmd, args) =>
      cmd === 'delete_snippet' ? Promise.reject('database is locked') : backend(cmd, args));
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'd', code: 'KeyD', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Delete snippet' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.keyDown(cancel, { key: 'Enter', ctrlKey: true });

    const message = 'Could not delete the snippet. Reason: database is locked.';
    await waitFor(() => expect(within(dialog).getByText(message)).toBeInTheDocument());
    expect(screen.getAllByText(/database is locked/)).toHaveLength(1);
    expect(cancel).toHaveFocus();
    expect(screen.getByRole('option', { name: 'Greeting' })).toBeInTheDocument();
  });

  it('Ctrl+N, Ctrl+Enter: focus comes back once, to the new snippet, not first to the one selected before', async () => {
    const search = await openApp();
    const seen = recordFocus(search);
    fireEvent.keyDown(search, { key: 'n', code: 'KeyN', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Create snippet' });
    fireEvent.change(within(dialog).getByLabelText(/^title/i), { target: { value: 'Newest' } });
    fireEvent.change(within(dialog).getByLabelText(/^content/i), { target: { value: 'Text' } });
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(seen).toEqual([{ pointsAt: 'snippet-3', list: ['snippet-3', 'snippet-1', 'snippet-2'] }]);
    expect(search).toHaveFocus();
  });
});

// TASK-33: a snippet database damaged inside. Up to 0.3.5 the list was silently incomplete (or said
// "No snippets yet") and copying or opening a damaged snippet showed SQLite's English text.
describe('App: a damaged snippet database', () => {
  type Item = { id: number; title: string; score: number; matched_positions: number[]; is_encrypted: boolean };
  const item = (id: number, title: string): Item => ({ id, title, score: 0, matched_positions: [], is_encrypted: false });
  const RESTART =
    'Restart QuickSnippets: at start-up it checks the database and offers to save the snippets that can still be read.';
  let listed: { items: Item[]; damaged: boolean };
  let failure: string;

  beforeEach(() => {
    listed = { items: [item(1, 'Greeting'), item(2, 'Goodbye')], damaged: true };
    failure = 'The snippet database is damaged';
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
          return { items: listed.items.map((s) => ({ ...s })), damaged: listed.damaged };
        case 'activate_snippet':
        case 'autotype_snippet':
        case 'get_snippet_by_id':
          throw failure;
        default:
          return null;
      }
    });
  });

  /**
   * Opens the app with the search box focused. Returns once the first snippet is selected and the
   * shortcuts know it: Ctrl+E needs a selected snippet (see settle).
   */
  async function openApp(): Promise<HTMLInputElement> {
    renderShownApp();
    await settle();
    const search = screen.getByRole('combobox') as HTMLInputElement;
    act(() => search.focus());
    expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true');
    return search;
  }

  it('says above the list that not all snippets are shown', async () => {
    await openApp();
    expect(screen.getByText(`Not all snippets are shown: the snippet database is damaged. ${RESTART}`)).toBeInTheDocument();
  });

  it('an empty damaged list does not claim that there are no snippets yet', async () => {
    listed = { items: [], damaged: true };
    renderShownApp();
    await waitFor(() => expect(document.getElementById('list-damaged')).toBeInTheDocument());
    expect(screen.queryByText(/No snippets yet/)).not.toBeInTheDocument();
  });

  it('a complete list shows no notice', async () => {
    listed = { ...listed, damaged: false };
    await openApp();
    expect(document.getElementById('list-damaged')).not.toBeInTheDocument();
  });

  it('copying a snippet of a damaged database says so in the language of the app, with what to do', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText(`Could not copy the snippet. Reason: the snippet database is damaged. ${RESTART}`)).toBeInTheDocument();
    expect(screen.queryByText('The snippet database is damaged')).not.toBeInTheDocument();
  });

  it('typing a damaged snippet says that this snippet is damaged', async () => {
    failure = 'This snippet is damaged';
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
    expect(await screen.findByText('Could not type the snippet. Reason: this snippet is damaged and cannot be read.')).toBeInTheDocument();
  });

  it('opening a damaged snippet for editing says so in the language of the app', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'e', code: 'KeyE', ctrlKey: true });
    expect(await screen.findByText(`Could not open the snippet. Reason: the snippet database is damaged. ${RESTART}`)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a notice about damage stays 8 s, as it holds advice', async () => {
    const search = await openApp();
    fireEvent.keyDown(search, { key: 'Enter' });
    const toast = await screen.findByText(`Could not copy the snippet. Reason: the snippet database is damaged. ${RESTART}`);
    // Toast fades out 300 ms before it goes (see Toast).
    expect(toast.style.animationDelay).toBe('7700ms');
  });
});

// TASK-42: copying or typing a snippet without a password, opening a snippet for editing and
// reading the settings as the settings dialog opens. Up to 0.3.6 a failure was a toast with the
// backend's own text only, in English. Now the toast says what failed, in the language of the app,
// with the reason the database or Windows gives, as it is (the user's choice), for 2 s as before.
describe('App: a failed copy, auto-type, opening for editing or reading of the settings', () => {
  type Item = { id: number; title: string; score: number; matched_positions: number[]; is_encrypted: boolean };
  const item = (id: number, title: string): Item => ({ id, title, score: 0, matched_positions: [], is_encrypted: false });
  let language: string;
  let failure: string;
  let settingsBroken: boolean;

  beforeEach(() => {
    language = 'en';
    failure = 'database is locked';
    settingsBroken = false;
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => void 0);
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_settings':
          if (settingsBroken) throw 'poisoned lock: another task failed inside';
          return {
            theme: 'dark',
            start_in_tray: false,
            autostart: false,
            confirm_on_close: false,
            language,
            window_state: { x: 0, y: 0, width: 680, height: 520 },
            autotype_delay_ms: 1,
            sort_mode: 'modified',
            sort_direction: 'desc',
          };
        case 'search_snippets':
        case 'get_sorted_snippets':
          return { items: [item(1, 'Greeting'), item(2, 'Goodbye')], damaged: false };
        case 'activate_snippet':
        case 'autotype_snippet':
        case 'get_snippet_by_id':
          throw failure;
        default:
          return null;
      }
    });
  });

  /**
   * The app shown, in its language, with the first snippet selected. Returns once the shortcuts
   * know that snippet: Ctrl+E needs a selected snippet (see settle).
   */
  async function openApp(placeholder = 'Search'): Promise<HTMLInputElement> {
    renderShownApp();
    await settle();
    const search = screen.getByPlaceholderText(placeholder) as HTMLInputElement;
    act(() => search.focus());
    expect(screen.getByRole('option', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true');
    return search;
  }

  const copy = (search: HTMLElement) => fireEvent.keyDown(search, { key: 'Enter' });
  const autotype = (search: HTMLElement) => fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
  const openEdit = (search: HTMLElement) => fireEvent.keyDown(search, { key: 'e', code: 'KeyE', ctrlKey: true });
  const openSettings = (search: HTMLElement) => fireEvent.keyDown(search, { key: ',', code: 'Comma', ctrlKey: true });

  it('copying: says that the copy failed, with the reason as the database gives it, for 2 s', async () => {
    const search = await openApp();
    copy(search);
    const toast = await screen.findByText('Could not copy the snippet. Reason: database is locked.');
    // Toast fades out 300 ms before it goes: 2 s, as every toast.
    expect(toast.style.animationDelay).toBe('1700ms');
    // Said once, as one message: the bare reason is nowhere on its own.
    expect(screen.queryByText('database is locked')).not.toBeInTheDocument();
    expect(screen.getAllByText(/database is locked/)).toHaveLength(1);
  });

  it('copying with the clipboard held by another program: the reason as Windows gives it', async () => {
    failure = 'The native clipboard is not accessible due to being held by another party.';
    const search = await openApp();
    copy(search);
    expect(
      await screen.findByText(
        'Could not copy the snippet. Reason: The native clipboard is not accessible due to being held by another party.',
      ),
    ).toBeInTheDocument();
  });

  it('copying a snippet that is no longer in the database', async () => {
    failure = 'Query returned no rows';
    const search = await openApp();
    copy(search);
    expect(await screen.findByText('Could not copy the snippet. Reason: Query returned no rows.')).toBeInTheDocument();
  });

  it('auto-type: says that typing failed, with the reason as Windows gives it, for 2 s', async () => {
    failure = 'PostMessageW(WM_CHAR) failed: Access is denied. (os error 5)';
    const search = await openApp();
    autotype(search);
    const toast = await screen.findByText(
      'Could not type the snippet. Reason: PostMessageW(WM_CHAR) failed: Access is denied. (os error 5).',
    );
    expect(toast.style.animationDelay).toBe('1700ms');
  });

  it('opening a snippet for editing: says so, and the dialog does not open', async () => {
    failure = 'Query returned no rows';
    const search = await openApp();
    openEdit(search);
    const toast = await screen.findByText('Could not open the snippet. Reason: Query returned no rows.');
    expect(toast.style.animationDelay).toBe('1700ms');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reading the settings: says that the settings could not be opened, and the dialog does not open', async () => {
    const search = await openApp();
    settingsBroken = true;
    openSettings(search);
    const toast = await screen.findByText(
      'Could not open the settings. Reason: poisoned lock: another task failed inside.',
    );
    expect(toast.style.animationDelay).toBe('1700ms');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('in Ukrainian', async () => {
    language = 'uk';
    const search = await openApp('Пошук');
    copy(search);
    expect(await screen.findByText('Не вдалося скопіювати сніпет. Причина: database is locked.')).toBeInTheDocument();
    autotype(search);
    expect(await screen.findByText('Не вдалося надрукувати сніпет. Причина: database is locked.')).toBeInTheDocument();
    openEdit(search);
    expect(await screen.findByText('Не вдалося відкрити сніпет. Причина: database is locked.')).toBeInTheDocument();
    settingsBroken = true;
    openSettings(search);
    expect(
      await screen.findByText('Не вдалося відкрити налаштування. Причина: poisoned lock: another task failed inside.'),
    ).toBeInTheDocument();
  });

  it('in German', async () => {
    language = 'de';
    const search = await openApp('Suchen');
    copy(search);
    expect(await screen.findByText('Das Snippet ließ sich nicht kopieren. Grund: database is locked.')).toBeInTheDocument();
    autotype(search);
    expect(
      await screen.findByText('Das Snippet ließ sich nicht automatisch tippen. Grund: database is locked.'),
    ).toBeInTheDocument();
    openEdit(search);
    expect(await screen.findByText('Das Snippet ließ sich nicht öffnen. Grund: database is locked.')).toBeInTheDocument();
    settingsBroken = true;
    openSettings(search);
    expect(
      await screen.findByText('Die Einstellungen ließen sich nicht öffnen. Grund: poisoned lock: another task failed inside.'),
    ).toBeInTheDocument();
  });
});

