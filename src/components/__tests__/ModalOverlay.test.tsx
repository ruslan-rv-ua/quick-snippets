import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useLayoutEffect } from 'react';
import { ModalOverlay } from '../ModalOverlay';

function renderModal(overrides: Partial<React.ComponentProps<typeof ModalOverlay>> = {}) {
  return render(
    <ModalOverlay
      isOpen={true}
      onClose={vi.fn()}
      titleId="modal-title"
      {...overrides}
    >
      <h2 id="modal-title">Test Modal</h2>
      <button>First</button>
      <button>Second</button>
      <button>Last</button>
    </ModalOverlay>,
  );
}

describe('ModalOverlay', () => {
  it('renders with role="dialog"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby pointing to title id', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('has no description unless describedBy is given', () => {
    renderModal();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('describedBy sets the dialog description', () => {
    render(
      <ModalOverlay isOpen={true} onClose={vi.fn()} titleId="t" describedBy="d">
        <h2 id="t">Title</h2>
        <p id="d">Version 1.2.3</p>
        <button>OK</button>
      </ModalOverlay>,
    );
    expect(screen.getByRole('dialog', { name: 'Title' })).toHaveAccessibleDescription('Version 1.2.3');
  });

  it('className is added to the dialog classes', () => {
    renderModal({ className: 'settings-dialog' });
    expect(screen.getByRole('dialog')).toHaveClass('modal-dialog', 'settings-dialog');
  });

  it('click on overlay (outside dialog) calls onClose', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    // The overlay background is a sibling or wrapper element; click on container's first child (overlay)
    const overlay = container.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it('click inside dialog does not call onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps focus with Tab (cycles to first after last)', async () => {
    const user = userEvent.setup();
    renderModal();
    const buttons = screen.getAllByRole('button');
    buttons[buttons.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('traps focus with Shift+Tab (cycles to last from first)', async () => {
    const user = userEvent.setup();
    renderModal();
    const buttons = screen.getAllByRole('button');
    buttons[0].focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('focus is on first focusable element on open', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('restores focus to previous element on close', () => {
    const button = document.createElement('button');
    button.textContent = 'Trigger';
    document.body.appendChild(button);
    button.focus();

    const { unmount } = renderModal();
    unmount();
    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });

  // The layout effect of a later sibling runs in the same commit, once the dialog is gone. Focus
  // must already be back there: when it waited for a later task, NVDA heard the document first.
  describe('when the dialog closes, focus is back in the same commit', () => {
    function FocusProbe({ open, seen }: { open: boolean; seen: (Element | null)[] }) {
      useLayoutEffect(() => {
        seen.push(document.activeElement);
      }, [open, seen]);
      return null;
    }

    function Harness({ open, unmount, seen }: { open: boolean; unmount: boolean; seen: (Element | null)[] }) {
      return (
        <>
          <button>Opener</button>
          {(open || !unmount) && (
            <ModalOverlay isOpen={open} onClose={vi.fn()} titleId="t">
              <h2 id="t">Dialog</h2>
              <button>Inside</button>
            </ModalOverlay>
          )}
          <FocusProbe open={open} seen={seen} />
        </>
      );
    }

    it.each([
      ['the dialog component returns null, as the dialogs of the app do', true],
      ['isOpen becomes false', false],
    ])('%s', (_, unmount) => {
      const seen: (Element | null)[] = [];
      const { rerender } = render(<Harness open={false} unmount={unmount} seen={seen} />);
      const opener = screen.getByRole('button', { name: 'Opener' });
      opener.focus();
      rerender(<Harness open={true} unmount={unmount} seen={seen} />);
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

      seen.length = 0;
      rerender(<Harness open={false} unmount={unmount} seen={seen} />);
      expect(seen).toEqual([opener]);
      expect(opener).toHaveFocus();
    });
  });
});
