# PRD — Auto-type сніпету

**Статус:** Draft  
**Платформа:** Windows  
**Пріоритет:** Medium  

---

## 1. Проблема і мета

### Проблема

Поточна єдина дія після вибору сніпету — копіювання в системний буфер обміну (`activate_snippet`). Це не підходить для сценаріїв, де:

- запис у clipboard небажаний з міркувань безпеки (вміст залишається у clipboard після використання, доступний іншим процесам)
- потрібно вставити текст в конкретне місце без зміни вмісту clipboard

### Мета

Додати альтернативний режим активації сніпету — **auto-type**: автоматичне введення тексту безпосередньо в активне поле вводу ОС через симуляцію клавіатурних подій, без використання буфера обміну.

---

## 2. Вимоги

### Функціональні

- `Shift+Enter` активує auto-type для поточного виділеного сніпету
- `Enter` — залишається без змін (копіювання в clipboard)
- Для зашифрованих сніпетів: спочатку відкривається `PasswordModal`, після введення правильного пароля — auto-type
- Після успішного auto-type вікно ховається (як після копіювання)
- Toast-повідомлення підтверджує успішний auto-type
- Toast-повідомлення показує помилку у разі невдачі

### Нефункціональні

- Plaintext **ніколи** не передається у frontend — критичний інваріант безпеки зберігається
- IPC-відповідь `autotype_snippet` — тільки `Ok(())` або `Err(...)`
- Plaintext зероїзується після використання (`Zeroizing<Vec<u8>>`)
- Підтримка Unicode-тексту

### Не входить у цю ітерацію

- Linux, macOS
- Затримка між символами (для сумісності зі старими програмами)
- Конфігурування затримки через UI
- Auto-type через гарячу клавішу ззовні вікна застосунку

---

## 3. Рішення

### Бібліотека: `enigo`

**Обраний варіант:** `enigo` (crates.io).

**Чому не альтернативи:**
- `rdev` — немає зручного text-typing API, потребує побуквеного введення з ручними затримками, автор сам рекомендує `enigo` як альтернативу; менш активна підтримка
- `rdevin` — форк `rdev` з мінімальною підтримкою, нішевий

**Переваги `enigo`:**
- нативна Windows підтримка через `SendInput` Win32 API
- `enigo.text("...")` — одним викликом для довільного Unicode-тексту
- MIT ліцензія
- активно підтримується

```toml
# src-tauri/Cargo.toml
enigo = "0.3"
```

### Механізм роботи

```
Shift+Enter
  ↓
handleAutotype(snippet)
  ↓
[зашифровано?] → PasswordModal (action='autotype') → пароль введено
  ↓
IPC: autotype_snippet(id, password)
  ↓
Rust: отримати plaintext (activate_snippet_get_content)
  ↓
Rust: window.hide()
  ↓
Rust: thread::sleep(150ms)   ← фокус повертається до попереднього вікна
  ↓
Rust: enigo.text(&plaintext)
  ↓
Rust: plaintext зероїзується (drop Zeroizing)
  ↓
Ok(()) → hideWindow() + toast "Typed"
```

**Чому 150ms затримка:**  
На Windows після `window.hide()` ОС асинхронно передає фокус назад. Якщо `enigo` почне вводити раніше — текст потрапить у поле пошуку QuickSnippets. 150ms — стандартна практика (KeePass auto-type використовує аналогічний підхід).

---

## 3а. Стани перегонів (Race Conditions)

### RC-1 🔴 `blur` скидає `PasswordModal` поки `autotypeMode = true`

**Сценарій:**

```
1. Shift+Enter на зашифрованому сніпеті
2. setAutotypeMode(true) + setShowPassword(true)
3. PasswordModal відкрито
4. ОС перемикає фокус на інше вікно (будь-яка зовнішня причина)
5. onBlur → partialReset()
6. partialReset: setShowPassword(false) → PasswordModal закривається
7. autotypeMode залишається true (partialReset його не скидає)
8. Наступний Enter (копіювання) → PasswordModal відкривається з action='autotype' ← БАГ
```

**Мітигація:** `partialReset` у `useWindowHiding.ts` **мусить** скидати `autotypeMode = false`. Аналогічно — `hideWindow` і `closeAll`.

---

### RC-2 🔴 `window.hide()` у Rust тригерить `onBlur` у frontend під час виконання IPC

**Сценарій (незашифрований сніпет):**

