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

## Study mode (reusable word-learning framework)

The study feature is a **generic framework** (`backend/study.py`) — not tied
to any one word list. A *study pack* is just a folder of topic files, and any
pack that follows the layout gets flashcards, Leitner-box progress, browsing
and per-category search for free. The built-in list is the **1212 essential
TOEFL words** in `1212_Category/` (15 topic files, e.g.
`01_research_evidence_scientific_inquiry.txt`). Every line is
`word: gloss: gloss`, e.g.:

```
anomaly: irregularity
aggregate: combined: overall
```

To add your own list, drop a new folder of topic files next to `1212_Category/`
and register it in a few lines:

```python
# backend/study_my_words.py — then import it from api.py
from .study import StudyPack, register
register(StudyPack(pack_id="my_words", folder="My_Words",
                   title="My Words", description="..."))
```

The **words** are the study material; the file glosses are shown alongside.
Open the study tab to:

- **Study** a category with **flashcards**: reveal the meaning, then rate
  yourself — *Again* (key `1`) or *Got it* (key `2`). `Space` flips a card.
- Meanings are looked up live in the **installed dictionaries** — up to 5
  senses per word (English-Persian and WordNet), with the word-list gloss
  always shown first.
- **Search within a category** while browsing — matches the word, its gloss
  and the live dictionary definitions, limited to the current category.
- Progress uses **Leitner boxes**: every word moves
  `New → Learning → Review → Mastered`; a miss sends it back to *New*.
  Sessions deal up to 15 cards, always prioritizing the weakest words, and
  progress persists in SQLite across restarts.
- **Browse** the full category word list with per-word status; clicking a
  word opens it in the Search tab (where you can attach a note).
- Jumping to the dictionary mid-session (or switching tabs) **keeps your
  session state** — the study tab resumes exactly where you left off.
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
                        user notes, study progress
  parsers.py            bulk importers for each source format
  downloader.py         streaming download with progress (no per-word calls)
  sources.py            built-in dictionary manifest (URLs, sizes, licenses)
  study.py              generic study-pack framework (categories, search, flashcards)
  study1212.py          registers the 1212_Category TOEFL list as a study pack
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

The `study` table stores a Leitner box (0–3) plus seen/correct counters per
word, keyed by study pack (so separate word lists never collide). Category
progress bars and session queues are derived from it; all updates go through
the `study_rate` bridge method.

---

## Packaging as EXE

The app icon (same glyph as the navbar logo) is exported in `assets/`:
`icon.ico` (16–256 px multi-size), `icon.png` (512 px) and `icon.svg` (vector).
Build with PyInstaller:

```bash
pip install pyinstaller
pyinstaller --noconfirm --clean --onefile --windowed --icon=assets/icon.ico ^
  --name WordFellow --add-data "frontend;frontend" ^
  --add-data "1212_Category;1212_Category" main.py
```

The result is a single portable `dist/WordFellow.exe` (the app icon is baked
in). In a frozen build, all user data — downloaded dictionaries, history,
notes, study progress — lives in `%LOCALAPPDATA%\WordFellow\data`, so it
persists across runs and app updates no matter where the EXE is moved.

### Releases via GitHub Actions

Pushing a **tag** triggers [.github/workflows/release.yml](.github/workflows/release.yml),
which builds the single-file EXE on a Windows runner and publishes a GitHub
Release with the file attached automatically. The tag (minus a leading `v`)
becomes the version and the file suffix:

```bash
git tag v1.0.0
git push origin v1.0.0
# → Release "v1.0.0" with asset WordFellow-1.0.0.exe
```

Manual runs (`workflow_dispatch`) only upload a build artifact named after
the commit — they do not create a release.

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
