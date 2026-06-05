"""Desktop launcher — one process that serves the dashboard and opens it.

    python desktop.py            # run from source
    LedgerDiligence.exe          # the packaged build (double-click)

Starts the FastAPI app (which serves both the API and the built dashboard) on a
local port, waits for it to come up, then opens a native window (pywebview) — or
the default browser if pywebview isn't available. Set LEDGER_HEADLESS=1 to start
the server, confirm health, and exit (used to smoke-test the packaged EXE).
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
from pathlib import Path

# Windowed builds (PyInstaller --windowed) have no console, so sys.stdout/stderr are
# None. Libraries that call sys.stdout.isatty() (e.g. uvicorn's log formatter) crash on
# that — give them a real stream (a log file we can inspect if anything goes wrong).
if sys.stdout is None or sys.stderr is None:
    try:
        _logdir = Path.home() / ".ledger"
        _logdir.mkdir(parents=True, exist_ok=True)
        _stream = open(_logdir / "ledger.log", "a", buffering=1, encoding="utf-8")
    except Exception:
        _stream = open(os.devnull, "w")
    if sys.stdout is None:
        sys.stdout = _stream
    if sys.stderr is None:
        sys.stderr = _stream


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _prepare_env() -> None:
    # Writable location for the SQLite db + uploaded files when running as an app.
    os.environ.setdefault("QOE_DATA_ROOT", str(Path.home() / ".ledger"))


def _wait_until_up(url: str, timeout: float = 25.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


def main() -> int:
    _prepare_env()
    port = int(os.environ.get("LEDGER_PORT") or _free_port())
    url = f"http://127.0.0.1:{port}"

    # Import after env is set so config picks up QOE_DATA_ROOT.
    import uvicorn
    from qoe.api import app

    # log_config=None skips uvicorn's colourized formatter, which assumes a TTY and
    # crashes in a windowed (no-console) build.
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", log_config=None)
    )
    threading.Thread(target=server.run, daemon=True).start()

    if not _wait_until_up(f"{url}/api/health"):
        print("Backend failed to start.", file=sys.stderr)
        return 1

    # Headless smoke-test mode: confirm it serves, embeddings run, AND the document
    # parsers are actually bundled + functional (a lazy-imported parser that didn't get
    # packaged would silently break that file type — guard against it here), then exit.
    if os.environ.get("LEDGER_HEADLESS"):
        dim = 0
        try:
            from qoe import embeddings
            if embeddings.AVAILABLE:
                dim = len(embeddings.embed(["hello world"])[0])
        except Exception as exc:  # noqa: BLE001
            dim = -1
            print(f"embeddings error: {exc}", file=sys.stderr)

        missing = []
        for name in ("openpyxl", "pypdf", "docx", "xlrd", "pptx", "striprtf"):
            try:
                __import__(name)
            except Exception:
                missing.append(name)

        xlsx_chunks = -1  # functional check of the real ingest pipeline in the frozen build
        try:
            import tempfile
            from openpyxl import Workbook
            from qoe import ingest
            probe = Path(tempfile.gettempdir()) / "_ledger_probe.xlsx"
            wb = Workbook()
            wb.active.append(["item", "FY0"])
            wb.active.append(["Revenue", 3420345])
            wb.save(probe)
            xlsx_chunks = len(ingest.load_file(probe))
            probe.unlink(missing_ok=True)
        except Exception as exc:  # noqa: BLE001
            print(f"xlsx probe error: {exc}", file=sys.stderr)

        print(
            f"OK | serving {url} | embeddings={'on' if dim > 0 else 'off'} dim={dim} | "
            f"parsers={'all-ok' if not missing else 'MISSING:' + ','.join(missing)} | "
            f"xlsx_chunks={xlsx_chunks}"
        )
        return 0

    # Native app window, falling back to the browser.
    try:
        import webview  # pywebview
        webview.create_window("Ledger — Diligence Workspace", url, width=1440, height=920)
        webview.start()
        return 0
    except Exception:
        import webbrowser
        webbrowser.open(url)
        print(f"Ledger is running at {url}  (close this window to quit)")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
