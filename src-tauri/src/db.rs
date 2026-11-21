// Database CRUD operations

use crate::error_dialogs::{OpenFailure, RescueFailure};
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection, Result};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Damage met while the app works
// ---------------------------------------------------------------------------

/// The error the commands give when SQLite finds the database damaged (SQLITE_CORRUPT,
/// SQLITE_NOTADB). The frontend recognises this exact text (`DATABASE_DAMAGED` in
/// src/utils/errors.ts) and says it in the language of the app: change the two together.
pub const DATABASE_DAMAGED: &str = "The snippet database is damaged";

/// The error for a snippet whose stored values are no longer what the app wrote, for example a
/// title or a text that is not UTF-8. SQLite reads such a row without an error, and the check
/// at start-up does not see it. `SNIPPET_DAMAGED` in src/utils/errors.ts: change the two
/// together.
pub const SNIPPET_DAMAGED: &str = "This snippet is damaged";

/// What kind of damage an error shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Damage {
    /// SQLite finds the file damaged: a page of snippets, an index, the list of free pages.
    Database,
    /// One row reads, but a value in it is not what the app stores.
    Snippet,
}

/// The damage an error of SQLite or rusqlite shows, or `None` for any other error (a locked
/// database, a missing snippet, a full disk).
pub fn damage_of(err: &rusqlite::Error) -> Option<Damage> {
    use rusqlite::ErrorCode;
    match err {
        rusqlite::Error::SqliteFailure(e, _)
            if matches!(e.code, ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase) =>
        {
            Some(Damage::Database)
        }
        rusqlite::Error::FromSqlConversionFailure(..)
        | rusqlite::Error::InvalidColumnType(..)
        | rusqlite::Error::Utf8Error(_) => Some(Damage::Snippet),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

pub struct SnippetRow {
    pub id: i64,
    pub title: String,
    pub content: Vec<u8>,
    pub is_encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

pub fn get_db_path() -> PathBuf {
    crate::paths::get_data_dir().join("snippets.db")
}

// ---------------------------------------------------------------------------
// Schema init
// ---------------------------------------------------------------------------

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=DELETE;")?;
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS snippets (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT    NOT NULL,
            content      BLOB    NOT NULL,
            is_encrypted INTEGER NOT NULL DEFAULT 0,
            created_at   TEXT    NOT NULL,
            updated_at   TEXT    NOT NULL,
            last_used_at TEXT,
            CHECK (length(title) >= 3 AND length(title) <= 50),
            CHECK (length(content) <= 65536)
        );
        CREATE INDEX IF NOT EXISTS idx_snippets_updated_at
            ON snippets (updated_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_title
            ON snippets (title);",
    )?;
    // Schema migrations via user_version
    let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "ALTER TABLE snippets ADD COLUMN last_used_at TEXT;"
        ).ok(); // .ok() because fresh DBs already have the column from CREATE TABLE
        conn.execute_batch("PRAGMA user_version = 1;")?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Opening at start-up: damaged or unavailable database
// ---------------------------------------------------------------------------

/// Open the database and initialize it, without any dialog.
///
/// If the path is a **directory** (e.g. created by Scoop `persist` before the
/// first run), it is silently removed so SQLite can create a proper file.
pub fn open_and_init_db(db_path: &Path) -> Result<Connection> {
    if db_path.is_dir() {
        // Scoop creates a directory stub when the file doesn't exist in the
        // release archive and `persist` is listed in the manifest.
        std::fs::remove_dir_all(db_path).ok();
    }
    // On an error the connection is dropped inside the closure, so the file is
    // closed again before anyone tries to rename it.
    Connection::open(db_path).and_then(|conn| {
        init_db(&conn)?;
        Ok(conn)
    })
}

/// Tell real damage apart from the other reasons a database cannot be opened.
/// Only damage may lead to setting the file aside; for anything else the file
/// is probably fine and the user can only try again or quit.
pub fn classify_open_error(err: &rusqlite::Error) -> OpenFailure {
    use rusqlite::ErrorCode;
    match err {
        rusqlite::Error::SqliteFailure(e, _) => match e.code {
            ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase => OpenFailure::Damaged,
            ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => OpenFailure::Busy,
            ErrorCode::CannotOpen => OpenFailure::CannotOpen,
            ErrorCode::PermissionDenied | ErrorCode::ReadOnly => OpenFailure::NoAccess,
            ErrorCode::DiskFull => OpenFailure::DiskFull,
            _ => OpenFailure::Other(err.to_string()),
        },
        _ => OpenFailure::Other(err.to_string()),
    }
}

/// The local date and time for the name of a damaged database, e.g.
/// `2026-11-20-14-35`. SQLite's own clock saves a date crate.
pub fn local_timestamp() -> String {
    Connection::open_in_memory()
        .and_then(|c| {
            c.query_row(
                "SELECT strftime('%Y-%m-%d-%H-%M', 'now', 'localtime')",
                [],
                |row| row.get::<_, String>(0),
            )
        })
        .unwrap_or_else(|_| "unknown-time".to_string())
}

/// The name a damaged database gets in `folder`: `snippets-damaged-<stamp>.db`,
/// or with `-2`, `-3`, … when that name (or its journal) is already taken, so an
/// earlier damaged copy is never overwritten.
pub fn damaged_db_name(stamp: &str, folder: &Path) -> String {
    let base = format!("snippets-damaged-{stamp}");
    let mut n = 1;
    loop {
        let name = if n == 1 {
            format!("{base}.db")
        } else {
            format!("{base}-{n}.db")
        };
        let taken = folder.join(&name).exists() || folder.join(format!("{name}-journal")).exists();
        if !taken {
            return name;
        }
        n += 1;
    }
}

fn journal_path(db_path: &Path) -> PathBuf {
    let mut s = db_path.as_os_str().to_os_string();
    s.push("-journal");
    PathBuf::from(s)
}

/// Rename the damaged `db_path` to `kept_name` in the same folder, together
/// with its rollback journal if there is one (the journal may hold the last
/// changes, and left behind it would be applied to the new empty database).
/// The bytes are not touched. Nothing changes when the rename fails.
pub fn keep_damaged_db(db_path: &Path, kept_name: &str) -> std::io::Result<PathBuf> {
    let folder = db_path.parent().unwrap_or(Path::new("."));
    let target = folder.join(kept_name);
    let target_journal = journal_path(&target);
    if target.exists() || target_journal.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            format!("{} already exists", target.display()),
        ));
    }
    let journal = journal_path(db_path);
    let journal_moved = if journal.exists() {
        std::fs::rename(&journal, &target_journal)?;
        true
    } else {
        false
    };
    if let Err(e) = std::fs::rename(db_path, &target) {
        if journal_moved {
            std::fs::rename(&target_journal, &journal).ok();
        }
        return Err(e);
    }
    Ok(target)
}

/// A question the start-up asks when the database cannot be opened.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DbDialog {
    /// The file is damaged: keep it as `kept_name` and start with an empty one?
    Damaged { kept_name: String },
    /// It cannot be opened for another reason: try again?
    CannotOpen(OpenFailure),
}

