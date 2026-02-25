import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

let nextId = 0;

const DEFAULT_DURATION = 2000;

export interface ToastHook {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: number) => void;
}

export function useToast(): ToastHook {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration: number = DEFAULT_DURATION) => {
      const id = ++nextId;
      const toast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return { toasts, addToast, removeToast };
}
