"""pywebview API bridge — the single interface the frontend talks to."""

import os
import threading

from . import downloader
from . import study1212
from .db import DictDB
from .parsers import parse_source
from .sources import RAW_FILES, SOURCES, URLS, get_source

_DL = {"active": False, "source": None, "stage": "", "pct": 0, "msg": ""}
_LOCK = threading.Lock()


class Api:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.raw_dir = os.path.join(data_dir, "raw")
        self.db = DictDB(data_dir)
        self._threads = {}

    # ------------------------------------------------------------- search

    def _enabled_ids(self):
        """Source ids that are both installed and enabled (for searching)."""
        out = []
        for s in SOURCES:
            if self.db.get_meta(f"installed:{s.id}") == "1" and self.db.get_meta(
                f"enabled:{s.id}", "1"
            ) == "1":
                out.append(s.id)
        return out

    def search(self, query: str):
        q = (query or "").strip()
        db = self.db
        enabled = self._enabled_ids()
        exact = db.exact(q, enabled=enabled)
        result = {
            "query": q,
            "exact": exact,
            "reverse": db.reverse_hits(q, enabled=enabled),
            "suggestions": [],
            "sources": [s.id for s in SOURCES if s.id in {r["source"] for r in exact}],
        }
        db.record(q)
        if not result["exact"]:
            result["suggestions"] = db.suggestions(q, enabled=enabled)
        return result

    def suggest(self, query: str):
        return self.db.suggestions(query or "", enabled=self._enabled_ids(), limit=12)

    # ------------------------------------------------------------ sources

    def sources(self):
        out = []
        for s in SOURCES:
            installed = self.db.get_meta(f"installed:{s.id}") == "1"
            count = int(self.db.get_meta(f"count:{s.id}", "0") or 0)
            if not count:
                count = self.db.source_count(s.id)
            out.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "short_name": s.short_name,
                    "description": s.description,
                    "lang": s.lang,
                    "size": s.size_label,
                    "url": s.url,
                    "license": s.license,
                    "installed": installed,
                    "enabled": installed
                    and self.db.get_meta(f"enabled:{s.id}", "1") == "1",
                    "count": count,
                }
            )
        return out

    def install(self, source_id: str):
        with _LOCK:
            if _DL["active"]:
                return {"ok": False, "error": "another download is running"}
            if self.db.get_meta(f"installed:{source_id}") == "1":
                return {"ok": False, "error": "already installed"}
        t = threading.Thread(target=self._do_install, args=(source_id,), daemon=True)
        self._threads[source_id] = t
        t.start()
        return {"ok": True}

    def _set_dl(self, **kw):
        with _LOCK:
            _DL.update(kw)

    def _do_install(self, source_id: str):
        s = get_source(source_id)
        try:
            self._set_dl(active=True, source=source_id, stage="download", pct=0, msg="")
            raw = self._download_source(source_id)
            if raw is None:
                self._set_dl(stage="error", msg="Download failed")
                return
            self._set_dl(active=True, source=source_id, stage="import", pct=0, msg="")
            parser = parse_source(source_id, raw)
            self.db.clear_source(source_id)
            n = self.db.import_rows(source_id, parser)
            if n == 0:
                self.db.set_meta(f"installed:{source_id}", "0")
                self._set_dl(stage="error", msg="Received data was incomplete; try again")
                return
            self.db.set_meta(f"installed:{source_id}", "1")
            self.db.set_meta(f"enabled:{source_id}", "1")
            self.db.set_meta(f"count:{source_id}", str(n))
            self._set_dl(active=False, stage="done", pct=100, msg=f"{n:,} entries")
        except Exception as exc:  # noqa: BLE001
            self._set_dl(stage="error", msg=str(exc)[:300])
        finally:
            with _LOCK:
                _DL["active"] = False

    def _download_source(self, source_id: str) -> str | None:
        """Returns path to the raw file(s), or None on failure."""
        urls = URLS[source_id]
        dest_dir = os.path.join(self.raw_dir, source_id)
        os.makedirs(dest_dir, exist_ok=True)
        if isinstance(urls, str):
            fname = RAW_FILES[source_id]
            dest = os.path.join(dest_dir, fname)
            if os.path.isfile(dest):
                return dest  # already downloaded previously
            ok = downloader.download(
                urls, dest, lambda d, t: self._set_dl(pct=min(98, int(d * 100 / max(t, 1))))
            )
            return dest if ok else None
        # multi-file source (Dehkhoda letter dumps)
        dests = [os.path.join(dest_dir, os.path.basename(u)) for u in urls]
        if all(os.path.isfile(p) and os.path.getsize(p) > 0 for p in dests):
            return dests
        ok, _ = downloader.download_many(
            urls,
            dest_dir,
            progress=lambda d, t: self._set_dl(pct=min(98, int(d * 100 / max(t, 1)))),
        )
        return dests if all(ok) else None

    def download_state(self):
        with _LOCK:
            return dict(_DL)

    def remove(self, source_id: str):
        self.db.clear_source(source_id)
        self.db.set_meta(f"installed:{source_id}", "0")
        self.db.set_meta(f"enabled:{source_id}", "0")
        raw = os.path.join(self.raw_dir, source_id)
        import shutil

        if os.path.isdir(raw):
            shutil.rmtree(raw, ignore_errors=True)
        return True

    def set_enabled(self, source_id: str, enabled: bool):
        if self.db.get_meta(f"installed:{source_id}") != "1":
            return {"ok": False, "error": "dictionary not installed"}
        self.db.set_meta(f"enabled:{source_id}", "1" if enabled else "0")
        return {"ok": True}

    # ------------------------------------------------------------ history

    def history(self, limit: int = 100):
        return self.db.history(limit)

    def delete_history(self, word: str):
        self.db.delete_history(word)
        return True

    def clear_history(self):
        self.db.clear_history()
        return True

    # ----------------------------------------------------------- user notes

    def save_note(self, word: str, note: str):
        self.db.save_note(word.strip(), note)
        return True

    def get_notes(self, words: list[str]):
        return self.db.get_notes_bulk(words)

    def delete_note(self, word: str):
        self.db.delete_note(word.strip())
        return True

    # ------------------------------------------------------------- 1212 study

    def study_categories(self):
        """The 15 topic categories with per-word progress breakdowns."""
        prog = self.db.study_all()
        out = []
        for c in study1212.categories():
            new = learning = mastered = 0
            for w in c["words"]:
                box = prog.get(w["word"], {}).get("box", 0)
                if box >= 3:
                    mastered += 1
                elif box >= 1:
                    learning += 1
                else:
                    new += 1
            out.append(
                {
                    "id": c["id"],
                    "name": c["name"],
                    "total": c["total"],
                    "new": new,
                    "learning": learning,
                    "mastered": mastered,
                }
            )
        return out

    def study_words(self, cat_id: str):
        """Words of one category. Definitions come from the installed
        dictionaries (WordNet EN + English-Persian FA); the word-list
        gloss is kept as a fallback for words the dictionaries miss."""
        cat = study1212.get_category(cat_id)
        if not cat:
            return []
        prog = self.db.study_all()
        enabled = self._enabled_ids()
        out = []
        for w in cat["words"]:
            word = w["word"]
            p = prog.get(word, {"box": 0, "seen": 0, "correct": 0})
            def_en = def_fa = pos = ""
            for h in self.db.exact(word, enabled=enabled, limit_total=6):
                if h["source"] == "wn" and not def_en:
                    def_en, pos = h["definition"], h["pos"]
                elif h["source"] == "enfa" and not def_fa:
                    def_fa = h["definition"]
                if def_en and def_fa:
                    break
            out.append(
                {
                    "word": word,
                    "gloss": w["gloss"],
                    "def_en": def_en,
                    "def_fa": def_fa,
                    "pos": pos,
                    "box": p["box"],
                    "seen": p["seen"],
                    "correct": p["correct"],
                }
            )
        return out

    def study_rate(self, word: str, correct: bool):
        box = self.db.study_rate(word.strip(), bool(correct))
        return {"ok": True, "box": box}

    def study_reset(self, cat_id: str):
        cat = study1212.get_category(cat_id)
        if cat:
            self.db.study_reset([w["word"] for w in cat["words"]])
        return True

    def close(self):
        self.db.close()