import { useState, useCallback } from 'react';
import type { SnippetView, SearchResult } from '../types';

/** Data for delete confirmation modal */
export interface DeleteModalData {
  id: number;
  title: string;
}

/** Individual modal state */
export interface Modal<T> {
  isOpen: boolean;
  data: T;
}

/** Modal names */
export type ModalName = 'create' | 'edit' | 'delete' | 'password' | 'settings' | 'exit';

/** All modals managed by this hook */
export interface ModalCollection {
  create: Modal<null>;
  edit: Modal<SnippetView | null>;
  delete: Modal<DeleteModalData>;
  password: Modal<SearchResult | null>;
  settings: Modal<null>;
  exit: Modal<null>;
}

/** Return type of useModalManager */
export interface ModalManager {
  modals: ModalCollection;
  anyModalOpen: boolean;
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  closeAll: () => void;
  setData: (name: 'edit' | 'delete' | 'password', data: any) => void;
}

/**
 * Manages modal visibility and associated data.
 * Replaces the granular state from useModalState with a more structured API.
 */
export function useModalManager(): ModalManager {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExit, setShowExit] = useState(false);

  const [editData, setEditData] = useState<SnippetView | null>(null);
  const [deleteData, setDeleteData] = useState<DeleteModalData>({ id: 0, title: '' });
  const [passwordData, setPasswordData] = useState<SearchResult | null>(null);

  const modals: ModalCollection = {
    create: { isOpen: showCreate, data: null },
    edit: { isOpen: showEdit, data: editData },
    delete: { isOpen: showDelete, data: deleteData },
    password: { isOpen: showPassword, data: passwordData },
    settings: { isOpen: showSettings, data: null },
    exit: { isOpen: showExit, data: null },
  };

  const anyModalOpen = showCreate || showEdit || showDelete || showPassword || showSettings || showExit;

  const openModal = useCallback((name: ModalName) => {
    switch (name) {
      case 'create':
        setShowCreate(true);
        break;
      case 'edit':
        setShowEdit(true);
        break;
      case 'delete':
        setShowDelete(true);
        break;
      case 'password':
        setShowPassword(true);
        break;
      case 'settings':
        setShowSettings(true);
        break;
      case 'exit':
        setShowExit(true);
        break;
    }
  }, []);

  const closeModal = useCallback((name: ModalName) => {
    switch (name) {
      case 'create':
        setShowCreate(false);
        break;
      case 'edit':
        setShowEdit(false);
        break;
      case 'delete':
        setShowDelete(false);
        break;
      case 'password':
        setShowPassword(false);
        break;
      case 'settings':
        setShowSettings(false);
        break;
      case 'exit':
        setShowExit(false);
        break;
    }
  }, []);

  const closeAll = useCallback(() => {
    setShowCreate(false);
    setShowEdit(false);
    setShowDelete(false);
    setShowPassword(false);
    setShowSettings(false);
    setShowExit(false);
  }, []);

  const setData = useCallback(
    (name: 'edit' | 'delete' | 'password', data: any) => {
      switch (name) {
        case 'edit':
          setEditData(data);
          break;
        case 'delete':
          setDeleteData(data);
          break;
        case 'password':
          setPasswordData(data);
          break;
      }
    },
    []
  );

  return {
    modals,
    anyModalOpen,
    openModal,
    closeModal,
    closeAll,
    setData,
  };
}
