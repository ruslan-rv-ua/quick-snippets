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
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="toast-container"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