/// Open the database at start-up. On an error, `ask` gets the question for the
/// user and returns true for Yes. Returns `None` when the user said No: then
/// no file has been changed by this function.
///
/// * Damage: Yes renames the damaged file (see [`keep_damaged_db`]) and opens a
///   new empty database. If the rename fails, the user is asked to try again.
/// * Any other error: Yes tries again.
pub fn open_db_or_ask(
    db_path: &Path,
    stamp: &str,
    ask: &mut dyn FnMut(&DbDialog) -> bool,
) -> Option<Connection> {
    let folder = db_path.parent().unwrap_or(Path::new("."));
    loop {
        let err = match open_and_init_db(db_path) {
            Ok(conn) => return Some(conn),
            Err(e) => e,
        };
        eprintln!("Failed to open the database: {err}");
        match classify_open_error(&err) {
            OpenFailure::Damaged => {
                let kept_name = damaged_db_name(stamp, folder);
                if !ask(&DbDialog::Damaged { kept_name: kept_name.clone() }) {
                    return None;
                }
                if let Err(e) = keep_damaged_db(db_path, &kept_name) {
                    let failure = OpenFailure::KeepFailed(e.to_string());
                    if !ask(&DbDialog::CannotOpen(failure)) {
                        return None;
                    }
                }
            }
            failure => {
                if !ask(&DbDialog::CannotOpen(failure)) {
                    return None;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Damage inside a database that opens: check and rescue at start-up
// ---------------------------------------------------------------------------

/// What the quick check says about a database that opened.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Health {
    Healthy,
    /// The check found damage; its first lines, for the log.
    Damaged(String),
    /// The check could not run for another reason (the file is busy, a read error): nothing is
    /// known, and nothing is offered.
    Unknown(String),
}

/// `PRAGMA quick_check`: whether the database is damaged anywhere, not only in the header and the
/// schema that opening it reads. It reads every page and changes nothing. It does not see bytes
/// changed inside a title or a text: SQLite keeps no checksums.
pub fn check_health(conn: &Connection) -> Health {
    let lines: Result<Vec<String>> = (|| {
        let mut stmt = conn.prepare("PRAGMA quick_check")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect()
    })();
    match lines {
        Ok(lines) if lines.len() == 1 && lines[0] == "ok" => Health::Healthy,
        Ok(lines) => Health::Damaged(lines.into_iter().take(5).collect::<Vec<_>>().join("; ")),
        // A page full of garbage stops the check itself.
        Err(e) if damage_of(&e) == Some(Damage::Database) => Health::Damaged(e.to_string()),
        Err(e) => Health::Unknown(e.to_string()),
    }
}

/// What the rescue of a damaged database saved.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Rescue {
    /// Snippets copied into the new database.
    pub saved: usize,
    /// Titles of the snippets that exist but cannot be read, as far as the title index still
    /// names them, in the order of their ids.
    pub lost_titles: Vec<String>,
    /// Snippets that exist but cannot be read, and whose title is not known either.
    pub lost_untitled: usize,
}

impl Rescue {
    /// Snippets that exist but cannot be read.
    pub fn lost(&self) -> usize {
        self.lost_titles.len() + self.lost_untitled
    }

    /// Snippets known to be in the damaged database.
    pub fn total(&self) -> usize {
        self.saved + self.lost()
    }

    fn add_lost(&mut self, title: Option<String>) {
        match title {
            Some(t) => self.lost_titles.push(t),
            None => self.lost_untitled += 1,
        }
    }
}

/// A stored value as text, whatever SQLite holds: bytes that are not UTF-8 become U+FFFD.
fn text_lossy(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Text(b) | ValueRef::Blob(b) => Some(String::from_utf8_lossy(b).into_owned()),
        ValueRef::Integer(i) => Some(i.to_string()),
        ValueRef::Real(f) => Some(f.to_string()),
    }
}

/// Whether `value` is a date as QuickSnippets writes it: `strftime('%Y-%m-%dT%H:%M:%f', 'now')` in
/// SQLite, the one format of every version so far, for example `2026-11-21T10:13:05.123`, on a day
/// the calendar has. Damage can leave anything else in place of a date: U+FFFD, zero bytes,
/// letters, spaces (TASK-45). A date in this format is a date, even one that lies in the future.
fn is_app_date(value: &str) -> bool {
    let b = value.as_bytes();
    let separators = [(4, b'-'), (7, b'-'), (10, b'T'), (13, b':'), (16, b':'), (19, b'.')];
    if b.len() != 23 || separators.iter().any(|&(at, separator)| b[at] != separator) {
        return false;
    }
    let number = |from: usize, to: usize| -> Option<u32> {
        b[from..to]
            .iter()
            .try_fold(0, |n, &digit| digit.is_ascii_digit().then(|| n * 10 + u32::from(digit - b'0')))
    };
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second), Some(_)) = (
        number(0, 4),
        number(5, 7),
        number(8, 10),
        number(11, 13),
        number(14, 16),
        number(17, 19),
        number(20, 23),
    ) else {
        return false;
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    (1..=days).contains(&day) && hour < 24 && minute < 60 && second < 60
}

/// Adds the ids (and the titles, where the query gives them) that `sql` returns until SQLite
/// stops at damage.
fn collect_ids(conn: &Connection, sql: &str, known: &mut BTreeMap<i64, Option<String>>) {
    let Ok(mut stmt) = conn.prepare(sql) else { return };
    let Ok(mut rows) = stmt.query([]) else { return };
    while let Ok(Some(row)) = rows.next() {
        let Ok(id) = row.get::<_, i64>(0) else { continue };
        let title = row.get_ref(1).ok().and_then(text_lossy);
        let entry = known.entry(id).or_insert(None);
        if entry.is_none() {
            *entry = title;
        }
    }
}

/// One snippet as the rescue reads it.
struct RescuedRow {
    title: String,
    content: Vec<u8>,
    is_encrypted: bool,
    created_at: Option<String>,
    updated_at: Option<String>,
    last_used_at: Option<String>,
}

enum RowRead {
    /// No row with this id.
    Missing,
    /// SQLite cannot read the row, or a value the app needs is gone.
    Unreadable,
    Row(RescuedRow),
}

/// Reads one snippet by its id, the way that still works when other pages are damaged. A title
/// or the text of a plain snippet that is no longer UTF-8 is repaired with U+FFFD, so that the
/// snippet can be listed, opened and copied; an encrypted snippet keeps its bytes as they are.
/// The dates are read as text the same way; [`copy_readable_snippets`] keeps only those that are
/// still dates.
fn read_for_rescue(conn: &Connection, id: i64) -> RowRead {
    let read = || -> Result<RowRead> {
        let mut stmt = conn.prepare_cached(
            "SELECT title, content, is_encrypted, created_at, updated_at, last_used_at
             FROM snippets WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        let Some(row) = rows.next()? else { return Ok(RowRead::Missing) };
        let is_encrypted = match row.get_ref(2)? {
            ValueRef::Integer(i) => i != 0,
            _ => return Ok(RowRead::Unreadable),
        };
        let content = match row.get_ref(1)? {
            ValueRef::Blob(b) | ValueRef::Text(b) => b.to_vec(),
            _ => return Ok(RowRead::Unreadable),
        };
        let content = if is_encrypted {
            content
        } else {
            String::from_utf8_lossy(&content).into_owned().into_bytes()
        };
        let Some(title) = text_lossy(row.get_ref(0)?) else { return Ok(RowRead::Unreadable) };
        Ok(RowRead::Row(RescuedRow {
            title,
            content,
            is_encrypted,
            created_at: text_lossy(row.get_ref(3)?),
            updated_at: text_lossy(row.get_ref(4)?),
            last_used_at: text_lossy(row.get_ref(5)?),
        }))
    };
    read().unwrap_or(RowRead::Unreadable)
}

/// The highest id a snippet can have. The window gets ids as JavaScript numbers, which hold whole
/// numbers exactly only up to 2^53 - 1, so QuickSnippets never had a snippet with a higher id: in
/// a damaged file such an id is garbage. This also keeps the ids of new snippets within reach.
const MAX_SNIPPET_ID: i64 = (1 << 53) - 1;

/// How far above the highest id that could be read the id counter of a damaged database, or an
/// id its title index names, is still trusted (see [`snippet_ceiling`]).
const ID_MARGIN: i64 = 100_000;

/// The most ids that no scan or index named which [`read_snippets_one_by_one`] tries: about half a
/// second, whatever the damaged file says.
const MAX_TRIED_IDS: i64 = 1_000_000;

/// The highest id a real snippet of a damaged database can have. QuickSnippets gives ids one by
/// one and never gives an id twice (AUTOINCREMENT), so the id counter of the database is this
/// ceiling, as long as it agrees with what could be read: not below the highest id that could be
/// read (`top`) and at most [`ID_MARGIN`] above it. Otherwise the counter is damaged too, and the
/// ceiling is `top`, or the highest id that the title index names (`titled`) up to ID_MARGIN above
/// it. Ids from a damaged page that lie above the ceiling cannot raise it: a sector of 0xA5 gives a
/// scan the id 5374248273442940325.
fn snippet_ceiling(top: i64, counter: Option<i64>, titled: impl Iterator<Item = i64>) -> i64 {
    let limit = top.saturating_add(ID_MARGIN).min(MAX_SNIPPET_ID);
    match counter {
        Some(seq) if (top..=limit).contains(&seq) => seq,
        _ => titled.filter(|&id| id <= limit).fold(top, i64::max),
    }
}

/// Keeps `conn` in a read transaction, and begins it again when an error (a failed read) has ended
/// it. Inside one, SQLite takes the lock of the file once instead of at every statement: a snippet
/// read by its id takes 0.4-0.85 µs instead of about 27 µs. Reading changes nothing in the file.
fn keep_reading(conn: &Connection) {
    if conn.is_autocommit() {
        conn.execute_batch("BEGIN").ok();
    }
}

/// What [`read_snippets_one_by_one`] found besides the snippets it handed over.
struct Reading {
    /// The highest id a real snippet of the database can have (see [`snippet_ceiling`]).
    ceiling: i64,
    /// The snippets that exist but cannot be read, or that the caller could not keep, in the order
    /// of their ids, with their titles where they are known.
    lost: Vec<Option<String>>,
    /// Ids that a scan or an index named but that are no snippet: above the ceiling, 0 or below.
    /// Pieces of a damaged page; only for the log.
    garbage: Vec<i64>,
}

/// Reads every snippet of a damaged database that can still be read, one by one by its id, and
/// gives each to `keep`, which returns whether it kept it. A damaged page can give a scan any id,
/// so the work is bounded whatever the file holds:
///
/// 1. The ids come from a scan of the table in both directions and from both indexes, each up to
///    the first damaged page; the title index also gives the titles. Every named id from 1 to
///    [`MAX_SNIPPET_ID`] is read on its own: a damaged page loses only the snippets on it.
/// 2. The ceiling comes from what could be read (see [`snippet_ceiling`]).
/// 3. The ids up to the ceiling that no scan named are tried as well, at most [`MAX_TRIED_IDS`].
/// 4. A named id up to the ceiling that cannot be read is a lost snippet, named by the title index
///    where it still has it. Any other named id is garbage.
///
/// Reads `conn` only, in a read transaction (see [`keep_reading`]) that it ends again; a
/// transaction the caller began stays open.
fn read_snippets_one_by_one(conn: &Connection, keep: &mut dyn FnMut(i64, RescuedRow) -> bool) -> Reading {
    let caller_transaction = !conn.is_autocommit();
    keep_reading(conn);
    let mut named: BTreeMap<i64, Option<String>> = BTreeMap::new();
    collect_ids(conn, "SELECT id, title FROM snippets INDEXED BY idx_snippets_title", &mut named);
    collect_ids(conn, "SELECT id, NULL FROM snippets INDEXED BY idx_snippets_updated_at", &mut named);
    collect_ids(conn, "SELECT id, NULL FROM snippets NOT INDEXED ORDER BY id", &mut named);
    collect_ids(conn, "SELECT id, NULL FROM snippets NOT INDEXED ORDER BY id DESC", &mut named);
    let counter: Option<i64> = conn
        .query_row("SELECT seq FROM sqlite_sequence WHERE name = 'snippets'", [], |r| r.get(0))
        .ok();

    // Snippets that exist but were not kept, with their titles where known.
    let mut missed: BTreeMap<i64, Option<String>> = BTreeMap::new();
    // Reads one id and hands the snippet over; true when the caller kept it.
    let mut try_one = |id: i64, index_title: Option<&String>| -> bool {
        keep_reading(conn);
        match read_for_rescue(conn, id) {
            RowRead::Row(row) => {
                let title = row.title.clone();
                if keep(id, row) {
                    return true;
                }
                missed.insert(id, Some(title));
            }
            // Not even named: a deleted snippet.
            RowRead::Missing | RowRead::Unreadable if !named.contains_key(&id) => {}
            RowRead::Missing | RowRead::Unreadable => {
                missed.insert(id, index_title.cloned());
            }
        }
        false
    };
    let mut top = 0;
    for (&id, title) in named.range(1..=MAX_SNIPPET_ID) {
        if try_one(id, title.as_ref()) {
            top = id;
        }
    }
    let titled = named.iter().filter(|(_, title)| title.is_some()).map(|(&id, _)| id);
    let ceiling = snippet_ceiling(top, counter, titled);
    for id in (1..=ceiling.min(MAX_TRIED_IDS)).filter(|id| !named.contains_key(id)) {
        try_one(id, None);
    }

    if !caller_transaction && !conn.is_autocommit() {
        conn.execute_batch("ROLLBACK").ok();
    }
    Reading {
        ceiling,
        lost: missed.range(1..=ceiling).map(|(_, title)| title.clone()).collect(),
        garbage: named.keys().copied().filter(|id| !(1..=ceiling).contains(id)).collect(),
    }
}

/// Gives the snippets in `undated`, which [`copy_readable_snippets`] stored with '' for a date of
/// creation or change that damage had overwritten or emptied, the oldest intact date of creation or
/// change of the snippets copied (`oldest`), by the user's choice in TASK-45. Such a snippet goes to
/// the end of the lists sorted newest first (by date of change, the default, and by date of
/// creation), next to the snippet that has that date, and to the start of those sorted oldest first,
/// instead of to the top. Only when no snippet has an intact date, the time of the rescue. Intact
/// dates stay as they are.
fn fill_damaged_dates(conn: &Connection, undated: &[i64], oldest: Option<String>) -> Result<()> {
    if undated.is_empty() {
        return Ok(());
    }
    let date: String = match oldest {
        Some(date) => date,
        None => conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now')", [], |r| r.get(0))?,
    };
    let mut update = conn.prepare(
        "UPDATE snippets SET created_at = CASE created_at WHEN '' THEN ?1 ELSE created_at END,
                             updated_at = CASE updated_at WHEN '' THEN ?1 ELSE updated_at END
         WHERE id = ?2",
    )?;
    for id in undated {
        update.execute(params![date, id])?;
    }
    eprintln!("The rescue filled the damaged dates of {} snippets with {date}", undated.len());
    Ok(())
}

/// Copies every snippet of `src` that can still be read into a new database at `dst_path`, with
/// the same schema (see [`init_db`]), ids, titles and texts; encrypted snippets stay encrypted, byte
/// for byte. Intact dates are copied as they are. A date that damage overwrote or emptied (it is no
/// longer a date, see [`is_app_date`]) does not come along: a date of creation or change gets the
/// oldest intact date of the new database (see [`fill_damaged_dates`]), a date of last use is left
/// empty, as for a snippet never used. Reads `src` only, one snippet at a time (see
/// [`read_snippets_one_by_one`]): a damaged page loses only the snippets on it, and garbage ids from
/// it neither count as lost snippets nor make the work longer. The new database's id counter is the
/// ceiling (see [`snippet_ceiling`]): new snippets get ids after every id the damaged database
/// used, and never after a garbage one. The caller removes an old file at `dst_path` first; an
/// error leaves the new one half written.
pub fn copy_readable_snippets(src: &Connection, dst_path: &Path) -> Result<Rescue> {
    let mut dst = Connection::open(dst_path)?;
    init_db(&dst)?;
    let tx = dst.transaction()?;
    let mut saved = 0;
    // The oldest intact date of creation or change copied, and the snippets copied with a damaged one.
    let mut oldest: Option<String> = None;
    let mut undated = Vec::new();
    let reading = {
        // A damaged date of creation or change is stored as '' until `fill_damaged_dates` below.
        let mut insert = tx.prepare(
            "INSERT INTO snippets (id, title, content, is_encrypted, created_at, updated_at, last_used_at)
             VALUES (?1, ?2, ?3, ?4, COALESCE(?5, ''), COALESCE(?6, ''), ?7)",
        )?;
        let date = |value: Option<String>| value.filter(|d| is_app_date(d));
        read_snippets_one_by_one(src, &mut |id, row| {
            let (created, updated) = (date(row.created_at), date(row.updated_at));
            // A value the schema refuses (a title of a wrong length after damage) loses the snippet.
            let inserted = insert
                .execute(params![
                    id,
                    row.title,
                    row.content,
                    row.is_encrypted as i64,
                    created,
                    updated,
                    date(row.last_used_at)
                ])
                .is_ok();
            if inserted {
                saved += 1;
                if created.is_none() || updated.is_none() {
                    undated.push(id);
                }
                // Dates in the app's one format sort as text in the order of their times.
                oldest = [oldest.take(), created, updated].into_iter().flatten().min();
            }
            inserted
        })
    };
    fill_damaged_dates(&tx, &undated, oldest)?;
    if !reading.garbage.is_empty() {
        let shown = &reading.garbage[..reading.garbage.len().min(5)];
        eprintln!("The rescue left out ids that name no snippet ({} in all): {shown:?}", reading.garbage.len());
    }
    // sqlite_sequence has no key: its one row for the table is changed, or added when no snippet
    // was copied. The inserts above have raised it to the highest id copied; the ceiling is not
    // lower than that.
    tx.execute(
        "UPDATE sqlite_sequence SET seq = MAX(seq, ?1) WHERE name = 'snippets'",
        params![reading.ceiling],
    )?;
    tx.execute(
        "INSERT INTO sqlite_sequence (name, seq) SELECT 'snippets', ?1
         WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'snippets')",
        params![reading.ceiling],
    )?;
    tx.commit()?;
    let mut rescue = Rescue { saved, ..Rescue::default() };
    for title in reading.lost {
        rescue.add_lost(title);
    }
    Ok(rescue)
}

/// Name of the new database while the rescue writes it, next to snippets.db. Only the rescue
/// creates this file; one left by an interrupted rescue is removed before the next one.
pub const RESCUE_FILE_NAME: &str = "snippets-rescue.tmp";

/// Removes the rescue's own file and its journal. A folder of that name is left alone.
fn remove_rescue_file(path: &Path) {
    if path.is_file() {
        std::fs::remove_file(path).ok();
    }
    let journal = journal_path(path);
    if journal.is_file() {
        std::fs::remove_file(journal).ok();
    }
}

/// Puts the database renamed by [`keep_damaged_db`] (and its journal) back as `db_path`.
fn put_back_kept_db(kept: &Path, db_path: &Path) {
    std::fs::rename(kept, db_path).ok();
    let kept_journal = journal_path(kept);
    if kept_journal.exists() {
        std::fs::rename(&kept_journal, journal_path(db_path)).ok();
    }
}

/// Renames the damaged `db_path` to `kept_name` (see [`keep_damaged_db`]) and puts the rescued
/// database in its place. Nothing has changed when this fails.
fn replace_with_rescue(db_path: &Path, rescue_path: &Path, kept_name: &str) -> std::io::Result<()> {
    let kept = keep_damaged_db(db_path, kept_name)?;
    if let Err(e) = std::fs::rename(rescue_path, db_path) {
        put_back_kept_db(&kept, db_path);
        return Err(e);
    }
    Ok(())
}

/// A question the start-up asks about a database that opened but is damaged inside.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RescueDialog {
    /// Move the readable snippets into a new database and keep the damaged file as `kept_name`?
    Offer { rescue: Rescue, kept_name: String },
    /// The rescue failed and nothing was changed: try again?
    Failed(RescueFailure),
}

/// What the start-up goes on with after [`rescue_if_damaged`].
#[derive(Debug)]
pub enum RescueOutcome {
    /// This connection: the database is healthy or could not be checked, or the user chose to
    /// keep working with the damaged file.
    Keep(Connection),
    /// Open the database again: the rescued one is now snippets.db (or, very rarely, the damaged
    /// one could not be opened again after a failed rescue).
    Reopen,
}

