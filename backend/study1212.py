"""1212 TOEFL word list — study pack definition.

Registers the built-in 1212 TOEFL vocabulary as a ``StudyPack`` so the
generic study framework (search, flashcards, Leitner boxes) applies to
it.  The word list lives in the 1212_Category/ folder.
"""

from .study import StudyPack, register

register(
    StudyPack(
        pack_id="1212",
        folder="1212_Category",
        title="1212 Words",
        description="The essential TOEFL vocabulary, grouped into topics. "
        "Study with flashcards — words you miss come back until you master them.",
    )
)