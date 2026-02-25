# Додатки

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
