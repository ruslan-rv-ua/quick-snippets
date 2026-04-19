$ErrorActionPreference = "Stop"

# 0. Version sync check
Write-Host "=== Version sync ===" -ForegroundColor Cyan
$pkgVer = (Get-Content package.json | ConvertFrom-Json).version
$tauriVer = (Get-Content src-tauri\tauri.conf.json | ConvertFrom-Json).version
$cargoContent = Get-Content src-tauri\Cargo.toml -Raw
if ($cargoContent -match '(?m)^version\s*=\s*"([^"]+)"') { $cargoVer = $Matches[1] } else { Write-Error "Cannot parse Cargo.toml version"; exit 1 }
if ($pkgVer -ne $tauriVer -or $pkgVer -ne $cargoVer) {
    Write-Error "Version mismatch: package.json=$pkgVer, tauri.conf.json=$tauriVer, Cargo.toml=$cargoVer"
    exit 1
}
Write-Host "All versions match: $pkgVer" -ForegroundColor Green

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
