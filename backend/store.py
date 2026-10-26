"""Local SQLite storage, organized by conference.

A **conference** is the main bucket. Each conference has its own saved searches, shortlist, Keynote group
and panels. data/scout.db is created on first run and is git-ignored. "Start over" clears everything.

Older databases (from before conferences existed) are upgraded in place: everything is put in a
"General" conference, nothing is lost.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import config
from models import CATEGORY_LABELS, SearchBrief, SearchResult, SpeakerCard

DB_PATH = config.DATA_DIR / "scout.db"
_lock = threading.Lock()
DEFAULT_CONFERENCE = "General"

SCHEMA = """
CREATE TABLE IF NOT EXISTS conferences (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS searches (
    id            TEXT PRIMARY KEY,
    brief_hash    TEXT NOT NULL,
    theme         TEXT NOT NULL,
    status        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    result_json   TEXT NOT NULL,
    conference_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_searches_hash ON searches(brief_hash);
CREATE TABLE IF NOT EXISTS groups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('keynote', 'panel')),
    theme         TEXT NOT NULL DEFAULT '',
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    review_json   TEXT,
    conference_id INTEGER
);
CREATE TABLE IF NOT EXISTS shortlist (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_id INTEGER NOT NULL,
    search_id     TEXT NOT NULL,
    category      TEXT NOT NULL,
    name          TEXT NOT NULL,
    card_json     TEXT NOT NULL,
    note          TEXT NOT NULL DEFAULT '',
    added_at      TEXT NOT NULL,
    group_id      INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    UNIQUE(conference_id, name, category)
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}


