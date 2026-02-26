import React, { useCallback } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import type { SearchResult } from '../types';

export interface SnippetItemProps {
  snippet: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

/** Builds a highlighted React node from the title and matched positions. */
function buildHighlightedTitle(
  title: string,
  positions: number[],
): React.ReactNode[] {
  if (positions.length === 0) return [title];

  const posSet = new Set(positions);
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < title.length) {
    if (posSet.has(i)) {
      // Collect consecutive matched positions
      let j = i;
      while (j < title.length && posSet.has(j)) j++;
      nodes.push(
        <mark key={`m-${i}`} aria-hidden="true">
          {title.slice(i, j)}
        </mark>,
      );
      i = j;
    } else {
      // Collect consecutive unmatched
      let j = i;
      while (j < title.length && !posSet.has(j)) j++;
      nodes.push(title.slice(i, j));
      i = j;
    }
  }

  return nodes;
}

export function SnippetItem({
  snippet,
  isActive,
  onClick,
}: SnippetItemProps): React.ReactElement {
  const { tf } = useLanguage();

  const ariaLabel = tf.snippetLabel(snippet.title, snippet.is_encrypted);
  const highlighted = buildHighlightedTitle(snippet.title, snippet.matched_positions);

  const handleClick = useCallback(() => onClick(), [onClick]);

  return (
    <div
      id={`snippet-${snippet.id}`}
      role="option"
      aria-selected={isActive}
      aria-label={ariaLabel}
      className={`snippet-item${isActive ? ' active' : ''}`}
      onClick={handleClick}
    >
      <span className="snippet-title">{highlighted}</span>
      {snippet.is_encrypted && (
        <svg
          className="lock-icon"
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 7V5.5a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}
