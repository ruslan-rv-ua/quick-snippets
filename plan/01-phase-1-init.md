# Фаза 1 — Ініціалізація проєкту, структура та інфраструктура тестування

## Завдання

1. Створити Tauri v2 проєкт через `npm create tauri-app@latest` з шаблоном **React + TypeScript + Vite**
2. Налаштувати `Cargo.toml` — всі залежності:
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
8. Створити структуру директорій:
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

---

## 🤖 Автоматичні тести (критерії виконання фази)

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

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `cargo check` у `src-tauri/` завершується без помилок (всі залежності резолвляться)
- [ ] `npm install` завершується без помилок
- [ ] `npm run tauri dev` запускає порожнє вікно Tauri з заголовком `QuickSnippets`
- [ ] Вікно не менше 480×320 пікселів, не перевищує початковий розмір 680×520
- [ ] `npm run test` завершується успішно (0 тестів, 0 помилок)
- [ ] `npm run test:rust` завершується успішно
