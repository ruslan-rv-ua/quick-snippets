# Scoop Integration Setup

QuickSnippets is distributed as a portable Windows app via a personal [Scoop](https://scoop.sh) bucket.
This document explains how the automated release → Scoop update pipeline works and how to set it up.

---

## What was created

| # | File | Repository | Purpose |
|---|------|-----------|---------|
| 1 | `bucket/quick-snippets.json` | `scoop-bucket` | Scoop manifest — tells Scoop how to download, install, and update QuickSnippets |
| 2 | `.github/workflows/update-quick-snippets.yml` | `scoop-bucket` | Workflow that auto-updates the manifest (version + hash) when a new release is published |
| 3 | `.github/workflows/notify-scoop-bucket.yml` | `quick-snippets` | Lightweight workflow that notifies the bucket repo after `release.yml` publishes a GitHub Release |

---

## End-to-end release flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Developer                                                          │
│  git flow release finish 1.2.3                                      │
│  git push origin main develop --tags                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ push to main
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  quick-snippets / release.yml                                       │
│  • Builds frontend + Rust binary (release profile)                  │
│  • Packages quick-snippets.exe + WebView2Loader.dll into ZIP        │
│  • Generates SHA-256 checksum file                                  │
│  • Creates GitHub Release v1.2.3 with both artifacts                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ release: published
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  quick-snippets / notify-scoop-bucket.yml                           │
│  • Reads version from the release tag (strips "v" prefix)           │
│  • Sends repository_dispatch to scoop-bucket                        │
│    event_type: "quick-snippets-released"                            │
│    payload:    { "version": "1.2.3" }                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ repository_dispatch
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  scoop-bucket / update-quick-snippets.yml                           │
│  • Downloads the .sha256 file from the release (NOT the full ZIP)   │
│  • Parses the hex hash from shasum-compatible format                │
│  • Updates version + hash in bucket/quick-snippets.json             │
│  • Commits: "chore: update quick-snippets to v1.2.3"               │
│  • Pushes to main                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

After the pipeline completes, any user who has added the bucket can update:
```powershell
scoop update quick-snippets
```

---

## Setup instructions

### Step 1 — Create a GitHub Personal Access Token (PAT)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Set a descriptive name: `scoop-bucket-integration`
4. Select scope: **`repo`** (full control of private repositories)
   - This is needed for both `repository_dispatch` (cross-repo event) and pushing commits to the bucket repo
5. Set expiration as appropriate (or "No expiration" for long-lived automation)
6. Click **Generate token** and copy the value immediately

### Step 2 — Add the PAT as a secret to both repositories

**In `ruslan-rv-ua/quick-snippets`:**
1. Go to **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `BUCKET_REPO_PAT`
3. Value: paste the PAT from Step 1

**In `ruslan-rv-ua/scoop-bucket`:**
1. Go to **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `BUCKET_REPO_PAT`
3. Value: paste the same PAT from Step 1

> **Why both repos?**
> - `quick-snippets` uses it to send `repository_dispatch` to the bucket repo
> - `scoop-bucket` uses it to push the manifest commit (the default `GITHUB_TOKEN` can't push from a `repository_dispatch`-triggered workflow without explicit token)

### Step 3 — Verify

After the next release, check:
1. **quick-snippets → Actions → "Notify Scoop Bucket"** — should show a successful run
2. **scoop-bucket → Actions → "Update quick-snippets manifest"** — should show a successful run with a commit

---

## Manual triggers

### Re-trigger bucket update (from scoop-bucket)

1. Go to **scoop-bucket → Actions → "Update quick-snippets manifest"**
2. Click **Run workflow**
3. Optionally enter a version (e.g. `1.2.3`), or leave empty to auto-detect the latest release
4. Click **Run workflow**

### Re-trigger notification (from quick-snippets)

1. Go to **quick-snippets → Actions → "Notify Scoop Bucket"**
2. Click **Run workflow**
3. Optionally enter a version, or leave empty to auto-detect
4. Click **Run workflow**

---

## Testing Scoop installation locally

```powershell
# Add the bucket (one-time)
scoop bucket add ruslan-rv-ua https://github.com/ruslan-rv-ua/scoop-bucket

# Install QuickSnippets
scoop install quick-snippets

# Check installed version
scoop info quick-snippets

# Update to the latest version
scoop update quick-snippets

# Uninstall
scoop uninstall quick-snippets

# Remove the bucket (if needed)
scoop bucket rm ruslan-rv-ua
```

### Where does Scoop install it?

By default: `~/scoop/apps/quick-snippets/current/`

Persisted data files (`snippets.db`, `settings.json`) are stored in:
`~/scoop/persist/quick-snippets/`

These files survive `scoop update quick-snippets` — Scoop symlinks them into the app directory.

---

## Troubleshooting

### `repository_dispatch` returns 404 or 403
- Verify the PAT has `repo` scope
- Verify the PAT owner has write access to `ruslan-rv-ua/scoop-bucket`
- Check that the secret name is exactly `BUCKET_REPO_PAT` in both repos

### Bucket update workflow fails to download .sha256 file
- The release might still be in progress — wait a few minutes and re-trigger manually
- Verify the release on GitHub has both the ZIP and `.sha256` files attached

### Hash length mismatch error
- The `.sha256` file might be corrupted or have unexpected format
- Expected format: `{64-char hex hash}  {filename}` (two spaces between hash and filename)
- Check the release assets manually on GitHub

### `scoop install quick-snippets` fails with hash mismatch
- The manifest hash might be out of date — run `scoop update` first to pull the latest manifests
- Or re-trigger the bucket update workflow manually

### Persist files not found after update
- Scoop creates symlinks from `~/scoop/persist/quick-snippets/` into the app directory
- If `snippets.db` or `settings.json` didn't exist before the first `scoop update`, they won't be in persist
- Copy them manually into the persist directory if needed

### notify-scoop-bucket.yml doesn't trigger
- Verify the workflow file is on the **default branch** (`develop` for quick-snippets)
- The `on: release: types: [published]` trigger requires the workflow to exist on the default branch
- Merge `notify-scoop-bucket.yml` to `develop` first, then the next release from `main` will trigger it

---

## Scoop manifest details

The manifest (`bucket/quick-snippets.json`) includes:

| Field | Purpose |
|-------|---------|
| `architecture.64bit.url` | Download URL for the portable ZIP |
| `architecture.64bit.hash` | SHA-256 hash for integrity verification |
| `bin` | Executable to add to PATH: `quick-snippets.exe` |
| `shortcuts` | Start Menu shortcut: "QuickSnippets" |
| `persist` | Files preserved across updates: `snippets.db`, `settings.json` |
| `checkver` | Points to GitHub releases for `scoop checkver` |
| `autoupdate` | URL + hash patterns for `scoop autoupdate` |
