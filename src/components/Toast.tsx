import React from 'react';
import type { Toast as ToastType } from '../hooks/useToast';

export interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

export function Toast({ toast, onRemove }: ToastProps): React.ReactElement {
  const animDelay = Math.max(0, toast.duration - 300);

  return (
    <div
      className={`toast toast-${toast.type}`}
      style={{ animationDelay: `${animDelay}ms` }}
      onClick={() => onRemove(toast.id)}
    >
      {toast.message}
    </div>
  );
}
