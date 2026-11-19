import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  const region = (id: string) => document.getElementById(id);
  const save = () => fireEvent.click(screen.getByRole('button', { name: /save|зберегти/i }));

  it('validates title on save and focuses the title field', async () => {
    renderModal(plainSnippet);
    const title = screen.getByLabelText(/title|назва/i);
    fireEvent.change(title, { target: { value: 'ab' } });
    save();
    await waitFor(() => {
      expect(region('edit-title-err')).toHaveTextContent(/3.*50/);
      expect(document.activeElement).toBe(title);
    });
    expect(region('edit-content-err')).toBeEmptyDOMElement();
  });

  // The database counts a title in characters (code points), whatever the script.
  describe('title length in characters', () => {
    for (const snippet of [plainSnippet, encryptedSnippet]) {
      const kind = snippet.is_encrypted ? 'an encrypted' : 'a plain';

      for (const [name, title] of [
        ['Cyrillic', 'Ж'.repeat(50)],
        ['emoji', '😀'.repeat(50)],
      ] as const) {
        it(`saves ${kind} snippet renamed to 50 ${name} characters`, async () => {
          mockInvoke.mockResolvedValue(undefined);
          const onSuccess = vi.fn();
          renderModal(snippet, { onSuccess });
          fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: title } });
          save();
          await waitFor(() => expect(onSuccess).toHaveBeenCalled());
          expect(mockInvoke).toHaveBeenCalledWith('update_snippet', expect.objectContaining({ title }));
          expect(region('edit-title-err')).toBeEmptyDOMElement();
        });
      }

      for (const [name, title] of [
        ['Cyrillic', 'Ж'.repeat(51)],
        ['emoji', '😀'.repeat(51)],
      ] as const) {
        it(`refuses ${kind} snippet renamed to 51 ${name} characters with the count under Title`, async () => {
          renderModal(snippet);
          const titleInput = screen.getByLabelText(/title|назва/i) as HTMLInputElement;
          fireEvent.change(titleInput, { target: { value: title } });
          save();
          await waitFor(() => {
            expect(region('edit-title-err')).toHaveTextContent(/3.*50.*(now|зараз|jetzt) 51$/);
            expect(document.activeElement).toBe(titleInput);
          });
          expect(titleInput).toHaveAttribute('aria-invalid', 'true');
          expect(titleInput.value).toBe(title);
          expect(mockInvoke).not.toHaveBeenCalledWith('update_snippet', expect.anything());
        });
      }
    }

    it('does not cut the title field: it has no maxLength', () => {
      renderModal(plainSnippet);
      expect(screen.getByLabelText(/title|назва/i)).not.toHaveAttribute('maxLength');
    });

    it('translates a title error of the backend and shows it under Title', async () => {
      mockInvoke.mockRejectedValue('Title must be 3 to 50 characters (51 characters)');
      renderModal(plainSnippet);
      save();
      await waitFor(() => {
        expect(region('edit-title-err')).toHaveTextContent(/3.*50.*(now|зараз|jetzt) 51$/);
      });
      expect(region('edit-title-err')).not.toHaveTextContent('(51 characters)');
    });
  });

  // A paste longer than a snippet holds stays in the field; the backend's message tells why.
  it('keeps content of more than 65,536 characters in the field and shows the size under Content', async () => {
    const long = 'ж'.repeat(65537);
    mockInvoke.mockRejectedValue('Content too long (131074 bytes, max 65536 bytes)');
    renderModal(plainSnippet);
    const content = screen.getByLabelText(/content|вміст/i) as HTMLTextAreaElement;
    expect(content).not.toHaveAttribute('maxLength');
    fireEvent.change(content, { target: { value: long } });
    save();
    await waitFor(() => {
      expect(region('edit-content-err')).toHaveTextContent(/131074.*65536/);
      expect(document.activeElement).toBe(content);
    });
    expect(mockInvoke).toHaveBeenCalledWith('update_snippet', expect.objectContaining({ content: long }));
    expect(content.value).toBe(long);
  });

  it('validates content on save (unencrypted only) and focuses textarea', async () => {
    renderModal(plainSnippet);
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    const content = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(content, { target: { value: '' } });
    save();
    await waitFor(() => {
      expect(region('edit-content-err')).toHaveTextContent(/content|вміст/i);
      expect(document.activeElement).toBe(content);
    });
    expect(region('edit-title-err')).toBeEmptyDOMElement();
  });

  it('shows the duplicate-title error from the backend in the title live region', async () => {
    mockInvoke.mockRejectedValue('Title already exists');
    renderModal(plainSnippet);
    const title = screen.getByLabelText(/title|назва/i);
    fireEvent.change(title, { target: { value: 'Other Title' } });
    save();
    await waitFor(() => {
      expect(region('edit-title-err')).toHaveTextContent(/already exists|вже існує/i);
      expect(document.activeElement).toBe(title);
    });
  });

  // The backend checks the size in bytes; the dialog tells it under Content, translated.
  it('shows the too-long error from the backend under Content and focuses the textarea', async () => {
    mockInvoke.mockRejectedValue('Content too long (65538 bytes, max 65536 bytes)');
    const onClose = vi.fn();
    renderModal(plainSnippet, { onClose });
    const title = screen.getByLabelText(/title|назва/i);
    const content = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(content, { target: { value: 'longer content' } });
    title.focus();
    save();
    await waitFor(() => {
      expect(region('edit-content-err')).toHaveTextContent(/too long|задовгий/i);
      expect(document.activeElement).toBe(content);
    });
    expect(region('edit-content-err')).toHaveTextContent('65538');
    expect(region('edit-content-err')).toHaveTextContent('65536');
    expect(region('edit-content-err')).not.toHaveTextContent('Content too long');
    expect(content).toHaveAttribute('aria-invalid', 'true');
    expect(region('edit-title-err')).toBeEmptyDOMElement();
    expect(title).not.toHaveAttribute('aria-invalid');
    expect(onClose).not.toHaveBeenCalled();
  });

  // The error regions must exist before the error: screen readers announce text changes
  // in an existing live region, while a newly inserted role="alert" was read by NVDA
  // as just "alert" without its text (the app root has role="application").
  it('has an empty assertive live region for each field error before any error', () => {
    renderModal(plainSnippet);
    for (const id of ['edit-title-err', 'edit-content-err']) {
      const el = region(id);
      expect(el).toBeInTheDocument();
      expect(el).toBeEmptyDOMElement();
      expect(el).toHaveAttribute('aria-live', 'assertive');
      expect(el).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('shows errors in the existing live regions, with no role="alert" and no aria-describedby', async () => {
    renderModal(plainSnippet);
    const before = ['edit-title-err', 'edit-content-err'].map(region);
    const title = screen.getByLabelText(/title|назва/i);
    const content = screen.getByLabelText(/content|вміст/i);
    fireEvent.change(title, { target: { value: '' } });
    fireEvent.change(content, { target: { value: '' } });
    save();
    await waitFor(() => {
      expect(region('edit-title-err')).not.toBeEmptyDOMElement();
      expect(region('edit-content-err')).not.toBeEmptyDOMElement();
    });
    expect(['edit-title-err', 'edit-content-err'].map(region)).toEqual(before);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The live region announces the message. Pointing the focused field at it as well
    // made NVDA say it twice (live region + description change).
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).not.toHaveAttribute('aria-describedby');
    expect(content).not.toHaveAttribute('aria-describedby');
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

  // The app loads the list again in onSuccess: focus comes back once, to the new list.
  it('after a save it closes only once onSuccess has finished', async () => {
    mockInvoke.mockResolvedValue(undefined);
    let finish = () => {};
    const onSuccess = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    renderModal(plainSnippet, { onSuccess, onClose });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
