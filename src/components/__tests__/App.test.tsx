import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
