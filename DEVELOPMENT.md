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

# 4. Push main, develop, and the tag
git push origin main develop --tags
```

The push to `main` automatically triggers `.github/workflows/release.yml`.

### What the release workflow does

1. Reads the version from `src-tauri/Cargo.toml`
2. Builds the frontend with `npm run build` (creates `dist/` for Tauri to embed)
3. Builds the Rust binary with `cargo build --release` in `src-tauri/`
   - Uses direct `cargo` build — **not** `npm run tauri build` — to avoid
     triggering the Wix/NSIS bundler (we need only the raw `.exe`, not an installer)
4. Packages `quick-snippets.exe` into a ZIP:
   `quick-snippets-windows-x64-v{version}.zip`
5. Generates a SHA-256 checksum file
6. Creates (or updates) a GitHub Release tagged `v{version}` with both files

### Re-running a failed release

If the automatic trigger failed (e.g. transient runner error) and no new commit
is needed, re-trigger manually via the GitHub Actions UI:
- Go to **Actions → Release → Run workflow**
- Leave `version_override` empty to re-read from `Cargo.toml`, or fill it in if
  needed (format: `1.2.3`, no `v` prefix)

### Planned: Scoop bucket workflow

A future `release-scoop.yml` workflow will listen for the `release` event and
update a Scoop manifest.  The download URL follows a predictable pattern:

```
https://github.com/{owner}/{repo}/releases/download/v{version}/quick-snippets-windows-x64-v{version}.zip
```

The `.sha256` file attached to every release contains the checksum in
`sha256sum`-compatible format, ready for the Scoop manifest `hash` field.

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
