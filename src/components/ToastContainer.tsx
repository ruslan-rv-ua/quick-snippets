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
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
