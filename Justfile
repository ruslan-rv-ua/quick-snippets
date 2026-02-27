"""
QuickSnippets Justfile - minimal, cross-platform helpers (Tauri + React + Rust)
Keep commands POSIX-friendly; on Windows we prefer PowerShell invocation when needed.

Usage:
  just install
  just dev
  just build
  just test

Note: wrappers use a small runtime OS-check to invoke PowerShell on native Windows.
"""

# Helper: detect Windows at runtime and run either PowerShell or plain command.
# We wrap each critical command in `sh -lc '...if windows then powershell ... else ... fi'`
# so this Justfile works from POSIX shells (Linux/macOS) and Git/MSYS shells on Windows.

install:
    # Install frontend deps and check for rustup (prints a hint if missing)
    sh -lc 'if [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE "mingw|msys|cygwin"; then \
        powershell -NoProfile -ExecutionPolicy Bypass -Command "npm install" ; \
    else \
        npm install ; \
    fi'
    sh -lc 'if command -v rustup >/dev/null 2>&1; then \
        echo "rustup: found"; \
    else \
        echo "rustup: NOT found - install from https://rustup.rs"; \
    fi'

check:
    # Typecheck frontend (no emit) and cargo check for Rust backend
    sh -lc 'npx tsc --noEmit'
    sh -lc 'cd src-tauri && cargo check'

dev:
    # Start the full dev experience (Tauri dev - runs frontend + backend)
    sh -lc 'if [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE "mingw|msys|cygwin"; then \
        powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run tauri dev" ; \
    else \
        npm run tauri dev ; \
    fi'

frontend-dev:
    # Run the frontend dev server only (usually `npm run dev`)
    sh -lc 'if [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE "mingw|msys|cygwin"; then \
        powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev" ; \
    else \
        npm run dev ; \
    fi'

build:
    # Build frontend then compile backend (debug build by default)
    sh -lc 'npm run build'
    sh -lc 'cd src-tauri && cargo build'

tauri-build:
    # Full production build (invokes npm build + tauri bundling via npm script)
    sh -lc 'if [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE "mingw|msys|cygwin"; then \
        powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run tauri build" ; \
    else \
        npm run tauri build ; \
    fi'

test:
    # Run frontend and backend tests
    just test:frontend
    just test:backend

test:frontend:
    # Frontend unit tests (Vitest)
    sh -lc 'npx vitest run'

test:backend:
    # Rust tests (run in src-tauri)
    sh -lc 'cd src-tauri && cargo test -- --test-threads=1'

lint:
    # Frontend lint (if npm script exists) and Rust clippy
    sh -lc 'if npm run lint --silent >/dev/null 2>&1; then npm run lint || true; else echo "npm lint script not found"; fi'
    sh -lc 'cd src-tauri && cargo clippy -- -D warnings'

format:
    # Format frontend (if script) and Rust
    sh -lc 'if npm run format --silent >/dev/null 2>&1; then npm run format || true; else echo "npm format script not found"; fi'
    sh -lc 'cd src-tauri && cargo fmt'

clean:
    # Remove frontend build artifacts and Rust target directory
    sh -lc 'rm -rf dist || true'
    sh -lc 'rm -rf src-tauri/target || true'

release:
    # Production release: runs the tauri build script (bundles installers)
    sh -lc 'if [ "${OS:-}" = "Windows_NT" ] || uname -s 2>/dev/null | grep -qiE "mingw|msys|cygwin"; then \
        powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run tauri build" ; \
    else \
        npm run tauri build ; \
    fi'

help:
    # Print a short help summary
    sh -lc 'cat <<EOF
QuickSnippets - Justfile targets:
  install        Install npm deps and check Rust toolchain
  check          Run TypeScript check and cargo check
  dev            Start Tauri dev (frontend + backend)
  frontend-dev   Start frontend dev server only
  build          Frontend build + cargo build (debug)
  tauri-build    Full production bundle (npm run tauri build)
  test           Run frontend and backend tests
  test:frontend  Run frontend tests (Vitest)
  test:backend   Run Rust tests (cargo test)
  lint           Run frontend lint and cargo clippy
  format         Run frontend format (if script) and cargo fmt
  clean          Remove dist and src-tauri/target
  release        Create production artifacts (tauri build)
  help           Show this help
EOF'

