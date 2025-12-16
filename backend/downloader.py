"""Streaming downloader with progress reporting (no word-by-word calls)."""

import os
import time
import urllib.error
import urllib.request

CHUNK = 256 * 1024
RETRIES = 5
USER_AGENT = "Mozilla/5.0 (PersoDict/1.0)"


def _open(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=60)


def head_size(url: str) -> int:
    try:
        with _open(url) as resp:
            return int(resp.headers.get("Content-Length") or 0)
    except Exception:
        return 0


def download(url: str, dest: str, progress=None) -> bool:
    """Stream `url` to `dest`. `progress(done_bytes, total_bytes)` is
    called periodically. Returns True on success."""
    tmp = dest + ".part"
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    for attempt in range(1, RETRIES + 1):
        try:
            with _open(url) as resp:
                total = int(resp.headers.get("Content-Length") or 0)
                done = 0
                with open(tmp, "wb") as f:
                    while True:
                        chunk = resp.read(CHUNK)
                        if not chunk:
                            break
                        f.write(chunk)
                        done += len(chunk)
                        if progress:
                            progress(done, total)
            if progress:
                progress(done, done)
            if os.path.getsize(tmp) == 0:
                raise IOError("empty download")
            os.replace(tmp, dest)
            return True
        except (urllib.error.URLError, OSError, IOError):
            if attempt < RETRIES:
                time.sleep(1.0 * attempt)
                continue
            try:
                os.remove(tmp)
            except OSError:
                pass
            return False
    return False


def download_many(urls, dest_dir, progress=None):
    """Download a list of files into dest_dir; returns (total_bytes, ok)."""
    os.makedirs(dest_dir, exist_ok=True)
    names = [os.path.basename(u.split("?")[0]) for u in urls]
    sizes = [head_size(u) for u in urls]
    grand = sum(sizes) or 1
    done_all = 0
    result = []
    for url, name, size in zip(urls, names, sizes):
        dest = os.path.join(dest_dir, name)

        def make_cb(base=done_all, this_total=size or 0):
            def cb(done, total):
                if progress:
                    progress(base + done, grand)
            return cb

        if os.path.isfile(dest) and os.path.getsize(dest) > 0 and os.path.getsize(dest) == size:
            done_all += size
            result.append(True)
            continue
        ok = download(url, dest, make_cb())
        result.append(ok)
        done_all += size
        if not ok:
            # give GitHub CDN a breather before the next file
            time.sleep(2.0)
    return result, grand