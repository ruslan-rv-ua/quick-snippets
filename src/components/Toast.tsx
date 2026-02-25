import React from 'react';
import type { Toast as ToastType } from '../hooks/useToast';

export interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

const BORDER_COLORS: Record<ToastType['type'], string> = {
  success: '#4caf50',
  warning: '#ff9800',
  error: 'var(--color-destructive)',
  info: 'var(--color-border)',
};

export function Toast({ toast, onRemove }: ToastProps): React.ReactElement {
  const animDelay = Math.max(0, toast.duration - 300);

  return (
    <div
      role="status"
      className={`toast toast-${toast.type}`}
      style={{
        borderColor: BORDER_COLORS[toast.type],
        borderLeft: `4px solid ${BORDER_COLORS[toast.type]}`,
        animationDelay: `${animDelay}ms`,
        pointerEvents: 'none',
      }}
      onClick={() => onRemove(toast.id)}
    >
      {toast.message}
    </div>
  );
}
