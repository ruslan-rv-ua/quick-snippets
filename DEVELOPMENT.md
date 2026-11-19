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

`just smoke` — перевірка зібраного exe разом з NVDA, триває близько двох з половиною хвилин. Скрипт
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
- Між двома запусками залишайте хвилину або більше. Якщо тестову копію запустити менш ніж за
  пів хвилини після того, як попередню було примусово закрито, NVDA інколи читає нове вікно
  через UI Automation, а не через IAccessible2 (у звіті першого кроку тоді є «веб-вміст, регіон»).
  У такому разі Escape забирає собі NVDA, вікно не ховається, і тест зупиняється на першому кроці.
  Так поводиться й збірка 0.3.0; причину ще не з'ясовано.
- Зміна прапорця через UI Automation (`Set-Toggle`) змушує WebView2 переносити клавіатуру між
  своїми внутрішніми вікнами, й інколи вона лишається на одному з них. Програма має в такому разі
  не ховати вікно, доки воно активне, і за 0,2 с повернути клавіатуру у вміст
  (`src-tauri/src/window_blur.rs`). Це перевіряють чотири кроки після кроків автозапуску: один
  повторює зміну шість разів, другий сам ставить клавіатуру на внутрішнє вікно
  (`Chrome_RenderWidgetHostHWND`), третій і четвертий перевіряють, що вікно таки ховається,
  коли активним стає інше вікно.
- Пошук і діалог пароля скидаються лише тоді, коли вікно справді ховається: перед цим Rust
  надсилає вмісту подію `window:hidden`. Звичайна втрата фокуса (подія `blur` у вмісті) нічого
  не скидає. Два кроки в частині про пошук ставлять клавіатуру на внутрішнє вікно із запитом
  у полі пошуку і з відкритим діалогом пароля й перевіряють, що все лишилося на місці.

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

Чекати CI після push не треба: на push він не запускається. Lint і тести на чистій
машині проганяє сам Release workflow перед збіркою (див. нижче).

### Створення GitHub Release

Реліз створюється вручну через GitHub Actions:

1. **Actions → Release → Run workflow** (гілка `main`)
2. Вказати версію (формат `1.2.3`, без `v`)
3. За потреби позначити як pre-release

Workflow автоматично:
1. Збирає фронтенд і запускає `npm run lint`, `npm run test`, `npm run test:rust`.
   Якщо перевірка падає, workflow зупиняється: тегу і релізу немає
2. Запускає `npx tauri build --no-bundle` (фронтенд + Rust binary)
3. Пакує `quick-snippets.exe`, `LICENSE`, `README.md` у ZIP
   `quick-snippets-{version}-windows-x64.zip`
4. Створює файл `quick-snippets-{version}-windows-x64.zip.sha256`
5. Створює і пушить тег `v{version}`
6. Публікує GitHub Release з обома файлами

### Пробний запуск Release (dry run)

Прапорець **dry run** проганяє перевірки, збірку і пакування ZIP, але пропускає
тег і GitHub Release. Ним перевіряють зміни в `release.yml` або готовність гілки
до релізу. Запускати можна з будь-якої гілки, де є цей прапорець:

```powershell
gh workflow run release.yml --ref feature/my-branch -f version=0.0.0..dryrun -f dry_run=true -f prerelease=true
```

Версія `0.0.0..dryrun` — страховка: git не прийме таку назву тегу, тож навіть якщо
прапорець через помилку не спрацює, тег і реліз не з'являться. Справжній реліз
не можна створювати для перевірки навіть тимчасово: Excavator у scoop-bucket бере
найновіший реліз і роздав би його користувачам Scoop.

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

`.github/workflows/ci.yml` запускає `npm run build`, `npm run lint`, `npm run test`,
`npm run test:rust` лише для pull request (репозиторій публічний, тож чужі зміни
перевіряються) і вручну: **Actions → CI → Run workflow** або
`gh workflow run ci.yml --ref <гілка>`.

На кожен push у `develop`/`main` CI не запускається. Ті самі перевірки виконуються
локально в кожній задачі (`npm run test:all`, `npm run lint`), а на чистій машині —
у Release workflow перед збіркою релізу.

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
