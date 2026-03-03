import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { useModalManager } from './hooks/useModalManager';
import { useWindowLifecycle } from './hooks/useWindowLifecycle';
import { useWindowEvents } from './hooks/useWindowEvents';

import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useLanguage } from './hooks/useLanguage';
import { useSnippets } from './hooks/useSnippets';
import { useToast } from './hooks/useToast';
import { useDebounce } from './hooks/useDebounce';
import { useKeyboard } from './hooks/useKeyboard';
import {
  searchSnippets,
  getSnippetById,
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
  const { snippets, setSnippets, activeIndex, setActiveIndex, query, setQuery, resetState } =
    useSnippets();

  const debouncedQuery = useDebounce(query, 100);
  const searchRef = useRef<SearchBoxHandle>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Use new modal manager hook
  const { modals, anyModalOpen, openModal, closeModal, closeAll, setData } = useModalManager();

  // ── Fetch snippets on debounced query change OR window show ────────────
  useEffect(() => {
    searchSnippets(debouncedQuery)
      .then((results) => {
        const safeResults = Array.isArray(results) ? results : [];
        setSnippets(safeResults);
        setActiveIndex(safeResults.length > 0 ? 0 : -1);
      })
      .catch(() => void 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, refreshTick, setSnippets, setActiveIndex]);

  // ── Pending notification on startup ──────────────────────────────────
  useEffect(() => {
    getPendingNotification()
      .then((msg) => {
        if (msg && typeof msg === 'string') addToast(msg, 'warning', 5000);
      })
      .catch(() => void 0);
  }, [addToast]);

  // ── Full reset + hide window ──────────────────────────────────────────
  const hideWindow = useCallback(() => {
    resetState();
    closeAll();
    getCurrentWindow().hide().catch(() => void 0);
  }, [resetState, closeAll]);

  // ── Partial reset (blur) ──────────────────────────────────────────────
  const partialReset = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    closeModal('password');
    // Other modals stay open
  }, [setQuery, setActiveIndex, closeModal]);

  // ── Focus search box when no modal is open ────────────────────────────
  const focusSearch = useCallback(() => {
    if (!anyModalOpen) searchRef.current?.focus();
  }, [anyModalOpen]);

  // ── Window lifecycle ────────────────────────────────────────────────────
  useWindowLifecycle({
    onFocus: () => {
      focusSearch();
      hideWindow();
    },
    onBlur: partialReset,
  });

  // ── Window events (tray, hotkey, etc.) ──────────────────────────────────
  useWindowEvents({
    onInitialFocus: () => searchRef.current?.focus(),
    onShow: () => { focusSearch(); setRefreshTick((n) => n + 1); },
    onBlur: partialReset,
    onTrayCreate: () => openModal('create'),
    onTraySettings: () => openModal('settings'),
    onCloseRequest: () => openModal('exit'),
  });

  // ── Escape key on empty query → hide window ───────────────────────────
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && query === '' && !anyModalOpen) {
        hideWindow();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [query, hideWindow, anyModalOpen]);

  // ── Snippet activation ────────────────────────────────────────────────
  const handleActivate = useCallback(
    (snippet: SearchResult) => {
      if (snippet.is_encrypted) {
        setData('password', snippet);
        openModal('password');
      } else {
        activateSnippet(snippet.id, '')
          .then(() => {
            addToast(t('copySuccess'), 'success');
            hideWindow();
          })
          .catch((err: unknown) => addToast(String(err), 'error'));
      }
    },
    [t, addToast, hideWindow, openModal, setData],
  );

  // ── Modal helpers ─────────────────────────────────────────────────────
  const openEdit = useCallback(async () => {
    const active = snippets[activeIndex];
    if (!active) return;
    try {
      const sv = await getSnippetById(active.id);
      setData('edit', sv);
      openModal('edit');
    } catch (err) { addToast(String(err), 'error'); }
  }, [snippets, activeIndex, addToast, openModal, setData]);

  const openDelete = useCallback(() => {
    const active = snippets[activeIndex];
    if (!active) return;
    setData('delete', { id: active.id, title: active.title });
    openModal('delete');
  }, [snippets, activeIndex, openModal, setData]);

  // Reload snippets list after CRUD
  const refreshSnippets = useCallback(() => {
    searchSnippets(debouncedQuery)
      .then((results) => {
        setSnippets(results);
        setActiveIndex(results.length > 0 ? 0 : -1);
      })
      .catch((err: unknown) => addToast(String(err), 'error'));
  }, [debouncedQuery, setSnippets, setActiveIndex, addToast]);

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
    onOpenCreate: () => openModal('create'),
    onOpenEdit: () => void openEdit(),
    onOpenDelete: openDelete,
    onOpenSettings: () => openModal('settings'),
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
        isOpen={modals.create.isOpen}
        onClose={() => closeModal('create')}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          refreshSnippets();
        }}
      />

      <EditSnippetModal
        isOpen={modals.edit.isOpen}
        onClose={() => closeModal('edit')}
        snippet={modals.edit.data}
        onSuccess={() => {
          addToast(t('saveSuccess'), 'success');
          refreshSnippets();
        }}
      />

      <DeleteConfirmModal
        isOpen={modals.delete.isOpen}
        onClose={() => closeModal('delete')}
        snippetTitle={modals.delete.data.title}
        snippetId={modals.delete.data.id}
        onSuccess={() => {
          addToast(t('deleteSuccess'), 'success');
          refreshSnippets();
        }}
      />

      {modals.password.data && (
        <PasswordModal
          isOpen={modals.password.isOpen}
          onClose={() => closeModal('password')}
          snippetId={modals.password.data!.id}
          snippetTitle={modals.password.data!.title}
          onSuccess={() => {
            addToast(t('copySuccess'), 'success');
            hideWindow();
          }}
        />
      )}

      <SettingsModal
        isOpen={modals.settings.isOpen}
        onClose={() => closeModal('settings')}
        onError={(msg) => addToast(msg, 'error')}
      />

      <ExitConfirmModal
        isOpen={modals.exit.isOpen}
        onClose={() => {
          closeModal('exit');
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


