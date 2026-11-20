import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React, { useLayoutEffect, useState } from 'react';
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

  it('Ctrl+Enter triggers delete', async () => {
    mockInvoke.mockResolvedValue(undefined);
    renderModal();
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 42 }); });
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

  describe('a failed delete', () => {
    const LOCKED = 'database is locked';
    const message = () => document.getElementById('delete-error') as HTMLElement;
    const failedText = {
      en: 'Could not delete the snippet. Reason: database is locked.',
      uk: 'Не вдалося видалити сніпет. Причина: database is locked.',
      de: 'Das Snippet ließ sich nicht löschen. Grund: database is locked.',
    };

    /** The backend of the dialog: the saved language, and a delete that fails with `error`. */
    function backend(language: string, error: unknown = LOCKED) {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_settings') return { language };
        if (cmd === 'get_system_language') return 'en';
        if (cmd === 'delete_snippet') throw error;
        return undefined;
      });
    }

    // A live region announces changes of its text only when it was already in the page.
    it('has an empty assertive live region above the buttons before any failure', () => {
      renderModal();
      const region = message();
      expect(region).toBeInTheDocument();
      expect(region).toBeEmptyDOMElement();
      expect(region).toHaveAttribute('aria-live', 'assertive');
      expect(region).toHaveAttribute('aria-atomic', 'true');
      expect(region).not.toHaveAttribute('role', 'alert');
      // Right above the buttons, inside the dialog.
      expect(region.nextElementSibling).toHaveClass('modal-actions');
      expect(screen.getByRole('dialog')).toContainElement(region);
    });

    it('keeps the dialog open, focus on Cancel, and says why inside the dialog', async () => {
      backend('en');
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      renderModal({ onSuccess, onClose });
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      expect(cancel).toHaveFocus();

      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));
      expect(cancel).toHaveFocus();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // No other element in the page holds the message (no toast, no field error).
      expect(screen.getAllByText(/database is locked/)).toEqual([message()]);
    });

    it('focus stays on Delete when the button was clicked', async () => {
      backend('en');
      renderModal();
      const del = screen.getByRole('button', { name: 'Delete' });
      del.focus();
      fireEvent.click(del);
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));
      expect(del).toHaveFocus();
    });

    it('a second failure empties the message first, so that it is announced again', async () => {
      backend('en');
      renderModal();
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));

      const region = message();
      const texts: string[] = [];
      const observer = new MutationObserver(() => texts.push(region.textContent ?? ''));
      observer.observe(region, { childList: true, characterData: true, subtree: true });
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(texts[texts.length - 1]).toBe(failedText.en));
      observer.disconnect();

      expect(texts).toContain('');
      expect(texts.indexOf('')).toBeLessThan(texts.length - 1);
      expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'delete_snippet')).toHaveLength(2);
    });

    it('ignores another Ctrl+Enter while the delete is still running', async () => {
      let fail = (_: unknown) => {};
      mockInvoke.mockImplementation((cmd: string) =>
        cmd === 'delete_snippet' ? new Promise((_, reject) => { fail = reject; }) : Promise.resolve(undefined));
      renderModal();
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await act(async () => fail(LOCKED));
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));
      expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'delete_snippet')).toHaveLength(1);
    });

    it.each([['uk'], ['de']] as const)('says it in the language of the app (%s)', async (language) => {
      backend(language);
      renderModal();
      const cancel = language === 'uk' ? 'Скасувати' : 'Abbrechen';
      await screen.findByRole('button', { name: cancel });
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(message()).toHaveTextContent(failedText[language]));
    });

    it('a delete that works after a failure closes the dialog', async () => {
      backend('en');
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      renderModal({ onSuccess, onClose });
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));

      mockInvoke.mockResolvedValue(undefined);
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(message()).toBeEmptyDOMElement();
    });

    it('opening the dialog again shows no old message', async () => {
      backend('en');
      const props = {
        onClose: vi.fn(), snippetTitle: 'My Test Snippet', snippetId: 42, onSuccess: vi.fn(),
      };
      const { rerender } = render(
        <LanguageProvider><DeleteConfirmModal isOpen={true} {...props} /></LanguageProvider>,
      );
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(message()).toHaveTextContent(failedText.en));

      rerender(<LanguageProvider><DeleteConfirmModal isOpen={false} {...props} /></LanguageProvider>);
      rerender(<LanguageProvider><DeleteConfirmModal isOpen={true} {...props} /></LanguageProvider>);
      expect(message()).toBeEmptyDOMElement();
    });
  });

  // The app loads the list again in onSuccess: focus must not come back to the deleted snippet.
  it('after a delete it closes only once onSuccess has finished', async () => {
    mockInvoke.mockResolvedValue(undefined);
    let finish = () => {};
    const onSuccess = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    renderModal({ onSuccess, onClose });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The dialog closes after an await, outside the key event, as in the app. A layout effect of
  // a later sibling runs in the commit that removes the dialog: focus must already be back in
  // the search box then, or NVDA hears the document ("unknown", "application") first.
  describe('where focus goes after the delete confirmation closes', () => {
    function FocusProbe({ open, seen }: { open: boolean; seen: (Element | null)[] }) {
      useLayoutEffect(() => {
        seen.push(document.activeElement);
      }, [open, seen]);
      return null;
    }

    function Harness({ seen }: { seen: (Element | null)[] }) {
      const [open, setOpen] = useState(false);
      return (
        <LanguageProvider>
          <input aria-label="Search" />
          <button onClick={() => setOpen(true)}>Ask</button>
          <DeleteConfirmModal
            isOpen={open}
            onClose={() => setOpen(false)}
            snippetTitle="My Test Snippet"
            snippetId={42}
            onSuccess={vi.fn()}
          />
          <FocusProbe open={open} seen={seen} />
        </LanguageProvider>
      );
    }

    async function openFromSearch(seen: (Element | null)[]): Promise<HTMLElement> {
      render(<Harness seen={seen} />);
      const search = screen.getByRole('textbox', { name: 'Search' });
      search.focus();
      fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
      await waitFor(() => expect(screen.getByRole('button', { name: /cancel|скасувати/i })).toHaveFocus());
      seen.length = 0;
      return search;
    }

    it('Ctrl+Enter deletes, and focus is back in the search box in the same commit', async () => {
      mockInvoke.mockResolvedValue(undefined);
      const seen: (Element | null)[] = [];
      const search = await openFromSearch(seen);

      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mockInvoke).toHaveBeenCalledWith('delete_snippet', { id: 42 });
      expect(seen).toEqual([search]);
      expect(search).toHaveFocus();
    });

    it('Escape cancels, and focus is back in the search box in the same commit', async () => {
      const seen: (Element | null)[] = [];
      const search = await openFromSearch(seen);

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(seen).toEqual([search]);
      expect(search).toHaveFocus();
    });
  });
});
