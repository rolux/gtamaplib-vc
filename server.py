#!/usr/bin/env python3
"""Serve the local gtamaplib-vc UI."""

from __future__ import annotations

import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import api


PORT = 8026
ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        if path in {"/", "/index.html", "/app.js", "/map.js", "/style.css"}:
            name = "index.html" if path in {"/", "/index.html"} else path.removeprefix("/")
            return str(UI / name)
        return super().translate_path(path)


def main() -> None:
    ui_server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    api_server = ThreadingHTTPServer(("127.0.0.1", api.PORT), api.Handler)
    api_thread = threading.Thread(target=api_server.serve_forever, daemon=True)
    api_thread.start()
    print(f"Serving gtamaplib-vc web UI at http://127.0.0.1:{PORT}/")
    print(f"Serving gtamaplib-vc edit API at http://127.0.0.1:{api.PORT}/")
    try:
        ui_server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        ui_server.server_close()
        api_server.shutdown()
        api_server.server_close()


if __name__ == "__main__":
    main()
