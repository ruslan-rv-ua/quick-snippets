# DEV.md — Developer guide (Windows)

Коротко: цей репозиторій — Tauri (Rust) backend + React/TypeScript frontend. Використовуйте `just` (PowerShell) або наведені нижче команди вручну.

**Prerequisites (Windows)**
- Node.js (LTS). Рекомендація:
  - Scoop: `iwr -useb get.scoop.sh | iex; scoop install nodejs-lts`
  - або Chocolatey: `choco install nodejs-lts`
  - або nvm-windows: https://github.com/coreybutler/nvm-windows
- npm (поставляється з Node).
- Rust (rustup): `winget install --id RustLang.Rustup` або вручну з https://rustup.rs
  - Встановіть MSVC toolchain: `rustup default stable-x86_64-pc-windows-msvc`
- Visual Studio Build Tools (C++): встановіть "Desktop development with C++" workload.
- OpenSSL (за потреби для деяких crate): `scoop install openssl` або `choco install openssl`.
- Tauri CLI (optional): `cargo install tauri-cli` або використовуйте `npx tauri`.
- just (recommended): `scoop install just` або `choco install just`. Якщо відсутні пакети — скачайте реліз з https://github.com/casey/just/releases і додайте до PATH.

Якщо щось відсутнє — дотримуйтесь офіційних інструкцій на відповідних сайтах.

Як користуватись just
- Ініціалізація (встановлення deps + rust toolchain checks):
  ```powershell
  just setup
  ```
- Розробка (створити dev процес — Tauri часто запускає фронтенд автоматично):
  ```powershell
  just dev
  ```
- Локальна збірка + пакування:
  ```powershell
  just build
  just build-fast           # швидка збірка (release-fast профіль, більший exe)
  ```
- Тести:
  ```powershell
  just test              # frontend + backend
  just test-watch        # watch mode для frontend
  just test-coverage     # coverage для frontend
  just test-all          # всі тести (npm run test:all)
  ```
- Лінт/перевірка:
  ```powershell
  just lint              # tsc + cargo clippy
  just check             # швидкі статичні перевірки
  ```
- Форматування:
  ```powershell
  just format
  ```
- Випуск (production):
  ```powershell
  just release           # build + package в release режимі
  just package           # створити інсталятор/бінарні артефакти
  ```
- Фінальні перевірки:
  ```powershell
  just final-checks      # фінальний pipeline: version sync + tsc + clippy + tests + build
  ```
- Утиліти:
  ```powershell
  just clean             # видалити node_modules та cargo artifacts
  just db-reset          # скидання БД
  just open              - відкрити папку з фронтенд збіркою або Rust релізом
  ```

Генерація demo бази даних
- Для швидкого створення demo SQLite бази (заповненої >40 сніпетів) використайте:
  ```powershell
  just gdb
  # або запустити скрипт напряму
  python .\generate_demo_db.py
  ```
  Скрипт створює `src-tauri/target/release/snippets_demo.db`.

Передати змінні:
- Змінити профіль/архітектуру, наприклад:
  ```powershell
  just build PROFILE=release ARCH=x64
  ```

Примітка щодо `PROFILE` і `just build`:
- Для `PROFILE=release` рецепт викликає упаковку через Tauri (`npm run tauri build`) і створює релізні бінарі/інсталятори у `src-tauri/target/release/bundle`.
- Для інших профілів (наприклад `debug`) `Justfile` тепер викликає `cargo build --profile <PROFILE>` у `src-tauri`, тобто `just build PROFILE=debug` зробить `cargo build --profile debug` (з fallback на `cargo build` при помилці).
- Якщо потрібно точніше керувати збіркою Rust — відкрийте `src-tauri` і запускайте `cargo build` / `cargo build --release` вручну.

Приклади запуску окремо
- Frontend only:
  ```powershell
  npm install
  npm run build
  ```
- Backend only:
  ```powershell
  cd src-tauri
  cargo build
  ```

Ручні (PowerShell) еквіваленти основних задач
- Встановити залежності:
  ```powershell
  npm install
  ```
- TypeScript перевірка:
  ```powershell
  npx tsc --noEmit
  ```
- Запустити фронтенд тести (Vitest):
  ```powershell
  npx vitest run              # одноразовий запуск
  npx vitest                  # watch mode
  npx vitest run --coverage   # з coverage
  ```
- Запустити всі тести (frontend + backend):
  ```powershell
  npm run test:all
  ```
- Побудувати фронтенд:
  ```powershell
  npm run build
  ```
