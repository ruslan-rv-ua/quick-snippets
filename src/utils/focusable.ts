/**
 * CSS selector that matches all focusable/interactive elements.
 * Single source of truth — imported by ModalOverlay and SettingsModal.
 */
export const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Returns all focusable descendants of `container` in DOM order.
 */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}
