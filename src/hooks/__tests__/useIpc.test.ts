/**
 * Tests for src/hooks/useIpc.ts
 *
 * All Tauri IPC calls are intercepted via the global vi.mock set up in
 * src/test/setup.ts. Each test verifies that the thin wrapper:
 *   1. Calls `invoke` with the correct command name.
 *   2. Passes the correct argument payload.
 *   3. Returns / resolves with whatever `invoke` resolved with.
 *   4. Propagates rejections transparently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  searchSnippets,
  getSnippetById,
  createSnippet,
  activateSnippet,
  updateSnippet,
  deleteSnippet,
  getSettings,
  saveSettings,
  getPendingNotification,
  quitApp,
  cancelClose,
} from '../useIpc';
import type { SearchResult, SnippetView, Settings } from '../../types';

// The global mock declared in setup.ts turns `invoke` into a vi.fn().
const mockInvoke = invoke as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────

const makeSnippetView = (overrides: Partial<SnippetView> = {}): SnippetView => ({
  id: 1,
  title: 'My Snippet',
  content: 'some content',
  is_encrypted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 1,
  title: 'My Snippet',
  score: 0.9,
  matched_positions: [0, 1, 2],
  is_encrypted: false,
  ...overrides,
});

const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
  theme: 'dark',
  start_in_tray: false,
  autostart: false,
  confirm_on_close: true,
  language: 'en',
  window_state: { x: 100, y: 200, width: 400, height: 600 },
  ...overrides,
});

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── searchSnippets ────────────────────────────────────────────────────────

describe('searchSnippets', () => {
  it('calls invoke with "search_snippets" and the query argument', async () => {
    const results: SearchResult[] = [makeSearchResult()];
    mockInvoke.mockResolvedValueOnce(results);

    await searchSnippets('hello');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('search_snippets', { query: 'hello' });
  });

  it('returns the resolved array from invoke', async () => {
    const results: SearchResult[] = [
      makeSearchResult({ id: 1, title: 'Alpha', score: 0.95 }),
      makeSearchResult({ id: 2, title: 'Beta', score: 0.7 }),
    ];
    mockInvoke.mockResolvedValueOnce(results);

    const returned = await searchSnippets('a');

    expect(returned).toEqual(results);
  });

  it('returns an empty array when invoke resolves with []', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const returned = await searchSnippets('nomatch');

    expect(returned).toEqual([]);
  });

  it('propagates errors thrown by invoke', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('db error'));

    await expect(searchSnippets('fail')).rejects.toThrow('db error');
  });
});

// ── getSnippetById ────────────────────────────────────────────────────────

describe('getSnippetById', () => {
  it('calls invoke with "get_snippet_by_id" and the id argument', async () => {
    mockInvoke.mockResolvedValueOnce(makeSnippetView());

    await getSnippetById(42);

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('get_snippet_by_id', { id: 42 });
  });

  it('returns the SnippetView from invoke', async () => {
    const view = makeSnippetView({ id: 7, title: 'Special', is_encrypted: true, content: '' });
    mockInvoke.mockResolvedValueOnce(view);

    const returned = await getSnippetById(7);

    expect(returned).toEqual(view);
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('not found'));

    await expect(getSnippetById(999)).rejects.toThrow('not found');
  });
});

// ── createSnippet ─────────────────────────────────────────────────────────

describe('createSnippet', () => {
  it('calls invoke with "create_snippet" and title/content/password', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await createSnippet('Title', 'Content', '');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('create_snippet', {
      title: 'Title',
      content: 'Content',
      password: '',
    });
  });

  it('passes a non-empty password for encrypted snippets', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await createSnippet('Secret', 'TopSecret', 'mypassword');

    expect(mockInvoke).toHaveBeenCalledWith('create_snippet', {
      title: 'Secret',
      content: 'TopSecret',
      password: 'mypassword',
    });
  });

  it('resolves with undefined on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await createSnippet('T', 'C', '');

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('title empty'));

    await expect(createSnippet('', 'C', '')).rejects.toThrow('title empty');
  });
});

// ── activateSnippet ───────────────────────────────────────────────────────

describe('activateSnippet', () => {
  it('calls invoke with "activate_snippet" and id/password', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await activateSnippet(3, '');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('activate_snippet', { id: 3, password: '' });
  });

  it('passes the password for encrypted snippets', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await activateSnippet(5, 'secret');

    expect(mockInvoke).toHaveBeenCalledWith('activate_snippet', { id: 5, password: 'secret' });
  });

  it('resolves with undefined (plaintext is NEVER returned)', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await activateSnippet(1, '');

    expect(result).toBeUndefined();
  });

  it('propagates wrong-password errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('wrong password'));

    await expect(activateSnippet(1, 'bad')).rejects.toThrow('wrong password');
  });
});

// ── updateSnippet ─────────────────────────────────────────────────────────

describe('updateSnippet', () => {
  it('calls invoke with "update_snippet" and id/title/content', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await updateSnippet(10, 'New Title', 'New Content');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('update_snippet', {
      id: 10,
      title: 'New Title',
      content: 'New Content',
    });
  });

  it('resolves with undefined on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await updateSnippet(1, 'T', 'C');

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('snippet not found'));

    await expect(updateSnippet(999, 'T', 'C')).rejects.toThrow('snippet not found');
  });
});

// ── deleteSnippet ─────────────────────────────────────────────────────────

describe('deleteSnippet', () => {
  it('calls invoke with "delete_snippet" and the id', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await deleteSnippet(7);

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 7 });
  });

  it('resolves with undefined on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await deleteSnippet(1);

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('cannot delete'));

    await expect(deleteSnippet(0)).rejects.toThrow('cannot delete');
  });
});

// ── getSettings ───────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('calls invoke with "get_settings" and no extra arguments', async () => {
    mockInvoke.mockResolvedValueOnce(makeSettings());

    await getSettings();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('get_settings');
  });

  it('returns the Settings object from invoke', async () => {
    const settings = makeSettings({ theme: 'light', autostart: true });
    mockInvoke.mockResolvedValueOnce(settings);

    const returned = await getSettings();

    expect(returned).toEqual(settings);
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('file not found'));

    await expect(getSettings()).rejects.toThrow('file not found');
  });
});

// ── saveSettings ──────────────────────────────────────────────────────────

describe('saveSettings', () => {
  it('calls invoke with "save_settings" and the settings payload', async () => {
    const settings = makeSettings({ theme: 'light' });
    mockInvoke.mockResolvedValueOnce(undefined);

    await saveSettings(settings);

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('save_settings', { settings });
  });

  it('resolves with undefined on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await saveSettings(makeSettings());

    expect(result).toBeUndefined();
  });

  it('propagates errors on save failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('write error'));

    await expect(saveSettings(makeSettings())).rejects.toThrow('write error');
  });
});

// ── getPendingNotification ────────────────────────────────────────────────

describe('getPendingNotification', () => {
  it('calls invoke with "get_pending_notification" and no arguments', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    await getPendingNotification();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('get_pending_notification');
  });

  it('returns a string when there is a pending message', async () => {
    mockInvoke.mockResolvedValueOnce('Snippet copied!');

    const result = await getPendingNotification();

    expect(result).toBe('Snippet copied!');
  });

  it('returns null when there is no pending message', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    const result = await getPendingNotification();

    expect(result).toBeNull();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('state error'));

    await expect(getPendingNotification()).rejects.toThrow('state error');
  });
});

// ── quitApp ───────────────────────────────────────────────────────────────

describe('quitApp', () => {
  it('calls invoke with "quit_app" and no arguments', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await quitApp();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('quit_app');
  });

  it('resolves with undefined', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await quitApp();

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('quit failed'));

    await expect(quitApp()).rejects.toThrow('quit failed');
  });
});

// ── cancelClose ───────────────────────────────────────────────────────────

describe('cancelClose', () => {
  it('calls invoke with "cancel_close" and no arguments', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await cancelClose();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('cancel_close');
  });

  it('resolves with undefined', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await cancelClose();

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('cancel failed'));

    await expect(cancelClose()).rejects.toThrow('cancel failed');
  });
});
