# QuickSnippets — План реалізації

> **Контекст:** Реалізація виконується у режимі vibe coding (агент-виконавець невизначений).
> Кожна фаза завершується ручною перевіркою перед переходом до наступної.
> Критичний інваріант безпеки, якого **не можна порушувати**: розшифрований вміст сніпета **ніколи не передається у фронтенд**. Всі операції з буфером обміну виконуються виключно у Rust-процесі.

---

## Фаза 1 — Ініціалізація проєкту та структура

### Завдання

1. Створити Tauri v2 проєкт через `npm create tauri-app@latest` з шаблоном **React + TypeScript + Vite**
2. Налаштувати `Cargo.toml` — всі залежності з розділу 12.6 PRD:
   - `tauri 2.x` з features `tray-icon`, `image-ico`, `image-png`
   - `tauri-plugin-global-shortcut`, `tauri-plugin-clipboard-manager`, `tauri-plugin-autostart`, `tauri-plugin-single-instance`, `tauri-plugin-dialog`
   - `rusqlite 0.32` з feature `bundled`
   - `aes-gcm 0.10`, `pbkdf2 0.12`, `sha2 0.10`, `zeroize 1.x` з feature `derive`, `rand 0.8`, `base64 0.22`
   - `serde 1.x` з feature `derive`, `serde_json 1.x`
3. Налаштувати `package.json`:
   - `react ^19.0`, `react-dom ^19.0`
   - `@tauri-apps/api ^2`, `@tauri-apps/plugin-global-shortcut ^2`, `@tauri-apps/plugin-clipboard-manager ^2`, `@tauri-apps/plugin-autostart ^2`
   - devDeps: `@tauri-apps/cli ^2`, `vite ^6`, `typescript ^5`, `@types/react ^19`, `@types/react-dom ^19`
4. Налаштувати `tauri.conf.json`:
   - Назва застосунку: `QuickSnippets`
   - Розмір вікна за замовчуванням: 680×520, мінімальний: 480×320
   - `decorations: true`, відображення у панелі завдань
   - Capability: дозволи для всіх використовуваних плагінів
5. Створити структуру директорій відповідно до розділу 12.5 PRD:
   ```
   src/
   ├── components/
   ├── hooks/
   ├── i18n/
   ├── styles/
   └── types/
   src-tauri/src/
   ├── main.rs
   ├── commands.rs
   ├── db.rs
   ├── crypto.rs
   ├── search.rs
   └── settings.rs
   ```

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo check` у `src-tauri/` завершується без помилок (всі залежності резолвляться)
- [ ] `npm install` завершується без помилок
- [ ] `npm run tauri dev` запускає порожнє вікно Tauri з заголовком `QuickSnippets`
- [ ] Вікно не менше 480×320 пікселів, не перевищує початковий розмір 680×520

---

## Фаза 2 — Backend: база даних (`db.rs`)

### Завдання

1. Функція `get_db_path()` — визначає шлях до `snippets.db` через `std::env::current_exe().parent()` (не `AppData`, не системні директорії)
2. Функція `init_db(conn: &Connection)` — створює схему:
   - Таблиця `snippets`: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `title TEXT NOT NULL`, `content BLOB NOT NULL`, `is_encrypted INTEGER NOT NULL DEFAULT 0`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`
   - CHECK-обмеження: `length(title) >= 3 AND length(title) <= 50`, `length(content) <= 65536`
   - Індекс `idx_snippets_updated_at` на `updated_at DESC`
   - `PRAGMA journal_mode=WAL`
   - `PRAGMA busy_timeout=5000`
3. Функція `handle_db_corruption(conn_result: Result<Connection>) -> Result<Connection>` — при отриманні помилки відкриття: нативний діалог «Файл snippets.db пошкоджений і не може бути відкритий. Скинути базу до порожньої? (Всі сніпети будуть безповоротно втрачені)» → Так: видалити файл і створити заново → Ні: завершити застосунок
4. CRUD-функції:
   - `create_snippet(conn, title, content_blob, is_encrypted)`
   - `get_snippet_by_id(conn, id) -> SnippetRow`
   - `update_snippet(conn, id, title, content_blob)` — для зашифрованих content_blob береться з наявного запису (не з параметра)
   - `delete_snippet(conn, id)`
