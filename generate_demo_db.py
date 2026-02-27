#!/usr/bin/env python3
# generate_demo_db.py
# Створює demo SQLite DB сумісну зі схемою quick-snippets (snippets table).

import sqlite3
import os
from pathlib import Path
from datetime import datetime

DB_PATH = Path("src-tauri/target/release/snippets.db")
DB_DIR = DB_PATH.parent

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS snippets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    content      BLOB    NOT NULL,
    is_encrypted INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    CHECK (length(title) >= 3 AND length(title) <= 50),
    CHECK (length(content) <= 65536)
);
CREATE INDEX IF NOT EXISTS idx_snippets_updated_at
    ON snippets (updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_title
    ON snippets (title);
"""

def now_ts():
    # Match SQLite strftime('%Y-%m-%dT%H:%M:%f','now') style (milliseconds)
    dt = datetime.utcnow()
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]

def ensure_dir():
    DB_DIR.mkdir(parents=True, exist_ok=True)

def open_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def create_schema(conn):
    conn.executescript(CREATE_TABLE_SQL)

def generate_snippets():
    # At least 40 demo snippets (plaintext content), varied languages and lengths.
    samples = [
        ("Hello World - Python", "print('Hello, world!')"),
        ("Hello World - JS", "console.log('Hello, world!');"),
        ("Hello World - Bash", "echo 'Hello, world!'" ) ,
        ("Функція сортування (Ukr)", "fn sort<T: Ord>(v: &mut [T]) { v.sort(); }"),
        ("SQL: Select Top", "SELECT id, title FROM snippets WHERE title LIKE '%test%';"),
        ("HTML Boilerplate", "<!doctype html>\n<html>\n<head><meta charset='utf-8'></head>\n<body></body>\n</html>"),
        ("CSS Center", ".center{display:flex;align-items:center;justify-content:center;}"),
        ("JSON Example", '{"name": "Alice", "age": 30, "tags": ["dev","py"]}'),
        ("Regex Email", r"^[\w\.-]+@[\w\.-]+\.\w{2,}$"),
        ("PowerShell Get-Child", "Get-ChildItem -Path . -Recurse | Where-Object { $_.Length -gt 1MB }"),
        ("Commit message - feat", "feat(ui): add search highlighting"),
        ("Git: revert last", "git revert HEAD --no-edit"),
        ("Dockerfile: simple", "FROM python:3.11-slim\nCOPY . /app\nRUN pip install -r requirements.txt"),
        ("Node: async fetch", "async function fetchJson(url){const r=await fetch(url);return r.json();}"),
        ("Kotlin: data class", "data class User(val id:Int, val name:String)"),
        ("TS: type guard", "function isString(x: any): x is string { return typeof x === 'string'; }"),
        ("Bash: backup", "tar -czvf backup.tar.gz /home/user/"),
        ("Ukr: Текстовий приклад", "Це приклад українського тексту для пошуку."),
        ("RU: Пример текста", "Это пример русского текста для поиска."),
        ("Long snippet - Lorem", "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 8),
        ("Short note", "TODO: add tests"),
        ("Snippet with tags", "#tags:algorithm,search\nfunction search(){/*...*/}"),
        ("SQL Insert Example", "INSERT INTO users (name, email) VALUES ('Bob','bob@example.com');"),
        ("Python: list comprehension", "[x*x for x in range(10) if x%2==0]"),
        ("HTML: form", "<form><input name='q'/><button>Search</button></form>"),
        ("CSS Grid layout", ".grid{display:grid;grid-template-columns:1fr 2fr;}"),
        ("JS: debounce", "function debounce(fn, wait){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait);}}"),
        ("Secret note (not encrypted)", "PASSWORD=supersecret123  # plaintext for demo"),
        ("XML Example", "<root><child id='1'>Value</child></root>"),
        ("Makefile target", "build:\n\tcargo build --release"),
        ("Rust: Result map", "let x = option.ok_or(\"err\")?;"),
        ("C#: LINQ example", "var q = list.Where(x => x.IsActive).Select(x => x.Id);"),
        ("Go: goroutine", "go func(){ fmt.Println(\"hi\") }()"),
        ("Snippet: TODO list", "- [ ] write tests\n- [x] init db"),
        ("Search keywords: database", "sqlite, wal, pragma, index, query"),
        ("Emoji title 😀", "Content with emoji 👍🏻"),
        ("Multi-language mixed", "Пример mixed text with English and русский слова."),
        ("Shell: curl POST", "curl -X POST -d '{\"a\":1}' https://api.example.com/endpoint"),
        ("Sample config yaml", "app:\n  name: demo\n  version: 1.0.0"),
        ("Short: ok", "ok"),
    ]

    # Ensure we have at least 40 items; if less, duplicate with minor suffixes
    items = list(samples)
    counter = 1
    while len(items) < 40:
        base_title = f"Extra snippet {counter}"
        base_content = f"This is extra demo snippet number {counter}."
        items.append((base_title, base_content))
        counter += 1

    # Guarantee unique titles and length constraints (3..50)
    final = []
    seen = set()
    for title, content in items:
        t = title.strip()
        if len(t) < 3:
            t = (t + "XX")[:3]
        if len(t) > 50:
            t = t[:50]
        orig_t = t
        i = 1
        while t in seen:
            # append suffix to make unique but within 50 chars
            suffix = f" ({i})"
            max_base = 50 - len(suffix)
            base = orig_t[:max_base]
            t = base + suffix
            i += 1
        seen.add(t)
        final.append((t, content))
    return final

def insert_snippets(conn, snippets):
    cur = conn.cursor()
    for title, content in snippets:
        ts = now_ts()
        blob = content.encode("utf-8")
        # ensure content size <= 65536
        if len(blob) > 65536:
            blob = blob[:65536]
        cur.execute(
            "INSERT INTO snippets (title, content, is_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (title, sqlite3.Binary(blob), 0, ts, ts),
        )
    conn.commit()

def main():
    ensure_dir()
    if DB_PATH.exists():
        try:
            DB_PATH.unlink()
        except Exception:
            pass
    conn = open_conn()
    try:
        create_schema(conn)
        snippets = generate_snippets()
        insert_snippets(conn, snippets)
        print(f"Created demo DB with {len(snippets)} snippets at: {DB_PATH}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
