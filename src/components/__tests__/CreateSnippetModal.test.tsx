import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  // The database counts a title in characters (code points), whatever the script.
  describe('title length in characters', () => {
    const fill = (title: string) => {
      fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: title } });
      fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'some content' } });
    };

    for (const [name, title] of [
      ['Cyrillic', 'Ж'.repeat(50)],
      ['emoji', '😀'.repeat(50)],
    ] as const) {
      it(`saves a title of 50 ${name} characters`, async () => {
        mockInvoke.mockResolvedValue(undefined);
        const onSuccess = vi.fn();
        renderModal({ onSuccess });
        fill(title);
        save();
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        expect(mockInvoke).toHaveBeenCalledWith('create_snippet', expect.objectContaining({ title }));
        expect(region('create-title-err')).toBeEmptyDOMElement();
      });
    }

    for (const [name, title] of [
      ['Cyrillic', 'Ж'.repeat(51)],
      ['emoji', '😀'.repeat(51)],
    ] as const) {
      it(`refuses a title of 51 ${name} characters with the count under Title`, async () => {
        renderModal();
        fill(title);
        const titleInput = screen.getByLabelText(/title|назва/i) as HTMLInputElement;
        save();
        await waitFor(() => {
          expect(region('create-title-err')).toHaveTextContent(/3.*50.*(now|зараз|jetzt) 51$/);
          expect(document.activeElement).toBe(titleInput);
        });
        expect(titleInput).toHaveAttribute('aria-invalid', 'true');
        expect(titleInput.value).toBe(title);
        expect(mockInvoke).not.toHaveBeenCalledWith('create_snippet', expect.anything());
      });
    }

    it('refuses a title of two emoji, which are four UTF-16 units', async () => {
      renderModal();
      fill('😀😀');
      save();
      await waitFor(() => {
        expect(region('create-title-err')).toHaveTextContent(/(now|зараз|jetzt) 2$/);
      });
      expect(mockInvoke).not.toHaveBeenCalledWith('create_snippet', expect.anything());
    });

    it('does not cut the title field: it has no maxLength', () => {
      renderModal();
      expect(screen.getByLabelText(/title|назва/i)).not.toHaveAttribute('maxLength');
    });

    it('translates a title error of the backend and shows it under Title', async () => {
      mockInvoke.mockRejectedValue('Title must be 3 to 50 characters (51 characters)');
      renderModal();
      fill('Valid Title');
      save();
      await waitFor(() => {
        expect(region('create-title-err')).toHaveTextContent(/3.*50.*(now|зараз|jetzt) 51$/);
      });
      expect(region('create-title-err')).not.toHaveTextContent('(51 characters)');
      expect(region('create-content-err')).toBeEmptyDOMElement();
    });
  });

  // A paste longer than a snippet holds stays in the field; the backend's message tells why.
  it('keeps content of more than 65,536 characters in the field and shows the size under Content', async () => {
    const long = 'x'.repeat(70000);
    mockInvoke.mockRejectedValue('Content too long (70000 bytes, max 65536 bytes)');
    renderModal();
    const content = screen.getByLabelText(/^content|^вміст/i) as HTMLTextAreaElement;
    expect(content).not.toHaveAttribute('maxLength');
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(content, { target: { value: long } });
    save();
    await waitFor(() => {
      expect(region('create-content-err')).toHaveTextContent(/70000.*65536/);
      expect(document.activeElement).toBe(content);
    });
    expect(mockInvoke).toHaveBeenCalledWith('create_snippet', expect.objectContaining({ content: long }));
    expect(content.value).toBe(long);
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

  // The backend checks the size in bytes; the dialog tells it under Content, translated.
  it('shows the too-long error from the backend under Content with the size and the limit', async () => {
    mockInvoke.mockRejectedValue('Content too long (70000 bytes, max 65536 bytes)');
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i);
    const content = screen.getByLabelText(/^content|^вміст/i);
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    fireEvent.change(content, { target: { value: 'some content' } });
    titleInput.focus();
    save();
    await waitFor(() => {
      expect(region('create-content-err')).toHaveTextContent(/too long|задовгий/i);
      expect(document.activeElement).toBe(content);
    });
    const message = region('create-content-err');
    expect(message).toHaveTextContent('70000');
    expect(message).toHaveTextContent('65536');
    expect(message).not.toHaveTextContent(/encrypted|зашифр/i);
    expect(message).not.toHaveTextContent('Content too long');
    expect(content).toHaveAttribute('aria-invalid', 'true');
    expect(region('create-title-err')).toBeEmptyDOMElement();
    expect(titleInput).not.toHaveAttribute('aria-invalid');
  });

  it('names the lower limit of encrypted snippets when the backend reports it', async () => {
    mockInvoke.mockRejectedValue(
      'Content too long for an encrypted snippet (52300 bytes, max 49105 bytes)',
    );
    const onSuccess = vi.fn();
    renderModal({ onSuccess });
    const content = screen.getByLabelText(/^content|^вміст/i);
    const confirmPwd = screen.getByLabelText(/confirm|підтвердити/i);
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(content, { target: { value: 'some content' } });
    fireEvent.change(screen.getByLabelText(/^password|^пароль/i), { target: { value: 'pass' } });
    fireEvent.change(confirmPwd, { target: { value: 'pass' } });
    confirmPwd.focus();
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => {
      expect(region('create-content-err')).toHaveTextContent(/encrypted snippet|зашифрованого сніпета/i);
      expect(document.activeElement).toBe(content);
    });
    expect(region('create-content-err')).toHaveTextContent('52300');
    expect(region('create-content-err')).toHaveTextContent('49105');
    expect(region('create-title-err')).toBeEmptyDOMElement();
    expect(region('create-confirm-err')).toBeEmptyDOMElement();
    expect(onSuccess).not.toHaveBeenCalled();
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

  // The app loads the list again in onSuccess: focus comes back once, to the new list.
  it('after a save it closes only once onSuccess has finished', async () => {
    mockInvoke.mockResolvedValue(undefined);
    let finish = () => {};
    const onSuccess = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    renderModal({ onSuccess, onClose });
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'Content here' } });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a failed save keeps the dialog open without onSuccess', async () => {
    mockInvoke.mockRejectedValue('Title already exists');
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSuccess, onClose });
    fireEvent.change(screen.getByLabelText(/title|назва/i), { target: { value: 'Valid Title' } });
    fireEvent.change(screen.getByLabelText(/^content|^вміст/i), { target: { value: 'Content here' } });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(screen.getByLabelText(/title|назва/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears all fields on open', () => {
    renderModal();
    const titleInput = screen.getByLabelText(/title|назва/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });
});
