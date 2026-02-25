# Фаза 5 — Backend: налаштування (`settings.rs`)

## Завдання

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

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

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

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `cargo test settings::tests` — всі тести зелені (≥ 18 тестів)
- [ ] Перший запуск (без `settings.json`): файл `settings.json` **з'являється автоматично** поруч з `.exe` зі стандартними значеннями (PRD 2.5.3)
- [ ] Зберегти налаштування → `settings.json` оновлюється поруч з `.exe`
- [ ] Вручну вписати у `settings.json` неправильний JSON → перезапуск → з'являється нативний діалог Windows
- [ ] Вручну вписати `"x": -9999` у `window_state` → перезапуск → вікно з'являється не за межами екрану
