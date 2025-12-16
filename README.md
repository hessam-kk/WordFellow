# PersoDict — Personalized Offline Dictionary for Students

A personalized dictionary for students built with **Python + pywebview**.
Search any word and get:

- **English definitions** (WordNet 3.0 — definitions, parts of speech, usage examples)
- **English ⇄ Persian** translations (Aryanpour / Wiktionary merged dataset)
- **Persian ⇄ Persian** definitions from the classic **Dehkhoda** encyclopedic dictionary

Every dictionary is **downloaded once, in bulk**, and stored locally in a
SQLite database. After the first download, **all lookups are fully offline** —
there are **no per-word API calls** and no internet connection is needed to search.

Searches are automatically tracked, so students can **review previously searched
words** (sorted by most-recent or most-frequent) and re-open them with one click.

---

## Features

- 🔎 **Smart search** with live autocomplete and "did-you-mean" suggestions.
- 🌐 **Bilingual** — results render in the correct direction automatically
  (Persian text right-to-left, English left-to-right).
- 📚 **Multiple sources** shown side-by-side, each with its own badge.
- 🔁 **Reverse lookup** — type a Persian word and get English equivalents.
- 🕑 **Search history** with two views: *Recent* and *Most searched*,
  plus per-word delete and *Clear all*.
- ⬇️ **Dictionary manager** — download / remove each dictionary with a live
  progress bar. Downloads are cached, so reinstalls are fast.
- 🎨 **Vazirmatn font** embedded locally (no CDN), so the app looks great offline.
- 🌙 **Light / dark theme** (remembered across sessions).
- 🖥 **Native desktop window** (Edge WebView2 on Windows) — feels like a real app.

---

## Install & run

```bash
# 1. create a virtual environment (optional but recommended)
python -m venv .venv
.venv\Scripts\activate        # Windows
#   source .venv/bin/activate  # macOS / Linux

# 2. install dependencies
pip install -r requirements.txt

# 3. run
python main.py
```

> On first launch no dictionary is installed. Open the **Dictionaries** tab and
> click *Download & install* for each source you want. The English dictionary is
> ~11 MB, the bilingual one ~90 MB, and Dehkhoda ~40 MB.

---

## How it works

```
main.py                 pywebview window + entry point
backend/
  api.py                bridge between the UI (JS) and Python
  db.py                 SQLite storage: entries, reverse index, history
  parsers.py            bulk importers for each source format
  downloader.py         streaming download with progress (no per-word calls)
  sources.py            built-in dictionary manifest (URLs, sizes, licenses)
  normalize.py          Persian/Arabic text normalization
frontend/
  index.html, style.css, app.js   the UI (vanilla JS, direction-aware)
  fonts/                embedded Vazirmatn woff2 files (offline)
data/                   created at runtime (dict.db + raw downloads)
```

### Data sources (all open / bulk-downloadable)

| Source | Language | Format | Size | Notes |
|--------|----------|--------|------|-------|
| WordNet 3.0 (Princeton) | English | `data.*` files in nltk `wordnet.zip` | ~11 MB | Definitions + examples |
| English↔Persian | Both | `dictionary.jsonl` (shirin-manzari) | ~90 MB | 880k rows + reverse index |
| Dehkhoda | Persian | `words` SQL dumps (nimah79), 33 gz files | ~40 MB | 312k headwords |

The bulk files are downloaded to `data/raw/<source>/` and parsed into
`data/dict.db`. Once installed, the app never touches the network for searches.

### Search logic

- Normalized key (lowercase, Arabic→Persian unification, diacritics stripped).
- **Exact** match across installed sources.
- **Reverse** (Persian→English) index hit.
- **Prefix** suggestions / "did you mean" when there is no exact match.

### History

Every search increments a per-word counter and refreshes a `last_seen`
timestamp in the `history` table, so the History view can show what the
student looked up recently and what they look up most often.

---

## Tests

```bash
python -m unittest discover -s tests
```

Unit tests cover normalization, the SQLite lookups/history, and the WordNet &
Dehkhoda importers using synthetic fixtures (no network needed). A live
end-to-end check (real downloads + searches) lives in `tools/verify.py`:

```bash
python tools/verify.py            # downloads + imports all sources
python tools/verify.py --skip-enfa # faster: only WordNet + Dehkhoda
```

---

## License & attribution

- **WordNet** — Princeton University; distributed under the WordNet license.
- **English↔Persian** — compiled dataset by shirin-manzari, derived from
  multiple open resources (Apache-2.0 upstream licenses).
- **Dehkhoda** — public-domain release of the Dehkhoda encyclopedic dictionary
  (CC0 per DehkhodaProject; SQL dumps by nimah79).
- **Vazirmatn** — font by Saber Rastikerdar, OFL-1.1 licensed.
- Application code: MIT.