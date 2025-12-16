"""Text normalization for dictionary lookups (Persian + English)."""

import re
import unicodedata

_ARABIC_TO_PERSIAN = str.maketrans(
    {
        "\u064a": "\u06cc",  # ي -> ی
        "\u0649": "\u06cc",  # ى -> ی
        "\u0643": "\u06a9",  # ك -> ک
        "\u0629": "\u0647",  # ة -> ه
        "\u06c0": "\u0647",  # ۀ -> ه
        "\u0623": "\u0627",  # أ -> ا
        "\u0625": "\u0627",  # إ -> ا
        "\u0622": "\u0627",  # آ -> ا
        "\u0671": "\u0627",  # ٱ -> ا
        "\u0624": "\u0648",  # ؤ -> و
        "\u0626": "\u06cc",  # ئ -> ی
    }
)

_DIACRITICS_RE = re.compile(
    "[\u064b-\u065f\u0670\u0640\u200c\u200f\u202a-\u202e\r\t\ufeff]"
)

_PUNCT_RE = re.compile(r"[\u060c\u061b\u061f.,;:!?\u201c\u201d\"'()\[\]{}<>&*#@$%^_+=/\\|~`]")

_LATIN_SPLIT_RE = re.compile(r"[^a-z0-9]+")


def normalize_arabic(text: str) -> str:
    """Unify Arabic variants to Persian forms and strip diacritics/ZWNJ."""
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(_ARABIC_TO_PERSIAN)
    text = _DIACRITICS_RE.sub("", text)
    if _PUNCT_RE.search(text):
        text = _PUNCT_RE.sub(" ", text)
    return text


def normalize_word(word: str) -> str:
    """Produce the normalized key used for indexing and matching."""
    w = unicodedata.normalize("NFKC", word).strip().lower()
    w = w.translate(_ARABIC_TO_PERSIAN)
    w = _DIACRITICS_RE.sub("", w)
    if _PUNCT_RE.search(w):
        w = _PUNCT_RE.sub(" ", w)
    w = " ".join(w.split())
    return w


def is_persian(text: str) -> bool:
    """True if the text starts with Persian/Arabic script characters."""
    for ch in text.strip():
        if ch.isspace():
            continue
        return "\u0600" <= ch <= "\u06ff" or "\u0750" <= ch <= "\u077f"
    return False


def strips(text: str) -> str:
    """Compact whitespace for display strings."""
    return " ".join(text.split())