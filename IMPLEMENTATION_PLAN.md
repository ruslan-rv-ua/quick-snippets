# QuickSnippets — План реалізації (TDD)

> **Контекст:** Реалізація виконується у режимі vibe coding (агент-виконавець невизначений).
> Кожна фаза завершується ручною та автоматичною перевіркою перед переходом до наступної.
> Критичний інваріант безпеки, якого **не можна порушувати**: розшифрований вміст сніпета **ніколи не передається у фронтенд**. Всі операції з буфером обміну виконуються виключно у Rust-процесі.

## Підхід TDD

Кожне завдання у кожній фазі виконується за циклом **Red → Green → Refactor**:

1. **Red**: Написати автоматичний тест, який описує очікувану поведінку. Тест повинен НЕ проходити (або не компілюватися).
2. **Green**: Написати мінімальну реалізацію, щоб тест пройшов.
3. **Refactor**: Покращити код, зберігаючи зелені тести.

**Інструменти тестування:**
- **Rust backend**: `#[cfg(test)] mod tests` з `cargo test`, `Connection::open_in_memory()` для БД, `tempfile` для файлових операцій
- **Frontend unit/component**: Vitest + React Testing Library + jsdom + `@tauri-apps/api/mocks` для IPC
- **Типи**: `tsc --noEmit` для перевірки повноти типів та перекладів
- **Lint**: `cargo clippy -- -D warnings`, ESLint

---

## Фаза 1 — Ініціалізація проєкту, структура та інфраструктура тестування

### Завдання

1. Створити Tauri v2 проєкт через `npm create tauri-app@latest` з шаблоном **React + TypeScript + Vite**
2. Налаштувати `Cargo.toml` — всі залежності з розділу 12.6 PRD:
   - `tauri 2.x` з features `tray-icon`, `image-ico`, `image-png`
   - `tauri-plugin-global-shortcut`, `tauri-plugin-clipboard-manager`, `tauri-plugin-autostart`, `tauri-plugin-single-instance`, `tauri-plugin-dialog`
   - `rusqlite 0.32` з feature `bundled`
   - `aes-gcm 0.10`, `pbkdf2 0.12`, `sha2 0.10`, `zeroize 1.x` з feature `derive`, `rand 0.8`, `base64 0.22`
   - `serde 1.x` з feature `derive`, `serde_json 1.x`
   - **`tempfile 3.x`** у `[dev-dependencies]` — для тестування файлових операцій
3. Налаштувати `package.json`:
   - `react ^19.0`, `react-dom ^19.0`
   - `@tauri-apps/api ^2`, `@tauri-apps/plugin-global-shortcut ^2`, `@tauri-apps/plugin-clipboard-manager ^2`, `@tauri-apps/plugin-autostart ^2`
   - devDeps: `@tauri-apps/cli ^2`, `vite ^6`, `typescript ^5`, `@types/react ^19`, `@types/react-dom ^19`
   - **devDeps (тестування)**: `vitest ^3`, `@testing-library/react ^16`, `@testing-library/dom ^10`, `@testing-library/jest-dom ^6`, `@testing-library/user-event ^14`, `jsdom ^26`
4. Налаштувати **Vitest** (`vitest.config.ts` або в `vite.config.ts`):
   ```ts
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: ['./src/test/setup.ts'],
     include: ['src/**/*.test.{ts,tsx}'],
     css: true,
   }
   ```
5. Створити **`src/test/setup.ts`**: імпорт `@testing-library/jest-dom`, мок `window.crypto` для jsdom, мок `@tauri-apps/api/mocks`
6. Додати npm-скрипти:
   ```json
   "test": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage",
   "test:rust": "cd src-tauri && cargo test",
   "test:all": "npm run test && npm run test:rust",
   "lint": "tsc --noEmit && cd src-tauri && cargo clippy -- -D warnings"
   ```
7. Налаштувати `tauri.conf.json`:
   - Назва застосунку: `QuickSnippets`
   - Розмір вікна за замовчуванням: 680×520, мінімальний: 480×320
   - `decorations: true`, відображення у панелі завдань
   - Capability: дозволи для всіх використовуваних плагінів
8. Створити структуру директорій відповідно до розділу 12.5 PRD:
   ```
   src/
   ├── components/
   ├── hooks/
   ├── i18n/
   ├── styles/
   ├── types/
   └── test/
       └── setup.ts
   src-tauri/src/
   ├── main.rs
   ├── commands.rs
   ├── db.rs
   ├── crypto.rs
   ├── search.rs
   └── settings.rs
   ```

### 🤖 Автоматичні тести (критерії виконання фази)

```bash
# Rust: порожній cargo test проходить
cd src-tauri && cargo test
# → 0 тестів, 0 помилок

# Cargo clippy без попереджень
cargo clippy -- -D warnings

# Frontend: Vitest з порожнім тест-сюїтом
npm run test
# → 0 тестів, 0 помилок

# TypeScript компіляція
npx tsc --noEmit
# → Exit code 0

# Повна збірка dev
npm run tauri dev
# → Запускається без помилок (ручна перевірка)
```

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo check` у `src-tauri/` завершується без помилок (всі залежності резолвляться)
- [ ] `npm install` завершується без помилок
- [ ] `npm run tauri dev` запускає порожнє вікно Tauri з заголовком `QuickSnippets`
- [ ] Вікно не менше 480×320 пікселів, не перевищує початковий розмір 680×520
- [ ] `npm run test` завершується успішно (0 тестів, 0 помилок)
- [ ] `npm run test:rust` завершується успішно

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
   - `create_snippet(conn, title, content_blob, is_encrypted) -> Result<i64>` — повертає id створеного сніпета
   - `get_snippet_by_id(conn, id) -> Result<SnippetRow>`
   - `update_snippet(conn, id, title, content_blob)` — для зашифрованих content_blob береться з наявного запису (не з параметра); оновлює `updated_at`
   - `delete_snippet(conn, id) -> Result<()>`
5. Функція `list_snippets_for_search(conn) -> Vec<(i64, String, bool)>` — повертає `(id, title, is_encrypted)` відсортовані за `updated_at DESC` для передачі до `search.rs`

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/db.rs` → `#[cfg(test)] mod tests`**

