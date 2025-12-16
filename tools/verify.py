"""End-to-end smoke test: downloads the real dictionaries into a temp dir,
imports them, and runs lookups. Use:  python tools/verify.py [--skip-enfa]"""

import os
import shutil
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

import io  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from backend.api import Api  # noqa: E402

WORK = os.path.join(BASE, "data", "_verify")
SKIP_ENFA = "--skip-enfa" in sys.argv


def main():
    if os.path.isdir(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK)
    api = Api(WORK)
    t0 = time.time()

    for sid in (["wn", "dehkhoda"] + (["enfa"] if not SKIP_ENFA else [])):
        print(f"\n=== installing {sid} ===")
        r = api.install(sid)
        assert r["ok"], r
        wait = 0
        while True:
            dl = api.download_state()
            if dl["stage"] in ("error", "done") or wait > 600:
                break
            time.sleep(1.2)
            wait += 1
        assert dl["stage"] == "done", dl
        api.db._conn.commit()  # no-op; ensure fresh reads
        print("installed:", api.db.get_meta(f"installed:{sid}"))
        print("rows:", api.db.source_count(sid))

    print("\n=== searches ===")
    tests = [
        ("hello", "wn should show an English definition"),
        ("run", "wn verb senses"),
        ("book", "enfa persian senses"),
        ("انسان", "dehkhoda + rev index"),
        ("کتاب", "dehkhoda"),
        ("water", "cross-check"),
        ("zzzznonexist", "no results -> suggestions"),
    ]
    for word, note in tests:
        res = api.search(word)
        print(f"\n--- {word!r} [{note}]")
        print("  exact rows:", len(res["exact"]))
        for r in res["exact"][:3]:
            print(f"   [{r['source']}] {r['word']!r} ({r['pos']}) sense#{r['sense_no']}: {r['definition'][:70]!r}")
        if res["reverse"]:
            print("   reverse:", res["reverse"][:6])
        if res["suggestions"]:
            print("   suggestions:", res["suggestions"][:6])
        if word == "zzzznonexist":
            # a clearly-fake word legitimately has no results/suggestions
            continue
        assert res["exact"] or res["reverse"] or res["suggestions"], f"nothing for {word}"

    print("\n=== history ===")
    hist = api.history()
    print("recent:", [(h["word"], h["count"]) for h in hist["recent"]][:8])
    print("top:", [(h["word"], h["count"]) for h in hist["top"]][:5])
    api.delete_history("hello")
    api.clear_history()
    assert api.history()["recent"] == []
    print("history tracking ok")

    print("\n=== suggestions ===")
    for q in ("hel", "کتابخ", "wat", "ان"):
        print(f"  {q!r} ->", api.suggest(q)[:6])

    print(f"\nALL OK in {time.time()-t0:.0f}s — db at {api.db.path}")
    api.close()


if __name__ == "__main__":
    main()