```
Frontend:  autotypeSnippet(id, '') → Promise pending...
                                      ↕ паралельно
Rust:      window.hide()
           → blur event → frontend: partialReset()
           sleep(150ms)
           enigo.text(...)
           → Ok(())
Frontend:  Promise resolved → hideWindow() викликається вдруге
```

`hideWindow()` викликається двічі: один раз з `partialReset` (через blur), другий — після `Ok(())`. Подвійний `window.hide()` сам по собі безпечний (idempotent), але `reset()` + `closeAll()` викликаються двічі. Це нешкідливо для стану (setState до тих же значень), але треба усвідомлювати цей флоу.

**Мітигація:** не потрібна активна — поточна архітектура витримує це. Але варто додати коментар у код.

---

### RC-3 🟡 `autotypeMode` не скидається при відхиленні пароля

**Сценарій:**

```
1. Shift+Enter на зашифрованому сніпеті → autotypeMode=true
2. PasswordModal: введено неправильний пароль
3. PasswordModal показує помилку, залишається відкритим (loading=false)
4. Користувач натискає Cancel / Escape
5. onClose → setShowPassword(false)
6. autotypeMode залишається true ← БАГ
```

**Мітигація:** `onClose` PasswordModal у `App.tsx` **мусить** також скидати `setAutotypeMode(false)`.

---

### RC-4 🟡 IPC Promise resolve після закриття `PasswordModal`

**Сценарій:**

```
1. PasswordModal: handleSubmit() → await autotypeSnippet(id, password)
2. IPC виконується (loading=true)
3. Користувач натискає Cancel (кнопка disabled={loading} — захищено ✅)
   АБО вікно отримує blur → partialReset → setShowPassword(false)
4. PasswordModal unmount або закривається
5. IPC завершується → onSuccess() викликається на вже закритому компоненті
```

Кнопка Cancel `disabled={loading}` захищає від явного закриття користувачем. Але blur → `partialReset` → `setShowPassword(false)` може закрити PasswordModal **поки IPC ще виконується**. Після цього `onSuccess()` викликається — `hideWindow()` і toast спрацюють коректно, але компонент вже unmounted.

**Мітигація:** використовувати `isMounted` ref у `PasswordModal` або перевіряти стан перед викликом `onSuccess`. Альтернатива — прийняти як прийнятний edge case: `hideWindow()` та toast після unmount не спричиняють видимого збою.

---

### Зведена таблиця

| ID | Серйозність | Де виникає | Мітигація |
|---|---|---|---|
| RC-1 | 🔴 Критичний | `partialReset` не скидає `autotypeMode` | Додати `setAutotypeMode(false)` в `partialReset`, `hideWindow`, `closeAll` |
| RC-2 | 🟡 Нешкідливий | Подвійний `hideWindow()` через blur + IPC resolve | Не потрібна; додати коментар |
| RC-3 | 🔴 Критичний | `onClose` PasswordModal не скидає `autotypeMode` | Додати `setAutotypeMode(false)` в `onClose` PasswordModal |
| RC-4 | 🟡 Edge case | IPC resolve після `PasswordModal` unmount | `isMounted` ref або прийняти як допустиме |
| RC-5 | 🟢 Безпечний | Rust 200ms debounce паралельно з autotype | Idempotent `window.hide()` — OK, задокументувати |

### RC-5 🟢 Rust-side 200ms debounce паралельний з autotype

У `setup_window_events` є незалежний механізм: при `Focused(false)` стартує debounce-thread (200ms), який викликає `window.hide()`.

**Таймлайн після `autotype_snippet`:**

```
t=0ms:   window.hide() — явний виклик у команді
         Focused(false) → hide_scheduled=true → debounce thread стартує
t=150ms: sleep закінчується, enigo.text(...) — target app вже має фокус
t=200ms: debounce thread: w.hide() — вікно вже сховано, idempotent ✅
```

Жодного конфлікту немає. Але `hide_scheduled` залишається `true` до t=200ms і потім скидається тільки коли вікно отримає фокус наступного разу (`Focused(true)` → `hide_scheduled=false`). Це нормально.

---

## 4. Зміни по файлах

### Backend (Rust)

**`src-tauri/Cargo.toml`**
- Додати залежність `enigo = "0.3"`

