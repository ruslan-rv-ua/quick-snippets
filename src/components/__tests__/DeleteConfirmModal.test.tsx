import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { LanguageProvider } from '../../contexts/LanguageContext';

const mockInvoke = vi.mocked(invoke);

function renderModal(overrides: Partial<React.ComponentProps<typeof DeleteConfirmModal>> = {}) {
  return render(
    <LanguageProvider>
      <DeleteConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        snippetTitle="My Test Snippet"
        snippetId={42}
        onSuccess={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('DeleteConfirmModal', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('shows snippet title in "quotes"', () => {
    renderModal();
    expect(screen.getByText(/My Test Snippet/)).toBeInTheDocument();
  });

  it('shows "cannot undo" warning', () => {
    renderModal();
    expect(screen.getByText(/cannot be undone|неможливо скасувати/i)).toBeInTheDocument();
  });

  it('focuses Cancel button on open (NOT Delete)', () => {
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: /cancel|скасувати/i });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('Enter key does NOT trigger delete', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_snippet', expect.anything());
  });

  it('clicking Delete button calls delete_snippet IPC', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /delete|видалити/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 42 });
    });
  });

  it('Escape closes without deleting', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_snippet', expect.anything());
  });

  it('Cancel button closes without deleting', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel|скасувати/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_snippet', expect.anything());
  });

  it('shows "deleted" toast on successful deletion', async () => {
    const onSuccess = vi.fn();
    mockInvoke.mockResolvedValue(undefined);
    renderModal({ onSuccess });
    fireEvent.click(screen.getByRole('button', { name: /delete|видалити/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
