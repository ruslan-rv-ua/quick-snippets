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

  it('Enter key calls quit_app', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.keyDown(document, { key: 'Enter' });
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