Всі тести використовують `Connection::open_in_memory()` — не потребують файлової системи.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    // --- Схема ---

    #[test]
    fn test_init_db_creates_snippets_table() {
        // init_db повинна створити таблицю snippets з правильними колонками
    }

    #[test]
    fn test_init_db_sets_wal_journal_mode() {
        // PRAGMA journal_mode; → "wal"
    }

    #[test]
    fn test_init_db_sets_busy_timeout() {
        // PRAGMA busy_timeout; → 5000
    }

    #[test]
    fn test_init_db_is_idempotent() {
        // Повторний виклик init_db на тій самій БД не падає
    }

    #[test]
    fn test_index_exists_on_updated_at() {
        // Перевірити наявність idx_snippets_updated_at через PRAGMA index_list
    }

    // --- CHECK-обмеження ---

    #[test]
    fn test_check_title_min_length_3() {
        // title "ab" (2 символи) → помилка SQLite
    }

    #[test]
    fn test_check_title_max_length_50() {
        // title "a".repeat(51) → помилка SQLite
    }

    #[test]
    fn test_check_title_boundary_3_chars_ok() {
        // title "abc" → ОК
    }

    #[test]
    fn test_check_title_boundary_50_chars_ok() {
        // title "a".repeat(50) → ОК
    }

    #[test]
    fn test_check_content_max_65536_bytes() {
        // content > 65536 байт → помилка SQLite
    }

    #[test]
    fn test_check_content_boundary_65536_bytes_ok() {
        // content рівно 65536 байт → ОК
    }

    // --- CRUD ---

    #[test]
    fn test_create_snippet_returns_id() {
        // create_snippet повертає ненульовий id
    }

    #[test]
    fn test_create_snippet_sets_timestamps() {
        // created_at та updated_at заповнені
    }

    #[test]
    fn test_get_snippet_by_id_found() {
        // Створити → отримати за id → дані співпадають
    }

    #[test]
    fn test_get_snippet_by_id_not_found() {
        // Неіснуючий id → Err
    }

    #[test]
    fn test_update_snippet_changes_title_and_content() {
        // Створити → оновити title і content → перевірити зміни
    }

    #[test]
    fn test_update_snippet_preserves_encrypted_content() {
        // Для is_encrypted=1: оновити title → content blob залишається незмінним
    }

    #[test]
    fn test_update_snippet_updates_updated_at() {
        // updated_at після оновлення > updated_at після створення
    }

    #[test]
    fn test_delete_snippet_removes_record() {
        // Створити → видалити → get_by_id → Err
    }

    #[test]
    fn test_delete_nonexistent_snippet() {
        // Видалення неіснуючого id → Err або Ok (визначити поведінку)
    }

    // --- Список ---

    #[test]
    fn test_list_snippets_sorted_by_updated_at_desc() {
        // Створити A, B, C → список: C, B, A (останній створений = перший)
    }

    #[test]
    fn test_list_snippets_returns_id_title_encrypted() {
        // Перевірити формат кортежу (id, title, is_encrypted)
    }

    #[test]
    fn test_list_snippets_empty_db() {
        // Порожня БД → порожній вектор
    }

    #[test]
    fn test_full_crud_cycle() {
        // Створити → прочитати → оновити → прочитати (перевірити зміни) → видалити → прочитати (Err)
    }
}
```

**Запуск:** `cd src-tauri && cargo test db::tests -- --test-threads=1`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test` — всі тести `db::tests` зелені (≥ 18 тестів)
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
3. Визначити `CryptoError` enum: `WrongPassword`, `InvalidData`, `EncryptionFailed`

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/crypto.rs` → `#[cfg(test)] mod tests`**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // --- Базовий roundtrip ---

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        // encrypt("hello world", "password123") → decrypt(result, "password123") → "hello world"
    }

    #[test]
    fn test_encrypt_decrypt_empty_string() {
        // encrypt("", "pass") → decrypt → ""
    }

    #[test]
    fn test_encrypt_decrypt_unicode_content() {
        // encrypt("Привіт 🌍", "пароль") → decrypt → "Привіт 🌍"
    }

    #[test]
    fn test_encrypt_decrypt_large_payload() {
        // encrypt(48000 байт даних, "pass") → decrypt → оригінал
    }

    // --- Унікальність salt/nonce ---

    #[test]
    fn test_two_encryptions_produce_different_output() {
        // encrypt("test", "pass") двічі → base64 результати РІЗНІ
    }

    // --- Невірний пароль ---

    #[test]
    fn test_decrypt_wrong_password_returns_error() {
        // encrypt("text", "correct") → decrypt(result, "wrong") → Err(WrongPassword)
    }

    #[test]
    fn test_decrypt_wrong_password_is_not_panic() {
        // Явна перевірка що WrongPassword — це Err, а не паніка
    }

    // --- Невалідні дані ---

    #[test]
    fn test_decrypt_invalid_base64() {
        // decrypt(невалідний base64, "pass") → Err(InvalidData)
    }

    #[test]
    fn test_decrypt_truncated_ciphertext() {
        // decrypt(base64 з обрізаними даними, "pass") → Err(InvalidData)
    }

    #[test]
    fn test_decrypt_empty_input() {
        // decrypt(порожній, "pass") → Err(InvalidData)
    }

    // --- Формат ---

    #[test]
    fn test_encrypted_output_is_valid_base64() {
        // encrypt → результат декодується base64 без помилки
    }

    #[test]
    fn test_encrypted_format_salt_nonce_ciphertext_tag() {
        // Декодувати base64 → length >= 16 + 12 + 0 + 16 = 44 байти мінімум
    }

    // --- Різні паролі ---

    #[test]
    fn test_encrypt_with_unicode_password() {
        // encrypt("data", "пароль🔑") → decrypt → "data"
    }

    #[test]
    fn test_encrypt_with_empty_password() {
        // encrypt("data", "") → decrypt("", "") → "data" (порожній пароль валідний)
    }

    #[test]
    fn test_encrypt_with_very_long_password() {
        // encrypt("data", "a".repeat(1000)) → decrypt → "data"
    }
}
```

**Запуск:** `cd src-tauri && cargo test crypto::tests`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test crypto::tests` — всі тести зелені (≥ 14 тестів)
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

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/search.rs` → `#[cfg(test)] mod tests`**