5. Функція `list_snippets_for_search(conn) -> Vec<(i64, String, bool)>` — повертає `(id, title, is_encrypted)` відсортовані за `updated_at DESC` для передачі до `search.rs`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test` для `db.rs`: створити сніпет → прочитати → оновити → видалити → перевірити відсутність
- [ ] Файл `snippets.db` з'являється **поруч з `.exe`** (або поруч з `src-tauri/target/debug/` у dev-режимі), а не в `AppData`
- [ ] PRAGMA WAL: після `init_db` виконати `PRAGMA journal_mode;` — відповідь `wal`
- [ ] CHECK-обмеження: спроба записати title довжиною 2 символи → помилка SQLite
- [ ] При ручному пошкодженні `snippets.db` (довільний текст у файлі) і перезапуску застосунку: з'являється нативний діалог Windows із двома кнопками

---

## Фаза 3 — Backend: шифрування (`crypto.rs`)

### Завдання

1. Функція `encrypt(plaintext: &[u8], password: &str) -> Result<Vec<u8>>`:
   - Генерація 16-байтового `salt` через `OsRng`
   - KDF: PBKDF2-HMAC-SHA256, 100 000 ітерацій, довжина ключа 32 байти
   - Генерація 12-байтового `nonce` через `OsRng`
   - Шифрування: AES-256-GCM
   - Формат результату: `base64(salt[16] || nonce[12] || ciphertext || GCM-тег[16])`
   - `zeroize` для ключа та будь-яких проміжних буферів після використання
2. Функція `decrypt(ciphertext_b64: &[u8], password: &str) -> Result<Vec<u8>>`:
   - Парсинг base64-блобу: витягти salt, nonce, ciphertext+tag
   - PBKDF2 з тим самим salt → ключ
   - AES-256-GCM decrypt: `AeadError` → повернути `Err(WrongPassword)`
   - `zeroize` для ключа та plaintext-буфера **до** повернення з функції (викликається після копіювання в буфер обміну)
3. Юніт-тести: encrypt → decrypt з правильним паролем → оригінальний текст; decrypt з неправильним паролем → `Err(WrongPassword)`; два encrypt одного тексту дають різні base64 (унікальні salt/nonce)

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test` для `crypto.rs` — всі три юніт-тести проходять
- [ ] Зашифрувати рядок «test» два рази → base64-результати **відрізняються** (різні salt/nonce)
- [ ] Decrypt з коректним паролем → оригінальний рядок
- [ ] Decrypt з будь-яким неправильним паролем → повертається `Err(WrongPassword)` (не паніка, не інший тип помилки)

---

## Фаза 4 — Backend: нечіткий пошук (`search.rs`)

### Завдання

1. Структура `SearchResult { id: i64, title: String, score: i32, matched_positions: Vec<usize>, is_encrypted: bool }`
2. Функція `fuzzy_match_single_term(term: &str, title_lower: &str) -> Option<(i32, Vec<usize>)>` — послідовний пошук символів терміну в назві; повертає позиції збіглих символів та score
3. Функція `fuzzy_match(query: &str, title: &str) -> Option<(i32, Vec<usize>)>`:
   - Привести query та title до нижнього регістру
   - Розбити query по пробілах → слова; перевірити кожне слово через `fuzzy_match_single_term` (AND-логіка: **всі** слова мають збігтися)
   - Для однословного запиту (без пробілів): якщо прямий збіг не знайдено — запустити фолбек
   - Фолбек: перебрати всі 2-частинні розбивки `query[..i] + query[i..]` для `i` від 1 до `len-1`; взяти **першу** успішну розбивку (не кращу); score = base_score − 10
