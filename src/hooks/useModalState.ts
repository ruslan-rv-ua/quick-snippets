import { useState, useCallback } from 'react';
import type { SnippetView, SearchResult } from '../types';

export interface ModalState {
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  showEdit: boolean;
  setShowEdit: (v: boolean) => void;
  showDelete: boolean;
  setShowDelete: (v: boolean) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showExit: boolean;
  setShowExit: (v: boolean) => void;
  editSnippet: SnippetView | null;
  setEditSnippet: (v: SnippetView | null) => void;
  deleteId: number;
  setDeleteId: (v: number) => void;
  deleteTitle: string;
  setDeleteTitle: (v: string) => void;
  passwordSnippet: SearchResult | null;
  setPasswordSnippet: (v: SearchResult | null) => void;
  /** True when any modal is currently visible. */
  anyModalOpen: boolean;
  /** Close all modals at once. */
  closeAll: () => void;
}

/**
 * Centralises all modal visibility flags and their associated data.
 */
export function useModalState(): ModalState {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExit, setShowExit] = useState(false);

  const [editSnippet, setEditSnippet] = useState<SnippetView | null>(null);
  const [deleteId, setDeleteId] = useState(0);
  const [deleteTitle, setDeleteTitle] = useState('');
  const [passwordSnippet, setPasswordSnippet] = useState<SearchResult | null>(null);

  const anyModalOpen =
    showCreate || showEdit || showDelete || showPassword || showSettings || showExit;

  const closeAll = useCallback(() => {
    setShowCreate(false);
    setShowEdit(false);
    setShowDelete(false);
    setShowPassword(false);
    setShowSettings(false);
    setShowExit(false);
  }, []);

  return {
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
  };
}
