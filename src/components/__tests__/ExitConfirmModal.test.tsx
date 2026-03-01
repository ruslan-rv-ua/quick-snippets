import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { ExitConfirmModal } from '../ExitConfirmModal';
import { LanguageProvider } from '../../contexts/LanguageContext';

const mockInvoke = vi.mocked(invoke);

function renderModal(overrides: Partial<React.ComponentProps<typeof ExitConfirmModal>> = {}) {
  return render(
    <LanguageProvider>
      <ExitConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('ExitConfirmModal', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('shows exit confirmation message', () => {
    renderModal();
    // Use heading role to distinguish title from the "Quit" button
    expect(screen.getByRole('heading', { name: /quit|вийти/i })).toBeInTheDocument();
  });

  it('focuses Cancel button on open', () => {
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: /cancel|скасувати/i });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('Enter key calls quit_app when Cancel is NOT focused', async () => {
    mockInvoke.mockResolvedValue(undefined);
    // Render with isOpen=false so the cancel button is never auto-focused
    const { rerender } = render(
      <LanguageProvider>
        <ExitConfirmModal isOpen={false} onClose={vi.fn()} />
      </LanguageProvider>,
    );
    // Open modal but don't wait for the focus timeout — activeElement stays elsewhere
    rerender(
      <LanguageProvider>
        <ExitConfirmModal isOpen={true} onClose={vi.fn()} />
      </LanguageProvider>,
    );
    // Blur cancel so it's definitely not active
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document, { key: 'Enter' });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('quit_app');
    });
  });

  it('Enter key does NOT call quit_app when Cancel button is focused', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: /cancel|скасувати/i });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
    fireEvent.keyDown(document, { key: 'Enter' });
    // Allow any async IPC calls to settle
    await new Promise((r) => setTimeout(r, 20));
    expect(mockInvoke).not.toHaveBeenCalledWith('quit_app');
  });

  it('Ctrl+Enter calls quit_app even when Cancel button IS focused', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: /cancel|скасувати/i });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('quit_app');
    });
  });

  it('Escape closes modal without hiding window', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel button closes modal without hiding window', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel|скасувати/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Quit button calls quit_app IPC', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^quit|^вийти/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('quit_app');
    });
  });
});