4. Функція `search(query: &str, snippets: &[(i64, String, bool)]) -> Vec<SearchResult>`:
   - Порожній запит → всі записи, score=0, matched_positions=[]; порядок збереження (за updated_at, вже відсортовані на вході)
   - Непорожній запит → застосувати `fuzzy_match` до кожного запису, відфільтрувати None, сортувати за score DESC

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test` для `search.rs` з тест-кейсами з розділу 2.2.1 PRD:
  - запит «pro prd» знаходить «prompt prd analize» та «prd add-req prompt» ✓
  - запит «proprd» фолбек-розбивка «pro»+«prd» знаходить «prompt prd analize» ✓
  - запит «HELLO» знаходить «hello world» (регістронезалежність) ✓
  - порожній запит повертає всі записи у порядку updated_at ✓
- [ ] Фолбек-результати мають score на 10 менше, ніж прямий збіг того ж слова
- [ ] Запит «xyz» без будь-яких збігів → порожній масив (не паніка)

---

## Фаза 5 — Backend: налаштування (`settings.rs`)

### Завдання

1. Структура `Settings` з полями відповідно до таблиці 5.1.2 PRD: `theme`, `start_in_tray`, `autostart`, `confirm_on_close`, `language`, `window_state: WindowState`; `#[derive(Serialize, Deserialize)]`
2. Структура `WindowState { x: i32, y: i32, width: u32, height: u32 }` зі стандартними значеннями `{100, 100, 680, 520}`
3. Функція `get_settings_path()` — поруч з `.exe`, файл `settings.json`
4. Функція `load_settings() -> Settings`:
   - Файл не існує → повернути `Settings::default()`; файл автоматично **не** записується при старті (запишеться при першому `save_settings`)
   - Файл існує, але невалідний JSON → нативний діалог «Файл settings.json пошкоджений. Скинути до стандартних налаштувань?» → Так: повернути `Settings::default()` → Ні: завершити застосунок
5. Функція `save_settings(settings: &Settings, window: &Window)`:
   - **Завжди** перезаписує `window_state` поточними `window.outer_position()` та `window.outer_size()` перед серіалізацією (захист від запису застарілих значень)
   - Записати `serde_json::to_string_pretty` у файл
6. Функція `detect_language() -> LangCode` — з системної локалі Windows: `uk*` → `"uk"`, інакше → `"en"`
7. Функція `apply_window_state(window: &Window, state: &WindowState)`:
   - Захист від позиції за межами екрану: `x < -1000 || y < -1000 || x > 10000 || y > 10000` → скинути до `{100, 100}`
   - Захист від розміру меншого за мінімальний: width < 480 або height < 320 → використати `{680, 520}`

### ✅ Ручна перевірка по завершенні фази

- [ ] Перший запуск (без `settings.json`): файл НЕ з'являється одразу при старті (з'являється лише після першого збереження налаштувань)
- [ ] Зберегти налаштування → `settings.json` з'являється **поруч з `.exe`**, а не в `AppData`
- [ ] Перемістити вікно, зберегти натільки → в `settings.json` реальні координати вікна (не ті, що передані в Settings)
- [ ] Вручну вписати у `settings.json` неправильний JSON → перезапуск → з'являється нативний діалог Windows
- [ ] Вручну вписати `"x": -9999` у `window_state` → перезапуск → вікно з'являється не за межами екрану

---

## Фаза 6 — Backend: IPC-команди (`commands.rs`)

### Завдання

Реалізувати всі команди з розділу 6.1 PRD як `#[tauri::command]` функції:

1. `search_snippets(query: String, state: State<AppState>) -> Result<Vec<SearchResult>>` — делегує до `search::search()`
2. `get_snippet_by_id(id: i64, state: State<AppState>) -> Result<SnippetView>` — для зашифрованих `content = ""` у відповіді (поле content виключене зі серіалізації для encrypted)
3. `create_snippet(title: String, content: String, password: String, state: State<AppState>) -> Result<()>` — якщо password непорожній → `crypto::encrypt()` → зберегти blob + `is_encrypted=1`; якщо порожній → зберегти як UTF-8 bytes + `is_encrypted=0`
4. `activate_snippet(id: i64, password: String, state: State<AppState>) -> Result<()>`:
   - Отримати snippet за id
   - Якщо `is_encrypted=0`: скопіювати content у буфер обміну
   - Якщо `is_encrypted=1`: `crypto::decrypt(content_blob, &password)` → скопіювати plaintext у буфер → **zeroize plaintext** → повернути Result
   - `content` та `plaintext` **не включаються до серіалізованої відповіді** — інтерфейс отримує лише `Ok(())` або `Err`
