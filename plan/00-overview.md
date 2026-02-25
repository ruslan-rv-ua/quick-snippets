# QuickSnippets — План реалізації (TDD)

> **Контекст:** Реалізація виконується у режимі vibe coding (агент-виконавець невизначений).
> Кожна фаза завершується ручною та автоматичною перевіркою перед переходом до наступної.
> Критичний інваріант безпеки, якого **не можна порушувати**: розшифрований вміст сніпета **ніколи не передається у фронтенд**. Всі операції з буфером обміну виконуються виключно у Rust-процесі.

---

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

## Перелік фаз

| Файл | Фаза | Зміст |
|------|------|-------|
| [01-phase-1-init.md](01-phase-1-init.md) | 1 | Ініціалізація проєкту, структура та інфраструктура тестування |
| [02-phase-2-database.md](02-phase-2-database.md) | 2 | Backend: база даних (`db.rs`) |
| [03-phase-3-crypto.md](03-phase-3-crypto.md) | 3 | Backend: шифрування (`crypto.rs`) |
| [04-phase-4-search.md](04-phase-4-search.md) | 4 | Backend: нечіткий пошук (`search.rs`) |
| [05-phase-5-settings.md](05-phase-5-settings.md) | 5 | Backend: налаштування (`settings.rs`) |
| [06-phase-6-commands.md](06-phase-6-commands.md) | 6 | Backend: IPC-команди (`commands.rs`) |
| [07-phase-7-main.md](07-phase-7-main.md) | 7 | Backend: ініціалізація (`main.rs`) |
| [08-phase-8-frontend-types.md](08-phase-8-frontend-types.md) | 8 | Frontend: типи, IPC та i18n |
| [09-phase-9-ui-components.md](09-phase-9-ui-components.md) | 9 | Frontend: UI компоненти |
| [10-phase-10-final-build.md](10-phase-10-final-build.md) | 10 | Фінальна збірка, інтеграційні тести та портативність |
| [appendices.md](appendices.md) | — | Додатки A–C |

---

## Зведення кількості автоматичних тестів по фазах

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