**`src-tauri/src/commands.rs`**
- Додати команду `autotype_snippet(id, password, window: Window, state: State<AppState>)` у модулі `tauri_commands`
- На відміну від `activate_snippet` (використовує `AppHandle` для clipboard), тут потрібен саме `Window` — для виклику `window.hide()`. `Window` вже імпортований у `tauri_commands`: `use tauri::{AppHandle, Manager, State, Window}`
- Логіка: отримати plaintext в окремому блоці `{ let conn = ...; ... }` → **conn lock звільняється до sleep** → `window.hide()` → `sleep(150ms)` → `enigo.text()` → plaintext дропається

> ⚠️ **Критично.** `conn` Mutex **не можна тримати під час `sleep(150ms)` і `enigo.text()`** — інакше база даних заблокована на весь час введення. Існуючий `activate_snippet` показує правильний патерн: блок `{ let conn = state.conn.lock()...; activate_snippet_get_content(...)?  }` звільняє lock до виходу з блоку.

**`src-tauri/src/lib.rs`** — `invoke_handler!`
- Додати `commands::tauri_commands::autotype_snippet` до макросу `tauri::generate_handler![...]` поруч з `activate_snippet`
- Це єдине місце реєстрації команд — не `main.rs`

> ⚠️ Команда не з'явиться у frontend IPC поки не додана сюди — типова помилка при додаванні нових команд.

**Тестованість `autotype_snippet`:** на відміну від inner-функцій, сам `tauri_command` `autotype_snippet` вимагає Tauri runtime (`Window`) та OS (`enigo`) — unit-тестувати його безпосередньо неможливо. Тестується тільки `activate_snippet_get_content` (вже існує). Для самого `autotype_snippet` — integration або manual тести.

### Frontend (TypeScript/React)

**`src/hooks/useIpc.ts`**
- Додати функцію `autotypeSnippet(id: number, password: string): Promise<void>`

**`src/hooks/useSearchBoxKeyboard.ts`**

> ⚠️ **Критично.** Поточний обробник `Enter` не перевіряє `shiftKey`:
> ```ts
> case 'Enter': {
>   if (activeIndex >= 0 && snippets[activeIndex]) {
>     e.preventDefault();
>     onSelect(snippets[activeIndex]); // ← спрацює і на Shift+Enter!
>   }
> }
> ```
> Без виправлення `Shift+Enter` одночасно тригерить і копіювання, і auto-type.

- Додати необов'язковий параметр `onAutotype?: (snippet: SearchResult) => void`
- В обробнику `Enter` — перевіряти `e.shiftKey`: якщо `true` → `onAutotype?.()`, якщо `false` → `onSelect()`
- Інтерфейс `UseSearchBoxKeyboardParams` — розширити новим полем

**`src/hooks/useWindowHiding.ts`**

> ⚠️ **Race condition RC-1.** `partialReset` викликається при кожному `onBlur`. Якщо `autotypeMode = true` і вікно втратило фокус — `autotypeMode` залишиться `true` після закриття `PasswordModal`.

- Додати `setAutotypeMode` до параметрів `UseWindowHidingParams`
- В `partialReset`: додати `setAutotypeMode(false)`
- В `hideWindow`: `closeAll()` вже скидає модальні вікна — переконатися що `autotypeMode` також скидається через `closeAll` або явно

**`src/hooks/useModalState.ts`**
- Додати `autotypeMode: boolean` та `setAutotypeMode`
- Включити `autotypeMode` в `anyModalOpen`-незалежний стан (це не модальне вікно, а прапор контексту)

**`src/hooks/useAppModals.ts`**
- Повертати `autotypeMode` і `setAutotypeMode`
- Прокидати ці значення з `useModalState`

**`src/components/PasswordModal.tsx`**

> ⚠️ **Критично.** Зараз `PasswordModal` хардкодить `activateSnippet`:
> ```ts
> await activateSnippet(snippetId, password); // завжди clipboard
> ```
> Потрібно зробити дію конфігурованою.

- Додати проп `action: 'copy' | 'autotype'` (або `onSubmit: (password: string) => Promise<void>`)
- Рекомендований варіант — `onSubmit`: більш гнучкий, не прив'язує модальне вікно до конкретних IPC-команд
- Кнопку підтвердження (`{t('copy')}`) відображати залежно від `action`: `t('copy')` або `t('autotype')`

**`src/components/SearchBox.tsx`**
- Додати проп `onAutotype?: (snippet: SearchResult) => void`
- Передати у `useSearchBoxKeyboard` як `onAutotype`

