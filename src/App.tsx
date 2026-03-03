import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { useModalState } from './hooks/useModalState';
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

  const {
    showCreate, setShowCreate,
    showEdit, setShowEdit,
    showDelete, setShowDelete,
    showPassword, setShowPassword,
    showSettings, setShowSettings,
    showExit, setShowExit,
    editSnippet, setEditSnippet,
    deleteId, setDeleteId,
    deleteTitle, setDeleteTitle,
    passwordSnippet, setPasswordSnippet,
    anyModalOpen,
    closeAll,
  } = useModalState();

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
    setShowPassword(false);
    // Other modals stay open
  }, [setQuery, setActiveIndex, setShowPassword]);

  // ── Focus search box when no modal is open ────────────────────────────
  const focusSearch = useCallback(() => {
    if (!anyModalOpen) searchRef.current?.focus();
  }, [anyModalOpen]);

  // ── Window events (focus, blur, tray, hotkey) ─────────────────────────
  useWindowEvents({
    onInitialFocus: () => searchRef.current?.focus(),
    onShow: () => { focusSearch(); setRefreshTick((n) => n + 1); },
    onBlur: partialReset,
    onTrayCreate: () => setShowCreate(true),
    onTraySettings: () => setShowSettings(true),
    onCloseRequest: () => setShowExit(true),
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

  // ── Modal helpers ─────────────────────────────────────────────────────
  const openEdit = useCallback(async () => {
    const active = snippets[activeIndex];
    if (!active) return;
    try {
      const sv = await getSnippetById(active.id);
      setEditSnippet(sv);
      setShowEdit(true);
    } catch (err) { addToast(String(err), 'error'); }
  }, [snippets, activeIndex, addToast]);

  const openDelete = useCallback(() => {
    const active = snippets[activeIndex];
    if (!active) return;
    setDeleteId(active.id);
    setDeleteTitle(active.title);
    setShowDelete(true);
  }, [snippets, activeIndex]);

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
    onOpenCreate: () => setShowCreate(true),
    onOpenEdit: () => void openEdit(),
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


