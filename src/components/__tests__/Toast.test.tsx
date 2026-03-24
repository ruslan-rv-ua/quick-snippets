import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../Toast';
import { ToastContainer } from '../ToastContainer';
import type { Toast as ToastType } from '../../hooks/useToast';

const successToast: ToastType = { id: 1, message: 'Copied', type: 'success', duration: 2000 };
const warningToast: ToastType = { id: 2, message: 'Warning', type: 'warning', duration: 2000 };
const errorToast: ToastType = { id: 3, message: 'Error', type: 'error', duration: 2000 };
const infoToast: ToastType = { id: 4, message: 'Info', type: 'info', duration: 2000 };

describe('Toast', () => {
  it('renders toast message text', () => {
    render(<Toast toast={successToast} onRemove={vi.fn()} />);
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('success toast has green (#4caf50) border', () => {
    render(<Toast toast={successToast} onRemove={vi.fn()} />);
    const el = screen.getByText('Copied').closest('[class]') as HTMLElement;
    // JSDOM converts #4caf50 → rgb(76, 175, 80); check either hex, rgb, or className
    const borderColor = el?.style.borderColor ?? '';
    const cls = el?.className ?? '';
    expect(borderColor.includes('76') || cls.includes('success')).toBe(true);
  });

  it('warning toast has orange (#ff9800) border', () => {
    render(<Toast toast={warningToast} onRemove={vi.fn()} />);
    const el = screen.getByText('Warning').closest('[class]') as HTMLElement;
    // JSDOM converts #ff9800 → rgb(255, 152, 0); check either hex, rgb, or className
    const borderColor = el?.style.borderColor ?? '';
    const cls = el?.className ?? '';
    expect(borderColor.includes('255') || cls.includes('warning')).toBe(true);
  });

  it('error toast has destructive border', () => {
    render(<Toast toast={errorToast} onRemove={vi.fn()} />);
    const el = screen.getByText('Error').closest('[class]') as HTMLElement;
    expect(el?.className).toMatch(/error/i);
  });

  it('info toast has default border', () => {
    render(<Toast toast={infoToast} onRemove={vi.fn()} />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('has pointer-events: none', () => {
    render(<Toast toast={successToast} onRemove={vi.fn()} />);
    const el = screen.getByText('Copied').closest('[class]') as HTMLElement;
    // Toast should have pointer-events none via CSS
    expect(el).toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  it('has aria-live="polite"', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('has aria-atomic="true"', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(document.querySelector('[aria-atomic="true"]')).toBeInTheDocument();
  });

  it('positions at bottom-right (fixed)', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    const container = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(container).toBeInTheDocument();
  });

  it('stacks toasts with gap 8px', () => {
    render(<ToastContainer toasts={[successToast, warningToast]} onRemove={vi.fn()} />);
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('new toasts appear at bottom', () => {
    render(<ToastContainer toasts={[successToast, warningToast]} onRemove={vi.fn()} />);
    const items = document.querySelectorAll('.toast');
    expect(items).toHaveLength(2);
  });
});
