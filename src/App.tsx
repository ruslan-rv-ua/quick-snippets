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
  getSettings,
  saveSettings,
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
 * - Snippets list & search: useSnippets() hook
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
    setRefreshTick,
    reset,
  } = useSearchLogic({ sortMode, sortDirection });

  const searchRef = useRef<SearchBoxHandle>(null);
  const [autotypeMode, setAutotypeMode] = useState(false);

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

  // Reload snippets list after CRUD
  const refreshSnippets = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, [setRefreshTick]);

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

      // Persist to settings
      getSettings()
        .then((s) => saveSettings({ ...s, sort_mode: mode, sort_direction: newDirection }))
        .catch(() => void 0);

      // Toast with translated label
      const labelKey = getSortLabelKey(mode, newDirection);
      const label = tf[labelKey as keyof typeof tf] as string;
      const toastMsg = tf.sortToast(label);
      addToast(toastMsg, 'info', 2000);
    },
    [sortMode, sortDirection, tf, addToast],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useKeyboard({
    activeIndex,
    disabled: anyModalOpen,
    onOpenCreate: () => setShowCreate(true),
    onOpenEdit: openEdit,
    onOpenDelete: openDelete,
    onOpenSettings: () => setShowSettings(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onAnnounce: handleAnnounce,
    onSelectFirst: () => setActiveIndex(snippets.length > 0 ? 0 : -1),
    onSelectLast: () => setActiveIndex(snippets.length > 0 ? snippets.length - 1 : -1),
    onSort: handleSort,
  });

  return (
    <div role="application" className="app">
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
      />
      <SnippetList
        snippets={snippets}
        activeIndex={activeIndex}
        query={query}
        onActiveIndexChange={setActiveIndex}
        onActivate={handleActivate}
      />

      <CreateSnippetModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          refreshSnippets();
        }}
      />

      <EditSnippetModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        snippet={editSnippet}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          refreshSnippets();
        }}
      />

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        snippetTitle={deleteTitle}
        snippetId={deleteId}
        onSuccess={() => {
          addToast(t('deleteSuccess'), 'success');
          refreshSnippets();
        }}
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


