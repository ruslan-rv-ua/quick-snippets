# Фаза 7 — Backend: ініціалізація (`main.rs`)

## Завдання

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

---

## 🤖 Автоматичні тести (TDD)

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

---

## ✅ Ручна перевірка по завершенні фази

- [ ] Запустити застосунок → іконка з'являється у системному треї Windows; tooltip «QuickSnippets»
- [ ] Клік правою кнопкою по іконці → контекстне меню з 5 пунктами (Показати, Новий сніпет, Налаштування, роздільник, Вихід)
- [ ] Натиснути Ctrl+Alt+Space з іншого застосунку → вікно QuickSnippets з'являється та отримує фокус
- [ ] Мінімізувати вікно → Ctrl+Alt+Space → вікно відновлюється (не лишається мінімізованим)
- [ ] Запустити другий екземпляр `.exe` → вікно першого отримує фокус, другий процес завершується
- [ ] Перемістити вікно → закрити через × → перезапустити → вікно відкривається на новій позиції
- [ ] `start_in_tray=true` у settings.json → перезапуск → вікно приховане, є тільки трей-іконка (PRD 2.5.1)
- [ ] Клік за межами вікна (blur) → вікно ховається (PRD 2.10.3)
- [ ] `confirm_on_close=true` (за замовчуванням): натиснути × → вікно НЕ закривається (подія `window:close-request` приходить у DevTools Console)
