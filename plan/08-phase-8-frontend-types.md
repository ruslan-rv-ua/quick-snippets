# Фаза 8 — Frontend: типи, IPC та i18n

## Завдання

1. **`src/types/index.ts`**: TypeScript-інтерфейси синхронізовані з Rust-структурами:
   - `Snippet`, `SnippetView`, `SearchResult { id, title, score, matched_positions, is_encrypted }`
   - `Settings`, `WindowState`
   - `LangCode = 'en' | 'uk'`
2. **`src/hooks/useIpc.ts`**: типізовані обгортки над `invoke()` — по одній функції на кожну Tauri-команду; всі повертають `Promise`
3. **`src/i18n/translations.ts`**: `translations: Record<LangCode, TranslationMap>` — **повний** перелік рядків для `en` та `uk`:
   - Статичні рядки (кнопки, заголовки, мітки, помилки, toast, порожні стани)
   - Параметризовані рядки як функції: `searchResults: (n: number, firstName: string) => string`, `snippetLabel: (title: string, encrypted: boolean) => string` тощо
   - **Плюралізація** (виправлення PRD open question 14): `snippetCount: (n: number) => n === 1 ? '1 snippet' : \`${n} snippets\`` (en), аналогічно для uk
   - TypeScript автоматично перевірить повноту перекладу завдяки `Record<LangCode, TranslationMap>`
4. **`src/hooks/useLanguage.ts`** + **`src/contexts/LanguageContext.tsx`**:
   - Завантажити мову через `get_settings()` при ініціалізації
   - `t(key)` helper для статичних рядків
   - `setLanguage(lang: LangCode)` — оновлює контекст + **`document.documentElement.lang = lang`** (виправлення PRD open question 13) → миттєве оновлення всього UI без перезапуску
5. **`src/contexts/ThemeContext.tsx`**: завантажити тему з settings → встановити CSS-клас на `<html>` (`""` = темна, `"theme-light"` = світла); `toggleTheme()` для Ctrl+Shift+T

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

### `src/i18n/__tests__/translations.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

describe('translations', () => {
  const langCodes = Object.keys(translations) as Array<keyof typeof translations>;

  it('has both en and uk translations', () => {
    expect(langCodes).toContain('en');
    expect(langCodes).toContain('uk');
  });

  it('en and uk have identical keys', () => {
    const enKeys = Object.keys(translations.en).sort();
    const ukKeys = Object.keys(translations.uk).sort();
    expect(enKeys).toEqual(ukKeys);
  });

  it('no empty string values in en', () => {
    for (const [key, value] of Object.entries(translations.en)) {
      if (typeof value === 'string') {
        expect(value.trim(), `en.${key} is empty`).not.toBe('');
      }
    }
  });

  it('no empty string values in uk', () => {
    for (const [key, value] of Object.entries(translations.uk)) {
      if (typeof value === 'string') {
        expect(value.trim(), `uk.${key} is empty`).not.toBe('');
      }
    }
  });

  it('parametrized functions return strings', () => {
    expect(typeof translations.en.searchResults(5, 'test')).toBe('string');
    expect(typeof translations.uk.searchResults(5, 'test')).toBe('string');
  });

  it('pluralization works for en (1 vs many)', () => {
    const one = translations.en.snippetCount(1);
    const many = translations.en.snippetCount(5);
    expect(one).toContain('1');
    expect(many).toContain('5');
    expect(one).not.toEqual(many);
  });

  // PRD required strings presence
  const requiredKeys = [
    'searchPlaceholder', 'copySuccess', 'saveSuccess', 'deleteSuccess',
    'cancel', 'save', 'delete', 'quit', 'copy',
    'titleLabel', 'contentLabel', 'passwordLabel', 'confirmPasswordLabel',
    'titleValidation', 'contentValidation', 'passwordMismatch',
    'wrongPassword', 'decryptError', 'enterPassword',
    'createSnippet', 'editSnippet', 'deleteSnippet',
    'noSnippets', 'noResults', 'encrypted',
    'settingsTitle', 'themeLabel', 'languageLabel',
    'startInTrayLabel', 'autostartLabel', 'confirmOnCloseLabel',
    'exitConfirmTitle', 'exitConfirmMessage',
    'nothingSelected', 'hotkeyWarning',
    'decrypting', 'corruptedDb', 'corruptedSettings',
    'darkTheme', 'lightTheme', 'autoLanguage',
    'restartHint', 'cannotUndo',
  ];

  for (const key of requiredKeys) {
    it(`has required key: ${key}`, () => {
      expect(translations.en).toHaveProperty(key);
      expect(translations.uk).toHaveProperty(key);
    });
  }
});
```

### `src/types/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type { SearchResult, Settings, SnippetView, LangCode } from '../index';

describe('TypeScript types compile correctly', () => {
  it('SearchResult has required fields', () => {
    const result: SearchResult = {
      id: 1, title: 'test', score: 10,
      matched_positions: [0, 1], is_encrypted: false,
    };
    expect(result.id).toBe(1);
  });

  it('Settings has all PRD fields', () => {
    const settings: Settings = {
      theme: 'dark', start_in_tray: false, autostart: false,
      confirm_on_close: true, language: '',
      window_state: { x: 100, y: 100, width: 680, height: 520 },
    };
    expect(settings.theme).toBe('dark');
  });

  it('SnippetView has content field', () => {
    const view: SnippetView = {
      id: 1, title: 'test', content: 'hello',
      is_encrypted: false, created_at: '', updated_at: '',
    };
    expect(view.content).toBe('hello');
  });

  it('LangCode only allows en or uk', () => {
    const lang: LangCode = 'en';
    expect(['en', 'uk']).toContain(lang);
  });
});
```

### `src/hooks/__tests__/useLanguage.test.tsx`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useLanguage', () => {
  it('t() returns correct translation for current language');
  it('setLanguage updates document.documentElement.lang');
  it('switching language updates all t() calls without reload');
  it('defaults to en for unknown language code');
});
```

### `src/contexts/__tests__/ThemeContext.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('ThemeContext', () => {
  it('dark theme: no theme-light class on html');
  it('light theme: theme-light class added to html');
  it('toggleTheme switches between dark and light');
  it('theme persists in context after toggle');
});
```

**Запуск:** `npm run test`

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `npm run test` — всі тести зелені (≥ 45 тестів: translations + types + hooks)
- [ ] `npx tsc --noEmit` — без помилок (включно з повнотою перекладів `Record<LangCode, TranslationMap>`)
- [ ] `console.log(t('copySuccess'))` → «Copied» або «Скопійовано» залежно від мови settings
- [ ] Перемикання мови → `document.documentElement.lang` оновлюється (перевірка в DevTools Elements)
- [ ] Клас `theme-light` з'являється на `<html>` при темі `"light"`
- [ ] `invoke("get_settings")` у DevTools Console повертає валідний JSON-об'єкт з усіма очікуваними полями
