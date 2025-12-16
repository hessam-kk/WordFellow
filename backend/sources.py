"""Built-in dictionary sources.

Every source can be downloaded in bulk (no per-word API calls). Once a
source is installed, lookups are served entirely from the local SQLite
database and work offline.
"""

from dataclasses import dataclass, field
from typing import List, Optional

RAW_DIR = "raw"


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    short_name: str
    description: str
    lang: str  # "en" | "fa"
    size_label: str
    license: str
    url: str
    kind: str  # parser type: "wordnet" | "enfa" | "dehkhoda"
    files: List[str] = field(default_factory=list)


SOURCES: List[Source] = [
    Source(
        id="wn",
        name="WordNet (English definitions)",
        short_name="WordNet",
        description=(
            "English dictionary with 117,000+ words, parts of speech, "
            "definitions and usage examples (Princeton WordNet 3.0)."
        ),
        lang="en",
        size_label="~11 MB",
        license="WordNet license (permissive)",
        url="https://wordnet.princeton.edu/",
        kind="wordnet",
    ),
    Source(
        id="enfa",
        name="English ↔ Persian (Aryanpour + Wiktionary)",
        short_name="English ↔ Persian",
        description=(
            "Bilingual dictionary: 308,000+ English words with Persian "
            "translations, multi-sense definitions, plus a reverse "
            "Persian→English index (880,000+ rows)."
        ),
        lang="both",
        size_label="~90 MB",
        license="Mixed open licenses (Apache-2.0 based)",
        url="https://github.com/shirin-manzari/english-persian-dictionary-dataset",
        kind="enfa",
    ),
    Source(
        id="dehkhoda",
        name="Dehkhoda Dictionary (Persian ⇄ Persian)",
        short_name="Dehkhoda",
        description=(
            "The classic Persian encyclopedic dictionary by Ali-Akbar "
            "Dehkhoda: 312,000+ headwords with Persian definitions and "
            "literary citations."
        ),
        lang="fa",
        size_label="~40 MB",
        license="CC0 (per DehkhodaProject release)",
        url="https://github.com/nimah79/Dehkhoda-SQL",
        kind="dehkhoda",
    ),
]

# Download endpoints (verified reachable).
URLS = {
    "wn": "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip",
    "enfa": "https://raw.githubusercontent.com/shirin-manzari/english-persian-dictionary-dataset/main/dictionary.jsonl",
    "dehkhoda": [
        f"https://raw.githubusercontent.com/nimah79/Dehkhoda-SQL/master/{part}.sql.gz"
        for part in [
            "01-A", "02-Alef", "03-Be", "04-Pe", "05-Te", "06-Se",
            "07-Jim", "08-Che", "09-He", "10-Khe", "11-Dal", "12-Zal",
            "13-Re", "14-Ze", "15-Zhe", "16-Sin", "17-Shin", "18-Sad",
            "19-Zad", "20-Ta", "21-Za", "22-Ain", "23-Qain", "24-Fe",
            "25-Qaf", "26-Kaf", "27-Gaf", "28-Lam", "29-Mim", "30-Noun",
            "31-Vav", "32-He", "33-Ye",
        ]
    ],
}

# File names stored under data/raw/<source_id>/
RAW_FILES = {
    "wn": "wordnet.zip",
    "enfa": "dictionary.jsonl",
}


def get_source(source_id: str) -> Optional[Source]:
    for s in SOURCES:
        if s.id == source_id:
            return s
    return None