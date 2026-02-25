import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnippetItem } from '../SnippetItem';
import type { SearchResult } from '../../types';

const plain: SearchResult = {
  id: 42,
  title: 'My Snippet',
  score: 1,
  matched_positions: [],
  is_encrypted: false,
};

const encrypted: SearchResult = {
  id: 7,
  title: 'Secret',
  score: 1,
  matched_positions: [],
  is_encrypted: true,
};

const withMatches: SearchResult = {
  id: 3,
  title: 'Hello World',
  score: 1,
  matched_positions: [0, 1, 2],
  is_encrypted: false,
};

describe('SnippetItem', () => {
  it('renders title text', () => {
    render(<SnippetItem snippet={plain} isActive={false} onClick={vi.fn()} />);
    expect(screen.getByText('My Snippet')).toBeInTheDocument();
  });

  it('shows lock icon for encrypted snippets', () => {
    render(<SnippetItem snippet={encrypted} isActive={false} onClick={vi.fn()} />);
    const lock = document.querySelector('[aria-hidden="true"]');
    expect(lock).toBeInTheDocument();
  });

  it('does not show lock icon for unencrypted', () => {
    render(<SnippetItem snippet={plain} isActive={false} onClick={vi.fn()} />);
    const lock = document.querySelector('.lock-icon');
    expect(lock).not.toBeInTheDocument();
  });

  it('lock icon has aria-hidden="true"', () => {
    render(<SnippetItem snippet={encrypted} isActive={false} onClick={vi.fn()} />);
    const lock = document.querySelector('[aria-hidden="true"]');
    expect(lock).toBeInTheDocument();
  });

  it('has correct id="snippet-{id}"', () => {
    render(<SnippetItem snippet={plain} isActive={false} onClick={vi.fn()} />);
    expect(document.getElementById('snippet-42')).toBeInTheDocument();
  });

  it('aria-label includes "encrypted" suffix for encrypted', () => {
    render(<SnippetItem snippet={encrypted} isActive={false} onClick={vi.fn()} />);
    const item = document.getElementById('snippet-7');
    expect(item?.getAttribute('aria-label')).toMatch(/encrypt/i);
  });

  it('aria-label is just title for unencrypted', () => {
    render(<SnippetItem snippet={plain} isActive={false} onClick={vi.fn()} />);
    const item = document.getElementById('snippet-42');
    expect(item?.getAttribute('aria-label')).toBe('My Snippet');
  });

  it('highlights matched positions with <mark>', () => {
    render(<SnippetItem snippet={withMatches} isActive={false} onClick={vi.fn()} />);
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('mark elements have aria-hidden="true"', () => {
    render(<SnippetItem snippet={withMatches} isActive={false} onClick={vi.fn()} />);
    const marks = document.querySelectorAll('mark');
    marks.forEach((m) => expect(m).toHaveAttribute('aria-hidden', 'true'));
  });

  it('applies active class when isActive=true', () => {
    render(<SnippetItem snippet={plain} isActive={true} onClick={vi.fn()} />);
    expect(document.getElementById('snippet-42')).toHaveClass('active');
  });

  it('handles empty matched_positions gracefully', () => {
    render(<SnippetItem snippet={plain} isActive={false} onClick={vi.fn()} />);
    expect(screen.getByText('My Snippet')).toBeInTheDocument();
  });
});
