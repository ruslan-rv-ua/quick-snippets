# DEVELOPMENT.md — Developer guide (Windows)

Коротко: цей репозиторій — Tauri 2 (Rust) backend + React/TypeScript frontend. Використовуйте `just` (PowerShell) або наведені нижче команди вручну.

## Prerequisites (Windows)

- Node.js (LTS; для тестів потрібна 22.22+, 24.15+ або 26+):
  - Scoop: `scoop install nodejs-lts`
  - або winget: `winget install OpenJS.NodeJS.LTS`
- Rust (rustup): `winget install --id Rustlang.Rustup` або з https://rustup.rs
  - MSVC toolchain: `rustup default stable-x86_64-pc-windows-msvc`
- Visual Studio Build Tools: workload "Desktop development with C++".
- WebView2 Runtime — уже є в Windows 10/11.
- just (рекомендовано): `scoop install just`.
- Tauri CLI окремо ставити не треба: він є в devDependencies, запускається через `npx tauri`.

## Команди just

`just` або `just help` показує всі рецепти. Основні:

```powershell
just setup             # npm install + перевірка Node/Rust
just dev               # Tauri dev: фронтенд + backend з hot-reload
just vite              # лише фронтенд (Vite dev server)

just test              # усі тести: Vitest + cargo test (однопотоково)
just test-front        # лише Vitest
just test-back         # лише cargo test
just test-mod db::tests  # один модуль Rust
just test-watch        # Vitest у watch-режимі
just test-cov          # Vitest з coverage

just check             # швидко: tsc --noEmit + cargo check
just lint              # tsc --noEmit + cargo clippy -D warnings
just format            # cargo fmt

just build             # debug-збірка (npm run build + cargo build)
just build release     # release-збірка через Tauri
just build-fast        # release-fast профіль: швидка компіляція, більший exe
just release           # tsc + release-збірка через Tauri

just final-checks      # version sync + tsc + clippy + тести + збірка
just db-reset          # видалити локальну quick-snippets-data\snippets.db
just clean             # видалити dist/ та src-tauri/target/
```

## Ручні (PowerShell) еквіваленти

```powershell
npm install                     # залежності
npx tsc --noEmit                # перевірка TypeScript
npx vitest run                  # тести фронтенду (одноразово)
npx vitest run src/hooks/__tests__/useSearchLogic.test.ts   # один файл
npm run test:rust               # тести Rust (--test-threads=1, через SQLite)
npm run test:all                # усі тести
npm run lint                    # tsc + clippy
npx tauri build --no-bundle     # портативний exe, як у релізі
```

Готовий exe: `src-tauri/target/release/quick-snippets.exe`.

## Перевірка з NVDA (smoke)

`just smoke` — приблизно хвилинна перевірка зібраного exe разом з NVDA. Скрипт
`scripts/smoke-nvda.ps1` натискає клавіші замість користувача, перевіряє результат кожного кроку
(через UI Automation, буфер обміну й реєстр) і показує, що NVDA сказав на кожному кроці.

- Спершу зберіть exe: `npx tauri build --no-bundle`.
- NVDA має бути запущений, рівень журналювання — «введення/виведення»
  (Налаштування NVDA → Загальні). Без NVDA перевіряється лише сама програма.
- Під час тесту не торкайтеся клавіатури й миші.
- Ваші дані не зачіпаються: тест запускає лише свою копію exe з тимчасової папки з порожньою
  базою. Запущену QuickSnippets скрипт закриває й назад не запускає; буфер обміну відновлює.
- Наприкінці тест закриває свою копію через діалог виходу (Alt+F4, Ctrl+Enter) і запускає її
  знову з тією самою текою даних: так перевіряється, що тема й видалення зберігаються.
- Поки програма схована, фокус стоїть у маленькому тестовому вікні скрипта, тож NVDA
  не читає ваших інших програм у звіт. З логу NVDA береться лише те, що записано під час тесту.
- Звіт друкується в консоль і зберігається в `%TEMP%\quick-snippets-smoke-report.txt`.
  Код виходу 0 — усе гаразд, 1 — є помилки.
- Перевірки «бажано» (наприклад, «Скопійовано») на результат не впливають: вікно ховається
  одразу після копіювання, і NVDA не завжди встигає це прочитати.

Запускайте після змін у capabilities, плагінах, фокусі, діалогах чи оголошеннях для екранного диктора.

