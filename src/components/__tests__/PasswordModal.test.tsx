import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React, { act } from 'react';
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

  // The error region must exist before the error: screen readers announce text changes
  // in an existing live region, while a newly inserted role="alert" was read by NVDA
  // as just "alert" without its text (the app root has role="application").
  it('has an empty assertive live region for errors before any error', () => {
    renderModal();
    const region = document.getElementById('pwd-error');
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region).not.toHaveAttribute('role', 'alert');
  });

  it('shows error for empty password submission and refocuses field', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(document.getElementById('pwd-error')).toHaveTextContent(/enter password|введіть пароль/i);
      expect(document.activeElement).toBe(screen.getByLabelText(/^(password|пароль)$/i));
    });
  });

  it('shows "wrong password" error in the same live region, clears and refocuses field', async () => {
    mockInvoke.mockRejectedValue(new Error('wrong password'));
    renderModal();
    const regionBefore = document.getElementById('pwd-error');
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(document.getElementById('pwd-error')).toHaveTextContent(/wrong password|невірний пароль/i);
      expect(document.activeElement).toBe(screen.getByLabelText(/^(password|пароль)$/i));
    });
    expect(document.getElementById('pwd-error')).toBe(regionBefore);
    const pwdField = screen.getByLabelText(/^(password|пароль)$/i) as HTMLInputElement;
    expect(pwdField.value).toBe('');
    expect(pwdField).toHaveAttribute('aria-invalid', 'true');
    // The live region announces the message. Pointing the focused field at it as well
    // made NVDA say it twice (live region + description change).
    expect(pwdField).not.toHaveAttribute('aria-describedby');
  });

  // A disabled field drops focus: NVDA said "unavailable" and re-read the whole dialog.
  it('keeps the field and buttons focusable during decryption', async () => {
    let resolveInvoke!: () => void;
    let invokePromise: Promise<void> | null = null;
    mockInvoke.mockImplementation(() => {
      invokePromise = new Promise<void>((r) => { resolveInvoke = r; });
      return invokePromise;
    });
    renderModal();
    const pwdField = screen.getByLabelText(/^(password|пароль)$/i);
    const copyBtn = screen.getByRole('button', { name: /copy|копіювати/i });
    fireEvent.change(pwdField, { target: { value: 'mypass' } });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(copyBtn).toHaveAttribute('aria-disabled', 'true');
    });
    expect(pwdField).not.toBeDisabled();
    expect(document.activeElement).toBe(pwdField);
    expect(copyBtn).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel|скасувати/i })).not.toBeDisabled();
    await act(async () => {
      resolveInvoke();
      if (invokePromise) await invokePromise;
    });
  });

  it('ignores another submit while decryption is running', async () => {
    let resolveInvoke!: () => void;
    let invokePromise: Promise<void> | null = null;
    mockInvoke.mockImplementation(() => {
      invokePromise = new Promise<void>((r) => { resolveInvoke = r; });
      return invokePromise;
    });
    renderModal();
    const pwdField = screen.getByLabelText(/^(password|пароль)$/i);
    fireEvent.change(pwdField, { target: { value: 'mypass' } });
    fireEvent.keyDown(pwdField, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy|копіювати/i })).toHaveAttribute('aria-disabled', 'true');
    });
    fireEvent.keyDown(pwdField, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    // LanguageProvider also calls invoke (settings), so count only the decryption calls.
    expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'activate_snippet')).toHaveLength(1);
    await act(async () => {
      resolveInvoke();
      if (invokePromise) await invokePromise;
    });
  });

  it('shows "Decrypting..." text during decryption', async () => {
    let resolveInvoke!: () => void;
    let invokePromise: Promise<void> | null = null;
    mockInvoke.mockImplementation(() => {
      invokePromise = new Promise<void>((r) => { resolveInvoke = r; });
      return invokePromise;
    });
    renderModal();
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByRole('button', { name: /copy|копіювати/i }));
    await waitFor(() => {
      expect(screen.getByText(/decrypting|розшифрування/i)).toBeInTheDocument();
    });
    await act(async () => {
      resolveInvoke();
      if (invokePromise) await invokePromise;
    });
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

  // ── Autotype action ─────────────────────────────────────────────────

  it('shows "Auto-type" button when action is autotype', () => {
    renderModal({ action: 'autotype' });
    expect(screen.getByRole('button', { name: /auto-type|автодрук|automatisch tippen/i })).toBeInTheDocument();
  });

  it('calls autotype_snippet IPC when action is autotype', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal({ action: 'autotype' });
    fireEvent.change(screen.getByLabelText(/^(password|пароль)$/i), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByRole('button', { name: /auto-type|автодрук|automatisch tippen/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('autotype_snippet', { id: 5, password: 'mypass' });
    });
  });
});
