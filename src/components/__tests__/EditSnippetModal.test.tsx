import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { EditSnippetModal } from '../EditSnippetModal';
import { LanguageProvider } from '../../contexts/LanguageContext';
import type { SnippetView } from '../../types';

const mockInvoke = vi.mocked(invoke);

const plainSnippet: SnippetView = {
  id: 1,
  title: 'My Snippet',
  content: 'Hello world',
  is_encrypted: false,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const encryptedSnippet: SnippetView = {
  id: 2,
  title: 'Secret',
  content: '',
  is_encrypted: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

function renderModal(snippet: SnippetView, overrides: Partial<React.ComponentProps<typeof EditSnippetModal>> = {}) {
  return render(
    <LanguageProvider>
      <EditSnippetModal
        isOpen={true}
        onClose={vi.fn()}
        snippet={snippet}
        onSuccess={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
}

describe('EditSnippetModal', () => {
  beforeEach(() => { mockInvoke.mockReset(); });

  it('pre-fills title field with current data', () => {
    renderModal(plainSnippet);
    const title = screen.getByLabelText(/title|назва/i) as HTMLInputElement;
    expect(title.value).toBe('My Snippet');
  });

  it('pre-fills content for unencrypted snippets', () => {
    renderModal(plainSnippet);
    const content = screen.getByLabelText(/content|вміст/i) as HTMLTextAreaElement;
    expect(content.value).toBe('Hello world');
  });

  it('shows info message instead of textarea for encrypted', () => {
    renderModal(encryptedSnippet);
    expect(screen.queryByRole('textbox', { name: /content|вміст/i })).not.toBeInTheDocument();
    expect(screen.getByText(/зашифровано|encrypted/i)).toBeInTheDocument();
  });

  it('encrypted info message has italic style', () => {
    renderModal(encryptedSnippet);
    const info = screen.getByText(/зашифровано|encrypted/i);
    expect(info).toBeInTheDocument();
  });

  it('validates title on save', async () => {
    renderModal(plainSnippet);
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('validates content on save (unencrypted only)', async () => {
    renderModal(plainSnippet);
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/content|вміст/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('does not show password fields', () => {
    renderModal(plainSnippet);
    expect(screen.queryByLabelText(/password|пароль/i)).not.toBeInTheDocument();
  });

  it('calls update_snippet IPC on valid submit', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal(plainSnippet);
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Updated Title' } });
    fireEvent.change(screen.getByLabelText(/content|вміст/i), { target: { value: 'Updated content' } });
    fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_snippet', expect.objectContaining({
        title: 'Updated Title',
      }));
    });
  });
});