**`src/components/SnippetList.tsx`**
- Додати проп `onAutotype?: (snippet: SearchResult) => void`
- Передати у кожен `SnippetItem` (або обробляти на рівні списку)

**`src/App.tsx`**
- Додати `handleAutotype` поруч з `handleActivate`:
  - незашифрований → `autotypeSnippet(id, '')` → toast + `hideWindow()`
  - зашифрований → `setAutotypeMode(true)` + `setPasswordSnippet(snippet)` + `setShowPassword(true)`
- `PasswordModal` отримує `action={autotypeMode ? 'autotype' : 'copy'}` або відповідний `onSubmit`
- `onClose` PasswordModal — **мусить** скидати `setAutotypeMode(false)` (мітигація RC-3): при Cancel, Escape або помилці пароля `autotypeMode` скидається до `false`
- Після закриття `PasswordModal` — скинути `autotypeMode(false)`
- Прокинути `onAutotype={handleAutotype}` у `SearchBox` і `SnippetList`

**`src/i18n/translations.ts`**

> ⚠️ **Критично.** Тест `'en, uk and de have identical keys'` впаде, якщо додати ключі тільки в одній мові.

Додати нові ключі одночасно в **en, uk і de**:
- `autotype` — label кнопки в `PasswordModal` та підказка в UI (напр. `"Auto-type"` / `"Автонабір"` / `"Autoeingabe"`)
- `autotypeSuccess` — toast після успішного auto-type (напр. `"Typed"` / `"Введено"` / `"Eingegeben"`)

Оновити `TranslationMap` інтерфейс — додати ці ключі як обов'язкові рядки.

### Оновлений повний перелік файлів для зміни

| Файл | Що змінюємо |
|---|---|
| `Cargo.toml` | + `enigo = "0.3"` |
| `src-tauri/src/commands.rs` | + команда `autotype_snippet` (у `tauri_commands`) |
| `src-tauri/src/lib.rs` | + реєстрація в `invoke_handler!` |
| `src/hooks/useIpc.ts` | + `autotypeSnippet()` |
| `src/hooks/useSearchBoxKeyboard.ts` | + `onAutotype`, `Shift+Enter` → `onAutotype` |
| `src/hooks/useModalState.ts` | + `autotypeMode: boolean`, `setAutotypeMode` |
| `src/hooks/useAppModals.ts` | передає `autotypeMode`, `setAutotypeMode` |
| `src/hooks/useWindowHiding.ts` | `partialReset` скидає `autotypeMode` (RC-1) |
| `src/components/PasswordModal.tsx` | + проп `action`, умовна кнопка |
| `src/components/SearchBox.tsx` | + проп `onAutotype` |
| `src/components/SnippetList.tsx` | + проп `onAutotype` |
| `src/App.tsx` | + `handleAutotype`, `autotypeMode` скидається скрізь (RC-3) |
| `src/i18n/translations.ts` | + `autotype`, `autotypeSuccess` в en/uk/de |
| `src/i18n/__tests__/translations.test.ts` | + нові ключі в `requiredKeys` |
| `README.md` | + `Shift+Enter` у таблиці shortcuts |
| `README_UK.md` | + `Shift+Enter` у таблиці shortcuts (uk) |
| `README_DE.md` | + `Shift+Enter` у таблиці shortcuts (de) |

## 5. Тести

Кожна змінена одиниця покривається тестами за TDD-циклом проекту (Red → Green → Refactor).

### Rust (`commands.rs`)

`autotype_snippet` як `#[tauri::command]` потребує Tauri runtime (`Window`) і OS (`enigo`) — unit-тестувати напряму неможливо. Тестується лише inner-шар:

- `test_autotype_get_content_unencrypted_ok` — `activate_snippet_get_content` повертає коректний plaintext
- `test_autotype_get_content_encrypted_correct_password` — розшифровує успішно
- `test_autotype_get_content_encrypted_wrong_password` — повертає `Err`
- `test_autotype_get_content_nonexistent` — повертає `Err`
- **Інваріант безпеки:** вже покритий `test_get_snippet_encrypted_excludes_content` — переконатися що новий код не порушує його

### Frontend (Vitest)

**`useSearchBoxKeyboard.test.ts`**
- `Enter` без Shift → викликає `onSelect`
- `Shift+Enter` → викликає `onAutotype`
- `Shift+Enter` без `onAutotype` → нічого не відбувається (не падає)

