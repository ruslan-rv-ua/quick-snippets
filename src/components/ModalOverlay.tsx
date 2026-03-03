import React, {
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { getFocusable } from '../utils/focusable';

export interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  children: React.ReactNode;
  /** When true, sets aria-busy="true" on the dialog element. */
  busy?: boolean;
}

export function ModalOverlay({
  isOpen,
  onClose,
  titleId,
  children,
  busy,
}: ModalOverlayProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save and restore focus
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element; fall back to the dialog itself
    const el = dialogRef.current;
    if (el) {
      const focusable = getFocusable(el);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        el.focus();
      }
    }

    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Re-focus dialog when the window regains focus (e.g. restored from tray)
  useEffect(() => {
    if (!isOpen) return;
    function handleWindowFocus() {
      const el = dialogRef.current;
      if (!el) return;
      // If focus fell outside the dialog, pull it back
      if (!el.contains(document.activeElement)) {
        const focusable = getFocusable(el);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          el.focus();
        }
      }
    }
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isOpen]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab') return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = getFocusable(el);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  // Click on overlay background
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close when clicking directly on the overlay, not on dialog content
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy ? 'true' : undefined}
        className="modal-dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        // Stop clicks inside dialog from closing the overlay
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