def _migrate(conn: sqlite3.Connection) -> None:
    """Bring older databases up to date without losing anything."""
    # Conferences: make sure at least one exists.
    if conn.execute("SELECT COUNT(*) FROM conferences").fetchone()[0] == 0:
        conn.execute("INSERT INTO conferences (name, created_at) VALUES (?, ?)", (DEFAULT_CONFERENCE, _now()))
    default_id = conn.execute("SELECT MIN(id) FROM conferences").fetchone()[0]

    # Columns added over time.
    if "conference_id" not in _cols(conn, "searches"):
        conn.execute("ALTER TABLE searches ADD COLUMN conference_id INTEGER")
    gcols = _cols(conn, "groups")
    if "review_json" not in gcols:
        conn.execute("ALTER TABLE groups ADD COLUMN review_json TEXT")
    if "conference_id" not in gcols:
        conn.execute("ALTER TABLE groups ADD COLUMN conference_id INTEGER")

    # The shortlist's "one person once" rule is now per conference, so rebuild the table if it's old.
    scols = _cols(conn, "shortlist")
    if "conference_id" not in scols:
        has_group = "group_id" in scols
        conn.executescript("""
            CREATE TABLE shortlist_new (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                conference_id INTEGER NOT NULL,
                search_id     TEXT NOT NULL,
                category      TEXT NOT NULL,
                name          TEXT NOT NULL,
                card_json     TEXT NOT NULL,
                note          TEXT NOT NULL DEFAULT '',
                added_at      TEXT NOT NULL,
                group_id      INTEGER REFERENCES groups(id) ON DELETE SET NULL,
                UNIQUE(conference_id, name, category)
            );""")
        conn.execute(
            "INSERT INTO shortlist_new (id, conference_id, search_id, category, name, card_json, note, added_at, group_id) "
            f"SELECT id, ?, search_id, category, name, card_json, note, added_at, {'group_id' if has_group else 'NULL'} "
            "FROM shortlist", (default_id,))
        conn.executescript("DROP TABLE shortlist; ALTER TABLE shortlist_new RENAME TO shortlist;")

    # Outreach tracking columns (added in Step 13).
    scols = _cols(conn, "shortlist")
    for col, ddl in (("outreach_status", "TEXT NOT NULL DEFAULT 'not_contacted'"),
                     ("outreach_notes", "TEXT NOT NULL DEFAULT ''"),
                     ("contacted_at", "TEXT"), ("outreach_updated_at", "TEXT")):
        if col not in scols:
            conn.execute(f"ALTER TABLE shortlist ADD COLUMN {col} {ddl}")

    # Planning fields (Step 13b): owner, follow-up, fee/travel, confirmed checklist, email draft.
    scols = _cols(conn, "shortlist")
    for col in ("owner", "follow_up_date", "fee", "travel", "checklist_json", "draft_json", "last_outreach_at"):
        if col not in scols:
            conn.execute(f"ALTER TABLE shortlist ADD COLUMN {col} TEXT")
    gcols = _cols(conn, "groups")
    for col in ("session_date", "session_time", "session_room"):
        if col not in gcols:
            conn.execute(f"ALTER TABLE groups ADD COLUMN {col} TEXT")
    conn.execute("""CREATE TABLE IF NOT EXISTS outreach_log (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id  INTEGER NOT NULL,
        ts       TEXT NOT NULL,
        kind     TEXT NOT NULL,          -- 'status' | 'note'
        status   TEXT NOT NULL,          -- the outreach status at the time
        text     TEXT NOT NULL DEFAULT ''
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_log_item ON outreach_log(item_id)")
    conn.execute("""CREATE TABLE IF NOT EXISTS speaker_notes (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id      INTEGER NOT NULL,
        ts           TEXT NOT NULL,
        origin       TEXT NOT NULL,      -- 'chat' | 'manual'
        question     TEXT NOT NULL DEFAULT '',
        text         TEXT NOT NULL,
        sources_json TEXT NOT NULL DEFAULT '[]'
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_item ON speaker_notes(item_id)")

    if "balance_json" not in _cols(conn, "conferences"):
        conn.execute("ALTER TABLE conferences ADD COLUMN balance_json TEXT")
    if "workspace_id" not in _cols(conn, "conferences"):
        conn.execute("ALTER TABLE conferences ADD COLUMN workspace_id INTEGER")   # NULL = not yet claimed
    if "added_by" not in _cols(conn, "shortlist"):
        conn.execute("ALTER TABLE shortlist ADD COLUMN added_by TEXT")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            team_name     TEXT NOT NULL,
            username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
            pw_hash       TEXT NOT NULL,
            salt          TEXT NOT NULL,
            created_at    TEXT NOT NULL,
            failed        INTEGER NOT NULL DEFAULT 0,
            locked_until  TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash  TEXT PRIMARY KEY,
            account_id  INTEGER NOT NULL,
            created_at  TEXT NOT NULL,
            expires_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id  INTEGER NOT NULL,
            conference_id INTEGER,
            ts            TEXT NOT NULL,
            actor         TEXT NOT NULL DEFAULT '',
            kind          TEXT NOT NULL,
            text          TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activity_ws ON activity(workspace_id, ts);
    """)

    # Anything without a conference goes to the first one.
    conn.execute("UPDATE searches SET conference_id = ? WHERE conference_id IS NULL", (default_id,))
    conn.execute("UPDATE groups SET conference_id = ? WHERE conference_id IS NULL", (default_id,))
    conn.execute("CREATE INDEX IF NOT EXISTS idx_searches_conf ON searches(conference_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_groups_conf ON groups(conference_id)")

    # Every conference has its own Keynote group.
    for (cid,) in conn.execute("SELECT id FROM conferences").fetchall():
        if not conn.execute("SELECT 1 FROM groups WHERE kind = 'keynote' AND conference_id = ?", (cid,)).fetchone():
            conn.execute("INSERT INTO groups (name, kind, position, created_at, conference_id) "
                         "VALUES ('Keynote speakers', 'keynote', 0, ?, ?)", (_now(), cid))


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            conn.executescript(SCHEMA)
            _migrate(conn)
            yield conn
            conn.commit()
        finally:
            conn.close()


def brief_hash(brief: SearchBrief) -> str:
    """Same brief (ignoring letter case and extra spaces) -> same hash, so repeat searches reload for free."""
    data = brief.model_dump()
    for k, v in data.items():
        if isinstance(v, str):
            data[k] = " ".join(v.lower().split())
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]


# ---- Conferences ----------------------------------------------------------------------

def list_conferences(workspace_id: int | None = None) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute("""
            SELECT c.id, c.name, c.created_at, c.workspace_id,
                   (SELECT COUNT(*) FROM searches s WHERE s.conference_id = c.id) AS searches,
                   (SELECT COUNT(*) FROM shortlist l WHERE l.conference_id = c.id) AS saved,
                   (SELECT COUNT(*) FROM groups g WHERE g.conference_id = c.id AND g.kind = 'panel') AS panels
            FROM conferences c ORDER BY c.id""").fetchall()
    out = [dict(r) for r in rows]
    return out if workspace_id is None else [c for c in out if c["workspace_id"] == workspace_id]


def get_balance(conference_id: int) -> dict | None:
    with _db() as conn:
        row = conn.execute("SELECT balance_json FROM conferences WHERE id = ?", (conference_id,)).fetchone()
    return json.loads(row["balance_json"]) if row and row["balance_json"] else None


def set_balance(conference_id: int, review_json: str) -> None:
    with _db() as conn:
        conn.execute("UPDATE conferences SET balance_json = ? WHERE id = ?", (review_json, conference_id))


def conference_exists(conference_id: int) -> bool:
    with _db() as conn:
        return bool(conn.execute("SELECT 1 FROM conferences WHERE id = ?", (conference_id,)).fetchone())


def default_conference_id(workspace_id: int | None = None) -> int:
    with _db() as conn:
        if workspace_id is None:
            return conn.execute("SELECT MIN(id) FROM conferences").fetchone()[0]
        return conn.execute("SELECT MIN(id) FROM conferences WHERE workspace_id = ?", (workspace_id,)).fetchone()[0]


def create_conference(name: str, workspace_id: int | None = None) -> dict[str, Any]:
    with _db() as conn:
        cur = conn.execute("INSERT INTO conferences (name, created_at, workspace_id) VALUES (?, ?, ?)",
                           (name, _now(), workspace_id))
        cid = cur.lastrowid
        conn.execute("INSERT INTO groups (name, kind, position, created_at, conference_id) "
                     "VALUES ('Keynote speakers', 'keynote', 0, ?, ?)", (_now(), cid))
    return next(c for c in list_conferences() if c["id"] == cid)


def rename_conference(conference_id: int, name: str) -> dict[str, Any] | None:
    with _db() as conn:
        conn.execute("UPDATE conferences SET name = ? WHERE id = ?", (name, conference_id))
    return next((c for c in list_conferences() if c["id"] == conference_id), None)


def delete_conference(conference_id: int) -> str:
    """Delete a conference with its searches, shortlist and panels. The last conference can't be deleted.
    (Each search's full result is also kept in output/runs/, so the evidence isn't lost.)"""
    with _db() as conn:
        if not conn.execute("SELECT 1 FROM conferences WHERE id = ?", (conference_id,)).fetchone():
            return "missing"
        ws = conn.execute("SELECT workspace_id FROM conferences WHERE id = ?", (conference_id,)).fetchone()[0]
        if conn.execute("SELECT COUNT(*) FROM conferences WHERE workspace_id IS ?", (ws,)).fetchone()[0] <= 1:
            return "last"
        for t in ("outreach_log", "speaker_notes"):
            conn.execute(f"DELETE FROM {t} WHERE item_id IN (SELECT id FROM shortlist WHERE conference_id = ?)",
                         (conference_id,))
        conn.execute("DELETE FROM shortlist WHERE conference_id = ?", (conference_id,))
        conn.execute("DELETE FROM groups WHERE conference_id = ?", (conference_id,))
        conn.execute("DELETE FROM searches WHERE conference_id = ?", (conference_id,))
        conn.execute("DELETE FROM conferences WHERE id = ?", (conference_id,))
    return "deleted"


# ---- Searches -------------------------------------------------------------------

def save_search(result: SearchResult, conference_id: int | None = None) -> None:
    """Insert or update a search. A search keeps its conference when it's updated."""
    with _db() as conn:
        if conference_id is None:
            row = conn.execute("SELECT conference_id FROM searches WHERE id = ?", (result.id,)).fetchone()
            conference_id = row["conference_id"] if row else conn.execute("SELECT MIN(id) FROM conferences").fetchone()[0]
        conn.execute(
            "INSERT INTO searches (id, brief_hash, theme, status, created_at, result_json, conference_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET brief_hash = excluded.brief_hash, "
            "theme = excluded.theme, status = excluded.status, result_json = excluded.result_json, "
            "conference_id = excluded.conference_id",
            (result.id, brief_hash(result.brief), result.brief.conference_theme, result.status,
             result.created_at, result.model_dump_json(), conference_id),
        )


def get_search(search_id: str) -> SearchResult | None:
    with _db() as conn:
        row = conn.execute("SELECT result_json FROM searches WHERE id = ?", (search_id,)).fetchone()
    return SearchResult.model_validate_json(row["result_json"]) if row else None


def search_conference(search_id: str) -> int | None:
    with _db() as conn:
        row = conn.execute("SELECT conference_id FROM searches WHERE id = ?", (search_id,)).fetchone()
    return row["conference_id"] if row else None


def move_search(search_id: str, conference_id: int) -> bool:
    with _db() as conn:
        cur = conn.execute("UPDATE searches SET conference_id = ? WHERE id = ?", (conference_id, search_id))
    return cur.rowcount > 0


def find_recent(brief: SearchBrief, max_age_days: int, conference_id: int) -> SearchResult | None:
    """A finished search with exactly this brief, in this conference, from the last few days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age_days)).isoformat(timespec="seconds")
    with _db() as conn:
        row = conn.execute(
            "SELECT result_json FROM searches WHERE brief_hash = ? AND status = 'done' AND created_at >= ? "
            "AND conference_id = ? ORDER BY created_at DESC LIMIT 1", (brief_hash(brief), cutoff, conference_id),
        ).fetchone()
    return SearchResult.model_validate_json(row["result_json"]) if row else None


def _categories_label(brief: SearchBrief) -> str:
    if len(brief.categories) == 6:
        return "All 6 categories"
    if len(brief.categories) == 1:
        return f"{CATEGORY_LABELS[brief.categories[0]]} only"
    return f"{len(brief.categories)} of 6 categories"


def list_searches(conference_id: int, limit: int = 100) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT result_json, conference_id FROM searches WHERE conference_id = ? ORDER BY created_at DESC LIMIT ?",
            (conference_id, limit),
        ).fetchall()
    out = []
    for row in rows:
        r = SearchResult.model_validate_json(row["result_json"])
        out.append({
            "id": r.id, "status": r.status, "created_at": r.created_at, "conference_id": row["conference_id"],
            "conference_name": r.brief.conference_name, "conference_theme": r.brief.conference_theme,
            "looking_for": r.brief.looking_for, "panel_theme": r.brief.panel_theme,
            "categories_label": _categories_label(r.brief), "location": r.brief.location,
            "speakers": sum(len(c.cards) for c in r.categories), "seconds": r.seconds,
            "input_tokens": r.usage.input_tokens, "output_tokens": r.usage.output_tokens,
            "cost_usd": r.usage.cost_usd,
        })
    return out


def searches_today() -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    with _db() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM searches WHERE created_at >= ?", (today,)).fetchone()
    return int(row["n"])


def all_saved_cards(conference_id: int, limit_searches: int = 30) -> list[tuple[str, str, SpeakerCard]]:
    """(search_id, category, card) for every verified card in this conference's recent searches, newest first."""
    with _db() as conn:
        rows = conn.execute("SELECT result_json FROM searches WHERE status IN ('done', 'stopped') "
                            "AND conference_id = ? ORDER BY created_at DESC LIMIT ?",
                            (conference_id, limit_searches)).fetchall()
    out = []
    for row in rows:
        r = SearchResult.model_validate_json(row["result_json"])
        for c in r.categories:
            out.extend((r.id, c.category, card) for card in c.cards)
    return out


# ---- Shortlist --------------------------------------------------------------------

def _row_to_item(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "conference_id": row["conference_id"], "search_id": row["search_id"],
            "category": row["category"], "name": row["name"], "note": row["note"], "added_at": row["added_at"],
            "group_id": row["group_id"], "outreach_status": row["outreach_status"],
            "outreach_notes": row["outreach_notes"], "contacted_at": row["contacted_at"],
            "outreach_updated_at": row["outreach_updated_at"],
            "owner": row["owner"] or "", "follow_up_date": row["follow_up_date"], "fee": row["fee"] or "",
            "travel": row["travel"] or "", "checklist": json.loads(row["checklist_json"]) if row["checklist_json"] else {},
            "draft": json.loads(row["draft_json"]) if row["draft_json"] else None,
            "last_outreach_at": row["last_outreach_at"], "added_by": row["added_by"] or "",
            "card": json.loads(row["card_json"])}


def _log(conn: sqlite3.Connection, item_id: int, kind: str, status: str, text: str = "") -> None:
    conn.execute("INSERT INTO outreach_log (item_id, ts, kind, status, text) VALUES (?, ?, ?, ?, ?)",
                 (item_id, _now(), kind, status, text))


def add_log_note(item_id: int, text: str) -> dict[str, Any] | None:
    """Add a dated outreach note (e.g. 'Replied: interested, asked about dates'). Counts as outreach activity."""
    with _db() as conn:
        row = conn.execute("SELECT outreach_status FROM shortlist WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return None
        _log(conn, item_id, "note", row["outreach_status"], text)
        conn.execute("UPDATE shortlist SET last_outreach_at = ?, outreach_updated_at = ? WHERE id = ?",
                     (_now(), _now(), item_id))
        out = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(out)


def list_log(item_id: int) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute("SELECT * FROM outreach_log WHERE item_id = ? ORDER BY ts DESC, id DESC", (item_id,)).fetchall()
    return [dict(r) for r in rows]


def add_speaker_note(item_id: int, text: str, origin: str, question: str = "",
                     sources: list[dict] | None = None) -> dict[str, Any] | None:
    with _db() as conn:
        if not conn.execute("SELECT 1 FROM shortlist WHERE id = ?", (item_id,)).fetchone():
            return None
        cur = conn.execute("INSERT INTO speaker_notes (item_id, ts, origin, question, text, sources_json) "
                           "VALUES (?, ?, ?, ?, ?, ?)", (item_id, _now(), origin, question, text, json.dumps(sources or [])))
        row = conn.execute("SELECT * FROM speaker_notes WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _note(row)


def _note(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "item_id": row["item_id"], "ts": row["ts"], "origin": row["origin"],
            "question": row["question"], "text": row["text"], "sources": json.loads(row["sources_json"])}


def list_speaker_notes(item_id: int) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute("SELECT * FROM speaker_notes WHERE item_id = ? ORDER BY ts DESC, id DESC", (item_id,)).fetchall()
    return [_note(r) for r in rows]


def delete_speaker_note(note_id: int) -> bool:
    with _db() as conn:
        cur = conn.execute("DELETE FROM speaker_notes WHERE id = ?", (note_id,))
    return cur.rowcount > 0


PLANNING_FIELDS = ("owner", "follow_up_date", "fee", "travel")


def update_planning(item_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
    """Owner, next follow-up date, fee, travel, confirmed-speaker checklist, saved email draft."""
    with _db() as conn:
        if not conn.execute("SELECT 1 FROM shortlist WHERE id = ?", (item_id,)).fetchone():
            return None
        for key in PLANNING_FIELDS:
            if key in fields:
                conn.execute(f"UPDATE shortlist SET {key} = ? WHERE id = ?", (fields[key] or None, item_id))
        if "checklist" in fields:
            conn.execute("UPDATE shortlist SET checklist_json = ? WHERE id = ?", (json.dumps(fields["checklist"]), item_id))
        if "draft" in fields:
            conn.execute("UPDATE shortlist SET draft_json = ? WHERE id = ?",
                         (json.dumps(fields["draft"]) if fields["draft"] else None, item_id))
        out = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(out)


def get_item(item_id: int) -> dict[str, Any] | None:
    with _db() as conn:
        row = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(row) if row else None


OUTREACH_STATUSES = ("not_contacted", "reached_out", "following_up", "in_conversation", "confirmed", "declined")


def update_outreach(item_id: int, status: str | None, notes: str | None) -> dict[str, Any] | None:
    """Set a speaker's outreach status and/or notes. The first move off 'not contacted' records the date."""
    with _db() as conn:
        row = conn.execute("SELECT outreach_status, contacted_at FROM shortlist WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            return None
        now = _now()
        current_status = row["outreach_status"]
        if status is not None and status != row["outreach_status"]:
            # First move off "not contacted" records the date; resetting to "not contacted" clears it.
            contacted = None if status == "not_contacted" else (row["contacted_at"] or now)
            conn.execute("UPDATE shortlist SET outreach_status = ?, contacted_at = ?, outreach_updated_at = ?, "
                         "last_outreach_at = CASE WHEN ? = 'not_contacted' THEN last_outreach_at ELSE ? END WHERE id = ?",
                         (status, contacted, now, status, now, item_id))
            _log(conn, item_id, "status", status)
            current_status = status
        if notes is not None:
            conn.execute("UPDATE shortlist SET outreach_notes = ?, outreach_updated_at = ? WHERE id = ?",
                         (notes, now, item_id))
            if notes.strip():
                _log(conn, item_id, "note", current_status, notes.strip())
        out = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(out)


def add_to_shortlist(conference_id: int, search_id: str, category: str, card: SpeakerCard,
                     note: str = "", added_by: str = "") -> dict[str, Any]:
    with _db() as conn:
        conn.execute(
            "INSERT INTO shortlist (conference_id, search_id, category, name, card_json, note, added_at, added_by) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(conference_id, name, category) "
            "DO UPDATE SET card_json = excluded.card_json, search_id = excluded.search_id",
            (conference_id, search_id, category, card.name, card.model_dump_json(), note, _now(), added_by or None),
        )
        row = conn.execute("SELECT * FROM shortlist WHERE conference_id = ? AND name = ? AND category = ?",
                           (conference_id, card.name, category)).fetchone()
    return _row_to_item(row)


def list_shortlist(conference_id: int) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute("SELECT * FROM shortlist WHERE conference_id = ? ORDER BY added_at DESC",
                            (conference_id,)).fetchall()
    return [_row_to_item(r) for r in rows]


def update_note(item_id: int, note: str) -> dict[str, Any] | None:
    with _db() as conn:
        conn.execute("UPDATE shortlist SET note = ? WHERE id = ?", (note, item_id))
        row = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(row) if row else None


def remove_from_shortlist(item_id: int) -> bool:
    with _db() as conn:
        cur = conn.execute("DELETE FROM shortlist WHERE id = ?", (item_id,))
        conn.execute("DELETE FROM outreach_log WHERE item_id = ?", (item_id,))
        conn.execute("DELETE FROM speaker_notes WHERE item_id = ?", (item_id,))
    return cur.rowcount > 0


def move_item(item_id: int, group_id: int | None) -> dict[str, Any] | None:
    """Put a shortlisted person in a group of the same conference (or None for Unsorted)."""
    with _db() as conn:
        item = conn.execute("SELECT conference_id FROM shortlist WHERE id = ?", (item_id,)).fetchone()
        if item is None:
            return None
        if group_id is not None and not conn.execute(
                "SELECT 1 FROM groups WHERE id = ? AND conference_id = ?", (group_id, item["conference_id"])).fetchone():
            raise KeyError("no such group in this conference")
        conn.execute("UPDATE shortlist SET group_id = ? WHERE id = ?", (group_id, item_id))
        row = conn.execute("SELECT * FROM shortlist WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(row)


# ---- Groups (keynote speakers + named panels), per conference -------------------------

def _group(row: sqlite3.Row, count: int) -> dict[str, Any]:
    review = row["review_json"]
    return {"id": row["id"], "conference_id": row["conference_id"], "name": row["name"], "kind": row["kind"],
            "theme": row["theme"], "position": row["position"], "count": count,
            "review": json.loads(review) if review else None,
            "session_date": row["session_date"], "session_time": row["session_time"] or "",
            "session_room": row["session_room"] or ""}


def list_groups(conference_id: int) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT g.*, (SELECT COUNT(*) FROM shortlist s WHERE s.group_id = g.id) AS n FROM groups g "
            "WHERE g.conference_id = ? ORDER BY g.kind = 'panel', g.position, g.id", (conference_id,)).fetchall()
    return [_group(r, r["n"]) for r in rows]


def get_group(group_id: int) -> dict[str, Any] | None:
    with _db() as conn:
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
        n = conn.execute("SELECT COUNT(*) FROM shortlist WHERE group_id = ?", (group_id,)).fetchone()[0] if row else 0
    return _group(row, n) if row else None


def create_group(conference_id: int, name: str, theme: str = "") -> dict[str, Any]:
    with _db() as conn:
        pos = conn.execute("SELECT COALESCE(MAX(position), 0) + 1 FROM groups WHERE conference_id = ?",
                           (conference_id,)).fetchone()[0]
        cur = conn.execute("INSERT INTO groups (name, kind, theme, position, created_at, conference_id) "
                           "VALUES (?, 'panel', ?, ?, ?, ?)", (name, theme, pos, _now(), conference_id))
        row = conn.execute("SELECT * FROM groups WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _group(row, 0)


def update_group(group_id: int, name: str | None, theme: str | None,
                 session: dict[str, str | None] | None = None) -> dict[str, Any] | None:
    with _db() as conn:
        if name is not None:
            conn.execute("UPDATE groups SET name = ? WHERE id = ?", (name, group_id))
        if theme is not None:
            conn.execute("UPDATE groups SET theme = ? WHERE id = ?", (theme, group_id))
        for key, value in (session or {}).items():
            if key in ("session_date", "session_time", "session_room"):
                conn.execute(f"UPDATE groups SET {key} = ? WHERE id = ?", (value or None, group_id))
    return get_group(group_id)


def set_group_review(group_id: int, review_json: str) -> None:
    with _db() as conn:
        conn.execute("UPDATE groups SET review_json = ? WHERE id = ?", (review_json, group_id))


def move_group(group_id: int, conference_id: int) -> str:
    """Move a panel (and the people in it) to another conference.

    Each person comes along with their note. If the same person is already saved in the target
    conference, that entry is reused and put in the panel instead of making a duplicate.
    The Keynote group stays with its conference; people can be moved one by one instead.
    """
    with _db() as conn:
        g = conn.execute("SELECT kind, conference_id FROM groups WHERE id = ?", (group_id,)).fetchone()
        if g is None:
            return "missing"
        if g["kind"] == "keynote":
            return "protected"
        if not conn.execute("SELECT 1 FROM conferences WHERE id = ?", (conference_id,)).fetchone():
            return "no_conference"
        if g["conference_id"] == conference_id:
            return "same"
        pos = conn.execute("SELECT COALESCE(MAX(position), 0) + 1 FROM groups WHERE conference_id = ?",
                           (conference_id,)).fetchone()[0]
        conn.execute("UPDATE groups SET conference_id = ?, position = ? WHERE id = ?", (conference_id, pos, group_id))
        for item in conn.execute("SELECT * FROM shortlist WHERE group_id = ?", (group_id,)).fetchall():
            twin = conn.execute("SELECT id, note FROM shortlist WHERE conference_id = ? AND name = ? AND category = ?",
                                (conference_id, item["name"], item["category"])).fetchone()
            if twin:
                note = twin["note"] or item["note"]
                conn.execute("UPDATE shortlist SET group_id = ?, note = ? WHERE id = ?", (group_id, note, twin["id"]))
                if twin_status := (item["outreach_status"] if item["outreach_status"] != "not_contacted" else None):
                    conn.execute("UPDATE shortlist SET outreach_status = ?, outreach_notes = ? || outreach_notes, "
                                 "contacted_at = COALESCE(contacted_at, ?) WHERE id = ?",
                                 (twin_status, (item["outreach_notes"] + "\n") if item["outreach_notes"] else "",
                                  item["contacted_at"], twin["id"]))
                conn.execute("DELETE FROM shortlist WHERE id = ?", (item["id"],))
            else:
                conn.execute("UPDATE shortlist SET conference_id = ? WHERE id = ?", (conference_id, item["id"]))
    return "moved"


def delete_group(group_id: int) -> str:
    """Delete a panel; its people go back to Unsorted. The keynote group can't be deleted."""
    with _db() as conn:
        row = conn.execute("SELECT kind FROM groups WHERE id = ?", (group_id,)).fetchone()
        if row is None:
            return "missing"
        if row["kind"] == "keynote":
            return "protected"
        conn.execute("UPDATE shortlist SET group_id = NULL WHERE group_id = ?", (group_id,))
        conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    return "deleted"


def reset(workspace_id: int | None = None) -> None:
    """Start over: remove this team's conferences, searches, shortlist and panels, then give it a fresh 'General'.
    (Without a workspace, e.g. in tests, everything is cleared.)"""
    with _db() as conn:
        if workspace_id is None:
            for table in ("speaker_notes", "outreach_log", "shortlist", "groups", "searches", "conferences", "activity"):
                conn.execute(f"DELETE FROM {table}")
            return
        confs = [r[0] for r in conn.execute("SELECT id FROM conferences WHERE workspace_id = ?", (workspace_id,))]
        for cid in confs:
            conn.execute("DELETE FROM speaker_notes WHERE item_id IN (SELECT id FROM shortlist WHERE conference_id = ?)", (cid,))
            conn.execute("DELETE FROM outreach_log WHERE item_id IN (SELECT id FROM shortlist WHERE conference_id = ?)", (cid,))
            for t in ("shortlist", "groups", "searches"):
                conn.execute(f"DELETE FROM {t} WHERE conference_id = ?", (cid,))
            conn.execute("DELETE FROM conferences WHERE id = ?", (cid,))
        conn.execute("DELETE FROM activity WHERE workspace_id = ?", (workspace_id,))
        c = conn.execute("INSERT INTO conferences (name, created_at, workspace_id) VALUES (?, ?, ?)",
                         (DEFAULT_CONFERENCE, _now(), workspace_id))
        conn.execute("INSERT INTO groups (name, kind, position, created_at, conference_id) "
                     "VALUES ('Keynote speakers', 'keynote', 0, ?, ?)", (_now(), c.lastrowid))


# ---- Team accounts, sessions, ownership, activity -----------------------------------
# One account = one team workspace. Teammates can share the login; each browser also sends a display
# name ("who's using this") so the activity feed can show who did what. Passwords are stored only as
# salted PBKDF2 hashes and sessions only as SHA-256 hashes.

PBKDF2_ROUNDS = 200_000
SESSION_DAYS = 14
MAX_FAILED = 5
LOCK_MINUTES = 15


def _hash_pw(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ROUNDS).hex()


def create_account(team_name: str, username: str, password: str) -> dict[str, Any]:
    """Create a team account. The very first account adopts any data created before accounts existed."""
    salt = secrets.token_hex(16)
    with _db() as conn:
        if conn.execute("SELECT 1 FROM accounts WHERE username = ?", (username,)).fetchone():
            raise ValueError("That username is taken.")
        first = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0
        cur = conn.execute("INSERT INTO accounts (team_name, username, pw_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                           (team_name, username, _hash_pw(password, salt), salt, _now()))
        aid = cur.lastrowid
        adopted = 0
        if first:
            adopted = conn.execute("UPDATE conferences SET workspace_id = ? WHERE workspace_id IS NULL", (aid,)).rowcount
        if adopted == 0:
            c = conn.execute("INSERT INTO conferences (name, created_at, workspace_id) VALUES (?, ?, ?)",
                             (DEFAULT_CONFERENCE, _now(), aid))
            conn.execute("INSERT INTO groups (name, kind, position, created_at, conference_id) "
                         "VALUES ('Keynote speakers', 'keynote', 0, ?, ?)", (_now(), c.lastrowid))
    return {"id": aid, "team_name": team_name, "username": username, "adopted_conferences": adopted}


def verify_login(username: str, password: str) -> tuple[dict[str, Any] | None, str]:
    """Returns (account, '') or (None, reason). Locks the account for 15 minutes after 5 wrong passwords."""
    with _db() as conn:
        row = conn.execute("SELECT * FROM accounts WHERE username = ?", (username,)).fetchone()
        if row is None:
            return None, "Wrong username or password."
        if row["locked_until"] and row["locked_until"] > _now():
            return None, "Too many wrong passwords. Try again in 15 minutes."
        if not hmac.compare_digest(_hash_pw(password, row["salt"]), row["pw_hash"]):
            failed = row["failed"] + 1
            locked = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat(timespec="seconds") \
                if failed >= MAX_FAILED else None
            conn.execute("UPDATE accounts SET failed = ?, locked_until = ? WHERE id = ?",
                         (0 if locked else failed, locked, row["id"]))
            return None, "Wrong username or password."
        conn.execute("UPDATE accounts SET failed = 0, locked_until = NULL WHERE id = ?", (row["id"],))
    return {"id": row["id"], "team_name": row["team_name"], "username": row["username"]}, ""


def create_session(account_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
    with _db() as conn:
        conn.execute("INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                     (hashlib.sha256(token.encode()).hexdigest(), account_id, _now(), expires))
    return token


def session_account(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    with _db() as conn:
        row = conn.execute(
            "SELECT a.id, a.team_name, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id "
            "WHERE s.token_hash = ? AND s.expires_at > ?", (hashlib.sha256(token.encode()).hexdigest(), _now())).fetchone()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    with _db() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))


def account_count() -> int:
    with _db() as conn:
        return conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]


def workspace_of(kind: str, key: Any) -> int | None:
    """Which team owns a conference / search / shortlist item / group / note (None if not found)."""
    q = {
        "conference": "SELECT workspace_id FROM conferences WHERE id = ?",
        "search": "SELECT c.workspace_id FROM searches s JOIN conferences c ON c.id = s.conference_id WHERE s.id = ?",
        "item": "SELECT c.workspace_id FROM shortlist l JOIN conferences c ON c.id = l.conference_id WHERE l.id = ?",
        "group": "SELECT c.workspace_id FROM groups g JOIN conferences c ON c.id = g.conference_id WHERE g.id = ?",
        "note": "SELECT c.workspace_id FROM speaker_notes n JOIN shortlist l ON l.id = n.item_id "
                "JOIN conferences c ON c.id = l.conference_id WHERE n.id = ?",
    }[kind]
    with _db() as conn:
        row = conn.execute(q, (key,)).fetchone()
    return row[0] if row else None


def log_activity(workspace_id: int, conference_id: int | None, actor: str, kind: str, text: str) -> None:
    with _db() as conn:
        conn.execute("INSERT INTO activity (workspace_id, conference_id, ts, actor, kind, text) VALUES (?, ?, ?, ?, ?, ?)",
                     (workspace_id, conference_id, _now(), actor[:60], kind, text[:300]))


def list_activity(workspace_id: int, conference_id: int | None, limit: int = 100) -> list[dict[str, Any]]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT a.*, c.name AS conference_name FROM activity a LEFT JOIN conferences c ON c.id = a.conference_id "
            "WHERE a.workspace_id = ? AND (? IS NULL OR a.conference_id = ? OR a.conference_id IS NULL) "
            "ORDER BY a.ts DESC, a.id DESC LIMIT ?", (workspace_id, conference_id, conference_id, limit)).fetchall()
    return [dict(r) for r in rows]