5. `update_snippet(id: i64, title: String, content: String, state: State<AppState>) -> Result<()>` — для `is_encrypted=1`: ігнорувати `content`, зберегти існуючий blob
6. `delete_snippet(id: i64, state: State<AppState>) -> Result<()>`
7. `get_settings(state: State<AppState>) -> Result<Settings>`
8. `save_settings(settings: Settings, state: State<AppState>, window: Window) -> Result<()>` — завжди отримує поточну геометрію вікна, застосовує autostart через `tauri-plugin-autostart`
9. `get_pending_notification(state: State<AppState>) -> Option<String>` — повертає та **очищує** збережене попередження (one-shot)
10. `quit_app(app: AppHandle)` — `app.exit(0)`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo build` без помилок
- [ ] Через тимчасовий тест-хук у `main.tsx` (або DevTools console) викликати `invoke("create_snippet", {title: "test", content: "hello", password: ""})` → `invoke("search_snippets", {query: "test"})` → отримати результат з `id` та `title`
- [ ] **Критична перевірка безпеки:** викликати `activate_snippet` для незашифрованого сніпета → у відповіді, у DevTools Network/Console та у будь-якому proxyобх **відсутній** текст вмісту; буфер обміну містить правильний текст
- [ ] **Критична перевірка безпеки:** створити зашифрований сніпет (password: "abc") → `activate_snippet` з правильним паролем → вміст у буфері, у відповіді IPC — лише `null`/`undefined`; `activate_snippet` з неправильним паролем → `Err("WrongPassword")`
- [ ] `get_pending_notification` повертає рядок при першому виклику і `null` при другому

---

## Фаза 7 — Backend: ініціалізація (`main.rs`)

### Завдання

1. **Single-instance check** (`tauri-plugin-single-instance`): при повторному запуску — `window.show()` + `window.set_focus()` існуючого екземпляру, новий процес завершується
2. **Ініціалізація стану**: відкрити БД (`db::handle_db_corruption`), виконати `init_db`, завантажити `settings::load_settings`; зберегти у `AppState` (Mutex-обгорнуті)
3. **Відновлення стану вікна**: застосувати збережені координати та розміри через `settings::apply_window_state` (з захистами від виходу за межі)
4. **Програмна іконка трею** (без зовнішнього файлу):
   - Генерувати зображення 16×16 пікселів у Rust (мінімалістична піктограма документа з горизонтальними лініями тексту)
   - `TrayIconBuilder` з tooltip `"QuickSnippets"`
5. **Контекстне меню трею** (локалізовано за `settings.language`):
   - Пункти: Показати / Новий сніпет / Налаштування / `<separator>` / Вихід
   - Клік лівою кнопкою → `window.show()` + `window.unminimize()` + `window.set_focus()`
   - Пункт «Показати» → та сама дія
   - Пункт «Новий сніпет» → show+focus + `emit("tray:create-snippet")`
   - Пункт «Налаштування» → show+focus + `emit("tray:open-settings")`
   - Пункт «Вихід» → `app.exit(0)`
6. **Глобальний хоткей** Ctrl+Alt+Space (`tauri-plugin-global-shortcut`):
   - При успіху: show+unminimize+focus
   - При невдачі реєстрації: зберегти повідомлення-попередження у `AppState.pending_notification` (буде прочитане фронтендом через `get_pending_notification`)
7. **Перехоплення закриття вікна**: підписатись на `window.on_window_event(WindowEvent::CloseRequested)`:
   - Завантажити `confirm_on_close` з `AppState`
   - Якщо `true`: `emit("window:close-request")`, запобігти закриттю (`event.prevent_close()`)
   - Якщо `false`: `app.exit(0)`
8. **Авто-збереження геометрії вікна**: підписатись на `WindowEvent::Moved` та `WindowEvent::Resized` → `save_settings` з поточними параметрами (debounce 500 мс щоб не спамити запис)
9. **Примусова accessibility tree**: викликати відповідний Tauri API для примусової побудови дерева доступності WebView2 при старті

### ✅ Ручна перевірка по завершенні фази

- [ ] Запустити застосунок → іконка з'являється у системному треї Windows; tooltip «QuickSnippets»
- [ ] Клік правою кнопкою по іконці → контекстне меню з 5 пунктами (Показати, Новий сніпет, Налаштування, роздільник, Вихід)
- [ ] Натиснути Ctrl+Alt+Space з іншого застосунку → вікно QuickSnippets з'являється та отримує фокус
- [ ] Мінімізувати вікно → Ctrl+Alt+Space → вікно відновлюється (не лишається мінімізованим)
- [ ] Запустити другий екземпляр `.exe` → вікно першого отримує фокус, другий процес завершується
- [ ] Перемістити вікно → закрити через × → перезапустити → вікно відкривається на новій позиції
- [ ] `confirm_on_close=true` (за замовчуванням): натиснути × → вікно НЕ закривається (очікується, що фронтенд отримає подію і відобразить діалог — поки що можна перевірити в DevTools Console що подія `window:close-request` приходить)

---

## Фаза 8 — Frontend: типи, IPC та i18n

### Завдання

1. **`src/types/index.ts`**: TypeScript-інтерфейси синхронізовані з Rust-структурами:
   - `Snippet`, `SnippetView`, `SearchResult { id, title, score, matched_positions, is_encrypted }`
   - `Settings`, `WindowState`
   - `LangCode = 'en' | 'uk'`
2. **`src/hooks/useIpc.ts`**: типізовані обгортки над `invoke()` — по одній функції на кожну Tauri-команду; всі повертають `Promise`
3. **`src/i18n/translations.ts`**: `translations: Record<LangCode, TranslationMap>` — **повний** перелік рядків з розділу 8.4 PRD для `en` та `uk`:
   - Статичні рядки (кнопки, заголовки, мітки, помилки, toast, порожні стани)
   - Параметризовані рядки як функції: `searchResults: (n: number, firstName: string) => string`, `snippetLabel: (title: string, encrypted: boolean) => string` тощо
   - TypeScript автоматично перевірить повноту перекладу завдяки `Record<LangCode, TranslationMap>`
4. **`src/hooks/useLanguage.ts`** + **`src/contexts/LanguageContext.tsx`**:
   - Завантажити мову через `get_settings()` при ініціалізації
   - `t(key)` helper для статичних рядків
   - `setLanguage(lang: LangCode)` — оновлює контекст → миттєве оновлення всього UI без перезапуску
5. **`src/contexts/ThemeContext.tsx`**: завантажити тему з settings → встановити CSS-клас на `<html>` (`""` = темна, `"theme-light"` = світла); `toggleTheme()` для Ctrl+Shift+T

### ✅ Ручна перевірка по завершенні фази

- [ ] TypeScript-компіляція `npm run build` без помилок — зокрема перевірити, що обидва `en` та `uk` мають **однаковий** набір ключів
- [ ] Додати тимчасовий `console.log(t('copySuccess'))` у `App.tsx` → в DevTools Console з'являється «Copied» або «Скопійовано» залежно від мови settings
- [ ] Перемикання мови через `setLanguage('uk')` у DevTools → текст у DOM змінюється без перезавантаження
- [ ] Клас `theme-light` з'являється на `<html>` при темі `"light"`, відсутній при темі `"dark"`
- [ ] `invoke("get_settings")` у DevTools Console повертає валідний JSON-об'єкт з усіма очікуваними полями

---

## Фаза 9 — Frontend: UI компоненти

### Завдання

#### CSS (`src/styles/`)

1. **`theme.css`**: CSS-змінні для темної теми (`:root`) та клас `.theme-light` — всі значення з таблиці розділу 3.13 PRD; радіуси, тіні; шрифт Inter; базовий розмір 14px; стилі кнопок primary/secondary/destructive; `:focus-visible` — 2px solid `--color-accent`, offset 2px; `body { overflow: hidden }`

#### Хуки (`src/hooks/`)

2. **`useDebounce.ts`**: generic `useDebounce<T>(value: T, delay: number): T` — затримка 100 мс для пошукового рядка
3. **`useSnippets.ts`**: стан `snippets: SearchResult[]`, `activeIndex: number` (-1 = нічого), `query: string`; функції `setQuery`, `setActiveIndex`, `resetState` (очищення при приховуванні вікна)
4. **`useKeyboard.ts`**: глобальні хоткеї головного вікна: `Ctrl+N` / `Insert` → відкрити CreateModal; `Ctrl+E` → EditModal (якщо activeIndex ≥ 0); `Delete` → DeleteModal (якщо activeIndex ≥ 0); `Ctrl+,` → SettingsModal; `Ctrl+Shift+T` → toggleTheme; `Ctrl+F` / `/` → фокус на SearchBox; `Ctrl+Shift+Space` → on-demand screen reader оголошення
5. **`useToast.ts`**: стек `Toast[]`, функція `addToast(message, type, duration?)`, автоматичне видалення; типи: `success` / `warning` / `error` / `info`; тривалість за замовчуванням 2000 мс

#### Компоненти (`src/components/`)

6. **`SearchBox.tsx`**: `type="search"`, `autocomplete="off"`, `spellcheck="false"`; `aria-label={t('searchPlaceholder')}`; `aria-activedescendant` вказує на `snippet-{id}` активного елемента; ArrowDown/ArrowUp — навігація по списку (зупинка на межах, не циклічна); Enter → activate; Escape (непорожній) → clear query + `stopPropagation()`; Escape (порожній) → подія спливає до глобального обробника який ховає вікно; Tab → `preventDefault()`; CSS-модуль: стан focus → бордер `--color-accent` + кільце 3px `--color-focus-ring`
7. **`SnippetList.tsx`**: `overflow-y: auto`; при зміні `activeIndex` → `scrollIntoView({ block: 'nearest' })`; порожній стан при `snippets.length === 0 && query === ''` → текст «Немає сніпетів…»; порожній стан при `snippets.length === 0 && query !== ''` → «Нічого не знайдено»; `aria-live="polite"` live region оголошує `t('searchResults', n, firstName)` з затримкою 200 мс
8. **`SnippetItem.tsx`**: `id="snippet-{id}"`; `aria-label` = назва + (якщо encrypted: `, ${t('encrypted')}`); іконка замка `aria-hidden="true"` тільки для зашифрованих; підсвічування збігів через `<mark aria-hidden="true">` (прозорий фон, `--color-match-highlight`, `font-weight: 600`); active state → `translateX(2px)` + `--color-bg-active`; `text-overflow: ellipsis`
9. **`ModalOverlay.tsx`**: overlay `rgba(0,0,0,0.6)`, fade-in 150 мс; центрування вмісту; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → id заголовку; **focus trap**: Tab/Shift+Tab циклічно між фокусовними елементами всередині; зберігати `previousFocus` при відкритті → відновити при закритті; клік по overlay (не по dialog) → `onClose()`
10. **`CreateSnippetModal.tsx`**: поля title (maxlength=50), content (textarea, maxlength=65536, rows=5), password (optional), confirmPassword; фокус на title при відкритті; **валідація тільки при натисканні «Зберегти»** (не realtime): title 3–50 символів, content 1–65536, passwords match; `aria-invalid="true"` + `aria-describedby` на невалідних полях; `role="alert"` на помилках; assertive live region; Ctrl+Enter → submit; Escape / клік overlay → close
11. **`EditSnippetModal.tsx`**: аналог Create без полів пароля; при `is_encrypted=true` замість textarea → `<div>` з текстом «Вміст зашифровано і не може бути змінений» (курсив, `--color-bg-input`, ліва рамка `--color-icon-lock`); заповнити поля поточними даними при відкритті
12. **`DeleteConfirmModal.tsx`**: заголовок «Видалити сніпет?»; назва сніпета у «лапках» з лівою рамкою `--color-destructive`; попередження «Цю дію не можна скасувати»; кнопки: «Скасувати» (secondary, **отримує фокус при відкритті**), «Видалити» (destructive); **Enter НЕ підтверджує видалення** (тільки клік по «Видалити»); Escape → close
13. **`PasswordModal.tsx`**: заголовок «Введіть пароль»; підзаголовок з назвою сніпета, ліва рамка `--color-icon-lock`; password field; фокус на полі при відкритті; при submit: disabled обох кнопок + поля + текст «Розшифрування…»; три стани помилки (порожній пароль, невірний пароль — очистити поле + фокус, загальна помилка); Enter → submit; Escape → close + clear password
14. **`ExitConfirmModal.tsx`**: фокус на «Скасувати»; Enter → `invoke("quit_app")`; Escape → close modal + hide window; «Скасувати» → close modal + hide window; «Вийти» → `invoke("quit_app")`
15. **`SettingsModal.tsx`**: async завантаження `get_settings()` → `aria-busy="true"` + «…» під час завантаження; тема: `role="group"` + дві кнопки `aria-pressed`; мова: `<select>` з options Авто/English/Українська; три чекбокси (start_in_tray, autostart, confirm_on_close); підказка «Деякі зміни набудуть чинності після перезапуску»; «Зберегти» → disabled під час `save_settings()` (захист від подвійного натиску); тема та мова застосовуються негайно; Ctrl+Enter → submit; Escape → close without save
16. **`Toast.tsx`** + **`ToastContainer.tsx`**: fixed bottom-right, `gap: 8px`, нові toast — знизу; типи кольором бордера (success: `#4caf50`, warning: `#ff9800`, error: `--color-destructive`, info: стандартний); slide-in 150 мс; fade-out 300 мс через 2 с (5 с для warning); `pointer-events: none`; контейнер: `aria-live="polite"`, `aria-atomic="true"`