Це найбільш тестований модуль — всі вимоги з PRD 2.2.1 стають тестами.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Хелпер для створення тестових даних
    fn snippets(items: &[(i64, &str, bool)]) -> Vec<(i64, String, bool)> {
        items.iter().map(|(id, t, e)| (*id, t.to_string(), *e)).collect()
    }

    // === fuzzy_match_single_term ===

    #[test]
    fn test_single_term_exact_match() {
        // "hello" у "hello" → Some з score та positions [0,1,2,3,4]
    }

    #[test]
    fn test_single_term_subsequence() {
        // "hlo" у "hello" → Some (h=0, l=2 або 3, o=4)
    }

    #[test]
    fn test_single_term_no_match() {
        // "xyz" у "hello" → None
    }

    #[test]
    fn test_single_term_partial_no_match() {
        // "hz" у "hello" → None (z не знайдено після h)
    }

    // === fuzzy_match (повна функція) ===

    #[test]
    fn test_case_insensitive_match() {
        // PRD: "HELLO" знаходить "hello world" ✓
        let result = fuzzy_match("HELLO", "hello world");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic() {
        // PRD: "pro prd" знаходить "prompt prd analize" ✓
        let result = fuzzy_match("pro prd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic_reversed() {
        // PRD: "pro prd" знаходить "prd add-req prompt" ✓
        let result = fuzzy_match("pro prd", "prd add-req prompt");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_one_missing() {
        // "pro xyz" НЕ знаходить "prompt prd analize" (AND-логіка)
        let result = fuzzy_match("pro xyz", "prompt prd analize");
        assert!(result.is_none());
    }

    #[test]
    fn test_fallback_split_proprd() {
        // PRD: "proprd" фолбек → "pro"+"prd" → знаходить "prompt prd analize" ✓
        let result = fuzzy_match("proprd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_fallback_score_penalty() {
        // Фолбек-результати мають score на 10 менше за прямий збіг
        let direct = fuzzy_match("pro prd", "prompt prd analize").unwrap();
        let fallback = fuzzy_match("proprd", "prompt prd analize").unwrap();
        assert_eq!(direct.0 - fallback.0, 10);
    }

    #[test]
    fn test_fallback_uses_first_successful_split() {
        // Перша успішна розбивка використовується, не найкраща
        // "abc" → "a"+"bc", "ab"+"c" — перша успішна повинна бути стабільною
    }

    #[test]
    fn test_no_fallback_for_multi_term() {
        // Фолбек НЕ застосовується для запитів з пробілами
    }

    #[test]
    fn test_no_match_returns_none() {
        // "xyz" проти будь-якого рядка → None
        let result = fuzzy_match("xyz", "hello world");
        assert!(result.is_none());
    }

    // === search (повна функція з масивом сніпетів) ===

    #[test]
    fn test_empty_query_returns_all() {
        // PRD: порожній запит → всі записи у порядку updated_at
        let items = snippets(&[(1, "alpha", false), (2, "beta", true)]);
        let results = search("", &items);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, 1); // порядок збережено
        assert_eq!(results[1].id, 2);
    }

    #[test]
    fn test_empty_query_score_zero() {
        let items = snippets(&[(1, "alpha", false)]);
        let results = search("", &items);
        assert_eq!(results[0].score, 0);
        assert!(results[0].matched_positions.is_empty());
    }

    #[test]
    fn test_search_filters_non_matching() {
        let items = snippets(&[(1, "hello world", false), (2, "foo bar", false)]);
        let results = search("hel", &items);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }

    #[test]
    fn test_search_sorted_by_score_desc() {
        // Кращий збіг має вищий score → перший у результатах
        let items = snippets(&[
            (1, "abcdef", false),
            (2, "abc", false),
        ]);
        let results = search("abc", &items);
        assert!(results[0].score >= results.last().unwrap().score);
    }

    #[test]
    fn test_search_no_results() {
        // "xyz" без збігів → порожній масив
        let items = snippets(&[(1, "hello", false)]);
        let results = search("xyz", &items);
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_returns_encrypted_flag() {
        let items = snippets(&[(1, "secret", true)]);
        let results = search("sec", &items);
        assert_eq!(results[0].is_encrypted, true);
    }

    #[test]
    fn test_search_returns_matched_positions() {
        let items = snippets(&[(1, "hello", false)]);
        let results = search("hlo", &items);
        assert!(!results[0].matched_positions.is_empty());
    }

    #[test]
    fn test_search_prd_scenario_pro_prd() {
        // Повний тест-кейс з PRD
        let items = snippets(&[
            (1, "prompt prd analize", false),
            (2, "prd add-req prompt", false),
            (3, "something else", false),
        ]);
        let results = search("pro prd", &items);
        assert_eq!(results.len(), 2);
        let ids: Vec<i64> = results.iter().map(|r| r.id).collect();
        assert!(ids.contains(&1));
        assert!(ids.contains(&2));
    }

    #[test]
    fn test_search_prd_scenario_proprd_fallback() {
        let items = snippets(&[
            (1, "prompt prd analize", false),
            (2, "something else", false),
        ]);
        let results = search("proprd", &items);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }

    #[test]
    fn test_search_whitespace_only_query() {
        // "   " → трактувати як порожній запит → всі записи
        let items = snippets(&[(1, "alpha", false)]);
        let results = search("   ", &items);
        assert_eq!(results.len(), 1);
    }
}
```

**Запуск:** `cd src-tauri && cargo test search::tests`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test search::tests` — всі тести зелені (≥ 20 тестів)
- [ ] PRD тест-кейси пройдені (pro prd, proprd, HELLO, порожній запит)
- [ ] Фолбек-результати мають score на 10 менше, ніж прямий збіг
- [ ] Запит «xyz» без збігів → порожній масив (не паніка)

---

## Фаза 5 — Backend: налаштування (`settings.rs`)

### Завдання

1. Структура `Settings` з полями відповідно до таблиці 5.1.2 PRD: `theme`, `start_in_tray`, `autostart`, `confirm_on_close`, `language`, `window_state: WindowState`; `#[derive(Serialize, Deserialize, PartialEq, Debug)]`
2. Структура `WindowState { x: i32, y: i32, width: u32, height: u32 }` зі стандартними значеннями `{100, 100, 680, 520}`
3. Функція `get_settings_path()` — поруч з `.exe`, файл `settings.json`
4. Функція `load_settings_from_path(path: &Path) -> Result<Settings>` (чиста, тестована):
   - Файл не існує → створити файл зі стандартними налаштуваннями та повернути `Settings::default()` (**відповідно до PRD 2.5.3: файл створюється автоматично**)
   - Файл існує, але невалідний JSON → повернути `Err`
5. Функція `load_settings() -> Settings` (обгортка для реального шляху):
   - Викликає `load_settings_from_path` з результатом `get_settings_path()`
   - При `Err` (невалідний JSON) → нативний діалог «Файл settings.json пошкоджений. Скинути до стандартних налаштувань?» → Так: повернути `Settings::default()` та перезаписати файл → Ні: завершити застосунок
6. Функція `save_settings_to_path(settings: &Settings, path: &Path) -> Result<()>` (чиста, тестована):
   - Записати `serde_json::to_string_pretty` у файл
7. Функція `save_settings(settings: &Settings, window: &Window)`:
   - **Завжди** перезаписує `window_state` поточними `window.outer_position()` та `window.outer_size()` перед серіалізацією
   - Делегує до `save_settings_to_path`
8. Функція `detect_language() -> String` — з системної локалі Windows: `uk*` → `"uk"`, інакше → `"en"`
9. Функція `validate_window_state(state: &WindowState) -> WindowState` (чиста, тестована):
   - Захист від позиції за межами екрану: `x < -1000 || y < -1000 || x > 10000 || y > 10000` → скинути до `{100, 100}`
   - Захист від розміру меншого за мінімальний: width < 480 або height < 320 → використати `{680, 520}`
10. Функція `apply_window_state(window: &Window, state: &WindowState)`:
    - Виклик `validate_window_state` → застосувати результат до вікна

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/settings.rs` → `#[cfg(test)] mod tests`**

Тестуємо чисті функції та файлові операції (через `tempfile`). Функції що потребують `Window` тестуються через витягнуту чисту логіку.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // === Settings::default ===

    #[test]
    fn test_default_settings() {
        let s = Settings::default();
        assert_eq!(s.theme, "dark");
        assert_eq!(s.start_in_tray, false);
        assert_eq!(s.autostart, false);
        assert_eq!(s.confirm_on_close, true);
        assert_eq!(s.language, ""); // порожній = авто
        assert_eq!(s.window_state.x, 100);
        assert_eq!(s.window_state.y, 100);
        assert_eq!(s.window_state.width, 680);
        assert_eq!(s.window_state.height, 520);
    }

    // === Серіалізація / десеріалізація ===

    #[test]
    fn test_settings_serialize_deserialize_roundtrip() {
        let original = Settings::default();
        let json = serde_json::to_string_pretty(&original).unwrap();
        let deserialized: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(original, deserialized);
    }

    #[test]
    fn test_settings_serialize_contains_all_fields() {
        let json = serde_json::to_string(&Settings::default()).unwrap();
        assert!(json.contains("theme"));
        assert!(json.contains("start_in_tray"));
        assert!(json.contains("autostart"));
        assert!(json.contains("confirm_on_close"));
        assert!(json.contains("language"));
        assert!(json.contains("window_state"));
    }

    #[test]
    fn test_settings_partial_json_uses_defaults_for_missing() {
        // Якщо в JSON бракує деяких полів — serde підставляє default значення
        let json = r#"{"theme": "light"}"#;
        let result: Result<Settings, _> = serde_json::from_str(json);
        // Залежить від #[serde(default)] — цей тест визначає поведінку
    }

    // === Файлові операції (з tempfile) ===

    #[test]
    fn test_load_settings_file_not_exists_creates_file() {
        // PRD 2.5.3: файл не існує → створюється автоматично зі стандартними значеннями
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        let settings = load_settings_from_path(&path).unwrap();
        assert_eq!(settings, Settings::default());
        assert!(path.exists()); // файл створений!
    }

    #[test]
    fn test_load_settings_file_not_exists_creates_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        load_settings_from_path(&path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        let parsed: Settings = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed, Settings::default());
    }

    #[test]
    fn test_load_settings_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.theme = "light".to_string();
        std::fs::write(&path, serde_json::to_string_pretty(&s).unwrap()).unwrap();
        let loaded = load_settings_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
    }

    #[test]
    fn test_load_settings_invalid_json_returns_error() {
        // Невалідний JSON → повертає помилку (діалог обробляється вище)
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "not json at all {{{").unwrap();
        let result = load_settings_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_settings_creates_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn test_save_settings_produces_pretty_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains('\n')); // Pretty-printed
    }

    #[test]
    fn test_save_settings_overwrites_existing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_to_path(&Settings::default(), &path).unwrap();
        let mut s = Settings::default();
        s.theme = "light".to_string();
        save_settings_to_path(&s, &path).unwrap();
        let loaded = load_settings_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
    }

    // === validate_window_state (чиста функція) ===

    #[test]
    fn test_validate_window_state_normal() {
        let state = WindowState { x: 200, y: 150, width: 700, height: 550 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 200);
        assert_eq!(result.y, 150);
        assert_eq!(result.width, 700);
        assert_eq!(result.height, 550);
    }

    #[test]
    fn test_validate_window_state_x_too_low() {
        let state = WindowState { x: -1001, y: 100, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_y_too_low() {
        let state = WindowState { x: 100, y: -1001, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_x_too_high() {
        let state = WindowState { x: 10001, y: 100, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_y_too_high() {
        let state = WindowState { x: 100, y: 10001, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 100);
        assert_eq!(result.y, 100);
    }

    #[test]
    fn test_validate_window_state_boundary_minus_1000_ok() {
        // -1000 включно — ще допустимо (PRD: "< -1000" означає -1001 і менше)
        let state = WindowState { x: -1000, y: -1000, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, -1000);
    }

    #[test]
    fn test_validate_window_state_boundary_10000_ok() {
        // 10000 включно — ще допустимо (PRD: "> 10000" означає 10001 і більше)
        let state = WindowState { x: 10000, y: 10000, width: 680, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.x, 10000);
    }

    #[test]
    fn test_validate_window_state_width_too_small() {
        let state = WindowState { x: 100, y: 100, width: 479, height: 520 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 680);
        assert_eq!(result.height, 520);
    }

    #[test]
    fn test_validate_window_state_height_too_small() {
        let state = WindowState { x: 100, y: 100, width: 680, height: 319 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 680);
        assert_eq!(result.height, 520);
    }

    #[test]
    fn test_validate_window_state_min_size_boundary_ok() {
        let state = WindowState { x: 100, y: 100, width: 480, height: 320 };
        let result = validate_window_state(&state);
        assert_eq!(result.width, 480); // мінімум ОК
        assert_eq!(result.height, 320);
    }

    // === detect_language ===

    #[test]
    fn test_detect_language_returns_valid_code() {
        let lang = detect_language();
        assert!(lang == "en" || lang == "uk");
    }
}
```

**Запуск:** `cd src-tauri && cargo test settings::tests`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test settings::tests` — всі тести зелені (≥ 18 тестів)
- [ ] Перший запуск (без `settings.json`): файл `settings.json` **з'являється автоматично** поруч з `.exe` зі стандартними значеннями (PRD 2.5.3)
- [ ] Зберегти налаштування → `settings.json` оновлюється поруч з `.exe`
- [ ] Вручну вписати у `settings.json` неправильний JSON → перезапуск → з'являється нативний діалог Windows
- [ ] Вручну вписати `"x": -9999` у `window_state` → перезапуск → вікно з'являється не за межами екрану

---

## Фаза 6 — Backend: IPC-команди (`commands.rs`)

### Завдання

Реалізувати всі команди з розділу 6.1 PRD як `#[tauri::command]` функції.
**Архітектурний принцип**: кожна команда делегує до внутрішньої `*_inner` функції, яка приймає `&Connection` / `&Settings` замість `State<AppState>`. Це забезпечує тестованість без мокання Tauri-рантайму.

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

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/commands.rs` → `#[cfg(test)] mod tests`**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::crypto;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::init_db(&conn).unwrap();
        conn
    }

    // === search_snippets ===

    #[test]
    fn test_search_snippets_empty_query_returns_all() {
        let conn = setup();
        db::create_snippet(&conn, "alpha", b"content1", false).unwrap();
        db::create_snippet(&conn, "beta test", b"content2", false).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_snippets_filters_by_query() {
        let conn = setup();
        db::create_snippet(&conn, "alpha", b"c1", false).unwrap();
        db::create_snippet(&conn, "beta", b"c2", false).unwrap();
        let results = search_snippets_inner(&conn, "alp").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "alpha");
    }

    // === get_snippet_by_id ===

    #[test]
    fn test_get_snippet_unencrypted_includes_content() {
        let conn = setup();
        let id = db::create_snippet(&conn, "test title", b"secret content", false).unwrap();
        let view = get_snippet_by_id_inner(&conn, id).unwrap();
        assert_eq!(view.content, "secret content");
    }

    #[test]
    fn test_get_snippet_encrypted_excludes_content() {
        // КРИТИЧНА ПЕРЕВІРКА БЕЗПЕКИ
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret", "pass").unwrap();
        let id = db::create_snippet(&conn, "encrypted one", &encrypted, true).unwrap();
        let view = get_snippet_by_id_inner(&conn, id).unwrap();
        assert_eq!(view.content, ""); // Вміст НЕ передається!
    }

    #[test]
    fn test_get_snippet_not_found() {
        let conn = setup();
        let result = get_snippet_by_id_inner(&conn, 99999);
        assert!(result.is_err());
    }

    // === create_snippet ===

    #[test]
    fn test_create_unencrypted_snippet() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "my title", "my content", "");
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_encrypted_snippet() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "my secret", "secret data", "password123");
        assert!(result.is_ok());
        // Перевірити is_encrypted = true
        let id = result.unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert!(row.is_encrypted);
    }

    #[test]
    fn test_create_snippet_validation_title_too_short() {
        let conn = setup();
        let result = create_snippet_inner(&conn, "ab", "content", "");
        assert!(result.is_err());
    }

    // === activate_snippet: extract content for clipboard ===

    #[test]
    fn test_activate_unencrypted_returns_content_bytes() {
        let conn = setup();
        let id = db::create_snippet(&conn, "test snip", b"clipboard text", false).unwrap();
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(content, b"clipboard text");
    }

    #[test]
    fn test_activate_encrypted_correct_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", &encrypted, true).unwrap();
        let content = activate_snippet_get_content(&conn, id, "mypass").unwrap();
        assert_eq!(content, b"secret data");
    }

    #[test]
    fn test_activate_encrypted_wrong_password() {
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret data", "mypass").unwrap();
        let id = db::create_snippet(&conn, "encrypted", &encrypted, true).unwrap();
        let result = activate_snippet_get_content(&conn, id, "wrongpass");
        assert!(result.is_err());
    }

    #[test]
    fn test_activate_nonexistent_snippet() {
        let conn = setup();
        let result = activate_snippet_get_content(&conn, 99999, "");
        assert!(result.is_err());
    }

    // === update_snippet ===

    #[test]
    fn test_update_unencrypted_changes_content() {
        let conn = setup();
        let id = db::create_snippet(&conn, "title", b"old content", false).unwrap();
        update_snippet_inner(&conn, id, "new title", "new content").unwrap();
        let row = db::get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "new title");
    }

    #[test]
    fn test_update_encrypted_preserves_content_blob() {
        // КРИТИЧНА ПЕРЕВІРКА: при update зашифрованого — content blob не змінюється
        let conn = setup();
        let encrypted = crypto::encrypt(b"secret", "pass").unwrap();
        let id = db::create_snippet(&conn, "orig title", &encrypted, true).unwrap();
        let orig_blob = db::get_snippet_by_id(&conn, id).unwrap().content.clone();
        update_snippet_inner(&conn, id, "new title", "ignored content").unwrap();
        let updated_blob = db::get_snippet_by_id(&conn, id).unwrap().content;
        assert_eq!(orig_blob, updated_blob); // blob не змінився!
    }

    // === delete_snippet ===

    #[test]
    fn test_delete_snippet_removes_from_search() {
        let conn = setup();
        let id = db::create_snippet(&conn, "to delete", b"data", false).unwrap();
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 0);
    }

    // === pending notification ===

    #[test]
    fn test_pending_notification_one_shot() {
        let mut notification: Option<String> = Some("Warning!".to_string());
        let first = notification.take();
        let second = notification.take();
        assert_eq!(first, Some("Warning!".to_string()));
        assert_eq!(second, None);
    }

    // === end-to-end command integration ===

    #[test]
    fn test_full_flow_create_search_activate_delete() {
        let conn = setup();
        // Create
        let id = create_snippet_inner(&conn, "my test", "hello world", "").unwrap();
        // Search
        let results = search_snippets_inner(&conn, "test").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, id);
        // Activate
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(String::from_utf8(content).unwrap(), "hello world");
        // Delete
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 0);
    }
}
```

**Запуск:** `cd src-tauri && cargo test commands::tests`

### ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test commands::tests` — всі тести зелені (≥ 16 тестів)
- [ ] `cargo build` без помилок
- [ ] Через DevTools console: `invoke("create_snippet", {title: "test", content: "hello", password: ""})` → `invoke("search_snippets", {query: "test"})` → результат з id і title
- [ ] **Критична перевірка безпеки:** `activate_snippet` для незашифрованого → у відповіді, у DevTools **відсутній** текст вмісту; буфер обміну містить правильний текст
- [ ] **Критична перевірка безпеки:** створити зашифрований сніпет (password: "abc") → `activate_snippet` з правильним паролем → вміст у буфері, у відповіді IPC — лише `null`/`undefined`; `activate_snippet` з неправильним паролем → `Err("WrongPassword")`
- [ ] `get_pending_notification` повертає рядок при першому виклику і `null` при другому

