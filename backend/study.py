"""Generic study packs — reusable word-learning framework.

A *study pack* is a folder of category files (one topic per .txt, each
line "word: gloss: gloss: ...").  Any spaced-repetition word list that
follows this layout can be plugged in by registering a ``StudyPack`` —
see ``study1212.py`` for the built-in TOEFL list.  Search, flashcards
and Leitner-box progress work automatically for every registered pack.
"""

import os
import re

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class StudyPack:
    def __init__(self, pack_id, folder, title, description=""):
        self.pack_id = pack_id
        self.folder = folder
        self.title = title
        self.description = description
        self._dir = os.path.join(_ROOT, folder)
        self._cache = None

    def _humanize(self, fname: str) -> str:
        stem = os.path.splitext(fname)[0]
        stem = re.sub(r"^\d+_", "", stem)
        return stem.replace("_", " ").strip().title()

    def _parse_line(self, line: str):
        line = line.strip()
        if not line:
            return None
        if ":" in line:
            word, _, gloss = line.partition(":")
            word = word.strip()
            gloss = " · ".join(g.strip() for g in gloss.split(":") if g.strip())
            gloss = re.sub(r"\s*>\s*", " — ", gloss)
        else:
            word, gloss = line, ""
        return (word, gloss) if word else None

    def _load(self):
        cats = []
        if not os.path.isdir(self._dir):
            return cats
        for fname in sorted(os.listdir(self._dir)):
            if not fname.endswith(".txt"):
                continue
            m = re.match(r"(\d+)", fname)
            words, seen = [], set()
            try:
                with open(
                    os.path.join(self._dir, fname),
                    encoding="utf-8",
                    errors="replace",
                ) as fh:
                    for line in fh:
                        parsed = self._parse_line(line)
                        if not parsed:
                            continue
                        w, g = parsed
                        if w.lower() in seen:
                            continue
                        seen.add(w.lower())
                        words.append({"word": w, "gloss": g})
            except OSError:
                continue
            if words:
                cats.append(
                    {
                        "id": m.group(1) if m else fname,
                        "name": self._humanize(fname),
                        "total": len(words),
                        "words": words,
                    }
                )
        return cats

    def categories(self):
        if self._cache is None:
            self._cache = self._load()
        return self._cache

    def get_category(self, cat_id: str):
        for c in self.categories():
            if c["id"] == cat_id:
                return c
        return None

    def search(self, cat_id: str, query: str, limit: int = 100):
        """Words of one category whose word or gloss matches *query*
        (case-insensitive substring)."""
        cat = self.get_category(cat_id)
        if not cat:
            return []
        q = (query or "").strip().lower()
        if not q:
            return []
        out = []
        for w in cat["words"]:
            if q in w["word"].lower() or q in (w["gloss"] or "").lower():
                out.append(w)
                if len(out) >= limit:
                    break
        return out

    def info(self) -> dict:
        return {
            "id": self.pack_id,
            "title": self.title,
            "description": self.description,
            "folder": self.folder,
        }


_PACKS: dict[str, StudyPack] = {}


def register(pack: StudyPack):
    _PACKS[pack.pack_id] = pack


def get_pack(pack_id: str):
    return _PACKS.get(pack_id)


def packs():
    return list(_PACKS.values())