## Розмір exe

Release-профіль у `src-tauri/Cargo.toml` налаштований на мінімальний розмір:
`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.
У `src-tauri/tauri.conf.json` увімкнено `build.removeUnusedCommands`: Tauri не вбудовує
команди плагінів, які не дозволені в `capabilities/`. Тому не додавайте туди дозволи
плагінів, яких фронтенд не викликає: глобальна клавіша, буфер обміну й автозапуск
працюють з Rust.

Також на розмір впливають:
- `src-tauri/icons/icon.ico` вбудовується в exe. Генеруйте його через
  `npx tauri icon <png 1024×1024>` — так шари зберігаються стисненими (PNG).
- Кожна залежність у `Cargo.toml`. Перевірка невикористаних: `cargo machete` у `src-tauri`.

## Release Process

### Version management

Версія записана в трьох місцях, їх треба тримати однаковими
(`just final-checks` це перевіряє):

```
src-tauri/Cargo.toml        ← [package].version (вбудовується в exe)
src-tauri/tauri.conf.json   ← "version"
package.json                ← "version"
```

### Git Flow release procedure

```powershell
# 1. Гілка релізу від develop
git flow release start 1.2.3

# 2. Підняти версію в трьох файлах, оновити CHANGELOG.md, закомітити
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json package.json package-lock.json CHANGELOG.md
git commit -m "chore: bump version to 1.2.3"

# 3. Завершити реліз (злиття в main і develop)
git flow release finish 1.2.3

# 4. Запушити гілки (теги не пушити: тег створює release workflow)
git push origin main develop
```

### Створення GitHub Release

Реліз створюється вручну через GitHub Actions:

1. **Actions → Release → Run workflow** (гілка `main`)
2. Вказати версію (формат `1.2.3`, без `v`)
3. За потреби позначити як pre-release

Workflow автоматично:
1. Створює і пушить тег `v{version}`
2. Запускає `npx tauri build --no-bundle` (фронтенд + Rust binary)
3. Пакує `quick-snippets.exe`, `LICENSE`, `README.md` у ZIP
   `quick-snippets-{version}-windows-x64.zip`
4. Створює файл `quick-snippets-{version}-windows-x64.zip.sha256`
5. Публікує GitHub Release з обома файлами

### Оновлення Scoop

Маніфест `bucket/quick-snippets.json` живе в репозиторії
[ruslan-rv-ua/scoop-bucket](https://github.com/ruslan-rv-ua/scoop-bucket) і оновлюється
там воркфлоу **Excavator**. Він сам знаходить новий реліз (`checkver`), бере хеш з
`.sha256`-файлу (`autoupdate`) і комітить маніфест.

Після релізу:
- або запустіть **Actions → Excavator → Run workflow** у scoop-bucket, щоб оновити одразу;
- або нічого не робіть: Excavator щодня запускається за розкладом.

Тому імена файлів релізу мають залишатися саме такими:

```
https://github.com/ruslan-rv-ua/quick-snippets/releases/download/v{version}/quick-snippets-{version}-windows-x64.zip
https://github.com/ruslan-rv-ua/quick-snippets/releases/download/v{version}/quick-snippets-{version}-windows-x64.zip.sha256
```

Дані користувача (`quick-snippets-data/`) Scoop зберігає між оновленнями через `persist`.

## CI

`.github/workflows/ci.yml` на кожен push у `develop`/`main` і на pull request запускає
`npm run build`, `npm run lint`, `npm run test`, `npm run test:rust`.

## TDD та безпека

- Пишіть тести перед фічами.
- Rust-тести для БД використовують in-memory SQLite (`Connection::open_in_memory()`).
- Критичний інваріант безпеки: розшифрований текст сніпетів НІКОЛИ не передається у фронтенд
  і не потрапляє в логи (зокрема CI). Розшифрування і копіювання в буфер обміну відбуваються
  лише в Rust (`activate_snippet`).

## Troubleshooting (Windows)

- Помилки лінкера під час `cargo build` — зазвичай не встановлено workload "Desktop development with C++".
- `cargo`/`rustup` не в PATH — перезапустіть PowerShell після встановлення.
- Попередження Git про LF/CRLF — нормальні; за потреби налаштуйте `core.autocrlf`.
- Розбіжності версій Tauri/Node/Rust — `npm ci` і `rustup update`.
