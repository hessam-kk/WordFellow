"""WordFellow — offline Persian/English dictionary for students.

Run:  python main.py
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

import webview  # noqa: E402

from backend.api import Api  # noqa: E402

DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND = os.path.join(BASE_DIR, "frontend", "index.html")


def main():
    api = Api(DATA_DIR)
    window = webview.create_window(
        "WordFellow — Offline Student Dictionary",
        FRONTEND,
        js_api=api,
        width=1160,
        height=780,
        min_size=(900, 620),
        maximized=True,
    )
    window.events.closing += lambda: api.close()
    # http_server serves the local page so the pywebview JS bridge is injected
    # deterministically (avoids the file:// injection race that broke the API).
    webview.start(
        debug=False,
        http_server=True,
        private_mode=False,
        storage_path=os.path.join(DATA_DIR, "webview"),
    )


if __name__ == "__main__":
    main()