---

## Фаза 7 — Backend: ініціалізація (`main.rs`)

### Завдання

1. **Single-instance check** (`tauri-plugin-single-instance`): при повторному запуску — `window.show()` + `window.set_focus()` існуючого екземпляру, новий процес завершується
2. **Ініціалізація стану**: відкрити БД (`db::handle_db_corruption`), виконати `init_db`, завантажити `settings::load_settings`; зберегти у `AppState` (Mutex-обгорнуті)
3. **Відновлення стану вікна**: застосувати збережені координати та розміри через `settings::apply_window_state` (з захистами від виходу за межі)
4. **start_in_tray**: якщо `settings.start_in_tray == true` → при старті сховати вікно після створення (`window.hide()`). Тільки іконка в треї видна. (PRD 2.5.1)
5. **Програмна іконка трею** (без зовнішнього файлу):
   - Генерувати зображення 16×16 пікселів у Rust (мінімалістична піктограма документа з горизонтальними лініями тексту)
   - `TrayIconBuilder` з tooltip `"QuickSnippets"`
6. **Контекстне меню трею** (локалізовано за `settings.language`):
   - Пункти: Показати / Новий сніпет / Налаштування / `<separator>` / Вихід
   - Клік лівою кнопкою → `window.show()` + `window.unminimize()` + `window.set_focus()`
   - Пункт «Показати» → та сама дія
   - Пункт «Новий сніпет» → show+focus + `emit("tray:create-snippet")`
   - Пункт «Налаштування» → show+focus + `emit("tray:open-settings")`
   - Пункт «Вихід» → `app.exit(0)`
