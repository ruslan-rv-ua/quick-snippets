import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../ToastContainer';
import type { Toast as ToastType } from '../../hooks/useToast';

const makeToast = (overrides: Partial<ToastType> = {}): ToastType => ({
  id: 1,
  message: 'Test message',
  type: 'success',
  duration: 2000,
  ...overrides,
});

describe('ToastContainer', () => {
  // ----- Empty state -----

  it('renders container element even when toasts array is empty', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
  });

  it('renders no toast items when toasts array is empty', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  // ----- Accessibility attributes -----

  it('has aria-live="polite" on the container', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    const container = document.querySelector('[aria-live="polite"]');
    expect(container).toBeInTheDocument();
  });

  it('has aria-atomic="true" on the container', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    const container = document.querySelector('[aria-atomic="true"]');
    expect(container).toBeInTheDocument();
  });

  // ----- Single toast -----

  it('renders a single toast with correct message', () => {
    const toast = makeToast({ message: 'Hello, world!' });
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders exactly one toast element for a single toast', () => {
    const toast = makeToast();
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
  });

  // ----- Toast types -----

  it('applies "toast-success" CSS class for success type', () => {
    const toast = makeToast({ type: 'success', message: 'Copied!' });
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    const el = screen.getByText('Copied!');
    expect(el.className).toMatch(/toast-success/);
  });

  it('applies "toast-error" CSS class for error type', () => {
    const toast = makeToast({ id: 2, type: 'error', message: 'Failed!' });
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    const el = screen.getByText('Failed!');
    expect(el.className).toMatch(/toast-error/);
  });

  it('applies "toast-warning" CSS class for warning type', () => {
    const toast = makeToast({ id: 3, type: 'warning', message: 'Watch out!' });
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    const el = screen.getByText('Watch out!');
    expect(el.className).toMatch(/toast-warning/);
  });

  it('applies "toast-info" CSS class for info type', () => {
    const toast = makeToast({ id: 4, type: 'info', message: 'FYI' });
    render(<ToastContainer toasts={[toast]} onRemove={vi.fn()} />);
    const el = screen.getByText('FYI');
    expect(el.className).toMatch(/toast-info/);
  });

  // ----- Multiple toasts -----

  it('renders multiple toasts', () => {
    const toasts: ToastType[] = [
      makeToast({ id: 1, message: 'First' }),
      makeToast({ id: 2, message: 'Second' }),
      makeToast({ id: 3, message: 'Third' }),
    ];
    render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('renders the correct number of toast elements for multiple toasts', () => {
    const toasts: ToastType[] = [
      makeToast({ id: 1, message: 'A' }),
      makeToast({ id: 2, message: 'B' }),
    ];
    render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
  });

  it('renders toasts with different types in the same container', () => {
    const toasts: ToastType[] = [
      makeToast({ id: 1, type: 'success', message: 'Done' }),
      makeToast({ id: 2, type: 'error', message: 'Oops' }),
      makeToast({ id: 3, type: 'warning', message: 'Careful' }),
      makeToast({ id: 4, type: 'info', message: 'Note' }),
    ];
    render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);
    expect(screen.getByText('Done').className).toMatch(/toast-success/);
    expect(screen.getByText('Oops').className).toMatch(/toast-error/);
    expect(screen.getByText('Careful').className).toMatch(/toast-warning/);
    expect(screen.getByText('Note').className).toMatch(/toast-info/);
  });

  // ----- Dismiss / onRemove callback -----

  it('calls onRemove with the correct id when a toast is clicked', () => {
    const onRemove = vi.fn();
    const toast = makeToast({ id: 42, message: 'Click me' });
    render(<ToastContainer toasts={[toast]} onRemove={onRemove} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(42);
  });

  it('calls onRemove with the correct id for each individual toast', () => {
    const onRemove = vi.fn();
    const toasts: ToastType[] = [
      makeToast({ id: 10, message: 'Alpha' }),
      makeToast({ id: 20, message: 'Beta' }),
    ];
    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    fireEvent.click(screen.getByText('Beta'));
    expect(onRemove).toHaveBeenCalledWith(20);

    fireEvent.click(screen.getByText('Alpha'));
    expect(onRemove).toHaveBeenCalledWith(10);

    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it('does not call onRemove without user interaction', () => {
    const onRemove = vi.fn();
    render(<ToastContainer toasts={[makeToast()]} onRemove={onRemove} />);
    expect(onRemove).not.toHaveBeenCalled();
  });

  // ----- Container class -----

  it('container has "toast-container" CSS class', () => {
    render(<ToastContainer toasts={[]} onRemove={vi.fn()} />);
    expect(document.querySelector('.toast-container')).toBeInTheDocument();
  });
});
