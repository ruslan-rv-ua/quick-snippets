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

### ⚠️ КРИТИЧНО: Коректність для будь-яких символів та розкладок

> **Ці вимоги є обов'язковими і не підлягають компромісу.**

#### Незалежність від поточної розкладки клавіатури

- Auto-type **мусить** коректно надрукувати будь-який символ незалежно від того, яка розкладка клавіатури зараз активна у системі (UA, EN, RU, DE або інша)
- Реалізація **мусить** використовувати `KEYEVENTF_UNICODE` (з `wVk = 0`, `wScan = utf16_code_unit`) — це єдиний механізм Win32, що обходить шар перекладу розкладки і доставляє символ безпосередньо як `WM_CHAR`
- Використання scan-кодів або virtual keys (`KEYEVENTF_SCANCODE`, `VK_*`) **заборонено** — вони проходять через розкладку і дадуть неправильні символи при не-EN розкладці

#### Підтримка всього Unicode-простору (включно з emoji)

- BMP-символи (U+0000–U+FFFF): ASCII, кирилиця, більшість пунктуації, CJK — один `KEYEVENTF_UNICODE` keydown + keyup на символ
- Символи поза BMP (U+10000+): emoji та інші supplementary characters — мають кодуватися як сурогатна пара UTF-16, тобто **два keydown/keyup** (4 INPUT-структури) на символ:
  - high surrogate (U+D800–U+DBFF) + low surrogate (U+DC00–U+DFFF)
  - обчислення: `cp -= 0x10000; high = 0xD800 + (cp >> 10); low = 0xDC00 + (cp & 0x3FF)`
- Реалізація мусить ітерувати по `str::encode_utf16()` (не по `chars()`), щоб сурогатні пари утворювались автоматично

#### Сумісність зі screen readers

- Auto-type **мусить** коректно працювати як при запущеному screen reader, так і без нього
- Screen readers (NVDA, JAWS) реєструють низькорівневий хук `WH_KEYBOARD_LL` (`SetWindowsHookEx`), що додає latency до pipeline клавіатурних подій. Якщо символи надсилаються без затримки, події можуть надходити у цільовий застосунок не по порядку або губитись
- **Важливо:** при наявності `WH_KEYBOARD_LL` хука гарантія атомарності SendInput (що події з інших джерел не вклиняться) **не діє**. Тому `SendInput` мусить викликатися посимвольно з затримками, а не одним великим батчем
- **Фіксована затримка між символами є обов'язковою**: `INTER_CHAR_DELAY_MS = 25ms` (keydown → keyup → delay → наступний символ)
- Значення 25ms є мінімумом, достатнім для NVDA/JAWS; достатньо для всіх сучасних застосунків
- **Примітка про `std::thread::sleep` на Windows:** гранулярність системного таймера — ~15.6ms (1/64с). `sleep(25ms)` фактично може спати 25–31ms. Для типових сніпетів (10–50 символів) це не створює помітної різниці
- NVDA при активній опції "speak typed characters" буде оголошувати кожен символ, що надрукований через SendInput — це очікувана поведінка NVDA, не баг autotype; для паролів це UX-ризик (вголос зачитується пароль), але не технічна некоректність. Для зменшення ризику NVDA-користувачі можуть встановити add-on **"Speak Passwords"** або **"Report Passwords"**, що дають контроль над озвучуванням символів у полях паролів
- **JAWS** (комерційний screen reader) використовує аналогічний механізм keyboard hooks. Затримка 25ms має бути достатньою. Тестування з JAWS рекомендоване, але не блокує реліз
- **Narrator** (вбудований у Windows) — менш агресивний, нижчий ризик несумісності

#### UIPI (User Interface Privilege Isolation)

- `SendInput` є subject to UIPI: якщо цільовий застосунок запущений із вищим рівнем привілеїв (elevated/UAC), ніж quick-snippets — SendInput повернеться з `0` (0 подій надіслано)
- **Важливо:** Microsoft документація стверджує: *"Neither GetLastError nor the return value will indicate the failure was caused by UIPI blocking."* Тому детекція базується на `SendInput() == 0` (жоден event не надіслано), а `GetLastError()` логується як додаткова діагностика
- У цьому випадку `autotype_snippet` мусить повернути `Err("Auto-type failed: no events were sent. This may happen if the target app runs with higher privileges (run as administrator).")` з відповідним Toast

### Не входить у цю ітерацію

- Linux, macOS
- Конфігурування затримки між символами через UI (затримка фіксована `INTER_CHAR_DELAY_MS = 25ms`)
- Auto-type через гарячу клавішу ззовні вікна застосунку
- Вимкнення NVDA "speak typed characters" програмно (це налаштування NVDA, не застосунку)

---

## 3. Рішення

### Rust backend — `autotype_snippet`

Нова команда `autotype_snippet(id, password)` у `src-tauri/src/commands.rs`:

