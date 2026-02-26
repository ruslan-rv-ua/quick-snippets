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
cargo test --lib -- --test-threads=1
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
$exe = Get-Item "src-tauri\target\release\quick-snippets.exe" -ErrorAction SilentlyContinue
if ($null -eq $exe) { Write-Error "EXE not found"; exit 1 }
$sizeMB = [math]::Round($exe.Length / 1MB, 1)
Write-Host "EXE size: ${sizeMB} MB" -ForegroundColor Green
if ($sizeMB -gt 25) {
    Write-Warning "EXE size ${sizeMB}MB exceeds expected 10-20MB range"
}

Write-Host ""
Write-Host "=== All automated checks passed ===" -ForegroundColor Green
Write-Host "Proceed to manual verification checklist." -ForegroundColor Yellow