#### Головний компонент (`src/`)

17. **`App.tsx`**: `role="application"` на кореневому елементі; LanguageContext + ThemeContext providers; стан всіх модальних вікон (open/closed); підписка на Tauri-події: `tray:create-snippet` → відкрити CreateModal, `tray:open-settings` → відкрити SettingsModal, `window:close-request` → відкрити ExitConfirmModal; **логіка blur**: `window.addEventListener("blur")` → часткове скидання (query, activeIndex, закрити PasswordModal; **інші модалки НЕ закривати**); логіка **повного скидання** при приховуванні вікна (Escape, успішна активація, «Скасувати» у ExitConfirmModal): `resetState()` + закрити всі модалки; `get_pending_notification()` при старті → якщо є: `addToast(msg, 'warning', 5000)`; `useKeyboard` підключений тут
18. **`main.tsx`**: `ReactDOM.createRoot` + `<App />`; відключити стандартне контекстне меню: `document.addEventListener('contextmenu', e => e.preventDefault())`

### ✅ Ручна перевірка по завершенні фази

#### Основний флоу (Сценарій S1 — Quick Copy)
- [ ] Ctrl+Alt+Space → вікно відкривається, фокус на пошуковому полі
- [ ] Ввести кілька символів → через ~100 мс список фільтрується, перший елемент виділяється
- [ ] ArrowDown/ArrowUp — навігація; не прокручується «за межі» (зупиняється на першому/останньому)
- [ ] Enter → toast «Скопійовано» → вікно ховається → буфер обміну містить текст
- [ ] Escape при непорожньому запиті — очищує запит (вікно **не** ховається)
- [ ] Escape при порожньому запиті — вікно ховається
- [ ] Повторне відкриття: поле пошуку порожнє, список повний

