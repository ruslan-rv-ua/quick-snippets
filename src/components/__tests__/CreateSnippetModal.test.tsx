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

  const region = (id: string) => document.getElementById(id);
  const save = () => fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));

  it('validates title min length 3 on save click', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });
    // Fill valid content so only the title error fires
    const contentInput = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(contentInput, { target: { value: 'some content' } });
    save();
    await waitFor(() => {
      expect(region('create-title-err')).toHaveTextContent(/3.*50/);
      expect(document.activeElement).toBe(titleInput);
    });
    expect(region('create-content-err')).toBeEmptyDOMElement();
  });

  it('validates title max length 50 on save click', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'a'.repeat(51) } });
    const contentInput = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(contentInput, { target: { value: 'some content' } });
    save();
    await waitFor(() => {
      expect(region('create-title-err')).toHaveTextContent(/3.*50/);
    });
  });

  it('validates content required on save click and focuses content field', async () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    save();
    await waitFor(() => {
      expect(region('create-content-err')).toHaveTextContent(/content|вміст/i);
      expect(document.activeElement).toBe(screen.getByLabelText(/^content|^вміст/i));
    });
    expect(region('create-title-err')).toBeEmptyDOMElement();
  });

  it('validates password match on save click and focuses confirm field', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'some content' } });
    const pwd = screen.getByLabelText(/^password|^пароль/i);
    fireEvent.change(pwd, { target: { value: 'pass1' } });
    const confirmPwd = screen.getByLabelText(/confirm|підтвердити/i);
    fireEvent.change(confirmPwd, { target: { value: 'pass2' } });
    save();
    await waitFor(() => {
      expect(region('create-confirm-err')).toHaveTextContent(/match|збігаються/i);
      expect(document.activeElement).toBe(confirmPwd);
    });
  });

  it('shows the duplicate-title error from the backend in the title live region', async () => {
    mockInvoke.mockRejectedValue('Title already exists');
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'some content' } });
    save();
    await waitFor(() => {
      expect(region('create-title-err')).toHaveTextContent(/already exists|вже існує/i);
      expect(document.activeElement).toBe(titleInput);
    });
  });

  it('does NOT show errors before save is clicked', () => {
    renderModal();
    for (const id of ['create-title-err', 'create-content-err', 'create-confirm-err']) {
      expect(region(id)).toBeEmptyDOMElement();
    }
  });

  it('sets aria-invalid="true" on invalid fields', async () => {
    renderModal();
    save();
    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title|назва/i);
      expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  // The error regions must exist before the error: screen readers announce text changes
  // in an existing live region, while a newly inserted role="alert" was read by NVDA
  // as just "alert" without its text (the app root has role="application").
  it('has an empty assertive live region for each field error before any error', () => {
    renderModal();
    for (const id of ['create-title-err', 'create-content-err', 'create-confirm-err']) {
      const el = region(id);
      expect(el).toBeInTheDocument();
      expect(el).toBeEmptyDOMElement();
      expect(el).toHaveAttribute('aria-live', 'assertive');
      expect(el).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('shows errors in the existing live regions, with no role="alert" and no aria-describedby', async () => {
    renderModal();
    const before = ['create-title-err', 'create-content-err'].map(region);
    save();
    await waitFor(() => {
      expect(region('create-title-err')).not.toBeEmptyDOMElement();
      expect(region('create-content-err')).not.toBeEmptyDOMElement();
    });
    expect(['create-title-err', 'create-content-err'].map(region)).toEqual(before);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The live region announces the message. Pointing the focused field at it as well
    // made NVDA say it twice (live region + description change).
    expect(screen.getByLabelText(/title|назва/i)).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText(/^content|^вміст/i)).not.toHaveAttribute('aria-describedby');
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
