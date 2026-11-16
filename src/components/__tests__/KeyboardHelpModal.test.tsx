import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { act } from 'react';
import { KeyboardHelpModal, helpItemLabel } from '../KeyboardHelpModal';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations, type HelpShortcuts } from '../../i18n/translations';
import type { LangCode } from '../../types';
import readmeEn from '../../../README.md?raw';
import readmeUk from '../../../README_UK.md?raw';
import readmeDe from '../../../README_DE.md?raw';

const mockInvoke = vi.mocked(invoke);

const GROUPS: (keyof HelpShortcuts)[] = ['global', 'main', 'dialogs'];

function allRows(lang: LangCode) {
  const s = translations[lang].helpShortcuts;
  return GROUPS.flatMap((g) => s[g]);
}

/** Renders the dialog in `lang` (loaded like at app start) and returns its parts. */
async function openHelp(lang: LangCode = 'en') {
  mockInvoke.mockImplementation(async (cmd: string) =>
    cmd === 'get_settings' ? { language: lang } : undefined,
  );
  const onClose = vi.fn();
  const utils = render(
    <LanguageProvider>
      <button type="button">before</button>
      <KeyboardHelpModal isOpen={false} onClose={onClose} />
    </LanguageProvider>,
  );
  await act(async () => {});
  const before = screen.getByRole('button', { name: 'before' });
  before.focus();
  utils.rerender(
    <LanguageProvider>
      <button type="button">before</button>
      <KeyboardHelpModal isOpen={true} onClose={onClose} />
    </LanguageProvider>,
  );
  const dialog = await screen.findByRole('dialog');
  const list = within(dialog).getByRole('listbox');
  const options = within(list).getAllByRole('option');
  return { ...utils, dialog, list, options, onClose, before };
}

/**
 * The first cells of the Keyboard Shortcuts tables in a README, per table
 * (global, main window, forms and dialogs).
 */
function readmeKeys(md: string, heading: string): string[][] {
  const lines = md.split(/\r?\n/);
  const start = lines.indexOf(`## ${heading}`);
  expect(start, `README heading "## ${heading}"`).toBeGreaterThanOrEqual(0);
  const tables: string[][] = [];
  let headerSeen = false;
  for (let i = start + 1; i < lines.length && lines[i] !== '---'; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      tables.push([]);
      headerSeen = false;
      continue;
    }
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    // The first row of each table is its header.
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }
    tables[tables.length - 1].push(line.split('|')[1].trim());
  }
  return tables;
}

