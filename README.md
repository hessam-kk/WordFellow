# WordFellow — Personalized Offline Dictionary for Students

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
On top of the dictionaries sits a **1212-word TOEFL study mode** with flashcards
and spaced repetition, plus **personal notes** on any word.

---

## Features

- 🔎 **Smart search** with live autocomplete (the exact word is offered first
  when it exists) and "did-you-mean" suggestions.
- 🌐 **Bilingual** — results render in the correct direction automatically
  (Persian text right-to-left, English left-to-right).
- 📚 **Multiple sources** shown side-by-side, each with its own badge.
- 🔁 **Reverse lookup** — type a Persian word and get English equivalents.
- 🗒 **Personal notes** — attach your own meaning or memory hook to any word;
  notes appear under its search results and persist in the database.
- 🎓 **1212 words study mode** — the essential TOEFL vocabulary grouped into
  15 topics, studied with flashcards and Leitner-style spaced repetition
  (see below).
- 🕑 **Search history** with two views: *Recent* and *Most searched*,
  plus per-word delete and *Clear all*.
- ⬇️ **Dictionary manager** — download / remove each dictionary with a live
  progress bar. Downloads are cached, so reinstalls are fast.
- 👤 **About page** — who built the app, TOEFL writing teaching / mentoring /
  consulting, and the [TOEFL FAQ](https://t.me/TOEFL_FAQ) Telegram channel.
- 🎨 **Vazirmatn font** embedded locally (no CDN), so the app looks great offline.
- 🌙 **Light / dark theme** (remembered across sessions).
- 🖥 **Native desktop window** (Edge WebView2 on Windows), launches maximized —
  feels like a real app.

---

## 1212 word list — study mode

The `1212_Category/` folder holds the **1212 essential TOEFL words** split
into 15 topic files (`01_research_evidence_scientific_inquiry.txt`, …).
Every line is `word: gloss: gloss`, e.g.:

```
anomaly: irregularity
aggregate: combined: overall
```

The **words** are the study material; the file glosses are shown alongside.
Open the **1212 Words** tab to:

- **Study** a category with **flashcards**: reveal the meaning, then rate
  yourself — *Again* (key `1`) or *Got it* (key `2`). `Space` flips a card.
- Meanings are looked up live in the **installed dictionaries** — up to 5
  senses per word (English-Persian and WordNet), with the word-list gloss
  always shown first.
- Progress uses **Leitner boxes**: every word moves
  `New → Learning → Review → Mastered`; a miss sends it back to *New*.
  Sessions deal up to 15 cards, always prioritizing the weakest words, and
  progress persists in SQLite across restarts.
- **Browse** the full category word list with per-word status; clicking a
  word opens it in the Search tab (where you can attach a note).
- Jumping to the dictionary mid-session (or switching tabs) **keeps your
  session state** — the 1212 tab resumes exactly where you left off.
- Each category has a **Reset progress** button (click twice to confirm).

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
> The 1212 study mode works best with at least one dictionary installed, but
> always falls back to the built-in word-list glosses.

---

## How it works

```
main.py                 pywebview window + entry point
backend/
  api.py                bridge between the UI (JS) and Python
  db.py                 SQLite storage: entries, reverse index, history,
                        user notes, 1212 study progress
  parsers.py            bulk importers for each source format
  downloader.py         streaming download with progress (no per-word calls)
  sources.py            built-in dictionary manifest (URLs, sizes, licenses)
  study1212.py          loader for the 1212_Category word list
  normalize.py          Persian/Arabic text normalization
frontend/
  index.html, style.css, app.js   the UI (vanilla JS, direction-aware)
  fonts/                embedded Vazirmatn woff2 files (offline)
  images/               photos for the About page
1212_Category/          15 topic files with the 1212 TOEFL words
assets/                 app icon (icon.ico / icon.png / icon.svg)
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
- **Prefix** suggestions / "did you mean" — the exact word itself is included
  and sorted first whenever it exists in an installed dictionary.

### History & notes

Every search increments a per-word counter and refreshes a `last_seen`
timestamp in the `history` table, so the History view can show what the
student looked up recently and what they look up most often.
Notes live in a `user_notes` table (one note per word) and are loaded in a
single batch after each search.

### Study progress

The `study1212` table stores a Leitner box (0–3) plus seen/correct counters
per word. Category progress bars and session queues are derived from it;
all updates go through the `study_rate` bridge method.

---

## Packaging as EXE

The app icon (same glyph as the navbar logo) is exported in `assets/`:
`icon.ico` (16–256 px multi-size), `icon.png` (512 px) and `icon.svg` (vector).
Build with PyInstaller:

```bash
pip install pyinstaller
pyinstaller --noconfirm --windowed --icon=assets/icon.ico --name WordFellow ^
  --add-data "frontend;frontend" --add-data "1212_Category;1212_Category" main.py
```

> Note: in a frozen build `data/` currently resolves to PyInstaller's temp
> folder, so downloaded dictionaries and progress would not persist between
> runs. Redirect `DATA_DIR` in `main.py` to a folder next to the executable
> before shipping a real release.

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
