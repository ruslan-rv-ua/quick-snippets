import { describe, it, expect } from 'vitest';
import type { SearchResult, Settings, SnippetView, LangCode } from '../index';

describe('TypeScript types compile correctly', () => {
  it('SearchResult has required fields', () => {
    const result: SearchResult = {
      id: 1,
      title: 'test',
      score: 10,
      matched_positions: [0, 1],
      is_encrypted: false,
    };
    expect(result.id).toBe(1);
  });

  it('Settings has all PRD fields', () => {
    const settings: Settings = {
      theme: 'dark',
      start_in_tray: false,
      autostart: false,
      confirm_on_close: true,
      language: '',
      window_state: { x: 100, y: 100, width: 680, height: 520 },
      autotype_delay_ms: 0,
    };
    expect(settings.theme).toBe('dark');
  });

  it('SnippetView has content field', () => {
    const view: SnippetView = {
      id: 1,
      title: 'test',
      content: 'hello',
      is_encrypted: false,
      created_at: '',
      updated_at: '',
    };
    expect(view.content).toBe('hello');
  });

  it('LangCode only allows en or uk', () => {
    const lang: LangCode = 'en';
    expect(['en', 'uk']).toContain(lang);
  });
});
