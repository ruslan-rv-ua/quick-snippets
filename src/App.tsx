import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

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

import type { SearchResult, SnippetView } from './types';
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

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExit, setShowExit] = useState(false);

  // Data for modals
  const [editSnippet, setEditSnippet] = useState<SnippetView | null>(null);
  const [deleteId, setDeleteId] = useState(0);
  const [deleteTitle, setDeleteTitle] = useState('');
  const [passwordSnippet, setPasswordSnippet] = useState<SearchResult | null>(null);

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
    setShowPassword(false);
    setShowCreate(false);
    setShowEdit(false);
    setShowDelete(false);
    setShowSettings(false);
    setShowExit(false);
    getCurrentWindow().hide().catch(() => void 0);
  }, [resetState]);

  // ── Partial reset (blur) ──────────────────────────────────────────────
  const partialReset = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    setShowPassword(false);
    // Other modals stay open
  }, [setQuery, setActiveIndex]);

  // ── Focus search box on window focus (hotkey / tray / startup) ────────
  const focusSearch = useCallback(() => {
    if (!showCreate && !showEdit && !showDelete && !showPassword && !showSettings && !showExit) {
      searchRef.current?.focus();
    }
  }, [showCreate, showEdit, showDelete, showPassword, showSettings, showExit]);

  // Focus on initial mount (small delay to let the webview fully activate)
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Focus + reload snippets whenever the OS gives focus to the window
  useEffect(() => {
    function handleWindowFocus() {
      focusSearch();
      setRefreshTick((n) => n + 1);
    }
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [focusSearch]);

  // ── Window blur ───────────────────────────────────────────────────────
  useEffect(() => {
    function handleBlur() { partialReset(); }
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [partialReset]);

  // ── Escape key on empty query → hide window ───────────────────────────
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && query === '') {
        // Only if no modal is open
        if (!showCreate && !showEdit && !showDelete && !showPassword && !showSettings && !showExit) {
          hideWindow();
        }
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [query, hideWindow, showCreate, showEdit, showDelete, showPassword, showSettings, showExit]);

  // ── Tauri event subscriptions ─────────────────────────────────────────
  useEffect(() => {
    const unlisten1 = listen('tray:create-snippet', () => setShowCreate(true));
    const unlisten2 = listen('tray:open-settings', () => setShowSettings(true));
    const unlisten3 = listen('window:close-request', () => setShowExit(true));
    // Fired by Rust whenever the window is programmatically shown (hotkey / tray).
    // Belt-and-suspenders alongside the native `window focus` handler.
    const unlisten4 = listen('window:show', () => {
      setRefreshTick((n) => n + 1);
      // focusSearch is not accessible here (stale closure), so
      // rely on the native 'focus' handler that fires right after show.
    });

    return () => {
      void unlisten1.then((fn) => fn());
      void unlisten2.then((fn) => fn());
      void unlisten3.then((fn) => fn());
      void unlisten4.then((fn) => fn());
    };
  }, []);

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
          .catch(() => void 0);
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
    } catch { /* ignore */ }
  }, [snippets, activeIndex]);

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
      .catch(() => void 0);
  }, [debouncedQuery, setSnippets, setActiveIndex]);

  // Announce for accessibility
  const handleAnnounce = useCallback(() => {
    const active = snippets[activeIndex];
    if (active) {
      addToast(
        `${active.title}${active.is_encrypted ? ', ' + t('encrypted') : ''}, ${activeIndex + 1} of ${snippets.length}`,
        'info',
        3000,
      );
    }
  }, [snippets, activeIndex, t, addToast]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  const anyModalOpen = showCreate || showEdit || showDelete || showPassword || showSettings || showExit;

  useKeyboard({
    activeIndex,
    disabled: anyModalOpen,
    onOpenCreate: () => setShowCreate(true),
    onOpenEdit: () => void openEdit(),
    onOpenDelete: openDelete,
    onOpenSettings: () => setShowSettings(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onAnnounce: handleAnnounce,
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