1. Отримує plaintext через існуючу `activate_snippet_get_content()` (повторне використання)
2. Ховає вікно: `window.hide()`
3. Пауза `FOCUS_DELAY_MS = 150ms` — очікує повернення фокусу в цільовий застосунок
4. Симулює введення тексту через **Win32 `SendInput` API** (`windows-sys`) з `KEYEVENTF_UNICODE`
5. Між символами — затримка `INTER_CHAR_DELAY_MS = 25ms` (обов'язково для NVDA)
6. Повертає `Ok(())` — plaintext ніколи не потрапляє в IPC-відповідь; при UIPI-блокуванні — `Err(...)`

```rust
const FOCUS_DELAY_MS: u64 = 150;
const INTER_CHAR_DELAY_MS: u64 = 25;
```

**Ключові деталі реалізації `send_unicode_text(text: &str)`:**

- Ітерація через `text.encode_utf16()` — дає UTF-16 code units, сурогатні пари для emoji формуються автоматично
- Для кожного UTF-16 code unit: 2 INPUT-структури (`INPUT_KEYBOARD`, `KEYEVENTF_UNICODE`, `wVk=0`, `wScan=code_unit`) — keydown + keyup
- `SendInput` викликається посимвольно (або малими батчами) з затримкою `INTER_CHAR_DELAY_MS` між символами
- Якщо `SendInput` повертає 0 (жоден event не надіслано) — повернути помилку. `GetLastError()` записати в лог як додаткову діагностику, але **не покладатися на нього для визначення причини**: Microsoft документація застерігає що ні return value, ні `GetLastError` не гарантовано вказують на UIPI як причину блокування. Повідомлення для користувача має бути загальним: "Auto-type failed: no events were sent. This may happen if the target app runs with higher privileges."
- **Заборонено**: scan codes, virtual keys (залежать від розкладки)

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
- `test_unicode_to_utf16_inputs_ascii` — ASCII-рядок кодується в правильні INPUT-структури з `KEYEVENTF_UNICODE`
- `test_unicode_to_utf16_inputs_cyrillic` — кирилиця (U+0400–U+04FF, BMP) → один code unit на символ
- `test_unicode_to_utf16_inputs_emoji` — emoji (наприклад 😀 U+1F600) → два code units (сурогатна пара): high=0xD83D, low=0xDE00
- `test_unicode_to_utf16_inputs_mixed` — рядок з ASCII + кирилиці + emoji разом
- `test_send_unicode_detects_uipi_error` — якщо `SendInput` повертає 0 → `Err` з текстом про UIPI

**Frontend (Vitest):**
- `autotypeMode` скидається в `partialReset` — RC-1
- `autotypeMode` скидається при `onClose` PasswordModal — RC-3
- `handleAutotype` відкриває `PasswordModal` з `action='autotype'` для зашифрованих сніпетів
- `handleAutotype` викликає `autotypeSnippet` IPC для незашифрованих сніпетів


## Ризики і нюанси

### NVDA Screen Reader — UX-ризик для зашифрованих сніпетів

NVDA з увімкненою опцією "speak typed characters" вголос оголошує кожен символ, надрукований через SendInput. Для незашифрованих сніпетів це прийнятна поведінка. Для зашифрованих сніпетів (паролі) — NVDA вимовляє пароль вголос, що є UX-ризиком в публічних місцях.

**Мітигація у цій ітерації:** Toast після auto-type містить попередження для користувачів NVDA (додати ключ `autotypeNvdaWarning`). Повне вирішення — за межами ітерації.

**Рекомендація для користувачів:** NVDA add-ons **"Speak Passwords"** та **"Report Passwords"** дають контроль над озвучуванням символів у полях паролів. Варто згадати у документації застосунку.

**Не-мітигація:** Вимкнення "speak typed characters" програмно неможливе без втручання у NVDA — не реалізується.

### UIPI (elevated цільовий застосунок)

Якщо цільовий застосунок запущений від імені адміністратора (UAC elevation), а quick-snippets — ні, `SendInput` повернеться з результатом 0, тобто жоден символ не буде надрукований. Microsoft документація застерігає що ні `GetLastError`, ні return value не гарантовано вказують UIPI як причину. Детекція базується на `SendInput() == 0`; `GetLastError()` логується як додаткова діагностика.

### Emoji та старі застосунки

Сурогатні пари надсилаються через два `KEYEVENTF_UNICODE` events. Сучасні застосунки (стандартні Win32 Edit/RichEdit, Chromium, .NET) їх коректно обробляють. Старі або нестандартні застосунки можуть не розуміти сурогатні пари — emoji виявляться двома окремими символами або ігноруватимуться. Це обмеження застосунку-отримувача, не баг autotype; задокументувати.

### Відомі обмеження окремих застосунків

Деякі застосунки мають задокументовані проблеми з `KEYEVENTF_UNICODE`/`VK_PACKET` через SendInput:

- **Windows Terminal** — задокументований баг ([microsoft/terminal#12977](https://github.com/microsoft/terminal/issues/12977)): відправка Unicode-символів через `KEYEVENTF_UNICODE` може виводити неправильні символи. Це обмеження Windows Terminal, не autotype
- **Старі Win32 застосунки** — можуть не розуміти сурогатні пари (emoji відображаються як два окремих символи)

Ці обмеження не є багами autotype і не потребують мітигації.

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
| `autotypeErrorNoEvents` | `Auto-type failed: no events were sent. Target app may require elevation` | `Помилка автодруку: жодна подія не надіслана. Цільовий застосунок може вимагати прав адміністратора` | `Automatisches Tippen fehlgeschlagen: Keine Ereignisse gesendet. Zielprogramm erfordert möglicherweise erhöhte Rechte` |


