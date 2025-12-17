"""Unit tests for PersoDict (no network required).

Run:  python -m unittest discover -s tests
"""

import io
import json
import os
import sqlite3
import sys
import tempfile
import unittest
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

from backend import sources  # noqa: E402
from backend.db import DictDB  # noqa: E402
from backend.normalize import is_persian, normalize_word  # noqa: E402
from backend.parsers import parse_dehkhoda, parse_wordnet  # noqa: E402


class NormalizeTests(unittest.TestCase):
    def test_arabic_to_persian(self):
        self.assertEqual(normalize_word("كتاب"), "کتاب")
        self.assertEqual(normalize_word("يار"), "یار")

    def test_lowercase_punct(self):
        self.assertEqual(normalize_word("Run!"), "run")
        self.assertEqual(normalize_word("  Hello "), "hello")

    def test_diactrics_stripped(self):
        self.assertEqual(normalize_word("کِتاب"), "کتاب")

    def test_is_persian(self):
        self.assertTrue(is_persian("کتاب"))
        self.assertFalse(is_persian("book"))


class DbTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.db = DictDB(self.dir)

    def _seed(self):
        rows = [
            ("book", "noun", 1, "a set of pages", "", ""),
            ("book", "verb", 2, "to reserve", "", ""),
            ("book", "", 1, "\u06a9\u062a\u0627\u0628", "", ""),
            ("@rev", "\u06a9\u062a\u0627\u0628", 0, "book", "", ""),
            ("\u06a9\u062a\u0627\u0628", "", 1, "\u06a9\u062a\u0627\u0628. \u0645\u0639\u0646\u06cc...", "", ""),
        ]
        self.db.import_rows("wn", rows[:2])
        self.db.import_rows("enfa", rows[2:4])
        self.db.import_rows("dehkhoda", rows[4:])

    def test_exact(self):
        self._seed()
        res = self.db.exact("book")
        self.assertEqual(len(res), 3)  # 2 wn + 1 enfa ("کتاب" is a separate lookup)
        srcs = {r["source"] for r in res}
        self.assertEqual(srcs, {"wn", "enfa"})

    def test_reverse(self):
        self._seed()
        self.assertEqual(self.db.reverse_hits("کتاب"), ["book"])

    def test_suggestions(self):
        self._seed()
        self.assertIn("book", self.db.suggestions("boo"))

    def test_history(self):
        self.db.record("book")
        self.db.record("book")
        self.db.record("run")
        hist = self.db.history()
        self.assertEqual(hist["top"][0]["word"], "book")
        self.assertEqual(hist["top"][0]["count"], 2)
        self.db.delete_history("book")
        self.assertEqual(len(self.db.history()["recent"]), 1)
        self.db.clear_history()
        self.assertEqual(self.db.history()["recent"], [])


class WordNetParserTests(unittest.TestCase):
    def _make_zip(self, path):
        # minimal data.noun line (WordNet 3.0 shape)
        data = (
            "00001740 05 n 03 dog 0 domestic_dog 0 Canis_familiaris 0 0 | "
            'a member of the genus Canis; "the dog barked"; common pet\n'
            "00002030 05 n 02 cat 0 true_cat 0 0 | feline mammal\n"
        )
        with zipfile.ZipFile(path, "w") as zf:
            zf.writestr("dict/data.noun", data)

    def test_parse(self):
        d = tempfile.mkdtemp()
        zp = os.path.join(d, "wn.zip")
        self._make_zip(zp)
        out = list(parse_wordnet(zp))
        words = {w for w, *_ in out}
        self.assertIn("dog", words)
        self.assertIn("cat", words)
        # gloss split: definition + example
        dog = [r for r in out if r[0] == "dog"][0]
        self.assertEqual(dog[3], "a member of the genus Canis")
        self.assertIn("the dog barked", dog[4])


class DehkhodaParserTests(unittest.TestCase):
    def test_html_clean(self):
        d = tempfile.mkdtemp()
        ab = "\u0622\u0628"  # آب
        ma = "\u0645\u0627\u06cc\u0639 \u062d\u06cc\u0627\u062a"  # مایع حیات
        nam = "\u0646\u0645\u0648\u0646\u0647: \u0686\u0634\u0645\u0647 "  # نمونه: چشمه
        tk = "\u062a\u06a9\u0631\u0627\u0631"  # تکرار
        sql = (
            "INSERT INTO `words` (`id`, `word`, `meaning`) VALUES\n"
            + "(1, '" + ab + "', '<span class=\"hlight\">" + ab + ".</span> "
            + ma + ".<br />'\n"
            + nam + "<font color=\"Red\">X</font>.'),\n"
            + "(2, '" + ab + "', '" + tk + "');\n"
        )
        gz = os.path.join(d, "t.sql.gz")
        import gzip

        with gzip.open(gz, "wt", encoding="utf-8") as f:
            f.write(sql)
        out = list(parse_dehkhoda([gz]))
        self.assertEqual(len(out), 1)
        word, pos, sense, meaning, ex, extra = out[0]
        self.assertEqual(word, "آب")
        self.assertNotIn("<", meaning)
        self.assertNotIn("span", meaning)


class SourcesTests(unittest.TestCase):
    def test_manifest_urls_reachable(self):
        import urllib.request

        for sid, url in (("wn", sources.URLS["wn"]), ("enfa", sources.URLS["enfa"])):
            req = urllib.request.Request(url, method="HEAD")
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    self.assertIn(r.status, (200, 301, 302), sid)
            except Exception as e:  # network may be unavailable in CI
                self.skipTest(f"network unavailable: {e}")


if __name__ == "__main__":
    unittest.main()