# Фаза 9 — Frontend: UI компоненти

## Завдання

### CSS (`src/styles/`)

1. **`theme.css`**: CSS-змінні для темної теми (`:root`) та клас `.theme-light` — всі значення з таблиці розділу 3.13 PRD; радіуси, тіні; шрифт Inter; базовий розмір 14px; стилі кнопок primary/secondary/destructive; `:focus-visible` — 2px solid `--color-accent`, offset 2px; `body { overflow: hidden }`

### Хуки (`src/hooks/`)

2. **`useDebounce.ts`**: generic `useDebounce<T>(value: T, delay: number): T` — затримка 100 мс для пошукового рядка
3. **`useSnippets.ts`**: стан `snippets: SearchResult[]`, `activeIndex: number` (-1 = нічого), `query: string`; функції `setQuery`, `setActiveIndex`, `resetState`
4. **`useKeyboard.ts`**: глобальні хоткеї головного вікна: `Ctrl+N` / `Insert` → відкрити CreateModal; `Ctrl+E` → EditModal (якщо activeIndex ≥ 0); `Delete` → DeleteModal (якщо activeIndex ≥ 0); `Ctrl+,` → SettingsModal; `Ctrl+Shift+T` → toggleTheme; `Ctrl+F` / `/` → фокус на SearchBox; `Ctrl+Shift+Space` → on-demand screen reader оголошення
5. **`useToast.ts`**: стек `Toast[]`, функція `addToast(message, type, duration?)`, автоматичне видалення; типи: `success` / `warning` / `error` / `info`; тривалість за замовчуванням 2000 мс; **animation-delay = duration − 300ms** (виправлення PRD OQ#12)

### Компоненти (`src/components/`)

6. **`SearchBox.tsx`**: `type="search"`, `autocomplete="off"`, `spellcheck="false"`; `aria-label={t('searchPlaceholder')}`; `aria-activedescendant` вказує на `snippet-{id}` активного елемента; ArrowDown/ArrowUp — навігація (зупинка на межах, не циклічна); Enter → activate; Escape (непорожній) → clear + `stopPropagation()`; Escape (порожній) → спливає до глобального обробника; Tab → `preventDefault()`

7. **`SnippetList.tsx`**: `overflow-y: auto`; при зміні `activeIndex` → `scrollIntoView({ block: 'nearest' })`; порожні стани: при `snippets.length === 0 && query === ''` → «Немає сніпетів…»; при `snippets.length === 0 && query !== ''` → «Нічого не знайдено»; `aria-live="polite"` live region оголошує `t('searchResults', n, firstName)` з затримкою 200 мс

8. **`SnippetItem.tsx`**: `id="snippet-{id}"`; `aria-label` = назва + (якщо encrypted: `, ${t('encrypted')}`); іконка замка `aria-hidden="true"` тільки для зашифрованих; підсвічування збігів через `<mark aria-hidden="true">` (`--color-match-highlight`, `font-weight: 600`); active state → `translateX(2px)` + `--color-bg-active`; `text-overflow: ellipsis`

9. **`ModalOverlay.tsx`**: overlay `rgba(0,0,0,0.6)`, fade-in 150 мс; `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; **focus trap**: Tab/Shift+Tab циклічно між фокусовними елементами; зберігати `previousFocus` при відкритті → відновити при закритті; клік по overlay → `onClose()`

10. **`CreateSnippetModal.tsx`**: поля title (maxlength=50), content (textarea, maxlength=65536, rows=5), password (optional), confirmPassword; фокус на title при відкритті; **валідація тільки при «Зберегти»**: title 3–50, content 1–65536, passwords match; `aria-invalid="true"` + `aria-describedby` на невалідних полях; `role="alert"` на помилках; Ctrl+Enter → submit; Escape → close

11. **`EditSnippetModal.tsx`**: аналог Create без полів пароля; при `is_encrypted=true` замість textarea → `<div>` з «Вміст зашифровано і не може бути змінений» (курсив, ліва рамка `--color-icon-lock`); заповнити поля поточними даними при відкритті

12. **`DeleteConfirmModal.tsx`**: заголовок «Видалити сніпет?»; назва у «лапках» з лівою рамкою `--color-destructive`; «Цю дію не можна скасувати»; фокус на «Скасувати»; **Enter НЕ підтверджує видалення**; Escape → close

13. **`PasswordModal.tsx`**: заголовок «Введіть пароль»; підзаголовок з назвою сніпета, ліва рамка `--color-icon-lock`; фокус на полі при відкритті; при submit: disabled кнопок + поля + «Розшифрування…»; три стани помилки; Enter → submit; Escape → close + clear password; **кнопки: «Скасувати» (secondary), «Копіювати» (primary)**

14. **`ExitConfirmModal.tsx`**: фокус на «Скасувати»; Enter → `invoke("quit_app")`; Escape → close + hide window; «Скасувати» → close + hide window; «Вийти» → `invoke("quit_app")`

15. **`SettingsModal.tsx`**: async завантаження `get_settings()` → `aria-busy="true"` + «…» під час завантаження; тема: `role="group"` + дві кнопки `aria-pressed`; мова: `<select>` з options Авто/English/Українська; три чекбокси; підказка «Деякі зміни набудуть чинності після перезапуску»; «Зберегти» → disabled під час save (захист від подвійного натиску); тема та мова застосовуються негайно; Ctrl+Enter → submit

16. **`Toast.tsx`** + **`ToastContainer.tsx`**: fixed bottom-right, `gap: 8px`, нові toast — знизу; типи кольором бордера (success: `#4caf50`, warning: `#ff9800`, error: `--color-destructive`, info: стандартний); slide-in 150 мс; fade-out 300 мс; `animation-delay = duration − 300ms`; `pointer-events: none`; контейнер: `aria-live="polite"`, `aria-atomic="true"`

### Головний компонент (`src/`)

17. **`App.tsx`**: `role="application"` на кореневому елементі; LanguageContext + ThemeContext providers; стан всіх модальних вікон; підписка на Tauri-події: `tray:create-snippet`, `tray:open-settings`, `window:close-request`; **blur**: часткове скидання (query, activeIndex, close PasswordModal — **інші модалки НЕ закриваються**); повне скидання при приховуванні (Escape, успішна активація, «Скасувати» у ExitConfirmModal); `get_pending_notification()` при старті → toast 5000 мс якщо є

18. **`main.tsx`**: `ReactDOM.createRoot` + `<App />`; відключити контекстне меню: `document.addEventListener('contextmenu', e => e.preventDefault())`

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

### Хуки

**`src/hooks/__tests__/useDebounce.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 100));
    expect(result.current).toBe('hello');
  });

  it('debounces value changes', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'ab' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('ab');
    vi.useRealTimers();
  });

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'ab' });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ value: 'abc' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('abc');
    vi.useRealTimers();
  });
});
```

**`src/hooks/__tests__/useToast.test.ts`**

```typescript
describe('useToast', () => {
  it('adds toast with correct properties');
  it('removes toast after default duration (2000ms)');
  it('removes toast after custom duration (5000ms for warning)');
  it('supports success/warning/error/info types');
  it('multiple toasts stack correctly');
});
```

**`src/hooks/__tests__/useSnippets.test.ts`**

```typescript
describe('useSnippets', () => {
  it('initial state: empty query, empty snippets, activeIndex=-1');
  it('setQuery updates query');
  it('setActiveIndex updates activeIndex');
  it('resetState clears query, activeIndex, snippets');
});
```

### Компоненти

**`src/components/__tests__/SearchBox.test.tsx`**

```typescript
describe('SearchBox', () => {
  it('has type="search"');
  it('has aria-label for search placeholder');
  it('has autocomplete="off" and spellcheck="false"');
  it('sets aria-activedescendant to active snippet id');
  it('clears aria-activedescendant when activeIndex is -1');
  it('ArrowDown calls onActiveIndexChange with index+1');
  it('ArrowUp calls onActiveIndexChange with index-1');
  it('ArrowDown at last item does not wrap (stays at last)');
  it('ArrowUp at first item does not wrap (stays at first)');
  it('ArrowDown/Up when activeIndex=-1 selects first item');
  it('Enter calls onActivate with active snippet');
  it('Enter with no active snippet does nothing');
  it('Escape on non-empty query clears query and stops propagation');
  it('Escape on empty query does not stop propagation');
  it('Tab is prevented (preventDefault called)');
});
```

**`src/components/__tests__/SnippetList.test.tsx`**

```typescript
describe('SnippetList', () => {
  it('renders all provided snippets');
  it('shows "no snippets" message when empty and no query');
  it('shows "no results" message when empty with query');
  it('active item has active CSS class');
  it('has aria-live="polite" region');
  it('live region updates with result count after 200ms delay');
});
```

**`src/components/__tests__/SnippetItem.test.tsx`**

```typescript
describe('SnippetItem', () => {
  it('renders title text');
  it('shows lock icon for encrypted snippets');
  it('does not show lock icon for unencrypted');
  it('lock icon has aria-hidden="true"');
  it('has correct id="snippet-{id}"');
  it('aria-label includes "encrypted" suffix for encrypted');
  it('aria-label is just title for unencrypted');
  it('highlights matched positions with <mark>');
  it('mark elements have aria-hidden="true"');
  it('applies active class when isActive=true');
  it('handles empty matched_positions gracefully');
});
```

**`src/components/__tests__/ModalOverlay.test.tsx`**

```typescript
describe('ModalOverlay', () => {
  it('renders with role="dialog"');
  it('has aria-modal="true"');
  it('has aria-labelledby pointing to title id');
  it('click on overlay (outside dialog) calls onClose');
  it('click inside dialog does not call onClose');
  it('traps focus with Tab (cycles to first after last)');
  it('traps focus with Shift+Tab (cycles to last from first)');
  it('focus is on first focusable element on open');
  it('restores focus to previous element on close');
});
```

**`src/components/__tests__/CreateSnippetModal.test.tsx`**

```typescript
describe('CreateSnippetModal', () => {
  it('focuses title field on open');
  it('validates title min length 3 on save click');
  it('validates title max length 50 on save click');
  it('validates content required on save click');
  it('validates password match on save click');
  it('does NOT show errors before save is clicked');
  it('sets aria-invalid="true" on invalid fields');
  it('sets aria-describedby on invalid fields pointing to error id');
  it('error elements have role="alert"');
  it('focuses first invalid field on validation error');
  it('Ctrl+Enter submits form');
  it('Escape closes modal');
  it('overlay click closes modal');
  it('calls create_snippet IPC on valid submit');
  it('shows "saved" toast on successful creation');
  it('clears all fields on open');
});
```

**`src/components/__tests__/EditSnippetModal.test.tsx`**

```typescript
describe('EditSnippetModal', () => {
  it('pre-fills title field with current data');
  it('pre-fills content for unencrypted snippets');
  it('shows info message instead of textarea for encrypted');
  it('encrypted info message has italic style');
  it('validates title on save');
  it('validates content on save (unencrypted only)');
  it('does not show password fields');
  it('calls update_snippet IPC on valid submit');
});
```

**`src/components/__tests__/DeleteConfirmModal.test.tsx`**

```typescript
describe('DeleteConfirmModal', () => {
  it('shows snippet title in "quotes"');
  it('shows "cannot undo" warning');
  it('focuses Cancel button on open (NOT Delete)');
  it('Enter key does NOT trigger delete');
  it('clicking Delete button calls delete_snippet IPC');
  it('Escape closes without deleting');
  it('Cancel button closes without deleting');
  it('shows "deleted" toast on successful deletion');
});
```

**`src/components/__tests__/PasswordModal.test.tsx`**

```typescript
describe('PasswordModal', () => {
  it('focuses password field on open');
  it('shows snippet title in subtitle');
  it('subtitle has left border with lock color');
  it('Enter submits password');
  it('shows error for empty password submission');
  it('shows "wrong password" error and clears field');
  it('refocuses password field after wrong password');
  it('disables field and buttons during decryption');
  it('shows "Decrypting..." text during decryption');
  it('Escape closes and clears password');
  it('primary button text is "Copy" (localized)');
  it('calls activate_snippet IPC with password');
});
```

**`src/components/__tests__/ExitConfirmModal.test.tsx`**

```typescript
describe('ExitConfirmModal', () => {
  it('shows exit confirmation message');
  it('focuses Cancel button on open');
  it('Enter key calls quit_app');
  it('Escape closes modal and calls onHideWindow');
  it('Cancel button closes modal and calls onHideWindow');
  it('Quit button calls quit_app IPC');
});
```

**`src/components/__tests__/SettingsModal.test.tsx`**

```typescript
describe('SettingsModal', () => {
  it('shows "..." loading state with aria-busy="true"');
  it('loads settings from get_settings IPC on open');
  it('theme toggle buttons have role="group"');
  it('active theme button has aria-pressed="true"');
  it('inactive theme button has aria-pressed="false"');
  it('language select has Auto/English/Українська options');
  it('renders start_in_tray checkbox');
  it('renders autostart checkbox');
  it('renders confirm_on_close checkbox');
  it('shows restart hint text');
  it('Save button disabled during save operation (double-click protection)');
  it('Ctrl+Enter submits settings');
  it('Escape closes without saving');
  it('calls save_settings IPC on save');
  it('theme and language apply immediately on save');
});
```

**`src/components/__tests__/Toast.test.tsx`**

```typescript
describe('Toast', () => {
  it('renders toast message text');
  it('success toast has green (#4caf50) border');
  it('warning toast has orange (#ff9800) border');
  it('error toast has destructive border');
  it('info toast has default border');
  it('has pointer-events: none');
});

describe('ToastContainer', () => {
  it('has aria-live="polite"');
  it('has aria-atomic="true"');
  it('positions at bottom-right (fixed)');
  it('stacks toasts with gap 8px');
  it('new toasts appear at bottom');
});
```

**`src/components/__tests__/App.test.tsx`**

```typescript
describe('App', () => {
  it('root element has role="application"');
  it('blur event triggers partial state reset');
  it('blur closes PasswordModal but not CreateModal');
  it('Escape on empty query hides window (full reset)');
  it('successful activation hides window (full reset)');
  it('renders ToastContainer');
  it('shows pending notification toast on startup');
});
```

**Запуск:** `npm run test`

---

## ✅ Ручна перевірка по завершенні фази

### Основний флоу (Сценарій S1)
- [ ] Ctrl+Alt+Space → вікно відкривається, фокус на пошуковому полі
- [ ] Ввести кілька символів → через ~100 мс список фільтрується, перший елемент виділяється
- [ ] ArrowDown/ArrowUp — навігація; не прокручується за межі
- [ ] Enter → toast «Скопійовано» → вікно ховається → буфер містить текст
- [ ] Escape при непорожньому запиті — очищує (вікно **не** ховається)
- [ ] Escape при порожньому — вікно ховається
- [ ] Повторне відкриття: поле порожнє, список повний

### Зашифрований сніпет (Сценарій S2)
- [ ] Зашифрований сніпет позначений 🔒
- [ ] Enter → PasswordModal, фокус на полі пароля
- [ ] Невірний пароль → «Невірний пароль», поле очищується, фокус повертається
- [ ] Правильний пароль → toast, вікно ховається
- [ ] Під час розшифрування: кнопки та поле disabled, «Розшифрування…»

### CRUD
- [ ] Ctrl+N → CreateModal; Ctrl+Enter → toast, список оновлюється
- [ ] Валідація: title < 3 → помилка під полем, фокус
- [ ] Ctrl+E → EditModal; для зашифрованого — textarea замінена повідомленням
- [ ] Delete → DeleteConfirmModal; фокус на «Скасувати»; Enter не видаляє; клік «Видалити» → toast

### Модальні вікна
- [ ] Focus trap: Tab/Shift+Tab — фокус не виходить за межі
- [ ] Клік по overlay → закриття
- [ ] Після закриття: фокус повертається на попередній елемент

### Теми та локалізація
- [ ] Ctrl+Shift+T → тема перемикається, `theme-light` на `<html>`
- [ ] Змінити мову → весь UI змінюється без перезавантаження
- [ ] `document.documentElement.lang` оновлюється

### Поведінка вікна
- [ ] Blur → вікно ховається; PasswordModal закривається; CreateModal/EditModal/SettingsModal **не закриваються**
- [ ] × при `confirm_on_close=true` → ExitConfirmModal
- [ ] Контекстне меню (правий клік) → не з'являється

### Accessibility
- [ ] Windows Narrator оголошує назву + «зашифрований» при навігації по списку
- [ ] Ctrl+Shift+Space → Narrator оголошує «{назва}, {тип}, {N} з {total}»
- [ ] CreateModal → Narrator оголошує заголовок; після валідаційної помилки — помилку
