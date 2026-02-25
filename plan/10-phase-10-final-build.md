# Фаза 10 — Фінальна збірка, інтеграційні тести та портативність

## Завдання

1. Перевірити та виправити всі TypeScript-помилки: `npx tsc --noEmit` без помилок
2. Перевірити та виправити всі Rust-попередження: `cargo clippy -- -D warnings` без помилок
3. Запустити повний набір тестів: `npm run test:all`
4. Виконати фінальну збірку: `npm run tauri build` → `src-tauri/target/release/QuickSnippets.exe`
5. Перевірити розмір `.exe` — орієнтовно 10–15 MB (якщо значно більше — перевірити чи не потрапили зайві debug-символи)
6. Перевірити наявність WebView2: якщо WebView2 Runtime не встановлений — застосунок повинен показати нативний діалог з посиланням на завантаження (не мовчки падати)

---

## 🤖 Фінальний automated pipeline

**Скрипт: `scripts/final-checks.ps1`**

```powershell
$ErrorActionPreference = "Stop"

# 1. TypeScript compilation
Write-Host "=== TypeScript check ===" -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Write-Error "TypeScript errors found"; exit 1 }

# 2. Rust clippy
Write-Host "=== Cargo clippy ===" -ForegroundColor Cyan
Push-Location src-tauri
cargo clippy -- -D warnings
if ($LASTEXITCODE -ne 0) { Write-Error "Clippy warnings found"; Pop-Location; exit 1 }
Pop-Location

# 3. Rust tests
Write-Host "=== Cargo test ===" -ForegroundColor Cyan
Push-Location src-tauri
cargo test -- --test-threads=1
if ($LASTEXITCODE -ne 0) { Write-Error "Rust tests failed"; Pop-Location; exit 1 }
Pop-Location

# 4. Frontend tests
Write-Host "=== Vitest ===" -ForegroundColor Cyan
npx vitest run
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend tests failed"; exit 1 }

# 5. Build
Write-Host "=== Tauri build ===" -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# 6. Check exe exists and size
$exe = Get-Item "src-tauri\target\release\QuickSnippets.exe" -ErrorAction SilentlyContinue
if ($null -eq $exe) { Write-Error "EXE not found"; exit 1 }
$sizeMB = [math]::Round($exe.Length / 1MB, 1)
Write-Host "EXE size: ${sizeMB} MB" -ForegroundColor Green
if ($sizeMB -gt 25) {
    Write-Warning "EXE size ${sizeMB}MB exceeds expected 10-20MB range"
}

Write-Host ""
Write-Host "=== All automated checks passed ===" -ForegroundColor Green
Write-Host "Proceed to manual verification checklist." -ForegroundColor Yellow
```

---

## ✅ Ручна перевірка по завершенні фази

- [ ] `powershell -File scripts/final-checks.ps1` — все зелене
- [ ] Скопіювати **лише** `QuickSnippets.exe` у нову порожню директорію (без `snippets.db`, без `settings.json`)
- [ ] Запустити `QuickSnippets.exe` — застосунок стартує без помилок
- [ ] Після першого запуску: `settings.json` з'являється автоматично (PRD 2.5.3); `snippets.db` створюється одразу
- [ ] Скопіювати `QuickSnippets.exe` + `snippets.db` + `settings.json` у іншу директорію → запустити → всі сніпети та налаштування збереглися
- [ ] Перенести директорію на інший диск (наприклад, з `C:\tools\` у `D:\utils\`) → запустити → все працює
- [ ] Перевірити розмір: `(Get-Item QuickSnippets.exe).Length / 1MB` → результат у діапазоні 10–20 MB
- [ ] Повний smoke-test фінального `.exe`: Ctrl+Alt+Space → пошук → копіювання → трей → завершення
