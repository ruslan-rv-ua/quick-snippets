import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
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
});