#### Зашифрований сніпет (Сценарій S2)
- [ ] Зашифрований сніпет позначений іконкою 🔒
- [ ] Enter → PasswordModal відкривається, фокус на полі пароля
- [ ] Невірний пароль → «Невірний пароль», поле очищується, фокус повертається
- [ ] Правильний пароль → toast «Скопійовано», вікно ховається
- [ ] Під час розшифрування: кнопки та поле disabled, текст «Розшифрування…»

#### CRUD сніпетів
- [ ] Ctrl+N → CreateModal; заповнити поля; Ctrl+Enter → toast «Збережено», список оновлюється
- [ ] Валідація: title < 3 символів → помилка під полем, фокус на полі; паролі не співпадають → помилка
- [ ] Ctrl+E на виділеному елементі → EditModal з поточними даними; для зашифрованого — textarea замінена повідомленням
- [ ] Delete на виділеному → DeleteConfirmModal; фокус на «Скасувати»; Enter **не видаляє**; клік «Видалити» → toast «Видалено», список оновлюється

#### Модальні вікна
- [ ] Focus trap: Tab/Shift+Tab у будь-якому модальному вікні — фокус не виходить за межі
- [ ] Клік по оверлею (поза dialog) → закриття модального вікна
- [ ] Після закриття модального вікна: фокус повертається на попередній елемент