7. **Глобальний хоткей** Ctrl+Alt+Space (`tauri-plugin-global-shortcut`):
   - При успіху: show+unminimize+focus
   - При невдачі реєстрації: зберегти повідомлення-попередження у `AppState.pending_notification` (буде прочитане фронтендом через `get_pending_notification`)
8. **Перехоплення закриття вікна**: підписатись на `window.on_window_event(WindowEvent::CloseRequested)`:
   - Завантажити `confirm_on_close` з `AppState`
   - Якщо `true`: `emit("window:close-request")`, запобігти закриттю (`event.prevent_close()`)
   - Якщо `false`: `app.exit(0)`
9. **Перехоплення втрати фокусу (blur)**: підписатись на `WindowEvent::Focused(false)`:
   - `window.hide()` — вікно ховається при втраті фокусу (PRD 2.10.3, 2.10.5)
   - Фронтенд додатково виконає часткове скидання стану через `window.addEventListener("blur")`
10. **Авто-збереження геометрії вікна**: підписатись на `WindowEvent::Moved` та `WindowEvent::Resized` → `save_settings` з поточними параметрами (debounce 500 мс щоб не спамити запис)
11. **Примусова accessibility tree**: викликати відповідний Tauri API для примусової побудови дерева доступності WebView2 при старті

### 🤖 Автоматичні тести (TDD)

**Файл: `src-tauri/src/main.rs` → окремі тести для допоміжних функцій**