- Побудувати Rust backend:
  ```powershell
  cd src-tauri
  cargo build
  cargo check                 # швидка перевірка компіляції
  cargo clippy -- -D warnings # lint (нульова толерантність)
  ```
- Запустити Rust тести:
  ```powershell
  cd src-tauri
  cargo test -- --test-threads=1
  cargo test db::tests       # конкретний модуль
  ```
- Зібрати пакет Tauri (можна двома способами):
  ```powershell
  # from project root
  npm run tauri -- build
  # or from src-tauri
  cd src-tauri
  npx tauri build
  ```
- Фінальна перевірка pipeline:
  ```powershell
  powershell -File scripts/final-checks.ps1
  ```

Release Process
---------------

### Version management

Single source of truth: **`src-tauri/Cargo.toml`** (`[package].version`).
When cutting a release, bump the version in all three places and keep them in sync:

```
src-tauri/Cargo.toml   ← authoritative source (binary embeds this)
tauri.conf.json         ← "version" field
package.json            ← "version" field
```

### Git Flow release procedure

```powershell
# 1. Start a release branch from develop
git flow release start 1.2.3

# 2. Bump version in all three files (see above), commit
git add src-tauri/Cargo.toml tauri.conf.json package.json
git commit -m "chore: bump version to 1.2.3"

# 3. Finish the release (merges to main + develop, creates tag v1.2.3)
git flow release finish 1.2.3

# 4. Push main and develop
git push origin main develop
```

### Creating a GitHub Release

Release створюється вручну через GitHub Actions UI:

1. **Actions → Release → Run workflow**
2. Вказати версію (формат: `1.2.3`, без `v`)
3. За потреби позначити як pre-release

Workflow автоматично:
1. Створює тег `v{version}` та пушить його
2. Запускає `npx tauri build --no-bundle` (збірка фронтенду + Rust binary)
3. Пакує `quick-snippets.exe`, `LICENSE`, `README.md` у ZIP:
   `quick-snippets-{version}-windows-x64.zip`
4. Генерує SHA-256 checksum файл
5. Створює GitHub Release з обома файлами

### Оновлення Scoop маніфесту

Після створення релізу вручну запустіть **Actions → Update Scoop manifest**:
1. Вказати версію (або залишити порожнім для останньої)
2. Workflow завантажить ZIP, перевірить SHA256, та відправить dispatch до scoop-bucket

```
https://github.com/{owner}/{repo}/releases/download/v{version}/quick-snippets-{version}-windows-x64.zip
```

TDD та безпека
- Проєкт дотримується TDD: пишіть тести перед фічами.
- Rust тести для DB використовують in-memory DB (`Connection::open_in_memory()`).
- Критичний інваріант безпеки (AGENTS.md): розшифровані/plaintext сніпети НІКОЛИ не передаються у frontend. Усі операції з буфером обміну — виключно в Rust-процесі. Поважайте цей інваріант при розробці і тестуванні.

Troubleshooting (Windows)
- Visual Studio Build Tools: помилки під час `cargo build` зазвичай означають, що workload не встановлено.
- Long path / MAX_PATH: за потреби ввімкніть long paths або використовуйте коротші шляхи.
- `cargo`/`rustup` не в PATH: закрийте/відкрийте PowerShell після інсталяції або перезапустіть систему.
- antivirus / SmartScreen може блокувати NSIS/makensis — дозволіть у вірусі або перевірте logs.
- Git LF/CRLF warnings: стандартне попередження; налаштуйте `.gitattributes` або `core.autocrlf`.
- Tauri / Node / Rust version mismatches: тримайте Node LTS та stable Rust; якщо з'являються проблеми, оновіть локальні пакети: `npm ci` і `rustup update`.
- Якщо `npx tauri build` падає, спробуйте `npm run tauri -- build` (передає аргументи скрипту).

Рекомендовані just-змінні (в justfile)
- `PROFILE` (debug|release) - профіль збірки
- `ARCH` (x64|arm64) - цільова архітектура
- `NODE_VERSION` (інформаційно) - версія Node.js

Приклади використання змінних:
```powershell
just build PROFILE=release
just build PROFILE=release ARCH=x64
just release ARCH=arm64
```

Зверніть увагу на безпеку: ніколи не виводьте/логгируйте plaintext сніпетів у фронтенд або CI-логи. Дотримуйтесь інваріанту з AGENTS.md.

Додаткова інформація
- Повний список команд: `just help`
- Justfile вже налаштований для Windows (PowerShell)
- Всі команди автоматично виконують `npm install` перед основними операціями (dev, build, test-all, final-checks, package)