#### Теми та локалізація
- [ ] Ctrl+Shift+T → тема перемикається миттєво, клас `theme-light` з'являється/зникає на `<html>`
- [ ] Змінити мову в налаштуваннях → весь текст інтерфейсу змінюється без перезавантаження

#### Поведінка вікна
- [ ] Blur (клік за межами вікна) → вікно ховається; PasswordModal закривається; CreateModal/EditModal/SettingsModal **не закривається**
- [ ] × при `confirm_on_close=true` → ExitConfirmModal; «Скасувати» → модалка закривається + вікно ховається; «Вийти» → застосунок завершується
- [ ] Контекстне меню (правий клік) → **не з'являється** ніде у вікні

#### Accessibility
- [ ] Відкрити Windows Narrator (Win+Ctrl+Enter) → навігація по списку: Narrator оголошує назву + «зашифрований» (якщо є) при зміні активного елемента
- [ ] Ctrl+Shift+Space → Narrator оголошує «{назва}, {тип}, {N} з {total}»
- [ ] Відкрити CreateModal → Narrator оголошує заголовок вікна; після невдалої валідації → Narrator оголошує помилку

---

## Фаза 10 — Фінальна збірка та портативність

### Завдання

1. Перевірити та виправити всі TypeScript-помилки: `npm run build` без помилок та попереджень
2. Перевірити та виправити всі Rust-попередження: `cargo clippy -- -D warnings` без помилок
3. Виконати фінальну збірку: `npm run tauri build` → `src-tauri/target/release/QuickSnippets.exe`
4. Перевірити розмір `.exe` — орієнтовно 10–15 MB (якщо значно більше — перевірити чи не потрапили зайві debug-символи)
5. Перевірити наявність WebView2: якщо WebView2 Runtime не встановлений — застосунок повинен показати нативний діалог з посиланням на завантаження (не мовчки падати)

