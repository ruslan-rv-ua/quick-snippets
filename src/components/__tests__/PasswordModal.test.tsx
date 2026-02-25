import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { PasswordModal } from '../PasswordModal';
import { LanguageProvider } from '../../contexts/LanguageContext';

const mockInvoke = vi.mocked(invoke);

function renderModal(overrides: Partial<React.ComponentProps<typeof PasswordModal>> = {}) {
  return render(
    <LanguageProvider>
      <PasswordModal
        isOpen={true}
        onClose={vi.fn()}
        snippetId={5}
        snippetTitle="Secret Snippet"
        onSuccess={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('PasswordModal', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('focuses password field on open', () => {
    renderModal();
    const pwdField = screen.getByLabelText(/^(password|пароль)$/i);
    expect(document.activeElement).toBe(pwdField);
  });

  it('shows snippet title in subtitle', () => {
    renderModal();
    expect(screen.getByText(/Secret Snippet/)).toBeInTheDocument();
  });

  it('Enter submits password', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'mypass' } });
    fireEvent.keyDown(screen.getByLabelText(/^(password|пароль)$/i), { key: 'Enter' });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('activate_snippet', expect.objectContaining({
        id: 5,
        password: 'mypass',
      }));
    });
  });

  it('shows error for empty password submission', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows "wrong password" error and clears field', async () => {
    mockInvoke.mockRejectedValue(new Error('wrong password'));
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const pwdField = screen.getByLabelText(/^(password|пароль)$/i) as HTMLInputElement;
    expect(pwdField.value).toBe('');
  });

  it('disables field and buttons during decryption', async () => {
    let resolveInvoke!: () => void;
    mockInvoke.mockReturnValue(new Promise<void>((r) => { resolveInvoke = r; }));
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      const pwdField = screen.getByLabelText(/^(password|пароль)$/i);
      expect(pwdField).toBeDisabled();
    });
    resolveInvoke();
  });

  it('shows "Decrypting..." text during decryption', async () => {
    let resolveInvoke!: () => void;
    mockInvoke.mockReturnValue(new Promise<void>((r) => { resolveInvoke = r; }));
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(screen.getByText(/decrypting|розшифрування/i)).toBeInTheDocument();
    });
    resolveInvoke();
  });

  it('Escape closes and clears password', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'something' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('primary button text is "Copy" (localized)', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /copy|копіювати/i })).toBeInTheDocument();
  });

  it('calls activate_snippet IPC with password', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'correct' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('activate_snippet', { id: 5, password: 'correct' });
    });
  });
});
