import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { CreateSnippetModal } from '../CreateSnippetModal';
import { LanguageProvider } from '../../contexts/LanguageContext';

const mockInvoke = vi.mocked(invoke);

function renderModal(overrides: Partial<React.ComponentProps<typeof CreateSnippetModal>> = {}) {
  return render(
    <LanguageProvider>
      <CreateSnippetModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('CreateSnippetModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('focuses title field on open', () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    expect(document.activeElement).toBe(titleInput);
  });

  it('validates title min length 3 on save click', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });
    // Fill valid content so only the title error fires
    const contentInput = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(contentInput, { target: { value: 'some content' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('validates title max length 50 on save click', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'a'.repeat(51) } });
    const contentInput = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(contentInput, { target: { value: 'some content' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('validates content required on save click', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('validates password match on save click', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'some content' } });
    const pwd = screen.getByLabelText(/^password|^пароль/i);
    fireEvent.change(pwd, { target: { value: 'pass1' } });
    const confirmPwd = screen.getByLabelText(/confirm|підтвердити/i);
    fireEvent.change(confirmPwd, { target: { value: 'pass2' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('does NOT show errors before save is clicked', () => {
    renderModal();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sets aria-invalid="true" on invalid fields', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title|назва/i);
      expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('error elements have role="alert"', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  it('Ctrl+Enter submits form', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'some content' } });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_snippet', expect.any(Object));
    });
  });

  it('Escape closes modal', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls create_snippet IPC on valid submit', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'Content here' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_snippet', expect.objectContaining({
        title: 'Valid Title',
        content: 'Content here',
      }));
    });
  });

  it('shows "saved" toast on successful creation', async () => {
    const onSuccess = vi.fn();
    mockInvoke.mockResolvedValue(undefined);
    renderModal({ onSuccess });
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'Content here' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('clears all fields on open', () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });
});