**`PasswordModal.test.tsx`**
- при `action='autotype'` кнопка показує `t('autotype')`, а не `t('copy')`
- при `action='autotype'` `handleSubmit` викликає `autotype_snippet` IPC, а не `activate_snippet`
- `onClose` скидає `autotypeMode` — перевірити що після Cancel наступний виклик через `Enter` використовує `activate_snippet`

**`useWindowHiding.test.ts`** (або `App.test.tsx`)
- blur при відкритому `PasswordModal` з `autotypeMode=true` → `autotypeMode` стає `false`

**`translations.test.ts`**
- нові ключі автоматично перевіряються існуючим тестом після додавання в `requiredKeys`

---

## 6. Ризики і нюанси

### Антивірусне ПО (Windows)

`SendInput` Win32 API використовується `enigo` для симуляції клавіатури. Деякі антивіруси або EDR-системи можуть позначати цей виклик як підозрілий або блокувати. Це відомий нюанс всіх auto-type інструментів (KeePass, AutoHotkey). **Мітигація:** підписання бінарника (code signing) — вже є в release pipeline.

### Затримка фокусу

150ms — евристика. У теорії на дуже повільних або перевантажених системах фокус може ще не повернутися. Якщо виявиться проблемою — зробити значення конфігурованим у Settings у наступній ітерації.

### Unicode та розкладки клавіатури

`enigo.text()` вводить текст через Unicode, а не через симуляцію фізичних клавіш — це правильний підхід і він не залежить від активної розкладки. Тим не менш деякі застосунки (особливо старі або ігрові) можуть не обробляти Unicode-ін'єкцію коректно. Це обмеження документується, не вирішується.

### Зашифрований сніпет + `autotypeMode` — повний список точок скидання

`autotypeMode = false` має відбуватися у **всіх** наступних шляхах без винятку:

| Подія | Де скидати |
|---|---|
| Успішний auto-type | `onSuccess` → `hideWindow` → `closeAll` |
| Cancel / Escape у PasswordModal | `onClose` у `App.tsx` |
| Помилка пароля + Cancel | `onClose` у `App.tsx` |
| Blur вікна (будь-яка причина) | `partialReset` у `useWindowHiding` |
| `hideWindow` (Escape на порожньому полі) | `closeAll` або явно |

Пропуск будь-якого рядка — прихований баг: наступний `Enter` (копіювання) відкриє `PasswordModal` з `action='autotype'`.

---

## 7. UI / UX деталі

- Підказка в інтерфейсі: `Shift+Enter` — auto-type (аналогічно до існуючих підказок `Enter` — copy)
- `PasswordModal` при `action='autotype'`: кнопка підтвердження — `t('autotype')` замість `t('copy')`; заголовок і поле пароля — без змін
- Toast після auto-type — `t('autotypeSuccess')`, тип `'success'`, тривалість стандартна (2000ms)

### README — таблиці скорочень клавіатури

Усі три README мають таблицю "shortcuts" — рядок `Enter` потребує оновлення і додається новий рядок `Shift+Enter`:

| Файл | Рядок що міняється |
|---|---|
| `README.md` | `\| Enter \| Copy selected snippet to clipboard \|` → додати `\| Shift+Enter \| Auto-type selected snippet \|` |
| `README_UK.md` | `\| Enter \| Копіювати вибраний сніпет у буфер обміну \|` → додати `\| Shift+Enter \| Автонабір вибраного сніпету \|` |
| `README_DE.md` | `\| Enter \| Ausgewählten Schnipsel in die Zwischenablage kopieren \|` → додати `\| Umschalt+Enter \| Ausgewählten Schnipsel automatisch eingeben \|` |

---

## 8. Не зачіпаємо

- `activate_snippet` і весь існуючий clipboard-флоу — без змін
- `SnippetItem.tsx` — не потребує змін; клік мишею завжди викликає `onActivate` (копіювання). Auto-type через мишу **не підтримується** в цій ітерації — тільки клавіатура (`Shift+Enter`)
- `capabilities/default.json` — нових Tauri-дозволів не потрібно (`enigo` працює на рівні ОС напряму)
- `settings.rs`, `db.rs`, `crypto.rs`, `search.rs` — без змін
- `main.rs` — реєстрація команд у `lib.rs`, не тут
- `CHANGELOG.md` — оновлюється при релізі версії
