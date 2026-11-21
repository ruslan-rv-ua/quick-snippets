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
    // Exactly the text of WRONG_PASSWORD in src-tauri/src/crypto.rs, as Tauri passes it on.
    mockInvoke.mockRejectedValue('Wrong password');
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
  // Only a wrong password is the password's fault. Any other failure (a locked database, damaged
  // content, the clipboard) gets its own message above the buttons, and the password stays.
  describe('a failure that is not a wrong password', () => {
    const LOCKED = 'database is locked';
    const message = () => document.getElementById('pwd-failure') as HTMLElement;
    const field = () => document.getElementById('pwd-input') as HTMLInputElement;
    const copyFailed = {
      en: 'Could not copy the snippet. Reason: database is locked.',
      uk: 'Не вдалося скопіювати сніпет. Причина: database is locked.',
      de: 'Das Snippet ließ sich nicht kopieren. Grund: database is locked.',
    };
    const decrypts = () =>
      mockInvoke.mock.calls.filter(([cmd]) => cmd === 'activate_snippet' || cmd === 'autotype_snippet').length;

    function backend(language: string, error: unknown = LOCKED) {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_settings') return { language };
        if (cmd === 'get_system_language') return 'en';
        if (cmd === 'activate_snippet' || cmd === 'autotype_snippet') throw error;
        return undefined;
      });
    }

    function submit(password = 'right one') {
      fireEvent.change(field(), { target: { value: password } });
      fireEvent.keyDown(field(), { key: 'Enter' });
    }

    it('has an empty assertive live region above the buttons before any failure', () => {
      renderModal();
      const region = message();
      expect(region).toBeEmptyDOMElement();
      expect(region).toHaveAttribute('aria-live', 'assertive');
      expect(region).toHaveAttribute('aria-atomic', 'true');
      expect(region).not.toHaveAttribute('role', 'alert');
      expect(region.nextElementSibling).toHaveClass('modal-actions');
    });

    it('says why above the buttons, not "wrong password", and keeps the password', async () => {
      backend('en');
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      renderModal({ onSuccess, onClose });
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed.en));

      expect(document.getElementById('pwd-error')).toBeEmptyDOMElement();
      expect(screen.queryByText(/wrong password/i)).not.toBeInTheDocument();
      expect(field()).toHaveValue('right one');
      expect(field()).not.toHaveAttribute('aria-invalid');
      expect(field()).toHaveFocus();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each([
      ['damaged content', 'Invalid data', 'Could not copy the snippet. Reason: Invalid data.'],
      ['a busy clipboard', 'The native clipboard is not accessible due to being held by an other party',
        'Could not copy the snippet. Reason: The native clipboard is not accessible due to being held by an other party.'],
      ['an Error object', new Error('Wrong password'), 'Could not copy the snippet. Reason: Error: Wrong password.'],
      ['the text in other letters', 'wrong password', 'Could not copy the snippet. Reason: wrong password.'],
    ])('%s is not a wrong password', async (_, error, text) => {
      backend('en', error);
      renderModal();
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(text));
      expect(document.getElementById('pwd-error')).toBeEmptyDOMElement();
    });

    it('focus goes back to the field when the button was used', async () => {
      backend('en');
      renderModal();
      fireEvent.change(field(), { target: { value: 'right one' } });
      const copy = screen.getByRole('button', { name: 'Copy' });
      copy.focus();
      fireEvent.click(copy);
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed.en));
      expect(field()).toHaveFocus();
    });

    it('Enter tries again with the same password, and a second failure is announced again', async () => {
      backend('en');
      renderModal();
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed.en));

      const region = message();
      const texts: string[] = [];
      const observer = new MutationObserver(() => texts.push(region.textContent ?? ''));
      observer.observe(region, { childList: true, characterData: true, subtree: true });
      fireEvent.keyDown(field(), { key: 'Enter' });
      await waitFor(() => expect(texts[texts.length - 1]).toBe(copyFailed.en));
      observer.disconnect();

      expect(texts).toContain('');
      expect(texts.indexOf('')).toBeLessThan(texts.length - 1);
      expect(mockInvoke).toHaveBeenLastCalledWith('activate_snippet', { id: 5, password: 'right one' });
      expect(decrypts()).toBe(2);
    });

    it('a wrong password afterwards takes the place of the message', async () => {
      backend('en');
      renderModal();
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed.en));

      backend('en', 'Wrong password');
      submit('wrong one');
      await waitFor(() => expect(document.getElementById('pwd-error')).toHaveTextContent('Wrong password'));
      expect(message()).toBeEmptyDOMElement();
      expect(field()).toHaveValue('');
    });

    it('auto-type says that it could not type the snippet', async () => {
      backend('en');
      renderModal({ action: 'autotype' });
      submit();
      await waitFor(() =>
        expect(message()).toHaveTextContent('Could not type the snippet. Reason: database is locked.'));
      expect(decrypts()).toBe(1);
    });

    it.each([['uk'], ['de']] as const)('says it in the language of the app (%s)', async (language) => {
      backend(language);
      renderModal();
      await screen.findByRole('button', { name: language === 'uk' ? 'Скасувати' : 'Abbrechen' });
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed[language]));
    });

    it.each([
      ['uk', 'Не вдалося надрукувати сніпет. Причина: database is locked.'],
      ['de', 'Das Snippet ließ sich nicht automatisch tippen. Grund: database is locked.'],
    ] as const)('says the auto-type failure in the language of the app (%s)', async (language, text) => {
      backend(language);
      renderModal({ action: 'autotype' });
      await screen.findByRole('button', { name: language === 'uk' ? 'Скасувати' : 'Abbrechen' });
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(text));
    });

    // TASK-33: damage reaches the dialog as DATABASE_DAMAGED or SNIPPET_DAMAGED.
    it.each([
      ['en', 'Cancel', 'copy', 'The snippet database is damaged', 'Could not copy the snippet. Reason: the snippet database is damaged. Restart QuickSnippets: at start-up it checks the database and offers to save the snippets that can still be read.'],
      ['uk', 'Скасувати', 'copy', 'The snippet database is damaged', 'Не вдалося скопіювати сніпет. Причина: база сніпетів пошкоджена. Перезапустіть QuickSnippets: під час запуску програма перевірить базу й запропонує зберегти сніпети, які ще вдається прочитати.'],
      ['de', 'Abbrechen', 'autotype', 'The snippet database is damaged', 'Das Snippet ließ sich nicht automatisch tippen. Grund: Die Snippet-Datenbank ist beschädigt. Starten Sie QuickSnippets neu: Beim Start prüft es die Datenbank und bietet an, die noch lesbaren Snippets zu sichern.'],
      ['en', 'Cancel', 'copy', 'This snippet is damaged', 'Could not copy the snippet. Reason: this snippet is damaged and cannot be read.'],
      ['uk', 'Скасувати', 'autotype', 'This snippet is damaged', 'Не вдалося надрукувати сніпет. Причина: цей сніпет пошкоджений, його не вдається прочитати.'],
      ['de', 'Abbrechen', 'copy', 'This snippet is damaged', 'Das Snippet ließ sich nicht kopieren. Grund: Dieses Snippet ist beschädigt und kann nicht gelesen werden.'],
    ] as const)('says damage in the language of the app (%s, %s, %s)', async (language, cancel, action, error, text) => {
      backend(language, error);
      renderModal({ action });
      await screen.findByRole('button', { name: cancel });
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(text));
      expect(document.getElementById('pwd-error')).toBeEmptyDOMElement();
      expect(field()).toHaveValue('right one');
    });

    it('opening the dialog again shows no old message', async () => {
      backend('en');
      const view = (open: boolean) => (
        <LanguageProvider>
          <PasswordModal isOpen={open} onClose={vi.fn()} snippetId={5} snippetTitle="Secret Snippet" onSuccess={vi.fn()} />
        </LanguageProvider>
      );
      const { rerender } = render(view(true));
      submit();
      await waitFor(() => expect(message()).toHaveTextContent(copyFailed.en));
      rerender(view(false));
      rerender(view(true));
      expect(message()).toBeEmptyDOMElement();
    });
  });
});
