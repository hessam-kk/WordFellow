"""SQLite storage: dictionary entries, reverse index, usage history."""

import os
import sqlite3
import time

from .normalize import normalize_word

_SCHEMA = """
CREATE TABLE IF NOT EXISTS entries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  word TEXT NOT NULL,
  nword TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  sense_no INTEGER NOT NULL DEFAULT 0,
  definition TEXT NOT NULL,
  examples TEXT NOT NULL DEFAULT '',
  extra TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_entries_lookup ON entries(source, nword);
CREATE INDEX IF NOT EXISTS idx_entries_nword ON entries(nword);
CREATE INDEX IF NOT EXISTS idx_entries_word ON entries(nword, source);

CREATE TABLE IF NOT EXISTS rev(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nword TEXT NOT NULL,
  word TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rev_unique ON rev(nword, word);
CREATE INDEX IF NOT EXISTS idx_rev_nword ON rev(nword);

CREATE TABLE IF NOT EXISTS meta(
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS history(
  word TEXT PRIMARY KEY,
  nword TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  last_seen REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_last ON history(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_history_count ON history(count DESC);
"""

REV_SOURCE = "fatoen"  # reverse Persian→English index shown under enfa source

_MAX_RANGE = "\uffff"


class DictDB:
    def __init__(self, data_dir: str):
        os.makedirs(data_dir, exist_ok=True)
        self.path = os.path.join(data_dir, "dict.db")
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=10000")
        self._conn.executescript(_SCHEMA)

    def connect(self) -> sqlite3.Connection:
        """A separate connection for import workers."""
        conn = sqlite3.connect(self.path)
        conn.execute("PRAGMA busy_timeout=30000")
        conn.executescript(_SCHEMA)
        return conn

    # ------------------------------------------------------------- imports

    def import_rows(self, source_id: str, rows, bulk_commit=5000):
        """Stream rows (word, pos, sense_no, definition, examples, extra)
        into the entries table in batches."""
        conn = self.connect()
        cur = conn.cursor()
        n = 0
        batch = []
        try:
            for row in rows:
                n += 1
                if row[0] == "@rev":
                    cur.execute(
                        "INSERT OR IGNORE INTO rev (nword, word) VALUES (?, ?)",
                        (normalize_word(row[1]), row[3]),
                    )
                    if n % bulk_commit == 0:
                        conn.commit()
                    continue
                word, pos, sense, definition, examples, extra = row
                batch.append(
                    (
                        source_id,
                        word,
                        normalize_word(word),
                        pos,
                        int(sense or 0),
                        definition,
                        examples,
                        extra,
                    )
                )
                if len(batch) >= bulk_commit:
                    cur.executemany(
                        "INSERT INTO entries (source, word, nword, pos, sense_no,"
                        " definition, examples, extra) VALUES (?,?,?,?,?,?,?,?)",
                        batch,
                    )
                    conn.commit()
                    batch = []
            if batch:
                cur.executemany(
                    "INSERT INTO entries (source, word, nword, pos, sense_no,"
                    " definition, examples, extra) VALUES (?,?,?,?,?,?,?,?)",
                    batch,
                )
                conn.commit()
            conn.execute(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
                (f"count:{source_id}", str(n)),
            )
            conn.commit()
        finally:
            conn.close()
        return n

    def clear_source(self, source_id: str):
        conn = self.connect()
        try:
            conn.execute("DELETE FROM entries WHERE source = ?", (source_id,))
            if source_id == "enfa":
                conn.execute("DELETE FROM rev")
            conn.execute("DELETE FROM meta WHERE key = ?", (f"count:{source_id}",))
            conn.commit()
        finally:
            conn.close()

    def set_meta(self, key: str, value: str):
        self._conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)", (key, value)
        )
        self._conn.commit()

    def get_meta(self, key: str, default: str = "") -> str:
        row = self._conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default

    def source_count(self, source_id: str) -> int:
        try:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM entries WHERE source = ?", (source_id,)
            ).fetchone()
            return int(row[0]) if row else 0
        except sqlite3.Error:
            return int(self.get_meta(f"count:{source_id}", "0") or 0)

    # -------------------------------------------------------------- search

    @staticmethod
    def _nrange(nw: str):
        return nw, nw + _MAX_RANGE

    @staticmethod
    def _src_clause(enabled):
        """Return (sql, params) restricting a query to the enabled sources.
        enabled is a list of source ids; None/empty means 'all'."""
        if not enabled:
            return "", ()
        ph = ",".join("?" * len(enabled))
        return f" AND source IN ({ph})", tuple(enabled)

    def exact(self, query: str, enabled=None, limit_total: int = 500):
        nw = normalize_word(query)
        if not nw:
            return []
        sql, params = self._src_clause(enabled)
        rows = self._conn.execute(
            "SELECT source, word, pos, sense_no, definition, examples"
            f" FROM entries WHERE nword = ?{sql} ORDER BY source, rowid LIMIT ?",
            (nw, *params, limit_total),
        ).fetchall()
        return [self._row(r) for r in rows]

    def reverse_hits(self, query: str, enabled=None, limit: int = 15):
        """Persian→English index: english words whose persian gloss matches."""
        nw = normalize_word(query)
        if not nw:
            return []
        if enabled and "enfa" not in enabled:
            return []
        rows = self._conn.execute(
            "SELECT DISTINCT word FROM rev WHERE nword = ? LIMIT ?", (nw, limit)
        ).fetchall()
        return [r[0] for r in rows]

    def suggestions(self, query: str, enabled=None, limit: int = 24):
        """Prefix matches across all installed sources (for autocomplete +
        'did you mean')."""
        nw = normalize_word(query)
        if not nw:
            return []
        lo, hi = self._nrange(nw)
        sql, params = self._src_clause(enabled)
        rows = self._conn.execute(
            f"SELECT DISTINCT nword FROM entries WHERE nword >= ? AND nword < ?{sql}"
            " ORDER BY length(nword), nword LIMIT ?",
            (lo, hi, *params, limit),
        ).fetchall()
        out = []
        for (w,) in rows:
            if w != nw:
                out.append(w)
        if (not enabled or "enfa" in enabled) and len(out) < limit:
            rows = self._conn.execute(
                "SELECT DISTINCT nword FROM rev WHERE nword >= ? AND nword < ?"
                " ORDER BY length(nword), nword LIMIT ?",
                (lo, hi, limit),
            ).fetchall()
            for (w,) in rows:
                if w != nw:
                    out.append(w)
        return out[:limit]

    def browse_words(self, source_id: str, prefix: str = "", limit: int = 50):
        nw = normalize_word(prefix)
        if nw:
            lo, hi = self._nrange(nw)
            rows = self._conn.execute(
                "SELECT DISTINCT word FROM entries WHERE source = ? AND nword >= ?"
                " AND nword < ? ORDER BY nword LIMIT ?",
                (source_id, lo, hi, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT DISTINCT word FROM entries WHERE source = ? ORDER BY nword"
                " LIMIT ?",
                (source_id, limit),
            ).fetchall()
        return [r[0] for r in rows]

    @staticmethod
    def _row(r):
        return {
            "source": r[0],
            "word": r[1],
            "pos": r[2],
            "sense_no": r[3],
            "definition": r[4],
            "examples": r[5],
        }

    # -------------------------------------------------------------- history

    def record(self, word: str):
        word = word.strip()
        if not word:
            return
        nw = normalize_word(word)
        now = time.time()
        self._conn.execute(
            "INSERT INTO history (word, nword, count, last_seen) VALUES (?,?,1,?)"
            " ON CONFLICT(word) DO UPDATE SET count = count + 1, last_seen = ?",
            (word, nw, now, now),
        )
        self._conn.commit()

    def history(self, limit: int = 100):
        recent = self._conn.execute(
            "SELECT word, count, last_seen FROM history ORDER BY last_seen DESC"
            " LIMIT ?",
            (limit,),
        ).fetchall()
        top = self._conn.execute(
            "SELECT word, count, last_seen FROM history ORDER BY count DESC,"
            " last_seen DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return {
            "recent": [self._h(r) for r in recent],
            "top": [self._h(r) for r in top],
        }

    @staticmethod
    def _h(r):
        return {"word": r[0], "count": r[1], "last_seen": r[2]}

    def delete_history(self, word: str):
        self._conn.execute("DELETE FROM history WHERE word = ?", (word,))
        self._conn.commit()

    def clear_history(self):
        self._conn.execute("DELETE FROM history")
        self._conn.commit()

    def close(self):
        try:
            self._conn.close()
        except sqlite3.Error:
            pass