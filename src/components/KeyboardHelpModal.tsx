import React, { useCallback, useRef, useState } from 'react';
import { ModalOverlay } from './ModalOverlay';
import { useLanguage } from '../hooks/useLanguage';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import type { HelpShortcut } from '../i18n/translations';

export interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TITLE_ID = 'help-modal-title';

/** Id of the row at `index` (counted over all groups). */
export function helpItemId(index: number): string {
  return `help-item-${index}`;
}

/** What screen readers read for a row: the keys, then the action. */
export function helpItemLabel(item: HelpShortcut): string {
  return `${item.spokenKeys ?? item.keys}, ${item.action}`;
}

/**
 * The keyboard shortcuts help, opened with F1.
 *
 * The app root has role="application", so NVDA stays in focus mode here and
 * does not read plain text with the arrow keys. The shortcuts are therefore a
 * listbox: each row is an option that gets real focus, and the arrow keys move
 * that focus, so NVDA reads one row at a time, keys and action together. The
 * three groups are role="group" with a name, which NVDA says when focus enters
 * a group. Nothing depends on object descriptions (aria-describedby).
 */
export function KeyboardHelpModal({
  isOpen,
  onClose,
}: KeyboardHelpModalProps): React.ReactElement | null {
  const { t } = useLanguage();

  useModalKeyboard(isOpen, { onEscape: onClose, onCtrlEnter: onClose });

  if (!isOpen) return null;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      titleId={TITLE_ID}
      className="help-dialog"
    >
      <h2 id={TITLE_ID}>{t('helpTitle')}</h2>
      {/* Mounted with the dialog: every opening starts at the first row. */}
      <ShortcutList />
      <div className="modal-actions">
        <button
          type="button"
          id="help-close"
          className="btn-primary"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </div>
    </ModalOverlay>
  );
}

function ShortcutList(): React.ReactElement {
  const { t, tf } = useLanguage();
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const groups = [
    { id: 'global', title: t('helpGroupGlobal'), items: tf.helpShortcuts.global },
    { id: 'main', title: t('helpGroupMain'), items: tf.helpShortcuts.main },
    { id: 'dialogs', title: t('helpGroupDialogs'), items: tf.helpShortcuts.dialogs },
  ];
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  // Focus moves in the key handler, not in an effect: on mount ModalOverlay
  // must still see the element that had focus before F1, to return focus there.
  const moveTo = useCallback((index: number) => {
    setActive(index);
    itemRefs.current[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      let next: number;
      switch (e.key) {
        case 'ArrowDown':
          next = Math.min(active + 1, count - 1);
          break;
        case 'ArrowUp':
          next = Math.max(active - 1, 0);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      moveTo(next);
    },
    [active, count, moveTo],
  );

  let index = 0;
  return (
    // No name of its own: labelled by the dialog title, NVDA said the title twice
    // on opening ("Keyboard shortcuts, dialog | Keyboard shortcuts, list").
    <div
      role="listbox"
      className="help-list"
      onKeyDown={handleKeyDown}
    >
      {groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.title} className="help-group">
          {/* Shown on screen; screen readers get the group name from aria-label. */}
          <div className="help-group-title" aria-hidden="true">
            {group.title}
          </div>
          {group.items.map((item) => {
            const i = index++;
            const isActive = i === active;
            return (
              <div
                key={i}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                id={helpItemId(i)}
                role="option"
                aria-selected={isActive}
                aria-label={helpItemLabel(item)}
                tabIndex={isActive ? 0 : -1}
                className="help-item"
                onClick={() => moveTo(i)}
              >
                <kbd className="help-keys">{item.keys}</kbd>
                <span className="help-action">{item.action}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