/// Checks the database the start-up opened and, when it is damaged inside, asks the user (`ask`
/// returns true for Yes) whether to move the snippets that can still be read into a new database.
///
/// * Yes: the damaged file is renamed to `snippets-damaged-<stamp>.db` (see [`damaged_db_name`])
///   next to it, unchanged, and the new database takes its place.
/// * No: nothing is renamed; the app works with the damaged file, and the next start asks again.
/// * When the copy or the renaming fails, nothing is changed and the user is asked whether to try
///   again; No then works with the damaged file.
///
/// The damaged file itself is only read; the new database is written next to it as
/// [`RESCUE_FILE_NAME`] first, and removed again whenever it is not used.
pub fn rescue_if_damaged(
    db_path: &Path,
    conn: Connection,
    stamp: &str,
    ask: &mut dyn FnMut(&RescueDialog) -> bool,
) -> RescueOutcome {
    let folder = db_path.parent().unwrap_or(Path::new("."));
    let rescue_path = folder.join(RESCUE_FILE_NAME);
    let mut conn = conn;
    loop {
        match check_health(&conn) {
            Health::Healthy => return RescueOutcome::Keep(conn),
            Health::Unknown(e) => {
                eprintln!("The database could not be checked: {e}");
                return RescueOutcome::Keep(conn);
            }
            Health::Damaged(details) => eprintln!("The database is damaged: {details}"),
        }
        remove_rescue_file(&rescue_path);
        let rescue = match copy_readable_snippets(&conn, &rescue_path) {
            Ok(rescue) => rescue,
            Err(e) => {
                remove_rescue_file(&rescue_path);
                if ask(&RescueDialog::Failed(RescueFailure::CopyFailed(e.to_string()))) {
                    continue;
                }
                return RescueOutcome::Keep(conn);
            }
        };
        let kept_name = damaged_db_name(stamp, folder);
        if !ask(&RescueDialog::Offer { rescue, kept_name: kept_name.clone() }) {
            remove_rescue_file(&rescue_path);
            return RescueOutcome::Keep(conn);
        }
        // The damaged file must be closed before it can be renamed.
        drop(conn);
        let failure = match replace_with_rescue(db_path, &rescue_path, &kept_name) {
            Ok(()) => return RescueOutcome::Reopen,
            Err(e) => e,
        };
        remove_rescue_file(&rescue_path);
        conn = match open_and_init_db(db_path) {
            Ok(conn) => conn,
            Err(_) => return RescueOutcome::Reopen,
        };
        if !ask(&RescueDialog::Failed(RescueFailure::KeepFailed(failure.to_string()))) {
            return RescueOutcome::Keep(conn);
        }
    }
}

