#!/usr/bin/env python3
"""Serve the local gtamaplib-vc UI."""

from __future__ import annotations

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


PORT = 8026
ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        if path in {"/", "/index.html", "/app.js", "/map.js", "/style.css"}:
            name = "index.html" if path in {"/", "/index.html"} else path.removeprefix("/")
            return str(UI / name)
        return super().translate_path(path)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving gtamaplib-vc at http://127.0.0.1:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