describe('KeyboardHelpModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders nothing when closed', () => {
    render(<KeyboardHelpModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a dialog named "Keyboard shortcuts" without a description', async () => {
    const { dialog } = await openHelp();
    expect(dialog).toHaveAccessibleName('Keyboard shortcuts');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Screen readers must not need "Report object descriptions" here.
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('lists every shortcut as an option named "keys, action", in three named groups', async () => {
    const { list, options } = await openHelp();
    const en = translations.en;
    const groups = within(list).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      en.helpGroupGlobal,
      en.helpGroupMain,
      en.helpGroupDialogs,
    ]);
    GROUPS.forEach((g, i) => {
      expect(within(groups[i]).getAllByRole('option')).toHaveLength(en.helpShortcuts[g].length);
    });
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(
      allRows('en').map(helpItemLabel),
    );
    expect(screen.getByRole('option', { name: 'F1, Show this list of keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ctrl+Alt+Space, Show the QuickSnippets window' })).toBeInTheDocument();
  });

  it('reads the comma and the slash as words', async () => {
    await openHelp();
    expect(screen.getByRole('option', { name: 'Ctrl+Comma, Open Settings' })).toHaveTextContent('Ctrl+,');
    expect(screen.getByRole('option', { name: 'Ctrl+F or Slash, Go to the search box' })).toHaveTextContent('Ctrl+F or /');
  });

  it('shows the descriptions in the current UI language', async () => {
    const { dialog } = await openHelp('uk');
    expect(dialog).toHaveAccessibleName('Гарячі клавіші');
    expect(screen.getByRole('option', { name: 'F1, Показати цей список гарячих клавіш' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрити' })).toBeInTheDocument();
  });

  it('puts focus on the first row when it opens, with only that row in the Tab order', async () => {
    const { options } = await openHelp();
    expect(options[0]).toHaveFocus();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options.filter((o) => o.tabIndex === 0)).toEqual([options[0]]);
  });

  it('moves focus one row at a time with the arrow keys, and to the ends with Home and End', async () => {
    const { options } = await openHelp();
    const last = options.length - 1;

    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(options[1]).toHaveFocus();
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1].tabIndex).toBe(0);
    expect(options[0].tabIndex).toBe(-1);

    fireEvent.keyDown(options[1], { key: 'ArrowUp' });
    expect(options[0]).toHaveFocus();

    // No wrapping at either end.
    fireEvent.keyDown(options[0], { key: 'ArrowUp' });
    expect(options[0]).toHaveFocus();

    fireEvent.keyDown(options[0], { key: 'End' });
    expect(options[last]).toHaveFocus();
    fireEvent.keyDown(options[last], { key: 'ArrowDown' });
    expect(options[last]).toHaveFocus();

    fireEvent.keyDown(options[last], { key: 'Home' });
    expect(options[0]).toHaveFocus();
  });

  it('can be read row by row through all groups', async () => {
    const { options } = await openHelp();
    for (let i = 1; i < options.length; i++) {
      fireEvent.keyDown(options[i - 1], { key: 'ArrowDown' });
      expect(options[i]).toHaveFocus();
    }
  });

  it('Escape closes it', async () => {
    const { onClose, options } = await openHelp();
    fireEvent.keyDown(options[0], { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('the Close button closes it', async () => {
    const { onClose } = await openHelp();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('returns focus to where it was before when it closes', async () => {
    const { before, rerender, onClose } = await openHelp();
    expect(before).not.toHaveFocus();
    rerender(
      <LanguageProvider>
        <button type="button">before</button>
        <KeyboardHelpModal isOpen={false} onClose={onClose} />
      </LanguageProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(before).toHaveFocus();
  });

  it('starts at the first row again when it is opened again', async () => {
    const { options, rerender, onClose } = await openHelp();
    fireEvent.keyDown(options[0], { key: 'End' });
    const tree = (open: boolean) => (
      <LanguageProvider>
        <button type="button">before</button>
        <KeyboardHelpModal isOpen={open} onClose={onClose} />
      </LanguageProvider>
    );
    rerender(tree(false));
    rerender(tree(true));
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Keyboard shortcuts help content', () => {
  const readmes: [LangCode, string, string][] = [
    ['en', readmeEn, 'Keyboard Shortcuts'],
    ['uk', readmeUk, 'Гарячі клавіші'],
    ['de', readmeDe, 'Tastenkürzel'],
  ];

  it.each(readmes)('%s: has every shortcut of the README tables, in the same groups and order', (lang, md, heading) => {
    const tables = readmeKeys(md, heading);
    const help = translations[lang].helpShortcuts;
    expect(GROUPS.map((g) => help[g].map((r) => r.keys))).toEqual(tables);
    expect(help.main.map((r) => r.keys)).toContain('F1');
  });

  it('has the same number of rows in every language', () => {
    for (const lang of ['uk', 'de'] as LangCode[]) {
      for (const g of GROUPS) {
        expect(translations[lang].helpShortcuts[g]).toHaveLength(translations.en.helpShortcuts[g].length);
      }
    }
  });

  it('every row has keys and an action', () => {
    for (const lang of ['en', 'uk', 'de'] as LangCode[]) {
      for (const row of allRows(lang)) {
        expect(row.keys.trim()).not.toBe('');
        expect(row.action.trim()).not.toBe('');
      }
    }
  });
});
