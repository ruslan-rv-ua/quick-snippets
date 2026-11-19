import React, { useEffect, useState, useCallback, useRef } from 'react';

import { useAppModals } from './hooks/useAppModals';
import { useWindowHiding } from './hooks/useWindowHiding';

import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useLanguage } from './hooks/useLanguage';
import { useSearchLogic } from './hooks/useSearchLogic';
import { useToast } from './hooks/useToast';
import { useKeyboard } from './hooks/useKeyboard';
import {
  activateSnippet,
  autotypeSnippet,
  getPendingNotification,
  cancelClose,
  frontendReady,
  getSettings,
  updateSettings,
} from './hooks/useIpc';

import { SearchBox } from './components/SearchBox';
import type { SearchBoxHandle } from './components/SearchBox';
import { SnippetList } from './components/SnippetList';
import { CreateSnippetModal } from './components/CreateSnippetModal';
import { EditSnippetModal } from './components/EditSnippetModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { PasswordModal } from './components/PasswordModal';
import { SettingsModal } from './components/SettingsModal';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';
import { ToastContainer } from './components/ToastContainer';

import type { SearchResult } from './types';
import './styles/theme.css';

function getSortLabelKey(mode: string, direction: string): string {
  const map: Record<string, string> = {
    'created_desc': 'sortCreatedDesc',
    'created_asc': 'sortCreatedAsc',
    'modified_desc': 'sortModifiedDesc',
    'modified_asc': 'sortModifiedAsc',
    'alphabetical_asc': 'sortAlphaAsc',
    'alphabetical_desc': 'sortAlphaDesc',
    'last_used_desc': 'sortLastUsedDesc',
    'last_used_asc': 'sortLastUsedAsc',
  };
  return map[`${mode}_${direction}`] ?? 'sortModifiedDesc';
}

const DEFAULT_DIRECTIONS: Record<string, string> = {
  created: 'desc',
  modified: 'desc',
  alphabetical: 'asc',
  last_used: 'desc',
};

/**
 * Main application component (inside theme/language providers).
 *
 * ## State Management
 *
 * - Snippets list & search: useSearchLogic() hook
 * - Modal dialogs: useModalState() hook
 * - Window events (blur/show): useWindowEvents() hook
 * - Keyboard shortcuts: useKeyboard() hook
 *
 * ## Key Behaviors
 *
 * - Search is debounced (100ms) to reduce Rust backend load
 * - Blur (window loses focus) → hide + partial reset (clear password modal, keep other modals)
 * - Exit dialog confirmation → blur does NOT hide (so user can click Cancel)
 * - Search input auto-focus when modals close
 *
 * ## Future Improvements
 *
 * Consider splitting into sub-hooks to reduce component complexity:
 * - useSearchLogic() — search debouncing, IPC calls
 * - useAppModals() — modal state + all handlers
 * - useWindowHiding() — hide/reset logic
 */
