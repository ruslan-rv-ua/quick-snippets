# justfile - Windows (PowerShell) helper for quick-snippets
# Shell: Use PowerShell so recipes run in PowerShell on Windows Terminal
set shell := ["powershell", "-NoProfile", "-Command"]

# Recommended adjustable variables
PROFILE := "debug"        # build profile: "debug" or "release"
ARCH := "x64"             # target arch: "x64" or "arm64"
NODE_VERSION := "18"      # informational only

# --- Helpers ---
# Print quick status
help:
    @Write-Output "QuickSnippets - доступні цілі (targets):"
    @Write-Output ""
    @Write-Output "Основні команди:"
    @Write-Output "  setup        - Встановити frontend deps та підготувати Rust toolchain"
    @Write-Output "  install      - Встановити npm пакети"
    @Write-Output "  dev          - Запуск dev-середовища (frontend + tauri dev)"
    @Write-Output "  build        - Побудова production (frontend + tauri build)"
    @Write-Output ""
    @Write-Output "Тестування:"
    @Write-Output "  test         - Запуск тестів (frontend + backend)"
    @Write-Output "  test-watch   - Watch mode для frontend тестів"
    @Write-Output "  test-coverage - Coverage для frontend тестів"
    @Write-Output "  test-all     - Запуск всіх тестів (npm run test:all)"
    @Write-Output ""
    @Write-Output "Перевірка якості:"
    @Write-Output "  lint         - Запуск лінтерів (tsc, cargo clippy)"
    @Write-Output "  check        - Швидкі статичні перевірки (tsc, cargo check)"
    @Write-Output "  format       - Форматування коду (prettier)"
    @Write-Output ""
    @Write-Output "Збірка та реліз:"
    @Write-Output "  package      - Створити інсталятор/бінарні артефакти (Tauri)"
    @Write-Output "  release      - Повний релізний pipeline (build + package)"
    @Write-Output "  final-checks - Фінальний pipeline перевірок"
    @Write-Output ""
    @Write-Output "Утиліти:"
    @Write-Output "  clean        - Видалити node_modules та cargo artifacts"
    @Write-Output "  db-reset     - Скидання БД"
    @Write-Output "  open         - Відкрити папку з фронтенд збіркою або Rust релізом"
    @Write-Output ""
    @Write-Output "Змінні:"
    @Write-Output "  PROFILE      - debug (default) | release"
    @Write-Output "  ARCH         - x64 (default) | arm64"
    @Write-Output ""
    @Write-Output "Приклади використання:"
    @Write-Output "  just dev"
    @Write-Output "  just build PROFILE=release"
    @Write-Output "  just build PROFILE=release ARCH=x64"
    @Write-Output "  just test"
    @Write-Output "  just test-watch"
    @Write-Output "  just test-coverage"
    @Write-Output "  just test-all"
    @Write-Output "  just lint"
    @Write-Output "  just check"
    @Write-Output "  just format"
    @Write-Output "  just clean"
    @Write-Output "  just package"
    @Write-Output "  just release"
    @Write-Output "  just final-checks"
    @Write-Output "  just open"
    @Write-Output ""
    @Write-Output "Швидкі підказки:"
    @Write-Output "  - Запустити одну ціль: just <target>"
    @Write-Output "  - Передати змінні: just <target> VAR=val"
    @Write-Output "  - Фронтенд локально: npm install && npm run build"
    @Write-Output "  - Бекенд локально: cd src-tauri && cargo build --profile <PROFILE>"

# Install dependencies, ensure Rust toolchain suggestion
setup:
    # Встановити frontend deps і підготувати Rust (не автоматично встановлює VS Build Tools)
    npm install
    Write-Output "If rustup is missing, install from https://rustup.rs"
    Write-Output "Will ensure stable-msvc toolchain (no-op if already present)."
    # Select appropriate MSVC Windows toolchain for the target ARCH
    if ("{{ARCH}}" -eq "x64") { $tc = "stable-x86_64-pc-windows-msvc" } else { $tc = "stable-aarch64-pc-windows-msvc" }
    rustup toolchain install $tc
    if ($LASTEXITCODE -ne 0) { Write-Output "rustup/toolchain message" }
    rustup default $tc
    if ($LASTEXITCODE -ne 0) { Write-Output "rustup default message" }

# Alias to run npm install only
install:
    # Встановити npm пакети
    npm install

# Start dev environment. Spawns Tauri dev (which usually runs frontend dev server).
dev:
    # Запускає `npm run tauri dev` (dev-сервер)
    npm install
    npm run tauri dev

# Build frontend and then run Tauri packaging steps (native build)
build PROFILE="{{PROFILE}}":
    # Побудувати frontend, потім пакувати через Tauri
    npm install
    npm run build
    cd src-tauri; npm run tauri build; cd ..

# Run frontend (Vitest) and Rust tests
test:
    # Запустити frontend та backend тести
    npx vitest run
    cd src-tauri; cargo test -- --test-threads=1; cd ..

# Watch mode для frontend тестів
test-watch:
    # Запустити frontend тести у watch mode
    npx vitest

# Coverage для frontend тестів
test-coverage:
    # Запустити frontend тести з coverage
    npx vitest run --coverage

# Фінальний pipeline
final-checks:
    # Запустити фінальні перевірки
    npm install
    & .\scripts\final-checks.ps1

# Прямий виклик test:all
test-all:
    # Запустити всі тести (frontend + backend)
    npm install
    npm run test:all

# Type-check and Rust lint
lint:
    # TypeScript type-check; Rust clippy (may require toolchain + VS Tools)
    npx tsc --noEmit
    cd src-tauri; cargo clippy -- -D warnings; cd ..

# Format code via Prettier if available
format:
    # Форматування (встановіть prettier в devDependencies if missing)
    npx prettier --write .
    if ($LASTEXITCODE -ne 0) { Write-Output "Prettier not found. Install: npm install --save-dev --save-exact prettier" }

# Package / produce installer (calls Tauri build)
package:
    # Створити інсталер/бінарні артефакти за допомогою Tauri
    npm install
    cd src-tauri; npm run tauri build; cd ..

# Clean node_modules and cargo target
clean:
    # Видалити node_modules і cargo artifacts
    if (Test-Path .\node_modules) { Remove-Item -Recurse -Force .\node_modules } else { Write-Output "node_modules not found" }
    cd src-tauri; cargo clean; cd ..

# Release = production build + package
release:
    # Виклик build в release режимі
    just build PROFILE=release ARCH={{ARCH}}

# Quick static checks
check:
    # tsc and cargo check
    npx tsc --noEmit
    cd src-tauri; cargo check; cd ..

# DB reset / seed (best-effort; project-specific script)
db-reset:
    # Reset БД — викличте npm-сценарій якщо він існує, інакше інструкція
    npm run db:reset
    if ($LASTEXITCODE -ne 0) { Write-Output "No `db:reset` script. Remove DB or run migration manually in src-tauri." }

# Open build output in Explorer
open:
    # Відкрити папку з фронтенд збіркою або Rust релізом
    if (Test-Path .\dist) { explorer (Resolve-Path .\dist) } else { explorer (Resolve-Path .\src-tauri\target\release) }
