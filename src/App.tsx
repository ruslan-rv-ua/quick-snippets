import React, { useEffect, useCallback, useRef } from 'react';

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
  getPendingNotification,
  cancelClose,
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

// ── Inner app (inside providers) ─────────────────────────────────────────

function AppInner(): React.ReactElement {
  const { t } = useLanguage();
  const { toasts, addToast, removeToast } = useToast();
  const {
    query,
    setQuery,
    snippets,
    activeIndex,
    setActiveIndex,
    setRefreshTick,
    reset,
  } = useSearchLogic();

  const searchRef = useRef<SearchBoxHandle>(null);

  // ── Pending notification on startup ──────────────────────────────────
  useEffect(() => {
    getPendingNotification()
      .then((msg) => {
        if (msg && typeof msg === 'string') addToast(msg, 'warning', 5000);
      })
      .catch(() => void 0);
  }, [addToast]);

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
          onClose={() => setShowPassword(false)}
          snippetId={passwordSnippet.id}
          snippetTitle={passwordSnippet.title}
          onSuccess={() => {
            addToast(t('copySuccess'), 'success');
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


