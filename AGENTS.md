# AGENTS.md — QuickSnippets

Настанови для AI-агентів, які реалізують цей проєкт.

---

## 1. Що це за проєкт

**QuickSnippets** — портативний десктопний застосунок Windows для швидкого доступу до текстових сніпетів.
Стек: **Tauri v2** (Rust backend) + **React 19 + TypeScript + Vite** (frontend).
Підхід до реалізації: **TDD** (Red → Green → Refactor).

Детальні вимоги — у [PRD.md](PRD.md).
Покроковий план — у директорії [plan/](plan/).

---

## 2. Структура репозиторію

```
quick-snippets/
├── src/                    # React/TypeScript frontend
│   ├── components/         # UI компоненти
│   ├── contexts/           # React contexts (Theme, Language)
│   ├── hooks/              # Custom hooks
│   ├── i18n/               # Переклади (en, uk)
│   ├── styles/             # CSS-змінні і теми
│   ├── types/              # TypeScript типи
│   └── test/setup.ts       # Vitest setup
├── src-tauri/src/          # Rust backend
│   ├── main.rs             # Tauri init, tray, hotkey, window events
│   ├── commands.rs         # #[tauri::command] IPC handlers
│   ├── db.rs               # SQLite CRUD
│   ├── crypto.rs           # AES-256-GCM + PBKDF2
│   ├── search.rs           # Fuzzy search
│   └── settings.rs         # Settings load/save
├── plan/                   # Детальний план реалізації по фазах
├── scripts/                # PowerShell CI-скрипти
├── PRD.md                  # Product Requirements Document
├── AGENTS.md               # ← цей файл
└── .gitignore
```

---

## 3. Команди збірки та тестування

> Завжди запускайте ці команди, щоб переконатися в коректності змін.

```powershell
# --- Frontend ---
npm install                        # встановити залежності
npx tsc --noEmit                   # TypeScript перевірка типів
npx vitest run                     # всі frontend-тести (одноразово)
npx vitest                         # watch mode
npx vitest run --coverage          # з покриттям

# --- Rust backend ---
cd src-tauri
cargo check                        # швидка перевірка компіляції
cargo test -- --test-threads=1     # всі Rust-тести
cargo test db::tests               # конкретний модуль
cargo clippy -- -D warnings        # lint (нульова толерантність)
cargo build                        # debug-збірка

# --- Зібрати все ---
npm run test:all                   # Frontend Vitest + Rust cargo test
npm run tauri dev                  # dev-сервер
npm run tauri build                # production .exe

# --- Фінальний pipeline ---
powershell -File scripts/final-checks.ps1
```

---

## 4. TDD-цикл (обов'язковий)

Кожне завдання реалізується за циклом:

1. **Red** — написати тест, який НЕ проходить (або навіть не компілюється)
2. **Green** — мінімальна реалізація, щоб тест пройшов
3. **Refactor** — покращити код, не ламаючи тести

**Тести Rust** — `#[cfg(test)] mod tests` у кожному модулі; БД — виключно `Connection::open_in_memory()`.
**Тести Frontend** — Vitest + React Testing Library у директоріях `__tests__/` поруч із кодом.

---

## 5. Критичний інваріант безпеки

> ⛔ **НІКОЛИ не порушувати:**
> Розшифрований вміст зашифрованого сніпета **ніколи не передається у frontend**.
> Всі операції з буфером обміну виконуються **виключно в Rust-процесі**.
> IPC-відповідь на `activate_snippet` — лише `Ok(())` або `Err(...)`, без plaintext.
> Тест `test_get_snippet_encrypted_excludes_content` у `commands.rs` є стражем цього правила.

---

## 6. Правила написання коду

### Rust

- Усі публічні функції, що використовуються у тестах, виокремлюються в `*_inner()` варіанти (приймають `&Connection` замість `State<AppState>`) — це забезпечує тестованість без Tauri runtime.
- Після використання чутливих буферів обов'язковий `zeroize` (ключі, plaintext).
- `cargo clippy -- -D warnings` повинен проходити без помилок.
- Для файлових тестів — `tempfile::TempDir`, не реальні шляхи.