### ✅ Ручна перевірка по завершенні фази

- [ ] Скопіювати **лише** `QuickSnippets.exe` у нову порожню директорію (без `snippets.db`, без `settings.json`)
- [ ] Запустити `QuickSnippets.exe` — застосунок стартує без помилок
- [ ] Після першого запуску у директорії з'являється `snippets.db` (після першого запису) та `settings.json` (після першого збереження налаштувань) поруч з `.exe`
- [ ] Скопіювати `QuickSnippets.exe` + `snippets.db` + `settings.json` у іншу директорію → запустити → всі сніпети та налаштування збереглися
- [ ] Перенести директорію на інший диск (наприклад, з `C:\tools\` у `D:\utils\`) → запустити → все працює, нові файли створюються у новій директорії
- [ ] Перевірити розмір: `(Get-Item QuickSnippets.exe).Length / 1MB` → результат у діапазоні 10–20 MB
- [ ] Повний smoke-test фінального `.exe`: Ctrl+Alt+Space → пошук → копіювання → трей → завершення

---

## Відкриті питання (з PRD, розділ 11)

Наступні питання **не блокують** реалізацію, але потребують відповіді перед або під час розробки:

| # | Питання | Рішення за замовчуванням |
|---|---------|--------------------------|
| 9 | Чи рахується ліміт 3–50 символів для title в Unicode code points чи байтах? | Code points (`chars().count()`) |
| 10 | Ліміт content: 65 536 символів чи байтів? (Кирилиця — 2 байти/символ у UTF-8) | Байти на рівні БД; символи у валідації UI — задокументувати розбіжність |
| 11 | Макс. відкритий текст для зашифрованих: ~48 000 байт через base64+overhead | Відображати у UI або відхиляти з помилкою при перевищенні |
| 12 | Toast fade-out для 5-секундних toast починається о 2 с, а не о 5 с | Виправити: `animation-delay` = `duration - 300ms` |
| 13 | `<html lang>` не оновлюється при зміні мови | Додати `document.documentElement.lang = lang` у `setLanguage()` |
| 14 | «N snippets» не враховує плюрал для N=1 (англійська) | Параметризований рядок: `(n) => n === 1 ? '1 snippet' : \`${n} snippets\`` |