/// [`open_db_or_ask`] and [`rescue_if_damaged`] with the native dialogs in `lang`; No to a
/// database that cannot be opened quits the app.
#[cfg(not(test))]
pub fn open_db_at_startup(db_path: &Path, lang: &str) -> Connection {
    use crate::error_dialogs;
    let folder = db_path.parent().unwrap_or(Path::new("."));
    let stamp = local_timestamp();
    loop {
        let conn = open_db_or_ask(db_path, &stamp, &mut |dialog| {
            let text = match dialog {
                DbDialog::Damaged { kept_name } => error_dialogs::db_damaged(lang, kept_name, folder),
                DbDialog::CannotOpen(failure) => error_dialogs::db_cannot_open(lang, failure, folder),
            };
            error_dialogs::ask_yes_no(&text)
        });
        let Some(conn) = conn else { std::process::exit(0) };
        let outcome = rescue_if_damaged(db_path, conn, &stamp, &mut |dialog| {
            let text = match dialog {
                RescueDialog::Offer { rescue, kept_name } => {
                    error_dialogs::db_damaged_inside(lang, rescue, kept_name, folder)
                }
                RescueDialog::Failed(failure) => error_dialogs::db_rescue_failed(lang, failure, folder),
            };
            error_dialogs::ask_yes_no(&text)
        });
        match outcome {
            RescueOutcome::Keep(conn) => return conn,
            RescueOutcome::Reopen => continue,
        }
    }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

pub fn create_snippet(
    conn: &Connection,
    title: &str,
    content_blob: Vec<u8>,
    is_encrypted: bool,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO snippets (title, content, is_encrypted, created_at, updated_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%f', 'now'), strftime('%Y-%m-%dT%H:%M:%f', 'now'))",
        params![title, content_blob, is_encrypted as i64],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_snippet_by_id(conn: &Connection, id: i64) -> Result<SnippetRow> {
    conn.query_row(
        "SELECT id, title, content, is_encrypted, created_at, updated_at, last_used_at
         FROM snippets WHERE id = ?1",
        params![id],
        |row| {
            Ok(SnippetRow {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_encrypted: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                last_used_at: row.get(6)?,
            })
        },
    )
}

/// For encrypted snippets the `content_blob` parameter is ignored;
/// the existing encrypted blob is preserved in the database.
pub fn update_snippet(
    conn: &Connection,
    id: i64,
    title: &str,
    content_blob: Vec<u8>,
) -> Result<()> {
    let is_encrypted: bool = conn.query_row(
        "SELECT is_encrypted FROM snippets WHERE id = ?1",
        params![id],
        |row| Ok(row.get::<_, i64>(0)? != 0),
    )?;

    if is_encrypted {
        conn.execute(
            "UPDATE snippets SET title = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?2",
            params![title, id],
        )?;
    } else {
        conn.execute(
            "UPDATE snippets SET title = ?1, content = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?3",
            params![title, content_blob, id],
        )?;
    }
    Ok(())
}

/// Replace the stored blob of an encrypted snippet with the same content re-encrypted
/// in a newer format.
///
/// The row changes only if it still holds exactly `old_blob`; returns whether it changed.
/// `updated_at` is left alone: re-encryption is not an edit by the user.
pub fn replace_encrypted_blob(
    conn: &Connection,
    id: i64,
    old_blob: &[u8],
    new_blob: &[u8],
) -> Result<bool> {
    let affected = conn.execute(
        "UPDATE snippets SET content = ?1 WHERE id = ?2 AND is_encrypted = 1 AND content = ?3",
        params![new_blob, id, old_blob],
    )?;
    Ok(affected == 1)
}

pub fn delete_snippet(conn: &Connection, id: i64) -> Result<()> {
    let affected = conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
    if affected == 0 {
        Err(rusqlite::Error::QueryReturnedNoRows)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

pub fn touch_last_used(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "UPDATE snippets SET last_used_at = strftime('%Y-%m-%dT%H:%M:%f', 'now') WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Search list
// ---------------------------------------------------------------------------

/// The snippets a list shows (id, title, encrypted), and whether damage cut it short.
#[derive(Debug, Default)]
pub struct Listing {
    pub rows: Vec<(i64, String, bool)>,
    /// Damage stopped the reading or left a snippet out: the list is not complete.
    pub damaged: bool,
}

/// Reads `sql` (id, title, is_encrypted) as far as it goes. SQLite stops at the first damaged
/// page, so the rows after it are missing; a row that cannot be read is left out. Both mark the
/// list as damaged. Any other error (a locked database) ends the list as before, unmarked.
fn read_listing(conn: &Connection, sql: &str) -> Listing {
    let mut listing = Listing::default();
    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(e) => {
            listing.damaged = damage_of(&e).is_some();
            return listing;
        }
    };
    let mut rows = match stmt.query([]) {
        Ok(r) => r,
        Err(e) => {
            listing.damaged = damage_of(&e).is_some();
            return listing;
        }
    };
    loop {
        match rows.next() {
            Ok(Some(row)) => {
                let read = (|| {
                    Ok::<_, rusqlite::Error>((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)? != 0,
                    ))
                })();
                match read {
                    Ok(r) => listing.rows.push(r),
                    Err(e) => listing.damaged |= damage_of(&e).is_some(),
                }
            }
            Ok(None) => break,
            Err(e) => {
                listing.damaged |= damage_of(&e).is_some();
                break;
            }
        }
    }
    listing
}

pub fn list_snippets_for_search(conn: &Connection) -> Listing {
    read_listing(
        conn,
        "SELECT id, title, is_encrypted FROM snippets ORDER BY updated_at DESC",
    )
}

/// List all snippets sorted by the given mode and direction.
/// Unknown mode/direction falls back to "modified" / "desc".
pub fn list_snippets_sorted(
    conn: &Connection,
    sort_mode: &str,
    sort_direction: &str,
) -> Listing {
    let dir = match sort_direction {
        "asc" => "ASC",
        "desc" => "DESC",
        _ => "DESC",
    };

    let order_clause = match sort_mode {
        "created" => format!("created_at {dir}"),
        "modified" => format!("updated_at {dir}"),
        "alphabetical" => format!("title COLLATE NOCASE {dir}"),
        "last_used" => format!("last_used_at IS NULL, last_used_at {dir}"),
        _ => format!("updated_at {dir}"),
    };

    let sql = format!(
        "SELECT id, title, is_encrypted FROM snippets ORDER BY {order_clause}"
    );
    read_listing(conn, &sql)
}

// ---------------------------------------------------------------------------
// Test databases damaged on purpose (also used by the tests of commands.rs)
// ---------------------------------------------------------------------------

#[cfg(test)]
pub(crate) mod test_damage {
    use super::*;

    pub fn title_of(i: i64) -> String {
        format!("Сніпет {i:03} тест")
    }

    pub fn content_of(i: i64) -> String {
        format!("Вміст сніпета {i:03}. ").repeat(12)
    }

    /// `snippets.db` in `dir` with `count` plain snippets of about 300 bytes (eight to a page of
    /// 4096 bytes), saved the way the app saves them, in one transaction.
    ///
    /// Saved within a few milliseconds, many of them would share one time, and the list by date
    /// (idx_snippets_updated_at, ties by id) would start at the lowest id of the newest group:
    /// sometimes on the damaged page. So each snippet then gets its own dates, a minute apart,
    /// later for a higher id, as snippets saved over time have them. The dates keep their length,
    /// so every snippet stays on its page.
    pub fn build_db(dir: &Path, count: i64) -> PathBuf {
        let path = dir.join("snippets.db");
        let conn = open_and_init_db(&path).unwrap();
        conn.execute_batch("BEGIN").unwrap();
        for i in 1..=count {
            create_snippet(&conn, &title_of(i), content_of(i).into_bytes(), false).unwrap();
        }
        conn.execute_batch(
            "UPDATE snippets SET
                 created_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || (20000 - id) || ' minutes'),
                 updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || (10000 - id) || ' minutes')",
        )
        .unwrap();
        conn.execute_batch("COMMIT").unwrap();
        path
    }

    /// The pages of a table or index (`name`) of a kind ("leaf", "internal", "overflow"), from
    /// SQLite's dbstat table.
    pub fn pages_of(path: &Path, name: &str, kind: &str) -> Vec<i64> {
        let conn = Connection::open(path).unwrap();
        let mut stmt = conn
            .prepare("SELECT pageno FROM dbstat WHERE name = ?1 AND pagetype = ?2 ORDER BY pageno")
            .unwrap();
        let pages = stmt
            .query_map(params![name, kind], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        pages
    }

    /// Fills page `page` of the file with 0xA5, as a damaged disk sector or a broken copy can.
    pub fn damage_page(path: &Path, page: i64) {
        let mut bytes = std::fs::read(path).unwrap();
        let start = (page as usize - 1) * 4096;
        bytes[start..start + 4096].fill(0xA5);
        std::fs::write(path, bytes).unwrap();
    }

    /// Fills sector `sector` (512 bytes) of page `page` with `byte`, as a damaged disk sector can.
    /// The page header in sector 0 stays, so SQLite still reads cells from the rest of the page,
    /// and a cell that now starts in the filled bytes gives a garbage id: nine bytes of 0xA5 read
    /// as the id 5374248273442940325, 0x7F as the id 127.
    pub fn damage_sector(path: &Path, page: i64, sector: usize, byte: u8) {
        let mut bytes = std::fs::read(path).unwrap();
        let start = (page as usize - 1) * 4096 + sector * 512;
        bytes[start..start + 512].fill(byte);
        std::fs::write(path, bytes).unwrap();
    }

    /// Damages the middle page of snippets of a database made by [`build_db`] and returns the ids
    /// that can no longer be read.
    pub fn damage_middle_leaf(path: &Path, count: i64) -> Vec<i64> {
        let leaves = pages_of(path, "snippets", "leaf");
        damage_page(path, leaves[leaves.len() / 2]);
        let conn = Connection::open(path).unwrap();
        (1..=count).filter(|&id| get_snippet_by_id(&conn, id).is_err()).collect()
    }

    /// Overwrites `bytes.len()` bytes of the file, `skip` bytes after the first (or, with `in_page`,
    /// the first one inside that page) place that holds `needle`, and returns the page.
    pub fn overwrite_after(path: &Path, needle: &[u8], in_page: Option<&[i64]>, skip: usize, bytes: &[u8]) -> i64 {
        let mut file = std::fs::read(path).unwrap();
        let at = (0..=file.len() - needle.len())
            .filter(|&i| &file[i..i + needle.len()] == needle)
            .find(|&i| in_page.is_none_or(|pages| pages.contains(&((i / 4096) as i64 + 1))))
            .expect("the bytes are in the file");
        file[at + skip..at + skip + bytes.len()].copy_from_slice(bytes);
        std::fs::write(path, file).unwrap();
        (at / 4096) as i64 + 1
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::test_damage::*;
    use super::*;
    use rusqlite::Connection;
    use std::time::{Duration, Instant};

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    // --- Schema ---

    #[test]
    fn test_init_db_creates_snippets_table() {
        let conn = setup_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snippets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_init_db_sets_delete_journal_mode() {
        let conn = setup_test_db();
        // In-memory DBs always report "memory" for journal_mode, so we verify
        // that init_db executes without error and the PRAGMA is accepted.
        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        // Acceptable values: "delete" (file) or "memory" (in-memory)
        assert!(mode == "delete" || mode == "memory");
    }

    #[test]
    fn test_init_db_sets_busy_timeout() {
        let conn = setup_test_db();
        let timeout: i64 = conn
            .query_row("PRAGMA busy_timeout;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(timeout, 5000);
    }

    #[test]
    fn test_init_db_is_idempotent() {
        let conn = setup_test_db();
        // Second call must not fail
        init_db(&conn).unwrap();
    }

    #[test]
    fn test_index_exists_on_updated_at() {
        let conn = setup_test_db();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type='index' AND name='idx_snippets_updated_at'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    // --- CHECK constraints ---

    #[test]
    fn test_check_title_min_length_3() {
        let conn = setup_test_db();
        let result = create_snippet(&conn, "ab", b"content".to_vec(), false);
        assert!(result.is_err(), "title with 2 chars should fail");
    }

    #[test]
    fn test_check_title_max_length_50() {
        let conn = setup_test_db();
        let long_title = "a".repeat(51);
        let result = create_snippet(&conn, &long_title, b"content".to_vec(), false);
        assert!(result.is_err(), "title with 51 chars should fail");
    }

    #[test]
    fn test_check_title_boundary_3_chars_ok() {
        let conn = setup_test_db();
        let result = create_snippet(&conn, "abc", b"content".to_vec(), false);
        assert!(result.is_ok(), "title with 3 chars should be ok");
    }

    #[test]
    fn test_check_title_boundary_50_chars_ok() {
        let conn = setup_test_db();
        let title = "a".repeat(50);
        let result = create_snippet(&conn, &title, b"content".to_vec(), false);
        assert!(result.is_ok(), "title with 50 chars should be ok");
    }

    #[test]
    fn test_check_content_max_65536_bytes() {
        let conn = setup_test_db();
        let big = vec![0u8; 65537];
        let result = create_snippet(&conn, "title-ok", big, false);
        assert!(result.is_err(), "content > 65536 bytes should fail");
    }

    #[test]
    fn test_check_content_boundary_65536_bytes_ok() {
        let conn = setup_test_db();
        let exact = vec![0u8; 65536];
        let result = create_snippet(&conn, "title-ok", exact, false);
        assert!(result.is_ok(), "content of exactly 65536 bytes should be ok");
    }

    #[test]
    fn test_duplicate_title_fails() {
        let conn = setup_test_db();
        create_snippet(&conn, "same title", b"content1".to_vec(), false).unwrap();
        let result = create_snippet(&conn, "same title", b"content2".to_vec(), false);
        assert!(result.is_err(), "duplicate title should fail");
    }

    #[test]
    fn test_unique_titles_both_ok() {
        let conn = setup_test_db();
        create_snippet(&conn, "title A", b"content1".to_vec(), false).unwrap();
        let result = create_snippet(&conn, "title B", b"content2".to_vec(), false);
        assert!(result.is_ok(), "two snippets with different titles should be ok");
    }

    // --- CRUD ---

    #[test]
    fn test_create_snippet_returns_id() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        assert!(id > 0);
    }

    #[test]
    fn test_create_snippet_sets_timestamps() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert!(!row.created_at.is_empty());
        assert!(!row.updated_at.is_empty());
    }

    #[test]
    fn test_get_snippet_by_id_found() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello world".to_vec(), false).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.id, id);
        assert_eq!(row.title, "My snippet");
        assert_eq!(row.content, b"hello world");
        assert!(!row.is_encrypted);
    }

    #[test]
    fn test_get_snippet_by_id_not_found() {
        let conn = setup_test_db();
        let result = get_snippet_by_id(&conn, 9999);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_snippet_changes_title_and_content() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Old title", b"old content".to_vec(), false).unwrap();
        update_snippet(&conn, id, "New title", b"new content".to_vec()).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "New title");
        assert_eq!(row.content, b"new content");
    }

    #[test]
    fn test_update_snippet_preserves_encrypted_content() {
        let conn = setup_test_db();
        let original_blob = b"encrypted-blob".to_vec();
        let id = create_snippet(&conn, "Enc title", original_blob.clone(), true).unwrap();
        // update with different blob — should be ignored for encrypted snippets
        update_snippet(&conn, id, "New title", b"should-be-ignored".to_vec()).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "New title");
        assert_eq!(row.content, original_blob, "encrypted content must not change");
    }

    // --- replace_encrypted_blob ---

    #[test]
    fn test_replace_encrypted_blob_swaps_matching_blob() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"old-blob".to_vec(), true).unwrap();
        conn.execute(
            "UPDATE snippets SET updated_at = '2026-02-03T04:05:06.000' WHERE id = ?1",
            params![id],
        )
        .unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"old-blob", b"new-blob").unwrap();

        assert!(replaced);
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.content, b"new-blob");
        assert!(row.is_encrypted);
        assert_eq!(row.title, "Enc title");
        assert_eq!(row.updated_at, "2026-02-03T04:05:06.000", "updated_at must not change");
    }

    #[test]
    fn test_replace_encrypted_blob_refuses_when_stored_blob_differs() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"current-blob".to_vec(), true).unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"stale-blob", b"new-blob").unwrap();

        assert!(!replaced);
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"current-blob");
    }

    #[test]
    fn test_replace_encrypted_blob_ignores_plain_snippets() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Plain title", b"plain text".to_vec(), false).unwrap();

        let replaced = replace_encrypted_blob(&conn, id, b"plain text", b"new-blob").unwrap();

        assert!(!replaced);
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"plain text");
    }

    #[test]
    fn test_replace_encrypted_blob_touches_only_the_given_snippet() {
        let conn = setup_test_db();
        let first = create_snippet(&conn, "First enc", b"same-blob".to_vec(), true).unwrap();
        let second = create_snippet(&conn, "Second enc", b"same-blob".to_vec(), true).unwrap();

        assert!(replace_encrypted_blob(&conn, first, b"same-blob", b"new-blob").unwrap());

        assert_eq!(get_snippet_by_id(&conn, first).unwrap().content, b"new-blob");
        assert_eq!(get_snippet_by_id(&conn, second).unwrap().content, b"same-blob");
        assert!(!replace_encrypted_blob(&conn, 9999, b"same-blob", b"new-blob").unwrap());
    }

    #[test]
    fn test_replace_encrypted_blob_too_long_is_an_error_and_keeps_old_blob() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "Enc title", b"old-blob".to_vec(), true).unwrap();
        let too_long = vec![b'A'; 65_537];

        let result = replace_encrypted_blob(&conn, id, b"old-blob", &too_long);

        assert!(result.is_err(), "the content length CHECK must reject the new blob");
        assert_eq!(get_snippet_by_id(&conn, id).unwrap().content, b"old-blob");
    }

    #[test]
    fn test_update_snippet_updates_updated_at() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"hello".to_vec(), false).unwrap();
        let before = get_snippet_by_id(&conn, id).unwrap().updated_at;
        // Small sleep to guarantee timestamp difference
        std::thread::sleep(std::time::Duration::from_millis(5));
        update_snippet(&conn, id, "My snippet", b"hello".to_vec()).unwrap();
        let after = get_snippet_by_id(&conn, id).unwrap().updated_at;
        assert!(after > before, "updated_at should increase after update");
    }

    #[test]
    fn test_delete_snippet_removes_record() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "To delete", b"bye".to_vec(), false).unwrap();
        delete_snippet(&conn, id).unwrap();
        assert!(get_snippet_by_id(&conn, id).is_err());
    }

    #[test]
    fn test_delete_nonexistent_snippet() {
        let conn = setup_test_db();
        let result = delete_snippet(&conn, 9999);
        assert!(result.is_err(), "deleting non-existent snippet should return Err");
    }

    // --- List ---

    #[test]
    fn test_list_snippets_sorted_by_updated_at_desc() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "AAA snippet", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "BBB snippet", b"b".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_c = create_snippet(&conn, "CCC snippet", b"c".to_vec(), false).unwrap();

        let list = list_snippets_for_search(&conn).rows;
        assert_eq!(list.len(), 3);
        assert_eq!(list[0].0, id_c);
        assert_eq!(list[1].0, id_b);
        assert_eq!(list[2].0, id_a);
    }

    #[test]
    fn test_list_snippets_returns_id_title_encrypted() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "My snippet", b"data".to_vec(), true).unwrap();
        let list = list_snippets_for_search(&conn).rows;
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].0, id);
        assert_eq!(list[0].1, "My snippet");
        assert!(list[0].2, "is_encrypted should be true");
    }

    #[test]
    fn test_list_snippets_empty_db() {
        let conn = setup_test_db();
        let list = list_snippets_for_search(&conn).rows;
        assert!(list.is_empty());
    }

    // --- Verification helpers ---

    #[test]
    fn test_open_and_init_db_when_path_is_directory() {
        // Scoop creates a directory stub for persisted files that don't exist
        // in the release archive.  The app must delete it and open a real DB.
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::create_dir_all(&db_path).unwrap();
        assert!(db_path.is_dir(), "precondition: path is a directory");

        let conn = open_and_init_db(&db_path).unwrap();
        assert!(
            !db_path.is_dir(),
            "directory should have been replaced by a file"
        );
        // DB must be functional
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='snippets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_get_db_path_is_in_data_dir() {
        let db_path = get_db_path();
        let data_dir = crate::paths::get_data_dir();
        assert_eq!(db_path, data_dir.join("snippets.db"));
        assert!(
            !db_path.to_string_lossy().contains("AppData"),
            "db path must not be in AppData"
        );
    }

    #[test]
    fn test_init_db_delete_journal_on_real_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        init_db(&conn).unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "delete", "DELETE journal mode must be enabled on a real file DB");
    }

    #[test]
    fn test_full_crud_cycle() {
        let conn = setup_test_db();

        // Create
        let id = create_snippet(&conn, "Cycle test", b"initial".to_vec(), false).unwrap();
        assert!(id > 0);

        // Read
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "Cycle test");
        assert_eq!(row.content, b"initial");

        // Update
        std::thread::sleep(std::time::Duration::from_millis(5));
        update_snippet(&conn, id, "Updated title", b"updated content".to_vec()).unwrap();
        let updated = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(updated.title, "Updated title");
        assert_eq!(updated.content, b"updated content");
        assert!(updated.updated_at > row.updated_at);

        // Delete
        delete_snippet(&conn, id).unwrap();
        assert!(get_snippet_by_id(&conn, id).is_err());
    }

    // --- open_and_init_db ---

    /// Opening a non-existent path creates the DB file on disk.
    #[test]
    fn test_open_and_init_db_creates_db_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");

        assert!(!db_path.exists(), "precondition: file must not exist yet");
        let _conn = open_and_init_db(&db_path).unwrap();
        assert!(db_path.is_file(), "open_and_init_db must create the db file");
    }

    /// The snippets table contains all six expected columns.
    #[test]
    fn test_open_and_init_db_schema_has_correct_columns() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let mut stmt = conn
            .prepare("PRAGMA table_info(snippets)")
            .unwrap();

        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        for expected in &["id", "title", "content", "is_encrypted", "created_at", "updated_at", "last_used_at"] {
            assert!(
                columns.iter().any(|c| c == expected),
                "column '{}' not found in snippets table; found: {:?}",
                expected,
                columns
            );
        }
    }

    #[test]
    fn test_schema_has_last_used_at_column() {
        let conn = setup_test_db();
        let mut stmt = conn.prepare("PRAGMA table_info(snippets)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(
            columns.contains(&"last_used_at".to_string()),
            "last_used_at column not found; found: {:?}",
            columns
        );
    }

    /// The unique index on `title` is created by open_and_init_db.
    #[test]
    fn test_open_and_init_db_creates_unique_title_index() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master \
                 WHERE type='index' AND name='idx_snippets_title'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "unique index on title must exist");
    }

    /// The resulting connection is fully usable (INSERT + SELECT round-trip).
    #[test]
    fn test_open_and_init_db_connection_is_functional() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let id = create_snippet(&conn, "Functional test", b"data".to_vec(), false)
            .expect("insert should succeed");
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert_eq!(row.title, "Functional test");
        assert_eq!(row.content, b"data");
    }

    /// Calling open_and_init_db on an already-initialised file succeeds
    /// (idempotent) and preserves existing data.
    #[test]
    fn test_open_and_init_db_idempotent_on_existing_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");

        // First open — create and insert one snippet
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Persist me", b"content".to_vec(), false).unwrap();
        }

        // Second open — must succeed and data must still be there
        let conn2 = open_and_init_db(&db_path).unwrap();
        let list = list_snippets_for_search(&conn2).rows;
        assert_eq!(list.len(), 1, "existing snippet must survive re-open");
        assert_eq!(list[0].1, "Persist me");
    }

    /// The journal_mode is DELETE when opening a real file (not in-memory).
    #[test]
    fn test_open_and_init_db_journal_mode_is_delete() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        let conn = open_and_init_db(&db_path).unwrap();

        let mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "delete", "journal_mode must be DELETE on a real file");
    }

    // --- touch_last_used ---

    #[test]
    fn test_touch_last_used_sets_timestamp() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "test snip", b"data".to_vec(), false).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert!(row.last_used_at.is_none(), "last_used_at should be None initially");

        touch_last_used(&conn, id).unwrap();
        let row = get_snippet_by_id(&conn, id).unwrap();
        assert!(row.last_used_at.is_some(), "last_used_at should be set after touch");
    }

    #[test]
    fn test_touch_last_used_updates_on_second_call() {
        let conn = setup_test_db();
        let id = create_snippet(&conn, "test snip", b"data".to_vec(), false).unwrap();
        touch_last_used(&conn, id).unwrap();
        let first = get_snippet_by_id(&conn, id).unwrap().last_used_at.unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        touch_last_used(&conn, id).unwrap();
        let second = get_snippet_by_id(&conn, id).unwrap().last_used_at.unwrap();
        assert!(second > first, "second touch should have a later timestamp");
    }

    // --- list_snippets_sorted ---

    #[test]
    fn test_list_snippets_sorted_by_title_asc() {
        let conn = setup_test_db();
        create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();

        let list = list_snippets_sorted(&conn, "alphabetical", "asc").rows;
        assert_eq!(list.len(), 3);
        assert_eq!(list[0].1, "Alpha");
        assert_eq!(list[1].1, "Bravo");
        assert_eq!(list[2].1, "Charlie");
    }

    #[test]
    fn test_list_snippets_sorted_by_title_desc() {
        let conn = setup_test_db();
        create_snippet(&conn, "Alpha", b"a".to_vec(), false).unwrap();
        create_snippet(&conn, "Bravo", b"b".to_vec(), false).unwrap();
        create_snippet(&conn, "Charlie", b"c".to_vec(), false).unwrap();

        let list = list_snippets_sorted(&conn, "alphabetical", "desc").rows;
        assert_eq!(list[0].1, "Charlie");
        assert_eq!(list[1].1, "Bravo");
        assert_eq!(list[2].1, "Alpha");
    }

    #[test]
    fn test_list_snippets_sorted_by_created_desc() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

        let list = list_snippets_sorted(&conn, "created", "desc").rows;
        assert_eq!(list[0].0, id_b);
        assert_eq!(list[1].0, id_a);
    }

    #[test]
    fn test_list_snippets_sorted_by_created_asc() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

        let list = list_snippets_sorted(&conn, "created", "asc").rows;
        assert_eq!(list[0].0, id_a);
        assert_eq!(list[1].0, id_b);
    }

    #[test]
    fn test_list_snippets_sorted_by_last_used_nulls_last() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "Never used", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "Used once", b"b".to_vec(), false).unwrap();
        touch_last_used(&conn, id_b).unwrap();

        let list = list_snippets_sorted(&conn, "last_used", "desc").rows;
        assert_eq!(list[0].0, id_b, "used snippet should be first");
        assert_eq!(list[1].0, id_a, "never-used snippet should be last");
    }

    #[test]
    fn test_list_snippets_sorted_by_last_used_asc_nulls_last() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "Never used", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "Used first", b"b".to_vec(), false).unwrap();
        touch_last_used(&conn, id_b).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_c = create_snippet(&conn, "Used second", b"c".to_vec(), false).unwrap();
        touch_last_used(&conn, id_c).unwrap();

        let list = list_snippets_sorted(&conn, "last_used", "asc").rows;
        assert_eq!(list[0].0, id_b, "oldest usage first");
        assert_eq!(list[1].0, id_c, "newest usage second");
        assert_eq!(list[2].0, id_a, "never-used last");
    }

    #[test]
    fn test_list_snippets_sorted_unknown_mode_falls_back() {
        let conn = setup_test_db();
        let id_a = create_snippet(&conn, "AAA first", b"a".to_vec(), false).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let id_b = create_snippet(&conn, "BBB second", b"b".to_vec(), false).unwrap();

        // Unknown mode should fall back to "modified" desc
        let list = list_snippets_sorted(&conn, "unknown", "xyz").rows;
        assert_eq!(list[0].0, id_b);
        assert_eq!(list[1].0, id_a);
    }

    // --- opening at start-up: damaged or unavailable database ---

    const STAMP: &str = "2026-11-20-14-35";
    /// Not a SQLite file: SQLite answers "file is not a database".
    const GARBAGE: &[u8] = b"this is not a sqlite database, just some damaged bytes........\
                              ................................................................";

    fn sqlite_failure(code: i32) -> rusqlite::Error {
        rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(code), None)
    }

    fn snippet_count(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM snippets", [], |row| row.get(0)).unwrap()
    }

    fn file_names(dir: &std::path::Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        names
    }

    /// A healthy database opens without any question.
    #[test]
    fn test_open_db_or_ask_healthy_db_asks_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let mut asked = Vec::new();
        let conn = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            true
        })
        .expect("a healthy database must open");
        assert!(asked.is_empty(), "no question for a healthy database: {asked:?}");
        assert_eq!(snippet_count(&conn), 1);
    }

    #[test]
    fn test_classify_open_error_damage() {
        assert_eq!(classify_open_error(&sqlite_failure(11)), OpenFailure::Damaged); // SQLITE_CORRUPT
        assert_eq!(classify_open_error(&sqlite_failure(26)), OpenFailure::Damaged); // SQLITE_NOTADB
    }

    #[test]
    fn test_classify_open_error_other_reasons_are_not_damage() {
        assert_eq!(classify_open_error(&sqlite_failure(5)), OpenFailure::Busy); // SQLITE_BUSY
        assert_eq!(classify_open_error(&sqlite_failure(6)), OpenFailure::Busy); // SQLITE_LOCKED
        assert_eq!(classify_open_error(&sqlite_failure(14)), OpenFailure::CannotOpen); // SQLITE_CANTOPEN
        assert_eq!(classify_open_error(&sqlite_failure(3)), OpenFailure::NoAccess); // SQLITE_PERM
        assert_eq!(classify_open_error(&sqlite_failure(8)), OpenFailure::NoAccess); // SQLITE_READONLY
        assert_eq!(classify_open_error(&sqlite_failure(13)), OpenFailure::DiskFull); // SQLITE_FULL
        assert!(matches!(
            classify_open_error(&sqlite_failure(10)), // SQLITE_IOERR
            OpenFailure::Other(_)
        ));
        assert!(matches!(
            classify_open_error(&rusqlite::Error::QueryReturnedNoRows),
            OpenFailure::Other(_)
        ));
    }

    /// A file that is not a database is reported as damage by the real open.
    #[test]
    fn test_classify_open_error_on_a_garbage_file_is_damage() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        let err = open_and_init_db(&db_path).expect_err("garbage must not open");
        assert_eq!(classify_open_error(&err), OpenFailure::Damaged, "{err}");
    }

    /// A database whose header is intact but whose first page is overwritten.
    #[test]
    fn test_classify_open_error_on_a_damaged_schema_is_damage() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Some title", b"x".to_vec(), false).unwrap();
        }
        let mut bytes = std::fs::read(&db_path).unwrap();
        for b in bytes.iter_mut().take(4096).skip(100) {
            *b = 0xA5;
        }
        std::fs::write(&db_path, &bytes).unwrap();
        let err = open_and_init_db(&db_path).expect_err("a damaged schema must not open");
        assert_eq!(classify_open_error(&err), OpenFailure::Damaged, "{err}");
    }

    #[test]
    fn test_local_timestamp_format() {
        let stamp = local_timestamp();
        // YYYY-MM-DD-HH-MM
        assert_eq!(stamp.len(), 16, "{stamp}");
        let parts: Vec<&str> = stamp.split('-').collect();
        assert_eq!(parts.len(), 5, "{stamp}");
        assert!(parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())), "{stamp}");
    }

    #[test]
    fn test_damaged_db_name_says_what_it_is() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35.db"
        );
    }

    #[test]
    fn test_damaged_db_name_never_reuses_a_taken_name() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("snippets-damaged-2026-11-20-14-35.db"), b"1").unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35-2.db"
        );
        // A leftover journal alone also takes the name.
        std::fs::write(dir.path().join("snippets-damaged-2026-11-20-14-35-2.db-journal"), b"j").unwrap();
        assert_eq!(
            damaged_db_name(STAMP, dir.path()),
            "snippets-damaged-2026-11-20-14-35-3.db"
        );
    }

    #[test]
    fn test_keep_damaged_db_renames_file_and_journal_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        std::fs::write(dir.path().join("snippets.db-journal"), b"journal bytes").unwrap();

        let kept = keep_damaged_db(&db_path, "snippets-damaged-x.db").unwrap();

        assert_eq!(kept, dir.path().join("snippets-damaged-x.db"));
        assert_eq!(std::fs::read(&kept).unwrap(), GARBAGE, "bytes must be kept as they were");
        assert_eq!(
            std::fs::read(dir.path().join("snippets-damaged-x.db-journal")).unwrap(),
            b"journal bytes"
        );
        assert!(!db_path.exists());
        assert!(!dir.path().join("snippets.db-journal").exists());
    }

    #[test]
    fn test_keep_damaged_db_never_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();
        std::fs::write(dir.path().join("snippets-damaged-x.db"), b"older copy").unwrap();

        assert!(keep_damaged_db(&db_path, "snippets-damaged-x.db").is_err());
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
        assert_eq!(
            std::fs::read(dir.path().join("snippets-damaged-x.db")).unwrap(),
            b"older copy"
        );
    }

    /// Yes in the damage dialog keeps the damaged file under the name the
    /// dialog showed and starts with an empty, working database.
    #[test]
    fn test_open_db_or_ask_damaged_yes_keeps_file_and_starts_empty() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        let mut asked = Vec::new();
        let conn = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            true
        })
        .expect("Yes must give a working database");

        assert_eq!(
            asked,
            vec![DbDialog::Damaged {
                kept_name: "snippets-damaged-2026-11-20-14-35.db".to_string()
            }]
        );
        let kept = dir.path().join("snippets-damaged-2026-11-20-14-35.db");
        assert_eq!(std::fs::read(&kept).unwrap(), GARBAGE, "the damaged file must be kept as it was");
        assert_eq!(snippet_count(&conn), 0);
        create_snippet(&conn, "New snippet", b"y".to_vec(), false).unwrap();
        assert_eq!(snippet_count(&conn), 1);
    }

    /// A second damaged file on the same minute gets its own name; the first
    /// copy stays.
    #[test]
    fn test_open_db_or_ask_damaged_twice_keeps_both_copies() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        for _ in 0..2 {
            std::fs::write(&db_path, GARBAGE).unwrap();
            let conn = open_db_or_ask(&db_path, STAMP, &mut |_| true).unwrap();
            drop(conn);
        }
        assert_eq!(
            file_names(dir.path()),
            vec![
                "snippets-damaged-2026-11-20-14-35-2.db",
                "snippets-damaged-2026-11-20-14-35.db",
                "snippets.db",
            ]
        );
    }

    /// No in the damage dialog changes no file.
    ///
    /// (A rollback journal next to it is SQLite's own business: on every open,
    /// before any dialog, SQLite discards a journal it finds invalid and plays
    /// back a valid one. This was so before the dialog changed, too.)
    #[test]
    fn test_open_db_or_ask_damaged_no_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        let mut asked = 0;
        let result = open_db_or_ask(&db_path, STAMP, &mut |_| {
            asked += 1;
            false
        });

        assert!(result.is_none());
        assert_eq!(asked, 1);
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
    }

    /// A file another program holds open without sharing is not damage: the
    /// user is asked to try again, and No changes nothing.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_file_in_use_asks_to_try_again() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let before = std::fs::read(&db_path).unwrap();

        // Share mode 0: nobody else may open the file while this handle lives.
        let holder = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&db_path)
            .unwrap();
        let mut asked = Vec::new();
        let result = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            false
        });
        drop(holder);

        assert!(result.is_none());
        assert_eq!(asked.len(), 1);
        assert!(
            matches!(asked[0], DbDialog::CannotOpen(ref f) if *f != OpenFailure::Damaged),
            "{asked:?}"
        );
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), before);
    }

    /// Yes in the "try again" dialog tries again: once the other program has
    /// let go, the user's own database opens with their snippets.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_try_again_opens_the_same_database() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        {
            let conn = open_and_init_db(&db_path).unwrap();
            create_snippet(&conn, "Kept snippet", b"x".to_vec(), false).unwrap();
        }
        let mut holder = Some(
            std::fs::OpenOptions::new()
                .read(true)
                .share_mode(0)
                .open(&db_path)
                .unwrap(),
        );
        let mut asked = 0;
        let conn = open_db_or_ask(&db_path, STAMP, &mut |_| {
            asked += 1;
            holder.take(); // the other program closes the file
            true
        })
        .expect("the second try must open");
        assert_eq!(asked, 1);
        assert_eq!(snippet_count(&conn), 1, "the user's snippets must still be there");
    }

    /// When the damaged file cannot be renamed, the user is told so and nothing
    /// changes.
    #[cfg(windows)]
    #[test]
    fn test_open_db_or_ask_rename_failure_is_reported_and_changes_nothing() {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_SHARE_READ: u32 = 0x1;
        const FILE_SHARE_WRITE: u32 = 0x2;
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("snippets.db");
        std::fs::write(&db_path, GARBAGE).unwrap();

        // SQLite can still open the file (read and write are shared), but it
        // cannot be renamed (delete is not shared).
        let holder = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .open(&db_path)
            .unwrap();
        let mut asked = Vec::new();
        let result = open_db_or_ask(&db_path, STAMP, &mut |d| {
            asked.push(d.clone());
            // Yes to keeping the damaged file, then No to trying again.
            matches!(d, DbDialog::Damaged { .. })
        });
        drop(holder);

        assert!(result.is_none());
        assert_eq!(asked.len(), 2, "{asked:?}");
        assert!(matches!(asked[0], DbDialog::Damaged { .. }));
        assert!(
            matches!(asked[1], DbDialog::CannotOpen(OpenFailure::KeepFailed(_))),
            "{asked:?}"
        );
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&db_path).unwrap(), GARBAGE);
    }

    // --- damage inside a database that opens (TASK-33) ---

    const COUNT: i64 = 90;

    fn all_rows(conn: &Connection) -> Vec<(i64, String, Vec<u8>, i64, String, String, Option<String>)> {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content, is_encrypted, created_at, updated_at, last_used_at
                 FROM snippets ORDER BY id",
            )
            .unwrap();
        let rows = stmt
            .query_map([], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?))
            })
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        rows
    }

    #[test]
    fn test_check_health_of_a_healthy_database() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let conn = open_and_init_db(&path).unwrap();
        assert_eq!(check_health(&conn), Health::Healthy);
    }

    /// Opening does not notice a damaged page of snippets (the start-up of 0.3.5 went on without a
    /// word); the quick check does, and changes nothing.
    #[test]
    fn test_check_health_finds_a_damaged_page_of_snippets_and_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_middle_leaf(&path, COUNT);
        let before = std::fs::read(&path).unwrap();

        let conn = open_and_init_db(&path).expect("damage after the schema does not stop the open");
        assert!(matches!(check_health(&conn), Health::Damaged(_)));
        drop(conn);
        assert_eq!(std::fs::read(&path).unwrap(), before, "the check must not change the file");
    }

    #[test]
    fn test_check_health_finds_a_damaged_index_and_overflow_page() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, pages_of(&path, "idx_snippets_updated_at", "leaf")[0]);
        let conn = open_and_init_db(&path).unwrap();
        assert!(matches!(check_health(&conn), Health::Damaged(_)), "index");

        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 3);
        {
            let conn = open_and_init_db(&path).unwrap();
            create_snippet(&conn, "Long one", "довгий текст ".repeat(2000).into_bytes(), false).unwrap();
        }
        let overflow = pages_of(&path, "snippets", "overflow");
        damage_page(&path, overflow[overflow.len() / 2]);
        let conn = open_and_init_db(&path).unwrap();
        assert!(matches!(check_health(&conn), Health::Damaged(_)), "overflow page");
    }

    /// The limit of the quick check: bytes changed inside a text break no structure, and SQLite
    /// keeps no checksums. Such a snippet shows up only when it is read (SNIPPET_DAMAGED).
    #[test]
    fn test_check_health_does_not_see_damaged_bytes_inside_a_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        overwrite_after(&path, content_of(40).as_bytes(), None, 10, &[0xFF, 0xFF]);
        let conn = open_and_init_db(&path).unwrap();
        assert_eq!(check_health(&conn), Health::Healthy);
    }

    #[test]
    fn test_listing_of_a_healthy_database_is_not_damaged() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let conn = open_and_init_db(&path).unwrap();
        for mode in ["modified", "created", "alphabetical", "last_used"] {
            let listing = list_snippets_sorted(&conn, mode, "desc");
            assert_eq!(listing.rows.len() as i64, COUNT, "{mode}");
            assert!(!listing.damaged, "{mode}");
        }
        assert!(!list_snippets_for_search(&conn).damaged);
        // The test database lists the newest first, by id: the damage tests rely on it.
        let ids: Vec<i64> = list_snippets_sorted(&conn, "modified", "desc").rows.iter().map(|r| r.0).collect();
        assert_eq!(ids, (1..=COUNT).rev().collect::<Vec<_>>());
    }

    /// Up to 0.3.5 the list ended silently at a damaged page, and the orders that sort every row
    /// first came out empty: the window said "No snippets yet".
    #[test]
    fn test_listing_says_when_a_damaged_page_cuts_it_short() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        let conn = open_and_init_db(&path).unwrap();

        let modified = list_snippets_sorted(&conn, "modified", "desc");
        assert!(modified.damaged);
        assert!(!modified.rows.is_empty() && (modified.rows.len() as i64) < COUNT - unreadable.len() as i64);
        let alphabetical = list_snippets_sorted(&conn, "alphabetical", "asc");
        assert!(alphabetical.damaged);
        assert!(alphabetical.rows.is_empty(), "sorting reads every row first");
        let search = list_snippets_for_search(&conn);
        assert!(search.damaged);
        assert_eq!(search.rows.len(), modified.rows.len());
    }

    /// A title that is not UTF-8 left its snippet out of the list without a word.
    #[test]
    fn test_listing_says_when_it_leaves_out_a_damaged_title() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        overwrite_after(&path, title_of(41).as_bytes(), Some(&leaves), 2, &[0xFF, 0xFE]);
        let conn = open_and_init_db(&path).unwrap();

        let listing = list_snippets_sorted(&conn, "modified", "desc");
        assert!(listing.damaged);
        assert_eq!(listing.rows.len() as i64, COUNT - 1);
        assert!(!listing.rows.iter().any(|r| r.0 == 41));
    }

    /// A database that another connection holds is no damage: the list ends as before, unmarked.
    #[test]
    fn test_listing_of_a_locked_database_is_not_damage() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 5);
        let holder = Connection::open(&path).unwrap();
        holder.execute_batch("BEGIN EXCLUSIVE").unwrap();
        let conn = Connection::open(&path).unwrap();
        conn.busy_timeout(std::time::Duration::ZERO).unwrap();

        let listing = list_snippets_sorted(&conn, "modified", "desc");
        assert!(listing.rows.is_empty());
        assert!(!listing.damaged);
    }

    #[test]
    fn test_damage_of_classifies_errors() {
        assert_eq!(damage_of(&sqlite_failure(11)), Some(Damage::Database)); // SQLITE_CORRUPT
        assert_eq!(damage_of(&sqlite_failure(26)), Some(Damage::Database)); // SQLITE_NOTADB
        assert_eq!(damage_of(&sqlite_failure(5)), None); // SQLITE_BUSY
        assert_eq!(damage_of(&sqlite_failure(13)), None); // SQLITE_FULL
        assert_eq!(damage_of(&rusqlite::Error::QueryReturnedNoRows), None);

        // A title that is not UTF-8, as SQLite returns it.
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO snippets (title, content, created_at, updated_at) VALUES (CAST(X'41FF4243' AS TEXT), X'00', 'a', 'b')",
            [],
        )
        .unwrap();
        let err = get_snippet_by_id(&conn, 1).err().expect("the title is not UTF-8");
        assert_eq!(damage_of(&err), Some(Damage::Snippet), "{err}");
    }

    #[test]
    fn test_copy_readable_snippets_copies_a_healthy_database_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 20);
        {
            let conn = open_and_init_db(&path).unwrap();
            // An encrypted snippet keeps its bytes, also those that are not UTF-8.
            create_snippet(&conn, "Encrypted one", vec![0x76, 0x32, 0x3A, 0xFF, 0x00, 0x80], true).unwrap();
            touch_last_used(&conn, 3).unwrap();
            delete_snippet(&conn, 7).unwrap();
        }
        let src = open_and_init_db(&path).unwrap();
        let dst_path = dir.path().join("copy.db");

        let rescue = copy_readable_snippets(&src, &dst_path).unwrap();

        assert_eq!(rescue, Rescue { saved: 20, lost_titles: vec![], lost_untitled: 0 });
        let dst = open_and_init_db(&dst_path).unwrap();
        assert_eq!(all_rows(&dst), all_rows(&src), "every value byte for byte");
        assert_eq!(check_health(&dst), Health::Healthy);
        let version: i32 = dst.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        assert_eq!(version, 1);
        // New snippets come after every id the old database used.
        let id = create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap();
        assert_eq!(id, 22);
    }

    #[test]
    fn test_copy_readable_snippets_loses_only_the_damaged_page_and_names_its_snippets() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        assert!(!unreadable.is_empty());
        let before = std::fs::read(&path).unwrap();
        let src = open_and_init_db(&path).unwrap();
        let dst_path = dir.path().join("copy.db");

        let rescue = copy_readable_snippets(&src, &dst_path).unwrap();

        assert_eq!(rescue.saved as i64, COUNT - unreadable.len() as i64);
        let expected: Vec<String> = unreadable.iter().map(|&i| title_of(i)).collect();
        assert_eq!(rescue.lost_titles, expected);
        assert_eq!(rescue.lost_untitled, 0);
        let dst = open_and_init_db(&dst_path).unwrap();
        let listing = list_snippets_sorted(&dst, "alphabetical", "asc");
        assert!(!listing.damaged);
        assert_eq!(listing.rows.len(), rescue.saved);
        assert_eq!(get_snippet_by_id(&dst, 1).unwrap().content, content_of(1).into_bytes());
        drop(src);
        assert_eq!(std::fs::read(&path).unwrap(), before, "the damaged file must stay as it was");
    }

    /// When the newest snippets are lost, new ones still get ids after theirs, and the id counter
    /// keeps one row.
    #[test]
    fn test_copy_readable_snippets_keeps_counting_after_lost_snippets() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, *pages_of(&path, "snippets", "leaf").last().unwrap());
        let src = open_and_init_db(&path).unwrap();
        assert!(get_snippet_by_id(&src, COUNT).is_err(), "the newest snippet is lost");

        let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();
        assert!(rescue.lost() > 0);

        let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
        let counters: i64 = dst
            .query_row("SELECT COUNT(*) FROM sqlite_sequence WHERE name = 'snippets'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(counters, 1);
        assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), COUNT + 1);

        // Nothing could be copied: the counter row is added.
        let empty = Connection::open_in_memory().unwrap();
        init_db(&empty).unwrap();
        let dst2 = dir.path().join("copy2.db");
        copy_readable_snippets(&empty, &dst2).unwrap();
        let dst2 = open_and_init_db(&dst2).unwrap();
        assert_eq!(create_snippet(&dst2, "First one", b"x".to_vec(), false).unwrap(), 1);
    }

    /// With the table's root page damaged no snippet can be read, but the title index still names
    /// every one.
    #[test]
    fn test_copy_readable_snippets_with_a_damaged_root_page_names_every_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, pages_of(&path, "snippets", "internal")[0]);
        let src = open_and_init_db(&path).unwrap();

        let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();

        assert_eq!(rescue.saved, 0);
        assert_eq!(rescue.lost_titles, (1..=COUNT).map(title_of).collect::<Vec<_>>());
    }

    #[test]
    fn test_copy_readable_snippets_with_a_damaged_index_saves_every_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, pages_of(&path, "idx_snippets_updated_at", "leaf")[0]);
        let src = open_and_init_db(&path).unwrap();
        assert!(list_snippets_sorted(&src, "modified", "desc").rows.is_empty());

        let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();

        assert_eq!(rescue.saved as i64, COUNT);
        assert_eq!(rescue.lost(), 0);
        let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
        let listing = list_snippets_sorted(&dst, "modified", "desc");
        assert_eq!(listing.rows.len() as i64, COUNT, "the index is built anew");
        assert!(!listing.damaged);
    }

    /// A title or a plain text that is no longer UTF-8 is repaired in the copy, so that the snippet
    /// is listed and can be opened; the damaged file keeps its bytes.
    #[test]
    fn test_copy_readable_snippets_repairs_text_that_is_not_utf8_in_the_copy() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        overwrite_after(&path, title_of(41).as_bytes(), Some(&leaves), 2, &[0xFF, 0xFE]);
        overwrite_after(&path, content_of(40).as_bytes(), None, 10, &[0xFF, 0xFF]);
        // Some structural damage too, so that the start-up would offer the rescue.
        damage_page(&path, pages_of(&path, "idx_snippets_updated_at", "leaf")[0]);
        let src = open_and_init_db(&path).unwrap();

        let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();

        assert_eq!(rescue.saved as i64, COUNT);
        let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
        let title = get_snippet_by_id(&dst, 41).unwrap().title;
        assert!(title.contains('\u{FFFD}') && title.ends_with("1 тест"), "{title}");
        let text = String::from_utf8(get_snippet_by_id(&dst, 40).unwrap().content).expect("UTF-8 now");
        assert!(text.contains('\u{FFFD}'), "{text}");
        assert_eq!(list_snippets_sorted(&dst, "modified", "desc").rows.len() as i64, COUNT);
    }

    // --- garbage ids from a damaged sector (TASK-43) ---

    /// The id a scan of the table returns from a cell that starts in a sector of 0xA5.
    const GARBAGE_A5: i64 = 5374248273442940325;

    /// The ids `sql` returns, as far as SQLite goes.
    fn scan_ids(conn: &Connection, sql: &str) -> Vec<i64> {
        let mut stmt = conn.prepare(sql).unwrap();
        let mut rows = stmt.query([]).unwrap();
        let mut ids = vec![];
        while let Ok(Some(row)) = rows.next() {
            ids.push(row.get(0).unwrap());
        }
        ids
    }

    /// Runs [`copy_readable_snippets`] from the database at `src` into `dst` in a thread of its own
    /// and waits at most `limit`, so that a rescue that does not end fails its test instead of
    /// hanging the whole test run (the tests run one at a time). Such a thread stays busy until
    /// the test run ends.
    fn copy_within(src: &Path, dst: &Path, limit: Duration) -> std::result::Result<Rescue, String> {
        let (tx, rx) = std::sync::mpsc::channel();
        let (src, dst) = (src.to_path_buf(), dst.to_path_buf());
        let started = Instant::now();
        std::thread::spawn(move || {
            let result = open_and_init_db(&src).and_then(|conn| copy_readable_snippets(&conn, &dst));
            tx.send(result.map_err(|e| e.to_string())).ok();
        });
        rx.recv_timeout(limit)
            .map_err(|_| format!("the rescue had not ended after {:?}", started.elapsed()))?
    }

    /// The snippets of the damaged file that the app itself can read: id, title, text.
    fn readable_snippets(path: &Path) -> Vec<(i64, String, Vec<u8>)> {
        let conn = open_and_init_db(path).unwrap();
        (1..=COUNT)
            .filter_map(|id| get_snippet_by_id(&conn, id).ok())
            .map(|row| (row.id, row.title, row.content))
            .collect()
    }

    /// A sector of 0xA5 in a page of snippets gives a scan of the table the id
    /// 5374248273442940325. Up to TASK-43 the rescue then read every id up to it: the start-up hung
    /// before any dialog, at every start. Now it ends at once, saves every snippet that can be read,
    /// and the garbage id is no snippet in the dialog.
    #[test]
    fn test_copy_readable_snippets_ends_quickly_after_a_garbage_id() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        damage_sector(&path, leaves[leaves.len() / 2], 1, 0xA5);
        {
            let conn = open_and_init_db(&path).unwrap();
            let ids = scan_ids(&conn, "SELECT id FROM snippets NOT INDEXED ORDER BY id");
            assert!(ids.contains(&GARBAGE_A5), "the scan returns the garbage id: {ids:?}");
        }
        let readable = readable_snippets(&path);
        assert!(!readable.is_empty() && (readable.len() as i64) < COUNT, "{}", readable.len());
        let before = std::fs::read(&path).unwrap();
        let dst_path = dir.path().join("copy.db");

        let rescue = copy_within(&path, &dst_path, Duration::from_secs(1)).unwrap();

        let dst = open_and_init_db(&dst_path).unwrap();
        for (id, title, content) in &readable {
            let row = get_snippet_by_id(&dst, *id).unwrap_or_else(|e| panic!("snippet {id}: {e}"));
            assert_eq!(&row.title, title);
            assert_eq!(row.content, String::from_utf8_lossy(content).into_owned().into_bytes());
        }
        let copied: Vec<i64> = all_rows(&dst).iter().map(|r| r.0).collect();
        assert_eq!(rescue.saved, copied.len());
        let lost: Vec<String> = (1..=COUNT).filter(|id| !copied.contains(id)).map(title_of).collect();
        assert!(!lost.is_empty());
        assert_eq!(rescue.lost_titles, lost, "the lost snippets, named by the title index");
        assert_eq!(rescue.lost_untitled, 0, "the garbage id is no lost snippet");
        assert_eq!(rescue.total() as i64, COUNT);
        assert_eq!(std::fs::read(&path).unwrap(), before, "the damaged file must stay as it was");
    }

    /// New snippets in the rescued database get the ids after the real ones, not after a garbage
    /// id: ids above 2^53 would not even reach the window intact (JavaScript numbers).
    #[test]
    fn test_copy_readable_snippets_counter_continues_after_the_real_ids() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        damage_sector(&path, leaves[leaves.len() / 2], 1, 0xA5);
        let dst_path = dir.path().join("copy.db");

        copy_within(&path, &dst_path, Duration::from_secs(1)).unwrap();

        let dst = open_and_init_db(&dst_path).unwrap();
        let counter: Vec<i64> = scan_ids(&dst, "SELECT seq FROM sqlite_sequence WHERE name = 'snippets'");
        assert_eq!(counter, vec![COUNT]);
        assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), COUNT + 1);
    }

    /// A sector of 0x7F in the modification date index gives its scan the id 127, a little above
    /// the real ones, while every snippet can be read. Up to TASK-43 the dialog counted it as a
    /// lost snippet (91 in the database, one unreadable), and the new counter went on from 127.
    #[test]
    fn test_copy_readable_snippets_does_not_count_a_garbage_id_as_lost() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_sector(&path, pages_of(&path, "idx_snippets_updated_at", "leaf")[0], 4, 0x7F);
        {
            let conn = open_and_init_db(&path).unwrap();
            let ids = scan_ids(&conn, "SELECT id FROM snippets INDEXED BY idx_snippets_updated_at");
            assert!(ids.contains(&127), "the index scan returns the garbage id: {ids:?}");
            assert!(matches!(check_health(&conn), Health::Damaged(_)));
        }
        let dst_path = dir.path().join("copy.db");

        let rescue = copy_within(&path, &dst_path, Duration::from_secs(1)).unwrap();

        assert_eq!(rescue, Rescue { saved: COUNT as usize, lost_titles: vec![], lost_untitled: 0 });
        let dst = open_and_init_db(&dst_path).unwrap();
        assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), COUNT + 1);
    }

    #[test]
    fn test_snippet_ceiling() {
        let none = std::iter::empty::<i64>;
        // The counter agrees with what could be read: it is the ceiling.
        assert_eq!(snippet_ceiling(90, Some(90), none()), 90);
        assert_eq!(snippet_ceiling(84, Some(90), none()), 90, "the newest snippets are lost");
        assert_eq!(snippet_ceiling(0, Some(90), none()), 90, "no snippet could be read");
        assert_eq!(snippet_ceiling(90, Some(90 + ID_MARGIN), none()), 90 + ID_MARGIN);
        assert_eq!(snippet_ceiling(90, Some(90), [95].into_iter()), 90, "the counter decides");
        // A counter below what could be read, or far above it, is damaged too.
        assert_eq!(snippet_ceiling(90, Some(50), none()), 90);
        assert_eq!(snippet_ceiling(90, Some(-1), none()), 90);
        assert_eq!(snippet_ceiling(90, Some(91 + ID_MARGIN), none()), 90);
        assert_eq!(snippet_ceiling(90, Some(GARBAGE_A5), none()), 90);
        // Without a counter, the ids the title index names count up to ID_MARGIN above.
        assert_eq!(snippet_ceiling(84, None, [3, 90, 84].into_iter()), 90);
        assert_eq!(snippet_ceiling(84, None, [85 + ID_MARGIN, GARBAGE_A5].into_iter()), 84);
        assert_eq!(snippet_ceiling(0, None, none()), 0, "an empty database");
        // Never above the ids the window can hold.
        assert_eq!(snippet_ceiling(MAX_SNIPPET_ID, Some(MAX_SNIPPET_ID), none()), MAX_SNIPPET_ID);
        assert_eq!(snippet_ceiling(MAX_SNIPPET_ID - 5, None, [MAX_SNIPPET_ID + 1].into_iter()), MAX_SNIPPET_ID - 5);
    }

    /// With the id counter damaged as well, the title index still names the newest snippets that
    /// are lost, and new ids come after theirs.
    #[test]
    fn test_copy_readable_snippets_with_a_damaged_counter_names_the_lost_newest_snippets() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_page(&path, *pages_of(&path, "snippets", "leaf").last().unwrap());
        damage_page(&path, pages_of(&path, "sqlite_sequence", "leaf")[0]);
        let src = open_and_init_db(&path).unwrap();
        let counter = src.query_row("SELECT seq FROM sqlite_sequence", [], |r| r.get::<_, i64>(0));
        assert!(counter.is_err(), "the counter cannot be read: {counter:?}");
        let unreadable: Vec<i64> = (1..=COUNT).filter(|&id| get_snippet_by_id(&src, id).is_err()).collect();
        assert!(unreadable.contains(&COUNT), "the newest snippet is lost");

        let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();

        assert_eq!(rescue.lost_titles, unreadable.iter().map(|&i| title_of(i)).collect::<Vec<_>>());
        assert_eq!(rescue.total() as i64, COUNT);
        let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
        assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), COUNT + 1);
    }

    /// A counter that agrees with the ids that can be read is kept: the ids of the snippets
    /// deleted last are not given again. One more than ID_MARGIN above them is damage: it is
    /// neither followed nor written into the new database.
    #[test]
    fn test_copy_readable_snippets_trusts_the_counter_only_near_the_real_ids() {
        for (seq, next) in [(25, 26), (20 + ID_MARGIN, 21 + ID_MARGIN), (21 + ID_MARGIN, 21), (1_000_000_000_000, 21)] {
            let dir = tempfile::tempdir().unwrap();
            let path = build_db(dir.path(), 20);
            let src = open_and_init_db(&path).unwrap();
            src.execute("UPDATE sqlite_sequence SET seq = ?1 WHERE name = 'snippets'", [seq]).unwrap();

            let rescue = copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();

            assert_eq!(rescue, Rescue { saved: 20, lost_titles: vec![], lost_untitled: 0 }, "{seq}");
            let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
            assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), next, "{seq}");
        }
    }

    /// A snippet with an id the window cannot hold is not one QuickSnippets made: it is neither
    /// copied nor counted, and new ids stay small. One with a huge id the window can hold is copied,
    /// but the ids that no one named are then tried only up to MAX_TRIED_IDS (here 1.7 s, with the
    /// SQLite of the tests built without optimization; about 0.4 s in the release build).
    #[test]
    fn test_copy_readable_snippets_with_huge_ids_ends_quickly() {
        let insert = "INSERT INTO snippets (id, title, content, created_at, updated_at)
                      VALUES (?1, 'Huge id', X'00', 'a', 'b')";
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 5);
        open_and_init_db(&path).unwrap().execute(insert, [MAX_SNIPPET_ID + 1]).unwrap();

        let rescue = copy_within(&path, &dir.path().join("copy.db"), Duration::from_secs(1)).unwrap();

        assert_eq!(rescue, Rescue { saved: 5, lost_titles: vec![], lost_untitled: 0 });
        let dst = open_and_init_db(&dir.path().join("copy.db")).unwrap();
        assert_eq!(create_snippet(&dst, "New one", b"x".to_vec(), false).unwrap(), 6);

        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 5);
        open_and_init_db(&path).unwrap().execute(insert, [1_000_000_000_000_i64]).unwrap();

        let rescue = copy_within(&path, &dir.path().join("copy.db"), Duration::from_secs(15)).unwrap();

        assert_eq!(rescue, Rescue { saved: 6, lost_titles: vec![], lost_untitled: 0 });
    }

    /// The rescue reads every snippet inside one read transaction (each read outside one takes
    /// and releases the lock of the file: about 30 times slower) and ends it, since after No the
    /// app goes on with the same connection. A transaction the caller began stays open.
    #[test]
    fn test_copy_readable_snippets_reads_in_a_transaction_and_ends_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 5);
        let src = open_and_init_db(&path).unwrap();

        let mut inside = Vec::new();
        read_snippets_one_by_one(&src, &mut |_, _| {
            inside.push(!src.is_autocommit());
            true
        });
        assert_eq!(inside, vec![true; 5]);
        assert!(src.is_autocommit(), "no transaction is left open");

        copy_readable_snippets(&src, &dir.path().join("copy.db")).unwrap();
        assert!(src.is_autocommit(), "no transaction is left open");

        src.execute_batch("BEGIN").unwrap();
        copy_readable_snippets(&src, &dir.path().join("copy2.db")).unwrap();
        assert!(!src.is_autocommit(), "the caller's transaction is still open");
        src.execute_batch("COMMIT").unwrap();
    }

    // --- dates that damage overwrote (TASK-45) ---

    /// The dates of a snippet: creation, change, last use.
    type Dates = (Option<String>, Option<String>, Option<String>);

    /// The dates of every snippet the rescue can read from the database at `path`, as it reads them
    /// (bytes that are no longer UTF-8 as U+FFFD).
    fn rescued_dates(path: &Path) -> BTreeMap<i64, Dates> {
        let conn = open_and_init_db(path).unwrap();
        let mut dates = BTreeMap::new();
        read_snippets_one_by_one(&conn, &mut |id, row| {
            dates.insert(id, (row.created_at, row.updated_at, row.last_used_at));
            true
        });
        dates
    }

    /// The dates of every snippet of a database.
    fn dates_of(conn: &Connection) -> BTreeMap<i64, Dates> {
        all_rows(conn).into_iter().map(|r| (r.0, (Some(r.4), Some(r.5), r.6))).collect()
    }

    /// The ids of a list in the order the window shows it.
    fn order_of(conn: &Connection, mode: &str, direction: &str) -> Vec<i64> {
        list_snippets_sorted(conn, mode, direction).rows.iter().map(|r| r.0).collect()
    }

    /// `is_app_date` agrees with SQLite itself, which writes every date of the app: a value is such a
    /// date when strftime gives it back unchanged.
    #[test]
    fn test_is_app_date_agrees_with_sqlite() {
        let conn = Connection::open_in_memory().unwrap();
        let sqlite_says = |value: &str| -> bool {
            conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%f', ?1) IS ?1", params![value], |r| r.get(0))
                .unwrap()
        };
        let now: String = conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now')", [], |r| r.get(0)).unwrap();
        let dates = [
            now.as_str(),
            "2026-11-21T10:13:05.123",
            "2026-04-30T23:59:59.999",
            "2024-02-29T00:00:00.000",
            "2000-02-29T12:00:00.500",
            "0000-01-01T00:00:00.000",
            "9999-12-31T23:59:59.999",
            // Damage that turned the year 2026 into 9926 still leaves a date, in the future.
            "9926-11-07T10:00:00.000",
        ];
        let filled = |piece: &str| piece.repeat(23);
        let not_dates = [
            String::new(),
            filled("\u{FFFD}"),
            filled("\0"),
            filled("p"),
            filled("0"),
            filled("9"),
            filled(" "),
            filled("\u{7F}"),
            format!("2026-11-07T1{}", "\0".repeat(11)),
            "2026-11-07T100000000000".into(),
            "2023-02-29T00:00:00.000".into(),
            "2100-02-29T00:00:00.000".into(),
            "2026-04-31T00:00:00.000".into(),
            "2026-00-10T00:00:00.000".into(),
            "2026-13-10T00:00:00.000".into(),
            "2026-01-00T00:00:00.000".into(),
            "2026-01-32T00:00:00.000".into(),
            "2026-11-21T23:60:00.000".into(),
            "2026-11-21T23:59:60.000".into(),
            "2026-11-21 10:13:05.123".into(),
            "2026-11-21T10:13:05.123Z".into(),
            "2026-11-21T10:13:05.12".into(),
            "2026-11-21T10:13:05.1234".into(),
            "2026-11-21T10:13:05".into(),
            "2026-11-21".into(),
            "+026-11-21T10:13:05.123".into(),
            "2026-11-21T10:13:05.12\u{FFFD}".into(),
            "\u{FF12}\u{FF10}\u{FF12}\u{FF16}-11-21T10:13:05.123".into(),
            "1732012345".into(),
        ];
        for value in dates {
            assert!(is_app_date(value), "{value:?}");
            assert!(sqlite_says(value), "{value:?}");
        }
        for value in &not_dates {
            assert!(!is_app_date(value), "{value:?}");
            assert!(!sqlite_says(value), "{value:?}");
        }
        // SQLite gives the hour 24 back as it is, but the app never writes it: only damage does.
        assert!(sqlite_says("2026-11-21T24:00:00.000"));
        assert!(!is_app_date("2026-11-21T24:00:00.000"));
    }

    /// TASK-43's test database, a sector of 0xA5 in the middle page of snippets, still gives snippet
    /// 056 with its title, but its text and both dates are U+FFFD. The copy kept those dates up to
    /// TASK-45, and U+FFFD sorts above every date: after Yes the snippet came first by date of change,
    /// the default order, and by date of creation. Now both get the oldest intact date of the new
    /// database: the snippet is last in these lists, and every other date stays as it was.
    #[test]
    fn test_copy_readable_snippets_gives_overwritten_dates_the_oldest_date() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        damage_sector(&path, leaves[leaves.len() / 2], 1, 0xA5);
        let read = rescued_dates(&path);
        let is_date = |d: &Option<String>| d.as_deref().is_some_and(is_app_date);
        let overwritten: Vec<i64> =
            read.iter().filter(|(_, (c, u, _))| !is_date(c) || !is_date(u)).map(|(&id, _)| id).collect();
        assert_eq!(overwritten, vec![56], "the sector covers the dates of snippet 056");
        assert!(read[&56].0.as_deref().is_some_and(|d| d.starts_with('\u{FFFD}')), "{:?}", read[&56]);
        let oldest = read
            .iter()
            .filter(|(id, _)| **id != 56)
            .flat_map(|(_, (c, u, _))| [c.clone(), u.clone()])
            .min()
            .flatten();
        assert!(oldest.as_deref().is_some_and(is_app_date), "{oldest:?}");
        let dst_path = dir.path().join("copy.db");

        copy_within(&path, &dst_path, Duration::from_secs(1)).unwrap();

        let dst = open_and_init_db(&dst_path).unwrap();
        let mut expected = read.clone();
        expected.insert(56, (oldest.clone(), oldest.clone(), None));
        assert_eq!(dates_of(&dst), expected, "056 gets the oldest date; every other date byte for byte");
        let by_change = order_of(&dst, "modified", "desc");
        assert_eq!(by_change.first(), Some(&COUNT), "the newest snippet comes first again");
        assert_eq!(by_change.last(), Some(&56));
        assert_eq!(order_of(&dst, "modified", "asc").first(), Some(&56));
        // 056 now shares its date of creation with the oldest snippet: equal dates may come either way.
        let by_creation = order_of(&dst, "created", "desc");
        assert!(by_creation[by_creation.len() - 2..].contains(&56), "{by_creation:?}");
        let search: Vec<i64> = list_snippets_for_search(&dst).rows.iter().map(|r| r.0).collect();
        assert_eq!(search.last(), Some(&56), "equally good search matches keep the order by date of change");
    }

    /// Damage of a few bytes can hit a single date. A damaged date of creation or change gets the
    /// oldest intact date, a damaged date of last use is left empty, as for a snippet never used; the
    /// snippet's other dates, and the dates of every other snippet, stay as they were. A value that is
    /// still a date in the app's format stays as it is, even one that damage moved into the future.
    #[test]
    fn test_copy_readable_snippets_fills_each_overwritten_date_on_its_own() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        Connection::open(&path)
            .unwrap()
            .execute_batch(
                "UPDATE snippets SET last_used_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '-' || (5000 - id) || ' minutes')
                 WHERE id IN (45, 47, 60)",
            )
            .unwrap();
        let before = rescued_dates(&path);
        let text = |date: &Option<String>| date.clone().unwrap().into_bytes();
        let leaves = pages_of(&path, "snippets", "leaf");
        overwrite_after(&path, &text(&before[&45].0), Some(&leaves), 0, &[0xA5; 23]);
        overwrite_after(&path, &text(&before[&46].1), Some(&leaves), 0, &[0; 23]);
        overwrite_after(&path, &text(&before[&47].2), Some(&leaves), 0, &[b'p'; 23]);
        overwrite_after(&path, &text(&before[&60].0), Some(&leaves), 0, b"99");
        let src = open_and_init_db(&path).unwrap();
        let dst_path = dir.path().join("copy.db");

        copy_readable_snippets(&src, &dst_path).unwrap();

        let dst = open_and_init_db(&dst_path).unwrap();
        // build_db gives the oldest date to the creation of snippet 001.
        let oldest = before[&1].0.clone();
        let mut expected = before.clone();
        expected.get_mut(&45).unwrap().0 = oldest.clone();
        expected.get_mut(&46).unwrap().1 = oldest;
        expected.get_mut(&47).unwrap().2 = None;
        let future = format!("99{}", &before[&60].0.as_deref().unwrap()[2..]);
        assert!(is_app_date(&future), "{future}");
        expected.get_mut(&60).unwrap().0 = Some(future);
        assert_eq!(dates_of(&dst), expected);
        assert_eq!(order_of(&dst, "modified", "desc").last(), Some(&46));
    }

    /// A date of creation or change that comes out of the damaged database empty (NULL: damage can
    /// change what a row says about its values) is filled like an overwritten one. Up to TASK-45 the
    /// rescue gave it the snippet's other date, or, when both were empty, the time of the rescue, and
    /// the snippet became the newest one. Only with no intact date in the whole database is the time
    /// of the rescue all there is.
    #[test]
    fn test_copy_readable_snippets_fills_empty_dates_like_overwritten_ones() {
        let dir = tempfile::tempdir().unwrap();
        // The app's table without NOT NULL, so that the test can store what damage can leave.
        let table = "CREATE TABLE snippets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content BLOB,
                         is_encrypted INTEGER, created_at TEXT, updated_at TEXT, last_used_at TEXT);
                     CREATE INDEX idx_snippets_updated_at ON snippets (updated_at DESC);
                     CREATE UNIQUE INDEX idx_snippets_title ON snippets (title);";
        let src = Connection::open_in_memory().unwrap();
        src.execute_batch(&format!(
            "{table}
             INSERT INTO snippets VALUES
                 (1, 'First', X'61', 0, '2026-01-01T10:00:00.000', '2026-01-05T10:00:00.000', NULL),
                 (2, 'Second', X'62', 0, NULL, NULL, NULL),
                 (3, 'Third', X'63', 0, NULL, '2026-03-01T10:00:00.000', '2026-03-02T10:00:00.000'),
                 (4, 'Fourth', X'64', 0, '2026-02-01T10:00:00.000', NULL, NULL);"
        ))
        .unwrap();
        let dst_path = dir.path().join("copy.db");

        copy_readable_snippets(&src, &dst_path).unwrap();

        let dst = open_and_init_db(&dst_path).unwrap();
        let date = |d: &str| Some(d.to_string());
        let oldest = date("2026-01-01T10:00:00.000");
        assert_eq!(
            dates_of(&dst),
            BTreeMap::from([
                (1, (oldest.clone(), date("2026-01-05T10:00:00.000"), None)),
                (2, (oldest.clone(), oldest.clone(), None)),
                (3, (oldest.clone(), date("2026-03-01T10:00:00.000"), date("2026-03-02T10:00:00.000"))),
                (4, (date("2026-02-01T10:00:00.000"), oldest, None)),
            ])
        );
        assert_eq!(order_of(&dst, "modified", "desc"), vec![3, 1, 2, 4]);

        // No intact date in the whole database: the time of the rescue.
        let src = Connection::open_in_memory().unwrap();
        src.execute_batch(&format!(
            "{table} INSERT INTO snippets VALUES (1, 'Only one', X'61', 0, NULL, 'not a date', NULL);"
        ))
        .unwrap();
        let now = || -> String {
            src.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now')", [], |r| r.get(0)).unwrap()
        };
        let started = now();
        let dst_path = dir.path().join("copy2.db");
        copy_readable_snippets(&src, &dst_path).unwrap();
        let ended = now();
        let (created, updated, used) = dates_of(&open_and_init_db(&dst_path).unwrap())[&1].clone();
        assert_eq!(created, updated);
        let created = created.unwrap();
        assert!(is_app_date(&created) && started <= created && created <= ended, "{started} {created} {ended}");
        assert_eq!(used, None);
    }

    /// The whole start-up path with TASK-43's database and Yes: the list by date of change, newest
    /// first, the default order, starts with the newest snippet again and ends with snippet 056,
    /// whose dates the sector overwrote. Up to TASK-45 056 came first.
    #[test]
    fn test_rescue_if_damaged_yes_puts_a_snippet_with_overwritten_dates_last() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        damage_sector(&path, leaves[leaves.len() / 2], 1, 0xA5);
        let (tx, rx) = std::sync::mpsc::channel();
        let db_path = path.clone();
        std::thread::spawn(move || {
            let conn = open_and_init_db(&db_path).unwrap();
            let mut asked = Vec::new();
            let outcome = rescue_if_damaged(&db_path, conn, STAMP, &mut |d| {
                asked.push(d.clone());
                true
            });
            tx.send((asked, matches!(outcome, RescueOutcome::Reopen))).ok();
        });
        let (asked, reopened) = rx.recv_timeout(Duration::from_secs(1)).expect("the rescue ends within a second");

        let [RescueDialog::Offer { rescue, .. }] = asked.as_slice() else { panic!("{asked:?}") };
        assert!(reopened, "Yes opens the new database");
        let conn = open_and_init_db(&path).unwrap();
        assert_eq!(check_health(&conn), Health::Healthy);
        let by_change = order_of(&conn, "modified", "desc");
        assert_eq!(by_change.len(), rescue.saved);
        assert_eq!(by_change.first(), Some(&COUNT));
        assert_eq!(by_change.last(), Some(&56));
    }

    /// The rescue's own new file sits next to the damaged database.
    fn rescue_path(dir: &Path) -> PathBuf {
        dir.join(RESCUE_FILE_NAME)
    }

    #[test]
    fn test_rescue_if_damaged_asks_nothing_for_a_healthy_database() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), 5);
        let conn = open_and_init_db(&path).unwrap();
        let mut asked = Vec::new();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |d| {
            asked.push(d.clone());
            true
        });

        assert!(matches!(outcome, RescueOutcome::Keep(_)));
        assert!(asked.is_empty(), "{asked:?}");
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
    }

    /// No keeps working with the damaged file: nothing renamed, nothing changed, no file left.
    #[test]
    fn test_rescue_if_damaged_no_keeps_the_damaged_file_as_it_is() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        let before = std::fs::read(&path).unwrap();
        let conn = open_and_init_db(&path).unwrap();
        let mut asked = Vec::new();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |d| {
            asked.push(d.clone());
            false
        });

        let RescueOutcome::Keep(conn) = outcome else { panic!("No must keep the connection") };
        assert_eq!(
            asked,
            vec![RescueDialog::Offer {
                rescue: Rescue {
                    saved: (COUNT as usize) - unreadable.len(),
                    lost_titles: unreadable.iter().map(|&i| title_of(i)).collect(),
                    lost_untitled: 0,
                },
                kept_name: "snippets-damaged-2026-11-20-14-35.db".to_string(),
            }]
        );
        assert!(get_snippet_by_id(&conn, 1).is_ok(), "the app works with the damaged file");
        drop(conn);
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    /// Yes: the damaged file stays next to the new database under the name the dialog showed,
    /// byte for byte, and the new database holds every snippet that could be read.
    #[test]
    fn test_rescue_if_damaged_yes_moves_the_readable_snippets_and_keeps_the_damaged_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        let damaged = std::fs::read(&path).unwrap();
        let conn = open_and_init_db(&path).unwrap();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |_| true);

        assert!(matches!(outcome, RescueOutcome::Reopen));
        assert_eq!(
            file_names(dir.path()),
            vec!["snippets-damaged-2026-11-20-14-35.db", "snippets.db"]
        );
        assert_eq!(
            std::fs::read(dir.path().join("snippets-damaged-2026-11-20-14-35.db")).unwrap(),
            damaged,
            "the damaged file must be kept unchanged"
        );
        let conn = open_and_init_db(&path).unwrap();
        assert_eq!(check_health(&conn), Health::Healthy);
        assert_eq!(snippet_count(&conn), COUNT - unreadable.len() as i64);
        for id in unreadable {
            assert!(get_snippet_by_id(&conn, id).is_err());
        }
    }

    /// The whole start-up path with a sector of 0xA5 in a page of snippets (TASK-43): the dialog
    /// comes at once and counts only real snippets. No keeps working with the damaged file, which
    /// stays as it was; Yes moves the readable snippets into a new database and keeps the damaged
    /// file next to it.
    #[test]
    fn test_rescue_if_damaged_with_a_garbage_id_asks_at_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let leaves = pages_of(&path, "snippets", "leaf");
        damage_sector(&path, leaves[leaves.len() / 2], 1, 0xA5);
        let damaged = std::fs::read(&path).unwrap();
        let readable = readable_snippets(&path).len();

        for answer in [false, true] {
            let (tx, rx) = std::sync::mpsc::channel();
            let db_path = path.clone();
            std::thread::spawn(move || {
                let conn = open_and_init_db(&db_path).unwrap();
                let mut asked = Vec::new();
                let outcome = rescue_if_damaged(&db_path, conn, STAMP, &mut |d| {
                    asked.push(d.clone());
                    answer
                });
                let kept = match outcome {
                    RescueOutcome::Keep(conn) => Some(conn.is_autocommit() && get_snippet_by_id(&conn, 1).is_ok()),
                    RescueOutcome::Reopen => None,
                };
                tx.send((asked, kept)).ok();
            });
            let (asked, kept) = rx.recv_timeout(Duration::from_secs(1)).expect("the dialog comes within a second");

            let [RescueDialog::Offer { rescue, kept_name }] = asked.as_slice() else { panic!("{asked:?}") };
            assert!(rescue.saved >= readable, "{} < {readable}", rescue.saved);
            assert_eq!(rescue.lost_untitled, 0);
            assert_eq!(rescue.total() as i64, COUNT);
            assert_eq!(kept_name, "snippets-damaged-2026-11-20-14-35.db");
            if !answer {
                assert_eq!(kept, Some(true), "No goes on with the damaged file");
                assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
                assert_eq!(std::fs::read(&path).unwrap(), damaged);
                continue;
            }
            assert_eq!(kept, None, "Yes opens the new database");
            assert_eq!(file_names(dir.path()), vec![kept_name.as_str(), "snippets.db"]);
            assert_eq!(std::fs::read(dir.path().join(kept_name)).unwrap(), damaged);
            let conn = open_and_init_db(&path).unwrap();
            assert_eq!(check_health(&conn), Health::Healthy);
            assert_eq!(snippet_count(&conn), rescue.saved as i64);
            assert_eq!(create_snippet(&conn, "New one", b"x".to_vec(), false).unwrap(), COUNT + 1);
        }
    }

    /// The damaged file cannot be renamed: the user is told so, nothing changes, and No keeps
    /// working with the damaged file.
    #[cfg(windows)]
    #[test]
    fn test_rescue_if_damaged_rename_failure_changes_nothing() {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_SHARE_READ: u32 = 0x1;
        const FILE_SHARE_WRITE: u32 = 0x2;
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_middle_leaf(&path, COUNT);
        let before = std::fs::read(&path).unwrap();
        let conn = open_and_init_db(&path).unwrap();
        // SQLite can still read and write the file, but it cannot be renamed.
        let holder = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .open(&path)
            .unwrap();
        let mut asked = Vec::new();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |d| {
            asked.push(d.clone());
            matches!(d, RescueDialog::Offer { .. })
        });
        drop(holder);

        assert!(matches!(outcome, RescueOutcome::Keep(_)));
        assert_eq!(asked.len(), 2, "{asked:?}");
        assert!(matches!(asked[1], RescueDialog::Failed(RescueFailure::KeepFailed(_))), "{asked:?}");
        drop(outcome);
        assert_eq!(file_names(dir.path()), vec!["snippets.db"]);
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    /// The new database cannot be written (here a folder has its name): the user is told so,
    /// nothing changes, and the folder is not touched.
    #[test]
    fn test_rescue_if_damaged_copy_failure_changes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        damage_middle_leaf(&path, COUNT);
        let before = std::fs::read(&path).unwrap();
        std::fs::create_dir(rescue_path(dir.path())).unwrap();
        let conn = open_and_init_db(&path).unwrap();
        let mut asked = Vec::new();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |d| {
            asked.push(d.clone());
            false
        });

        assert!(matches!(outcome, RescueOutcome::Keep(_)));
        assert!(matches!(asked[..], [RescueDialog::Failed(RescueFailure::CopyFailed(_))]), "{asked:?}");
        drop(outcome);
        assert!(rescue_path(dir.path()).is_dir(), "a folder of that name stays");
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }

    /// A file left by an interrupted rescue is written over, never used as it is.
    #[test]
    fn test_rescue_if_damaged_replaces_a_leftover_rescue_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = build_db(dir.path(), COUNT);
        let unreadable = damage_middle_leaf(&path, COUNT);
        std::fs::write(rescue_path(dir.path()), GARBAGE).unwrap();
        let conn = open_and_init_db(&path).unwrap();

        let outcome = rescue_if_damaged(&path, conn, STAMP, &mut |_| true);

        assert!(matches!(outcome, RescueOutcome::Reopen));
        assert!(!rescue_path(dir.path()).exists());
        let conn = open_and_init_db(&path).unwrap();
        assert_eq!(snippet_count(&conn), COUNT - unreadable.len() as i64);
    }
}
