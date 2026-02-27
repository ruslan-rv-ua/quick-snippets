# QuickSnippets · Justfile  (Windows · PowerShell 7 / pwsh)
# Docs:  https://just.systems/man/en/
# Usage: just <recipe>   |   just --list   |   just -l

set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

# Default build profile ("debug" | "release")
profile := "debug"

# ── Aliases (short forms) ─────────────────────────────────────────────────────
alias s   := setup
alias d   := dev
alias b   := build
alias r   := release
alias t   := test
alias tf  := test-front
alias tb  := test-back
alias tw  := test-watch
alias tc  := test-cov
alias c   := check
alias l   := lint
alias fmt := format
alias fc  := final-checks
alias gdb := generate-demo-db

# Show this list
[private]
default: help

# ═════════════════════════════════════════════════════════════════════════════
# SETUP / INSTALL
# ═════════════════════════════════════════════════════════════════════════════

# Install npm deps · verify Rust & Node toolchains
setup:
    npm install
    node --version
    rustup show active-toolchain
    cargo --version
    @Write-Host "`n[OK] Setup complete" -ForegroundColor Green

# ═════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT
# ═════════════════════════════════════════════════════════════════════════════

# Start Tauri dev server — frontend + backend with hot-reload  (alias: d)
dev:
    npm run tauri dev

# Start Vite frontend-only dev server
vite:
    npm run dev

# ═════════════════════════════════════════════════════════════════════════════
# TESTING   just t / tf / tb / tw / tc
#           just test-mod db::tests     ← specific Rust module
# ═════════════════════════════════════════════════════════════════════════════

# All tests: Vitest + cargo test  (alias: t)
test:
    npx vitest run
    cd src-tauri; cargo test --lib -- --test-threads=1

# Frontend tests — Vitest, one-shot  (alias: tf)
test-front:
    npx vitest run

# Backend tests — cargo test, single-threaded  (alias: tb)
test-back:
    cd src-tauri; cargo test --lib -- --test-threads=1

# Frontend tests in watch mode — TDD inner loop  (alias: tw)
test-watch:
    npx vitest

# Frontend tests with V8 coverage report  (alias: tc)
test-cov:
    npx vitest run --coverage

# Test a specific Rust module  →  just test-mod db::tests  (alias: tm)
test-mod module:
    cd src-tauri; cargo test --lib {{ module }} -- --test-threads=1

alias tm := test-mod

# ═════════════════════════════════════════════════════════════════════════════
# QUALITY   check · lint · format
# ═════════════════════════════════════════════════════════════════════════════

# Fast static check: tsc --noEmit + cargo check  (alias: c)
check:
    npx tsc --noEmit
    cd src-tauri; cargo check

# Full lint: tsc --noEmit + cargo clippy -D warnings  (alias: l)
lint:
    npx tsc --noEmit
    cd src-tauri; cargo clippy -- -D warnings

# Format Rust source with cargo fmt  (alias: fmt)
format:
    cd src-tauri; cargo fmt
    @Write-Host "[OK] Formatted" -ForegroundColor Green

# ═════════════════════════════════════════════════════════════════════════════
# BUILD & RELEASE
# ═════════════════════════════════════════════════════════════════════════════

# Debug build (frontend + cargo build).  profile=release → full tauri bundle  (alias: b)
build profile=profile:
    if ("{{ profile }}" -eq "release") { Write-Host "[build] Production bundle..." -ForegroundColor Cyan; npm run tauri build } else { Write-Host "[build] Debug build..." -ForegroundColor Cyan; npm run build; Push-Location src-tauri; cargo build; Pop-Location }

# Production bundle — npm run tauri build → .exe + installer  (alias: r)
release:
    npm run tauri build

# Open the release bundle folder in Explorer
open-release:
    Invoke-Item src-tauri\target\release\bundle

# ═════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═════════════════════════════════════════════════════════════════════════════

# Run the final CI pipeline  (alias: fc)
final-checks:
    powershell -NoProfile -File scripts/final-checks.ps1

# Delete dev snippets.db to reset local database
db-reset:
    Remove-Item -Force snippets.db -ErrorAction SilentlyContinue
    @Write-Host "[OK] snippets.db removed" -ForegroundColor Yellow

# Generate demo SQLite DB with 40+ snippets (uses generate_demo_db.py in project root)
generate-demo-db:
    python .\generate_demo_db.py

# Remove dist/ and src-tauri/target/
clean:
    Remove-Item -Recurse -Force dist            -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force src-tauri\target -ErrorAction SilentlyContinue
    @Write-Host "[OK] Cleaned" -ForegroundColor Green

# ═════════════════════════════════════════════════════════════════════════════
# HELP
# ═════════════════════════════════════════════════════════════════════════════

# List all recipes
help:
    @just --list

