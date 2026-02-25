# Фаза 2 — Backend: база даних (`db.rs`)

## Завдання

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

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

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

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test` — всі тести `db::tests` зелені (≥ 18 тестів)
- [ ] Файл `snippets.db` з'являється **поруч з `.exe`** (або поруч з `src-tauri/target/debug/` у dev-режимі), а не в `AppData`
- [ ] PRAGMA WAL: після `init_db` виконати `PRAGMA journal_mode;` — відповідь `wal`
- [ ] CHECK-обмеження: спроба записати title довжиною 2 символи → помилка SQLite
- [ ] При ручному пошкодженні `snippets.db` (довільний текст у файлі) і перезапуску застосунку: з'являється нативний діалог Windows із двома кнопками
