import { useState, useCallback } from 'react';
import type { SearchResult } from '../types';

export interface SnippetsState {
  snippets: SearchResult[];
  activeIndex: number;
  query: string;
  setSnippets: (snippets: SearchResult[]) => void;
  setQuery: (query: string) => void;
  setActiveIndex: (index: number) => void;
  resetState: () => void;
}

export function useSnippets(): SnippetsState {
  const [snippets, setSnippets] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [query, setQuery] = useState<string>('');

  const resetState = useCallback(() => {
    setSnippets([]);
    setActiveIndex(-1);
    setQuery('');
  }, []);

  return {
    snippets,
    activeIndex,
    query,
    setSnippets,
    setQuery,
    setActiveIndex,
    resetState,
  };
}