Повна інтеграція `main.rs` складно піддається unit-тестуванню через залежність від Tauri runtime. Тестуємо витягнуті чисті функції:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // === Генерація іконки трею ===

    #[test]
    fn test_generate_tray_icon_is_16x16() {
        let icon_data = generate_tray_icon_rgba();
        // 16 * 16 * 4 (RGBA) = 1024 байти
        assert_eq!(icon_data.len(), 16 * 16 * 4);
    }

    #[test]
    fn test_generate_tray_icon_not_all_transparent() {
        let icon_data = generate_tray_icon_rgba();
        let has_visible = icon_data.chunks(4).any(|pixel| pixel[3] > 0);
        assert!(has_visible);
    }

    // === Локалізація меню трею ===

    #[test]
    fn test_tray_menu_labels_en() {
        let labels = get_tray_menu_labels("en");
        assert_eq!(labels.show, "Show");
        assert_eq!(labels.new_snippet, "New Snippet");
        assert_eq!(labels.settings, "Settings");
        assert_eq!(labels.quit, "Quit");
    }

    #[test]
    fn test_tray_menu_labels_uk() {
        let labels = get_tray_menu_labels("uk");
        assert_eq!(labels.show, "Показати");
        assert_eq!(labels.new_snippet, "Новий сніпет");
        assert_eq!(labels.settings, "Налаштування");
        assert_eq!(labels.quit, "Вихід");
    }

    #[test]
    fn test_tray_menu_labels_unknown_defaults_to_en() {
        let labels = get_tray_menu_labels("xx");
        assert_eq!(labels.show, "Show");
    }

    // === Pending notification ===

    #[test]
    fn test_pending_notification_set_and_clear() {
        let state = AppState::new_for_test();
        state.set_pending_notification("Warning message".to_string());
        assert_eq!(state.take_pending_notification(), Some("Warning message".to_string()));
        assert_eq!(state.take_pending_notification(), None); // one-shot
    }
}
```

**Запуск:** `cd src-tauri && cargo test` (включає всі модулі)

### ✅ Ручна перевірка по завершенні фази

- [ ] Запустити застосунок → іконка з'являється у системному треї Windows; tooltip «QuickSnippets»
- [ ] Клік правою кнопкою по іконці → контекстне меню з 5 пунктами (Показати, Новий сніпет, Налаштування, роздільник, Вихід)
- [ ] Натиснути Ctrl+Alt+Space з іншого застосунку → вікно QuickSnippets з'являється та отримує фокус
- [ ] Мінімізувати вікно → Ctrl+Alt+Space → вікно відновлюється (не лишається мінімізованим)
- [ ] Запустити другий екземпляр `.exe` → вікно першого отримує фокус, другий процес завершується
- [ ] Перемістити вікно → закрити через × → перезапустити → вікно відкривається на новій позиції
- [ ] `start_in_tray=true` у settings.json → перезапуск → вікно приховане, є тільки трей-іконка (PRD 2.5.1)
- [ ] Клік за межами вікна (blur) → вікно ховається (PRD 2.10.3)
- [ ] `confirm_on_close=true` (за замовчуванням): натиснути × → вікно НЕ закривається (подія `window:close-request` приходить у DevTools Console)

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
   - **Плюралізація** (виправлення PRD open question 14): `snippetCount: (n: number) => n === 1 ? '1 snippet' : \`${n} snippets\`` (en), аналогічно для uk
   - TypeScript автоматично перевірить повноту перекладу завдяки `Record<LangCode, TranslationMap>`
4. **`src/hooks/useLanguage.ts`** + **`src/contexts/LanguageContext.tsx`**:
   - Завантажити мову через `get_settings()` при ініціалізації
   - `t(key)` helper для статичних рядків
   - `setLanguage(lang: LangCode)` — оновлює контекст + **`document.documentElement.lang = lang`** (виправлення PRD open question 13) → миттєве оновлення всього UI без перезапуску
5. **`src/contexts/ThemeContext.tsx`**: завантажити тему з settings → встановити CSS-клас на `<html>` (`""` = темна, `"theme-light"` = світла); `toggleTheme()` для Ctrl+Shift+T

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src/i18n/__tests__/translations.test.ts`**

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
    expect(one).not.toEqual(many); // Різні форми для 1 та >1
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

**Файл: `src/types/__tests__/types.test.ts`**

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

**Файл: `src/hooks/__tests__/useLanguage.test.tsx`**

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

**Файл: `src/contexts/__tests__/ThemeContext.test.tsx`**

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

### ✅ Ручна перевірка по завершенні фази

- [ ] `npm run test` — всі тести зелені (≥ 45 тестів: translations + types + hooks)
- [ ] `npx tsc --noEmit` — без помилок (включно з повнотою перекладів `Record<LangCode, TranslationMap>`)
- [ ] `console.log(t('copySuccess'))` → «Copied» або «Скопійовано» залежно від мови settings
- [ ] Перемикання мови → `document.documentElement.lang` оновлюється (перевірка в DevTools Elements)
- [ ] Клас `theme-light` з'являється на `<html>` при темі `"light"`
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
5. **`useToast.ts`**: стек `Toast[]`, функція `addToast(message, type, duration?)`, автоматичне видалення; типи: `success` / `warning` / `error` / `info`; тривалість за замовчуванням 2000 мс; **animation-delay = duration − 300ms** (виправлення PRD open question 12)

#### Компоненти (`src/components/`)

6. **`SearchBox.tsx`**: `type="search"`, `autocomplete="off"`, `spellcheck="false"`; `aria-label={t('searchPlaceholder')}`; `aria-activedescendant` вказує на `snippet-{id}` активного елемента; ArrowDown/ArrowUp — навігація по списку (зупинка на межах, не циклічна); Enter → activate; Escape (непорожній) → clear query + `stopPropagation()`; Escape (порожній) → подія спливає до глобального обробника який ховає вікно; Tab → `preventDefault()`; CSS-модуль: стан focus → бордер `--color-accent` + кільце 3px `--color-focus-ring`
7. **`SnippetList.tsx`**: `overflow-y: auto`; при зміні `activeIndex` → `scrollIntoView({ block: 'nearest' })`; порожній стан при `snippets.length === 0 && query === ''` → текст «Немає сніпетів…»; порожній стан при `snippets.length === 0 && query !== ''` → «Нічого не знайдено»; `aria-live="polite"` live region оголошує `t('searchResults', n, firstName)` з затримкою 200 мс
8. **`SnippetItem.tsx`**: `id="snippet-{id}"`; `aria-label` = назва + (якщо encrypted: `, ${t('encrypted')}`); іконка замка `aria-hidden="true"` тільки для зашифрованих; підсвічування збігів через `<mark aria-hidden="true">` (прозорий фон, `--color-match-highlight`, `font-weight: 600`); active state → `translateX(2px)` + `--color-bg-active`; `text-overflow: ellipsis`
9. **`ModalOverlay.tsx`**: overlay `rgba(0,0,0,0.6)`, fade-in 150 мс; центрування вмісту; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → id заголовку; **focus trap**: Tab/Shift+Tab циклічно між фокусовними елементами всередині; зберігати `previousFocus` при відкритті → відновити при закритті; клік по overlay (не по dialog) → `onClose()`
10. **`CreateSnippetModal.tsx`**: поля title (maxlength=50), content (textarea, maxlength=65536, rows=5), password (optional), confirmPassword; фокус на title при відкритті; **валідація тільки при натисканні «Зберегти»** (не realtime): title 3–50 символів, content 1–65536, passwords match; `aria-invalid="true"` + `aria-describedby` на невалідних полях; `role="alert"` на помилках; assertive live region; Ctrl+Enter → submit; Escape / клік overlay → close
11. **`EditSnippetModal.tsx`**: аналог Create без полів пароля; при `is_encrypted=true` замість textarea → `<div>` з текстом «Вміст зашифровано і не може бути змінений» (курсив, `--color-bg-input`, ліва рамка `--color-icon-lock`); заповнити поля поточними даними при відкритті
12. **`DeleteConfirmModal.tsx`**: заголовок «Видалити сніпет?»; назва сніпета у «лапках» з лівою рамкою `--color-destructive`; попередження «Цю дію не можна скасувати»; кнопки: «Скасувати» (secondary, **отримує фокус при відкритті**), «Видалити» (destructive); **Enter НЕ підтверджує видалення** (тільки клік по «Видалити»); Escape → close
13. **`PasswordModal.tsx`**: заголовок «Введіть пароль»; підзаголовок з назвою сніпета, ліва рамка `--color-icon-lock`; password field; фокус на полі при відкритті; при submit: disabled обох кнопок + поля + текст «Розшифрування…»; три стани помилки (порожній пароль, невірний пароль — очистити поле + фокус, загальна помилка); Enter → submit; Escape → close + clear password; **кнопки: «Скасувати» (secondary), «Копіювати» (primary)** (PRD 3.8)
14. **`ExitConfirmModal.tsx`**: фокус на «Скасувати»; Enter → `invoke("quit_app")`; Escape → close modal + hide window; «Скасувати» → close modal + hide window; «Вийти» → `invoke("quit_app")`
15. **`SettingsModal.tsx`**: async завантаження `get_settings()` → `aria-busy="true"` + «…» під час завантаження; тема: `role="group"` + дві кнопки `aria-pressed`; мова: `<select>` з options Авто/English/Українська; три чекбокси (start_in_tray, autostart, confirm_on_close); підказка «Деякі зміни набудуть чинності після перезапуску»; «Зберегти» → disabled під час `save_settings()` (захист від подвійного натиску); тема та мова застосовуються негайно; Ctrl+Enter → submit; Escape → close without save
16. **`Toast.tsx`** + **`ToastContainer.tsx`**: fixed bottom-right, `gap: 8px`, нові toast — знизу; типи кольором бордера (success: `#4caf50`, warning: `#ff9800`, error: `--color-destructive`, info: стандартний); slide-in 150 мс; fade-out 300 мс; **`animation-delay = duration − 300ms`** (виправлення PRD open question 12: для 5с toast fade починається о 4.7с, не о 2с); `pointer-events: none`; контейнер: `aria-live="polite"`, `aria-atomic="true"`