### TypeScript / React

- Типи синхронізовані з Rust-структурами (`src/types/index.ts`).
- Переклади (`src/i18n/translations.ts`) покривають обидві мови (`en`, `uk`); TypeScript `Record<LangCode, TranslationMap>` гарантує повноту.
- `npx tsc --noEmit` без помилок — обов'язково.
- Компоненти — функціональні (React hooks).
- Модальні вікна — через `ModalOverlay` з focus trap.

### CSS

- Використовувати лише CSS-змінні з `theme.css` (`--color-*`, `--shadow-*`, `--radius-*`).
- Не додавати хардкод кольорів поза `theme.css`.

---

## 7. Фази реалізації

| Файл | Фаза | Зміст |
|------|------|-------|
| [plan/00-overview.md](plan/00-overview.md) | — | Мета, TDD-підхід, інструменти |
| [plan/01-phase-1-init.md](plan/01-phase-1-init.md) | 1 | Ініціалізація проєкту та інфраструктура |
| [plan/02-phase-2-database.md](plan/02-phase-2-database.md) | 2 | Backend: база даних (`db.rs`) |
| [plan/03-phase-3-crypto.md](plan/03-phase-3-crypto.md) | 3 | Backend: шифрування (`crypto.rs`) |
| [plan/04-phase-4-search.md](plan/04-phase-4-search.md) | 4 | Backend: нечіткий пошук (`search.rs`) |
| [plan/05-phase-5-settings.md](plan/05-phase-5-settings.md) | 5 | Backend: налаштування (`settings.rs`) |
| [plan/06-phase-6-commands.md](plan/06-phase-6-commands.md) | 6 | Backend: IPC-команди (`commands.rs`) |
| [plan/07-phase-7-main.md](plan/07-phase-7-main.md) | 7 | Backend: ініціалізація (`main.rs`) |
| [plan/08-phase-8-frontend-types.md](plan/08-phase-8-frontend-types.md) | 8 | Frontend: типи, IPC, i18n |
| [plan/09-phase-9-ui-components.md](plan/09-phase-9-ui-components.md) | 9 | Frontend: UI компоненти |
| [plan/10-phase-10-final-build.md](plan/10-phase-10-final-build.md) | 10 | Фінальна збірка та портативність |
| [plan/appendices.md](plan/appendices.md) | — | Додатки A–C (відхилення PRD, рішення, команди) |

Проходити фази **послідовно**. Кожна фаза має чеклист ручної перевірки — виконати перед переходом до наступної.

---

## 8. Прийняті архітектурні рішення

- **Portability**: усі файли даних (`snippets.db`, `settings.json`) зберігаються **поруч з `.exe`** — не в `AppData`.
- **Шифрування**: AES-256-GCM + PBKDF2-HMAC-SHA256 (100 000 ітерацій); унікальні salt і nonce при кожному шифруванні.
- **Пошук**: клієнтський fuzzy search на стороні Rust (всі назви завантажуються в пам'ять, пошук виконується in-process).
- **Single Instance**: `tauri-plugin-single-instance`; повторний запуск фокусує існуюче вікно.
- **Blur → hide**: вікно автоматично ховається при втраті фокусу (поведінка лаунчера).

---

## 9. Де шукати деталі

- Вимоги до конкретного модуля → відповідна секція `PRD.md`
- Тести, які треба написати → розділ «🤖 Автоматичні тести» у відповідному файлі `plan/`
- Ручна перевірка → розділ «✅ Ручна перевірка» у відповідному файлі `plan/`
- Відхилення від PRD → [plan/appendices.md](plan/appendices.md) Додаток A
- Прийняті рішення → [plan/appendices.md](plan/appendices.md) Додаток B