function AppInner(): React.ReactElement {
  const { t, tf } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();

  const [sortMode, setSortMode] = useState('modified');
  const [sortDirection, setSortDirection] = useState('desc');

  const {
    query,
    setQuery,
    snippets,
    activeIndex,
    setActiveIndex,
    listFocused,
    setListFocused,
    setRefreshTick,
    reload,
    reset,
  } = useSearchLogic({ sortMode, sortDirection });

  const searchRef = useRef<SearchBoxHandle>(null);
  const [autotypeMode, setAutotypeMode] = useState(false);

  // ── Tell the backend when the page is ready to be seen ────────────────
  // The window is created hidden, and without "Start in tray" the backend shows it only after
  // this. Answers come back in the order the requests were sent. The first reload ends after
  // everything requested on mount (theme, language, sort order) has been answered; the second
  // one loads the list with the sort order those answers brought. The window then appears
  // complete: no theme switch and no list in another order a moment later.
  //
  // Until it is shown, the list is left as it is whenever the window is hidden: with nothing
  // selected. A screen reader in the search box reads the first snippet only when it becomes
  // the selected one, and that has to happen after the window is shown, on the reload the show
  // brings. Clearing the selection only at the show would be too late: unselected and selected
  // again within a few milliseconds, the snippet does not count as newly selected.
  useEffect(() => {
    reload()
      .then(() => reload())
      .then(() => {
        // The window is still hidden, unless the backend gave up waiting and showed it.
        if (!document.hasFocus()) setActiveIndex(-1);
        return frontendReady();
      })
      .catch(() => void 0);
  }, [reload, setActiveIndex]);

  // ── Pending notification on startup ──────────────────────────────────
  useEffect(() => {
    getPendingNotification()
      .then((msg) => {
        if (msg && typeof msg === 'string') addToast(msg, 'warning', 5000);
      })
      .catch(() => void 0);
  }, [addToast]);

  // ── Load sort settings on mount ────────────────────────────────────
  useEffect(() => {
    getSettings()
      .then((s) => {
        setSortMode(s.sort_mode || 'modified');
        setSortDirection(s.sort_direction || 'desc');
      })
      .catch(() => void 0);
  }, []);

  const {
    showCreate, setShowCreate,
    showEdit, setShowEdit,
    showDelete, setShowDelete,
    showPassword, setShowPassword,
    showSettings, setShowSettings,
    showExit, setShowExit,
    showHelp, setShowHelp,
    editSnippet,
    deleteId,
    deleteTitle,
    passwordSnippet, setPasswordSnippet,
    anyModalOpen,
    closeAll,
    openEdit,
    openDelete,
  } = useAppModals({
    snippets,
    activeIndex,
    addToast,
  });

  // ── Full reset + hide window ──────────────────────────────────────────
  const { hideWindow } = useWindowHiding({
    reset,
    closeAll,
    anyModalOpen,
    query,
    searchRef,
    setRefreshTick,
    setQuery,
    setActiveIndex,
    setListFocused,
    setShowPassword,
    setShowCreate,
    setShowSettings,
    setShowExit,
    setAutotypeMode,
  });

  // ── Snippet activation ────────────────────────────────────────────────
  const handleActivate = useCallback(
    (snippet: SearchResult) => {
      if (snippet.is_encrypted) {
        setPasswordSnippet(snippet);
        setShowPassword(true);
      } else {
        activateSnippet(snippet.id, '')
          .then(() => {
            addToast(t('copySuccess'), 'success');
            hideWindow();
          })
          .catch((err: unknown) => addToast(String(err), 'error'));
      }
    },
    [t, addToast, hideWindow],
  );

  // ── Snippet auto-type ──────────────────────────────────────────────────
  const handleAutotype = useCallback(
    (snippet: SearchResult) => {
      if (snippet.is_encrypted) {
        setAutotypeMode(true);
        setPasswordSnippet(snippet);
        setShowPassword(true);
      } else {
        autotypeSnippet(snippet.id, '')
          .then(() => {
            addToast(t('autotypeSuccess'), 'success');
            hideWindow();
          })
          .catch((err: unknown) => addToast(String(err), 'error'));
      }
    },
    [t, addToast, hideWindow, setPasswordSnippet, setShowPassword],
  );

  // Announce for accessibility
  const handleAnnounce = useCallback(() => {
    const active = snippets[activeIndex];
    if (active) {
      addToast(
        `${active.title}${active.is_encrypted ? ', ' + t('encrypted') : ''}, ${activeIndex + 1} ${t('of')} ${snippets.length}`,
        'info',
        3000,
      );
    }
  }, [snippets, activeIndex, t, addToast]);

  // ── Sort handler ─────────────────────────────────────────────────────
  const handleSort = useCallback(
    (mode: string) => {
      let newDirection: string;
      if (mode === sortMode) {
        newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        newDirection = DEFAULT_DIRECTIONS[mode] ?? 'desc';
      }
      setSortMode(mode);
      setSortDirection(newDirection);
      // The screen reader reads the first snippet of the sorted list.
      setListFocused(true);

      // Persist to settings
      updateSettings({ sort_mode: mode, sort_direction: newDirection }).catch(() => void 0);

      // Toast with translated label
      const labelKey = getSortLabelKey(mode, newDirection);
      const label = tf[labelKey as keyof typeof tf] as string;
      const toastMsg = tf.sortToast(label);
      addToast(toastMsg, 'info', 2000);
    },
    [sortMode, sortDirection, tf, addToast, setListFocused],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useKeyboard({
    activeIndex,
    disabled: anyModalOpen,
    onOpenCreate: () => setShowCreate(true),
    onOpenEdit: openEdit,
    onOpenDelete: openDelete,
    onOpenSettings: () => setShowSettings(true),
    onOpenHelp: () => setShowHelp(true),
    onFocusSearch: () => {
      setListFocused(false);
      searchRef.current?.focus();
    },
    onAnnounce: handleAnnounce,
    onSelectFirst: () => setActiveIndex(snippets.length > 0 ? 0 : -1),
    onSelectLast: () => setActiveIndex(snippets.length > 0 ? snippets.length - 1 : -1),
    onSort: handleSort,
  });

  return (
    <div role="application" className="app" tabIndex={-1}>
      <SearchBox
        ref={searchRef}
        value={query}
        onChange={setQuery}
        snippets={snippets}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onActivate={handleActivate}
        onAutotype={handleAutotype}
        sortLabel={query ? undefined : `\u2195 ${tf[getSortLabelKey(sortMode, sortDirection) as keyof typeof tf] as string}`}
        listFocused={listFocused}
        onListFocusChange={setListFocused}
      />
      <SnippetList
        snippets={snippets}
        activeIndex={activeIndex}
        query={query}
        onActiveIndexChange={setActiveIndex}
        onActivate={handleActivate}
      />

      {/* After a change the dialogs close only once the list is loaded again (they await
          onSuccess): focus then comes back once, to the snippet selected in the new list. */}
      <CreateSnippetModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          return reload();
        }}
      />

      <EditSnippetModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        snippet={editSnippet}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          return reload();
        }}
      />

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        snippetTitle={deleteTitle}
        snippetId={deleteId}
        onSuccess={() => {
          addToast(t('deleteSuccess'), 'success');
          return reload();
        }}
        onError={(err) => addToast(err, 'error')}
      />

      {passwordSnippet && (
        <PasswordModal
          isOpen={showPassword}
          onClose={() => {
            setShowPassword(false);
            setAutotypeMode(false); // RC-3: reset autotype mode on modal close
          }}
          snippetId={passwordSnippet.id}
          snippetTitle={passwordSnippet.title}
          action={autotypeMode ? 'autotype' : 'copy'}
          onSuccess={() => {
            addToast(t(autotypeMode ? 'autotypeSuccess' : 'copySuccess'), 'success');
            hideWindow();
          }}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onError={(msg) => addToast(msg, 'error')}
      />

      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      <ExitConfirmModal
        isOpen={showExit}
        onClose={() => {
          setShowExit(false);
          cancelClose().catch(() => void 0);
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

// ── Root App with providers ───────────────────────────────────────────────

export default function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </ThemeProvider>
  );
}


