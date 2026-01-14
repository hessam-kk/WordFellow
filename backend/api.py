"""pywebview API bridge — the single interface the frontend talks to."""

import os
import threading

from . import downloader
from . import study
from . import study1212  # noqa: F401 — registers the 1212 study pack
from . import tts
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

    # ---------------------------------------------------------------- study

    def study_packs(self) -> list:
        """Every registered study pack (e.g. the 1212 TOEFL list)."""
        return [p.info() for p in study.packs()]

    def _study_pack(self, pack_id: str):
        return study.get_pack(pack_id or "1212")

    def study_categories(self, pack_id: str = "1212"):
        """The topic categories of a pack with per-word progress breakdowns."""
        pack = self._study_pack(pack_id)
        if not pack:
            return []
        prog = self.db.study_all(pack.pack_id)
        out = []
        for c in pack.categories():
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

    def _study_entries(self, pack: "study.StudyPack", words: list) -> list:
        """Enrich raw word-list rows with dictionary definitions + progress."""
        prog = self.db.study_all(pack.pack_id)
        enabled = self._enabled_ids()
        out = []
        for w in words:
            word = w["word"]
            p = prog.get(word, {"box": 0, "seen": 0, "correct": 0})
            hits = self.db.exact(word, enabled=enabled, limit_total=30)
            wn = [h for h in hits if h["source"] == "wn" and h["definition"]]
            enfa = [h for h in hits if h["source"] == "enfa" and h["definition"]]
            ordered = []
            if enfa:
                ordered.append(enfa[0])
            if wn:
                ordered.append(wn[0])
            ordered.extend(enfa[1:])
            ordered.extend(wn[1:])
            defs = [
                {"src": h["source"], "text": h["definition"]} for h in ordered[:5]
            ]
            pos = ""
            for h in enfa + wn:
                if h["pos"] and h["pos"] != "None":
                    pos = h["pos"]
                    break
            out.append(
                {
                    "word": word,
                    "gloss": w["gloss"],
                    "defs": defs,
                    "pos": pos,
                    "box": p["box"],
                    "seen": p["seen"],
                    "correct": p["correct"],
                }
            )
        return out

    def study_words(self, cat_id: str, pack_id: str = "1212"):
        """Words of one category. Up to 5 definitions per word come from
        the installed dictionaries (English-Persian and WordNet senses);
        the word-list gloss is always included as an extra fallback."""
        pack = self._study_pack(pack_id)
        if not pack:
            return []
        cat = pack.get_category(cat_id)
        if not cat:
            return []
        return self._study_entries(pack, cat["words"])

    def study_search(self, cat_id: str, query: str, pack_id: str = "1212"):
        """Search only within one category of a pack — the word or its
        gloss must contain the query."""
        pack = self._study_pack(pack_id)
        if not pack:
            return []
        return self._study_entries(pack, pack.search(cat_id, query))

    def study_search_all(self, query: str, pack_id: str = "1212"):
        """Search the whole pack (every category) — matches carry the
        category they belong to."""
        pack = self._study_pack(pack_id)
        if not pack:
            return []
        prog = self.db.study_all(pack.pack_id)
        enabled = self._enabled_ids()
        out = []
        for w in pack.search_all(query):
            p = prog.get(w["word"], {"box": 0, "seen": 0, "correct": 0})
            hits = self.db.exact(w["word"], enabled=enabled, limit_total=30)
            wn = [h for h in hits if h["source"] == "wn" and h["definition"]]
            enfa = [h for h in hits if h["source"] == "enfa" and h["definition"]]
            ordered = []
            if enfa:
                ordered.append(enfa[0])
            if wn:
                ordered.append(wn[0])
            ordered.extend(enfa[1:])
            ordered.extend(wn[1:])
            defs = [
                {"src": h["source"], "text": h["definition"]} for h in ordered[:5]
            ]
            pos = ""
            for h in enfa + wn:
                if h["pos"] and h["pos"] != "None":
                    pos = h["pos"]
                    break
            out.append(
                {
                    "word": w["word"],
                    "gloss": w["gloss"],
                    "cat_id": w["cat_id"],
                    "cat_name": w["cat_name"],
                    "defs": defs,
                    "pos": pos,
                    "box": p["box"],
                    "seen": p["seen"],
                    "correct": p["correct"],
                }
            )
        return out

    def study_rate(self, word: str, correct: bool, pack_id: str = "1212"):
        pack = self._study_pack(pack_id)
        if not pack:
            return {"ok": False, "box": 0}
        box = self.db.study_rate(pack.pack_id, word.strip(), bool(correct))
        return {"ok": True, "box": box}

    def study_reset(self, cat_id: str, pack_id: str = "1212"):
        pack = self._study_pack(pack_id)
        if not pack:
            return True
        cat = pack.get_category(cat_id)
        if cat:
            self.db.study_reset(pack.pack_id, [w["word"] for w in cat["words"]])
        return True

    # ----------------------------------------------------------- pronunciation

    def pronounce(self, word: str):
        """Speak *word* aloud using offline TTS (pyttsx3 / SAPI5).
        Runs in a dedicated worker thread so the GUI stays responsive."""
        tts.say(word)

    def tts_state(self) -> dict:
        """Return TTS diagnostics: ready, last error, word count."""
        tts.ensure_started()
        return tts.state()

    def set_auto_pronounce(self, enabled: bool):
        self.db.set_meta("auto_pronounce", "1" if enabled else "0")
        return True

    def get_auto_pronounce(self) -> bool:
        return self.db.get_meta("auto_pronounce", "0") == "1"

    def close(self):
        self.db.close()