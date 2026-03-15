# PRD — Auto-type сніпету
## Проблема і мета

### Проблема

Поточна єдина дія після вибору сніпету — копіювання в системний буфер обміну (`activate_snippet`). Це не підходить для сценаріїв, де:

- запис у clipboard небажаний з міркувань безпеки (вміст залишається у clipboard після використання, доступний іншим процесам)
- потрібно вставити текст в конкретне місце без зміни вмісту clipboard

### Мета

Додати альтернативний режим активації сніпету — **auto-type**: автоматичне введення тексту безпосередньо в активне поле вводу ОС через симуляцію клавіатурних подій, без використання буфера обміну.

---

## Вимоги

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

### Rust backend — `autotype_snippet`

Нова команда `autotype_snippet(id, password)` у `src-tauri/src/commands.rs`:

1. Отримує plaintext через існуючу `activate_snippet_get_content()` (повторне використання)
2. Ховає вікно: `window.hide()`
3. Пауза `FOCUS_DELAY_MS = 150ms` — очікує повернення фокусу в цільовий застосунок
4. Симулює введення тексту через **Win32 `SendInput` API** (`windows-sys`)
5. Повертає `Ok(())` — plaintext ніколи не потрапляє в IPC-відповідь

```rust
const FOCUS_DELAY_MS: u64 = 150;
```

Команда огорнута в `#[cfg(target_os = "windows")]` — на не-Windows не компілюється.
`windows-sys` додається як conditional dependency в `Cargo.toml`:

```toml
[target.'cfg(target_os = "windows")'.dependencies]
windows-sys = { version = "0.52", features = ["Win32_UI_Input_KeyboardAndMouse"] }
```

Команда реєструється в `.invoke_handler()` у `src-tauri/src/lib.rs`.

---

### Frontend — `autotypeMode` стан

У `App.tsx` (AppInner):

```ts
const [autotypeMode, setAutotypeMode] = useState(false);
```

`setAutotypeMode` передається в `useWindowHiding` як параметр (поруч із існуючими `setShowPassword` тощо) — щоб `partialReset`, `hideWindow`, `closeAll` могли скидати його.

---

### Frontend — `Shift+Enter` обробка

`SearchBox.tsx` і `SnippetList.tsx` отримують новий опціональний callback:

```ts
onAutotype?: (snippet: SearchResult) => void
```

При `Shift+Enter` — викликається `onAutotype`, при звичайному `Enter` — `onActivate` (без змін).

В `App.tsx` додається `handleAutotype`:

```ts
const handleAutotype = useCallback((snippet: SearchResult) => {
  if (snippet.is_encrypted) {
    setAutotypeMode(true);
    setPasswordSnippet(snippet);
    setShowPassword(true);
  } else {
    autotypeSnippet(snippet.id, '')
      .then(() => { addToast(t('autotypeSuccess'), 'success'); hideWindow(); })
      .catch((err: unknown) => addToast(String(err), 'error'));
  }
}, [...]);
```

---

### Frontend — `PasswordModal` зміна

Додається проп `action: 'copy' | 'autotype'` (default: `'copy'`).

- Кнопка підтвердження: `t(action)` замість хардкоду `t('copy')`
- Всередині `handleSubmit`: якщо `action === 'autotype'` → `autotypeSnippet(id, pwd)`, інакше → `activateSnippet(id, pwd)`

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

### RC-2 🟡 `window.hide()` у Rust тригерить `onBlur` у frontend під час виконання IPC

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

### RC-3 🔴 `autotypeMode` не скидається при відхиленні пароля

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
t=150ms: sleep закінчується, SendInput(...) — target app вже має фокус
t=200ms: debounce thread: w.hide() — вікно вже сховано, idempotent ✅
```

Жодного конфлікту немає. Але `hide_scheduled` залишається `true` до t=200ms і потім скидається тільки коли вікно отримає фокус наступного разу (`Focused(true)` → `hide_scheduled=false`). Це нормально.

---

## Тести

Кожна змінена одиниця покривається тестами за TDD-циклом проекту (Red → Green → Refactor).

**Rust (`commands.rs`):**
- `test_autotype_snippet_inner_unencrypted` — `activate_snippet_get_content` повертає правильний контент (Win32 SendInput відокремлюється в окрему функцію для мокування)
- `test_autotype_snippet_wrong_password` — помилка при невірному паролі для зашифрованого сніпету

**Frontend (Vitest):**
- `autotypeMode` скидається в `partialReset` — RC-1
- `autotypeMode` скидається при `onClose` PasswordModal — RC-3
- `handleAutotype` відкриває `PasswordModal` з `action='autotype'` для зашифрованих сніпетів
- `handleAutotype` викликає `autotypeSnippet` IPC для незашифрованих сніпетів


## Ризики і нюанси

### Антивірусне ПО (Windows)

`SendInput` Win32 API використовується для симуляції клавіатури. Деякі антивіруси або EDR-системи можуть позначати цей виклик як підозрілий або блокувати. Це відомий нюанс всіх auto-type інструментів (KeePass, AutoHotkey). **Мітигація:** підписання бінарника (code signing) — вже є в release pipeline.

### Затримка фокусу

150ms — евристика. У теорії на дуже повільних або перевантажених системах фокус може ще не повернутися. Якщо виявиться проблемою — зробити значення конфігурованим у Settings у наступній ітерації.

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

## UI / UX деталі

- Підказка в інтерфейсі: `Shift+Enter` — auto-type (аналогічно до існуючих підказок `Enter` — copy)
- `PasswordModal` при `action='autotype'`: кнопка підтвердження — `t('autotype')` замість `t('copy')`; заголовок і поле пароля — без змін
- Toast після auto-type — `t('autotypeSuccess')`, тип `'success'`, тривалість стандартна (2000ms)
- Toast при помилці — `t('autotypeError')`, тип `'error'`

---

## i18n

Нові ключі в `src/i18n/translations.ts` та `TranslationMap`:

| Ключ | en | uk | de |
|---|---|---|---|
| `autotype` | `Auto-type` | `Автодрук` | `Automatisch tippen` |
| `autotypeSuccess` | `Typed` | `Надруковано` | `Eingegeben` |
| `autotypeError` | `Auto-type failed` | `Помилка автодруку` | `Automatisches Tippen fehlgeschlagen` |


