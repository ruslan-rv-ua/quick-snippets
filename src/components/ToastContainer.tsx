import React from 'react';
import { Toast } from './Toast';
import type { Toast as ToastType } from '../hooks/useToast';

export interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: number) => void;
}

export function ToastContainer({
  toasts,
  onRemove,
}: ToastContainerProps): React.ReactElement {
  // Not atomic: screen readers announce only the toast just added. An atomic region
  // re-reads every toast still on screen ("Saved Copied" after copying right after a save).
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="toast-container"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
