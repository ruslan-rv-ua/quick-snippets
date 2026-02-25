# Фаза 6 — Backend: IPC-команди (`commands.rs`)

## Завдання

Реалізувати всі команди як `#[tauri::command]` функції.

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

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

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
        let id = create_snippet_inner(&conn, "my test", "hello world", "").unwrap();
        let results = search_snippets_inner(&conn, "test").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, id);
        let content = activate_snippet_get_content(&conn, id, "").unwrap();
        assert_eq!(String::from_utf8(content).unwrap(), "hello world");
        delete_snippet_inner(&conn, id).unwrap();
        let results = search_snippets_inner(&conn, "").unwrap();
        assert_eq!(results.len(), 0);
    }
}
```

**Запуск:** `cd src-tauri && cargo test commands::tests`

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test commands::tests` — всі тести зелені (≥ 16 тестів)
- [ ] `cargo build` без помилок
- [ ] Через DevTools console: `invoke("create_snippet", {title: "test", content: "hello", password: ""})` → `invoke("search_snippets", {query: "test"})` → результат з id і title
- [ ] **Критична перевірка безпеки:** `activate_snippet` для незашифрованого → у відповіді, у DevTools **відсутній** текст вмісту; буфер обміну містить правильний текст
- [ ] **Критична перевірка безпеки:** створити зашифрований сніпет (password: "abc") → `activate_snippet` з правильним паролем → вміст у буфері, у відповіді IPC — лише `null`/`undefined`; `activate_snippet` з неправильним паролем → `Err("WrongPassword")`
- [ ] `get_pending_notification` повертає рядок при першому виклику і `null` при другому
