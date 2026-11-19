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
        onError={vi.fn()}
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

  it('a failed delete keeps the dialog open and reports the error', async () => {
    mockInvoke.mockRejectedValue('Snippet not found');
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const onError = vi.fn();
    renderModal({ onSuccess, onClose, onError });
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Snippet not found'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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
            onError={vi.fn()}
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
