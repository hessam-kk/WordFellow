"""Offline text-to-speech worker — direct SAPI5 via win32com.

Uses a single dedicated STA thread that owns the SAPI SpVoice COM object.
This avoids pyttsx3's internal driver thread which silently fails when
the calling context is not the main thread (as with pywebview API calls).
"""

import queue
import sys
import threading

_started = False
_lock = threading.Lock()
_q: "queue.Queue[str | None]" = queue.Queue()
_state = {
    "ready": False,
    "spoken": 0,
    "last_word": "",
    "error": "",
}


def _log(msg: str):
    print(f"[tts] {msg}", file=sys.stderr, flush=True)


def _worker():
    import pythoncom
    import win32com.client

    pythoncom.CoInitialize()
    voice = None
    try:
        voice = win32com.client.Dispatch("SAPI.SpVoice")
        voice.Rate = 1  # SAPI scale: -10..10, 0 = normal, 1 = slightly fast
        _state["ready"] = True
        _log("engine ready")
    except Exception as exc:  # noqa: BLE001
        _state["error"] = f"init: {type(exc).__name__}: {exc}"
        _log(f"init failed — {_state['error']}")
    while True:
        word = _q.get()
        if word is None:
            break
        try:
            if voice is None:
                pythoncom.CoInitialize()
                voice = win32com.client.Dispatch("SAPI.SpVoice")
                voice.Rate = 1
                _state["ready"] = True
            # flags=0 → synchronous (blocks until spoken)
            voice.Speak(word, 0)
            _state["spoken"] += 1
            _state["last_word"] = word
            _state["error"] = ""
        except Exception as exc:  # noqa: BLE001
            _state["error"] = f"speak: {type(exc).__name__}: {exc}"
            _log(f"speaking {word!r} failed — {_state['error']}")
            try:
                voice = None
            except Exception:  # noqa: BLE001
                pass
    try:
        pythoncom.CoUninitialize()
    except Exception:  # noqa: BLE001
        pass


def _ensure_thread():
    global _started
    with _lock:
        if _started:
            return
        _started = True
        threading.Thread(target=_worker, daemon=True, name="wordfellow-tts").start()


def say(word: str):
    """Queue a word for speaking (never blocks the caller)."""
    word = (word or "").strip()
    if not word:
        return
    _ensure_thread()
    _q.put(word)


def ensure_started():
    """Spin up the worker thread so the engine initialises eagerly (used at
    boot so the footer can show whether TTS is ready)."""
    _ensure_thread()


def state() -> dict:
    """Diagnostics for the frontend/tests: engine readiness + last error."""
    return dict(_state)
