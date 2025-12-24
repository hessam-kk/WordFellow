"""1212 TOEFL word list — category files loader.

Each file in 1212_Category/ holds one topic; every line is
"word: gloss: gloss: ...". The words are the study material; the
glosses are only a fallback shown when no installed dictionary
has a definition for the word.
"""

import os
import re

_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "1212_Category"
)


def _humanize(fname: str) -> str:
    stem = os.path.splitext(fname)[0]
    stem = re.sub(r"^\d+_", "", stem)
    return stem.replace("_", " ").strip().title()


def _parse_line(line: str):
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


def _load():
    cats = []
    if not os.path.isdir(_DIR):
        return cats
    for fname in sorted(os.listdir(_DIR)):
        if not fname.endswith(".txt"):
            continue
        m = re.match(r"(\d+)", fname)
        words, seen = [], set()
        try:
            with open(os.path.join(_DIR, fname), encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    parsed = _parse_line(line)
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
                    "name": _humanize(fname),
                    "total": len(words),
                    "words": words,
                }
            )
    return cats


_CACHE = None


def categories():
    global _CACHE
    if _CACHE is None:
        _CACHE = _load()
    return _CACHE


def get_category(cat_id: str):
    for c in categories():
        if c["id"] == cat_id:
            return c
    return None
