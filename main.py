"""WordFellow — offline Persian/English dictionary for students.

Run:  python main.py
"""

import os
import sys

if getattr(sys, "frozen", False):
    # Frozen (PyInstaller): bundled assets live in the temp extraction dir;
    # user data goes to the conventional per-user app-data folder so it
    # survives updates and never gets wiped.
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(sys.executable)))
    _app_root = os.path.join(
        os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "WordFellow"
    )
    DATA_DIR = os.path.join(_app_root, "data")
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, "data")
sys.path.insert(0, BASE_DIR)

import webview  # noqa: E402

from backend.api import Api  # noqa: E402

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