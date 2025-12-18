"""Parsers for the bundled dictionary formats.

All parsers are generators yielding row tuples:
    (word, pos, sense_no, definition, examples, extra)

Importing is fully streaming so a ~90 MB bulk file never needs to be
fully decoded into memory at once.
"""

import gzip
import html as html_lib
import json
import os
import re
import zipfile

from .normalize import normalize_word, strips

# --------------------------------------------------------------------------
# WordNet 3.0 (data.* files inside the nltk wordnet.zip corpus)
# --------------------------------------------------------------------------

_SS_TYPE_POS = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}


def _find_member(zf: zipfile.ZipFile, suffix: str):
    for name in zf.namelist():
        if name.endswith(suffix):
            return name
    raise KeyError(f"{suffix} not found in zip archive")


def _data_line_to_rows(line: str, pos_map):
    parts = line.split()
    if len(parts) < 5:
        return []
    ss_type = parts[2]
    if ss_type not in _SS_TYPE_POS:
        return []
    pos = pos_map[ss_type]
    try:
        w_cnt = int(parts[3])
    except ValueError:
        return []
    idx = 4
    words = []
    for _ in range(w_cnt):
        if idx + 1 >= len(parts):
            break
        words.append(parts[idx])
        idx += 2  # skip lex_id
    if idx >= len(parts):
        return []
    try:
        p_cnt = int(parts[idx])
    except ValueError:
        return []
    idx += 1 + p_cnt * 4
    if ss_type == "v" and idx < len(parts):
        try:
            f_cnt = int(parts[idx])
        except ValueError:
            f_cnt = 0
        idx += 1 + f_cnt * 3
    gloss = ""
    if idx < len(parts) and parts[idx] == "|":
        gloss = " ".join(parts[idx + 1:])
    head, examples = _split_gloss(gloss)
    rows = []
    for w in words:
        if not w:
            continue
        rows.append((w.replace("_", " "), pos, head, examples))
    return rows


_EX_RE = re.compile(r'"([^"]*)"')


def _split_gloss(gloss: str):
    """Split a WordNet gloss into (definition, examples list).

    WordNet gloss form:  definition ; "example1" ; "example2" ...
    Usage examples are always quoted and appear at the end of the gloss,
    so the definition is everything before the first double quote.
    """
    examples = [strips(e) for e in _EX_RE.findall(gloss)]
    if examples:
        head = gloss[: gloss.index('"')]
    else:
        head = gloss
    head = strips(head).rstrip(";").strip()
    if not head:
        head = "No definition available"
    return head, examples


def parse_wordnet(zip_path: str):
    """Yield (word, pos, sense_no, definition, examples) from wordnet.zip."""
    with zipfile.ZipFile(zip_path) as zf:
        for pos in ("noun", "verb", "adj", "adv"):
            try:
                member = _find_member(zf, f"data.{pos}")
            except KeyError:
                continue
            text = zf.read(member).decode("utf-8", errors="replace")
            for line in text.splitlines():
                if not line or line.startswith("  "):
                    continue
                for word, p, head, examples in _data_line_to_rows(line, _SS_TYPE_POS):
                    if word.startswith("(") or word.endswith(")"):
                        word = word.lstrip("(").rstrip(")")
                    yield word, p, 0, head, " • ".join(examples), ""


# --------------------------------------------------------------------------
# English ↔ Persian JSONL (shirin-manzari dataset)
# --------------------------------------------------------------------------


def parse_enfa(path: str, with_reverse: bool = True):
    """Yield entries from dictionary.jsonl.

    Yields (english_word, '', sense_order, persian, '', '') rows. When
    `with_reverse` is set, also yields ('@rev', persian_nword, english_word)
    pseudo-rows so the importer can build the Persian→English index.
    """
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            en = (o.get("english") or "").strip()
            fa = (o.get("persian") or "").strip()
            if not en or not fa:
                continue
            pos = o.get("pos") or ""
            sense = o.get("sense_order") or 0
            yield en, pos, sense, fa, "", ""
            if with_reverse:
                yield "@rev", fa, 0, en, "", ""


# --------------------------------------------------------------------------
# Dehkhoda SQL dumps (phpMyAdmin, gzipped, one file per Persian letter)
# --------------------------------------------------------------------------

_SQL_ROW_RE = re.compile(
    r"\(\s*(?P<id>\d+)\s*,\s*'(?P<word>(?:[^']|'')*)'\s*,\s*'(?P<meaning>(?:[^']|'')*)'\s*\)\s*,?"
)

_TAG_WS_RE = re.compile(r"\s+")
_NEWLINE_TAGS = ("<br>", "<br/>", "<br />", "</p>", "</P>", "</div>", "</li>")

def _clean_html(text: str) -> str:
    for tag in _NEWLINE_TAGS:
        text = text.replace(tag, "\n")
    text = re.sub(r"<[^>]+>", "", text)
    text = html_lib.unescape(text)
    text = text.replace("''", "'")
    text = _TAG_WS_RE.sub(" ", text)
    text = text.replace(" . ", ".\n")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    text = "\n".join(lines)
    return text


def parse_dehkhoda(paths):
    """Yield (word, '', 1, cleaned_meaning, '', '') from the SQL dumps."""
    seen = set()
    if isinstance(paths, str):
        paths = [paths]
    for path in paths:
        opener = gzip.open if path.endswith(".gz") else open
        with opener(path, "rt", encoding="utf-8", errors="replace") as f:
            text = f.read()
        for m in _SQL_ROW_RE.finditer(text):
            word = m.group("word").replace("''", "'").strip()
            if not word:
                continue
            nw = normalize_word(word)
            if nw in seen:
                continue
            seen.add(nw)
            meaning = _clean_html(m.group("meaning"))
            yield word, "", 1, meaning, "", ""


def parse_source(source_id: str, path_or_paths):
    """Dispatch to the right parser."""
    if source_id == "wn":
        return parse_wordnet(path_or_paths)
    if source_id == "enfa":
        return parse_enfa(path_or_paths)
    if source_id == "dehkhoda":
        return parse_dehkhoda(path_or_paths)
    raise ValueError(f"unknown source {source_id}")