#### Головний компонент (`src/`)

17. **`App.tsx`**: `role="application"` на кореневому елементі; LanguageContext + ThemeContext providers; стан всіх модальних вікон (open/closed); підписка на Tauri-події: `tray:create-snippet` → відкрити CreateModal, `tray:open-settings` → відкрити SettingsModal, `window:close-request` → відкрити ExitConfirmModal; **логіка blur**: `window.addEventListener("blur")` → часткове скидання (query, activeIndex, закрити PasswordModal; **інші модалки НЕ закривати**); логіка **повного скидання** при приховуванні вікна (Escape, успішна активація, «Скасувати» у ExitConfirmModal): `resetState()` + закрити всі модалки; `get_pending_notification()` при старті → якщо є: `addToast(msg, 'warning', 5000)`; `useKeyboard` підключений тут
18. **`main.tsx`**: `ReactDOM.createRoot` + `<App />`; відключити стандартне контекстне меню: `document.addEventListener('contextmenu', e => e.preventDefault())`

### 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

#### Хуки

**Файл: `src/hooks/__tests__/useDebounce.test.ts`**

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
    expect(result.current).toBe('a'); // Ще не оновлено
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('ab'); // Оновлено після debounce
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
    expect(result.current).toBe('a'); // Ще 'a', бо таймер скинувся
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('abc');
    vi.useRealTimers();
  });
});
```

**Файл: `src/hooks/__tests__/useToast.test.ts`**

```typescript
describe('useToast', () => {
  it('adds toast with correct properties');
  it('removes toast after default duration (2000ms)');
  it('removes toast after custom duration (5000ms for warning)');
  it('supports success/warning/error/info types');
  it('multiple toasts stack correctly');
});
```

**Файл: `src/hooks/__tests__/useSnippets.test.ts`**

```typescript
describe('useSnippets', () => {
  it('initial state: empty query, empty snippets, activeIndex=-1');
  it('setQuery updates query');
  it('setActiveIndex updates activeIndex');
  it('resetState clears query, activeIndex, snippets');
});
```

#### Компоненти (React Testing Library + mockIPC)

**Файл: `src/components/__tests__/SearchBox.test.tsx`**

```typescript
describe('SearchBox', () => {
  // --- ARIA ---
  it('has type="search"');
  it('has aria-label for search placeholder');
  it('has autocomplete="off" and spellcheck="false"');
  it('sets aria-activedescendant to active snippet id');
  it('clears aria-activedescendant when activeIndex is -1');

  // --- Keyboard ---
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

**Файл: `src/components/__tests__/SnippetList.test.tsx`**

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

**Файл: `src/components/__tests__/SnippetItem.test.tsx`**

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

**Файл: `src/components/__tests__/ModalOverlay.test.tsx`**

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

**Файл: `src/components/__tests__/CreateSnippetModal.test.tsx`**

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

**Файл: `src/components/__tests__/EditSnippetModal.test.tsx`**

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

**Файл: `src/components/__tests__/DeleteConfirmModal.test.tsx`**

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

**Файл: `src/components/__tests__/PasswordModal.test.tsx`**

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

**Файл: `src/components/__tests__/ExitConfirmModal.test.tsx`**

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

**Файл: `src/components/__tests__/SettingsModal.test.tsx`**

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

**Файл: `src/components/__tests__/Toast.test.tsx`**

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

**Файл: `src/components/__tests__/App.test.tsx`**

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
- [ ] `document.documentElement.lang` оновлюється при зміні мови

#### Поведінка вікна
- [ ] Blur (клік за межами вікна) → вікно ховається; PasswordModal закривається; CreateModal/EditModal/SettingsModal **не закривається**
- [ ] × при `confirm_on_close=true` → ExitConfirmModal; «Скасувати» → модалка закривається + вікно ховається; «Вийти» → застосунок завершується
- [ ] Контекстне меню (правий клік) → **не з'являється** ніде у вікні

#### Accessibility
- [ ] Відкрити Windows Narrator (Win+Ctrl+Enter) → навігація по списку: Narrator оголошує назву + «зашифрований» (якщо є) при зміні активного елемента
- [ ] Ctrl+Shift+Space → Narrator оголошує «{назва}, {тип}, {N} з {total}»
- [ ] Відкрити CreateModal → Narrator оголошує заголовок вікна; після невдалої валідації → Narrator оголошує помилку

---

## Фаза 10 — Фінальна збірка, інтеграційні тести та портативність

### Завдання

1. Перевірити та виправити всі TypeScript-помилки: `npx tsc --noEmit` без помилок
2. Перевірити та виправити всі Rust-попередження: `cargo clippy -- -D warnings` без помилок
3. Запустити повний набір тестів: `npm run test:all`
4. Виконати фінальну збірку: `npm run tauri build` → `src-tauri/target/release/QuickSnippets.exe`
5. Перевірити розмір `.exe` — орієнтовно 10–15 MB (якщо значно більше — перевірити чи не потрапили зайві debug-символи)
6. Перевірити наявність WebView2: якщо WebView2 Runtime не встановлений — застосунок повинен показати нативний діалог з посиланням на завантаження (не мовчки падати)

### 🤖 Фінальний automated pipeline

**Скрипт: `scripts/final-checks.ps1`**

```powershell
$ErrorActionPreference = "Stop"

# 1. TypeScript compilation
Write-Host "=== TypeScript check ===" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Write-Error "TypeScript errors found"; exit 1 }

# 2. Rust clippy
Write-Host "=== Cargo clippy ===" -ForegroundColor Cyan
Push-Location src-tauri
cargo clippy -- -D warnings
if ($LASTEXITCODE -ne 0) { Write-Error "Clippy warnings found"; Pop-Location; exit 1 }
Pop-Location

# 3. Rust tests
Write-Host "=== Cargo test ===" -ForegroundColor Cyan
Push-Location src-tauri
cargo test -- --test-threads=1
if ($LASTEXITCODE -ne 0) { Write-Error "Rust tests failed"; Pop-Location; exit 1 }
Pop-Location

# 4. Frontend tests
Write-Host "=== Vitest ===" -ForegroundColor Cyan
npx vitest run
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend tests failed"; exit 1 }

# 5. Build
Write-Host "=== Tauri build ===" -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# 6. Check exe exists and size
$exe = Get-Item "src-tauri\target\release\QuickSnippets.exe" -ErrorAction SilentlyContinue
if ($null -eq $exe) { Write-Error "EXE not found"; exit 1 }
$sizeMB = [math]::Round($exe.Length / 1MB, 1)
Write-Host "EXE size: ${sizeMB} MB" -ForegroundColor Green
if ($sizeMB -gt 25) {
    Write-Warning "EXE size ${sizeMB}MB exceeds expected 10-20MB range"
}

Write-Host ""
Write-Host "=== All automated checks passed ===" -ForegroundColor Green
Write-Host "Proceed to manual verification checklist." -ForegroundColor Yellow
```

### 🤖 Зведення кількості автоматичних тестів по фазах

| Фаза | Модуль | Мін. тестів | Інструмент |
|------|--------|-------------|------------|
| 2 | `db.rs` | 18 | `cargo test` |
| 3 | `crypto.rs` | 14 | `cargo test` |
| 4 | `search.rs` | 20 | `cargo test` |
| 5 | `settings.rs` | 18 | `cargo test` |
| 6 | `commands.rs` | 16 | `cargo test` |
| 7 | `main.rs` helpers | 6 | `cargo test` |
| 8 | translations, types, hooks | 45 | Vitest |
| 9 | hooks (debounce, toast, snippets) | 13 | Vitest |
| 9 | components (13 тест-файлів) | 100+ | Vitest + RTL |
| **Всього** | | **≥ 250** | |

### ✅ Ручна перевірка по завершенні фази

- [ ] `powershell -File scripts/final-checks.ps1` — все зелене
- [ ] Скопіювати **лише** `QuickSnippets.exe` у нову порожню директорію (без `snippets.db`, без `settings.json`)
- [ ] Запустити `QuickSnippets.exe` — застосунок стартує без помилок
- [ ] Після першого запуску: `settings.json` з'являється автоматично (PRD 2.5.3); `snippets.db` створюється одразу
- [ ] Скопіювати `QuickSnippets.exe` + `snippets.db` + `settings.json` у іншу директорію → запустити → всі сніпети та налаштування збереглися
- [ ] Перенести директорію на інший диск (наприклад, з `C:\tools\` у `D:\utils\`) → запустити → все працює
- [ ] Перевірити розмір: `(Get-Item QuickSnippets.exe).Length / 1MB` → результат у діапазоні 10–20 MB
- [ ] Повний smoke-test фінального `.exe`: Ctrl+Alt+Space → пошук → копіювання → трей → завершення

---

## Додаток A: Виявлені відхилення від PRD та виправлення

| # | Питання | Стан у попередньому плані | Виправлення | Фаза |
|---|---------|---------------------------|-------------|------|
| A1 | `settings.json` створення при 1-му запуску | Файл НЕ створювався | **Створюється автоматично** (PRD 2.5.3) | 5 |
| A2 | `start_in_tray` при запуску | Не реалізовано | Додано `window.hide()` якщо `true` (PRD 2.5.1) | 7 |
| A3 | Вікно ховається при blur | Тільки часткове скидання | Додано `window.hide()` при `Focused(false)` (PRD 2.10.3) | 7, 9 |
| A4 | `<html lang>` при зміні мови | Не оновлювався | `document.documentElement.lang = lang` (PRD OQ#13) | 8 |
| A5 | Toast fade-out для 5с toast | Починався о 2с | `animation-delay = duration - 300ms` (PRD OQ#12) | 9 |
| A6 | Плюралізація searchResults | Завжди множина | `n === 1 ? '1 snippet' : ...` (PRD OQ#14) | 8 |
| A7 | Кнопка PasswordModal | Не уточнено | «Копіювати» / «Copy» (PRD 3.8) | 9 |

---

## Додаток B: Прийняті рішення з відкритих питань PRD

| # | Питання з PRD розділу 11 | Прийняте рішення |
|---|--------------------------|-------------------|
| 9 | Ліміт title — code points чи байти? | Code points (`chars().count()` у Rust; `.length` у JS) |
| 10 | Ліміт content — символи чи байти? | Байти на рівні БД (CHECK); символи у UI-валідації. Задокументувати розбіжність |
| 11 | Макс. відкритий текст для зашифрованих ~48000 | Відхиляти з помилкою при перевищенні після шифрування в `create_snippet` |
| 12 | Toast fade-out таймінг | `animation-delay = duration − 300ms` → виправлено |
| 13 | `<html lang>` не оновлюється | `document.documentElement.lang = lang` у `setLanguage()` → виправлено |
| 14 | Плюралізація N=1 | Параметризований рядок з умовою → виправлено |

---

## Додаток C: Команди для запуску тестів

```bash
# --- Rust backend ---
cd src-tauri

# Усі Rust-тести
cargo test

# Окремий модуль
cargo test db::tests
cargo test crypto::tests
cargo test search::tests
cargo test settings::tests
cargo test commands::tests

# З виводом stdout
cargo test -- --nocapture

# Cargo clippy (lint)
cargo clippy -- -D warnings

# --- Frontend ---
cd ..

# Усі frontend-тести
npx vitest run

# Watch mode (розробка)
npx vitest

# Окремий файл
npx vitest run src/i18n/__tests__/translations.test.ts

# Coverage
npx vitest run --coverage

# TypeScript type check
npx tsc --noEmit

# --- Всі тести одночасно ---
npm run test:all

# --- Фінальний pipeline ---
powershell -File scripts/final-checks.ps1
```
