#!/usr/bin/env python3
"""Prepare a local gtamaplib-vc checkout."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from utils.optimizer_defaults import ensure_optimizer_defaults


ROOT = Path(__file__).resolve().parent
GTAMAPLIB = ROOT / "gtamaplib"
GTADB = ROOT / "gtadb.org"
GTADB_TILES = ROOT / "gtadb.org" / "maps" / "tiles" / "6" / "yanis,13"
GTAMAPLIB_URL = "https://github.com/rolux/gtamaplib.git"
GTADB_URL = "https://github.com/rolux/gtadb.org.git"
GTADB_TILE_PATH = "maps/tiles/6/yanis,13"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def ensure_gtamaplib() -> None:
    if GTAMAPLIB.exists():
        print(f"Found gtamaplib: {GTAMAPLIB.relative_to(ROOT)}")
        return
    run(["git", "clone", GTAMAPLIB_URL, "gtamaplib"])


def ensure_gtadb_tiles() -> None:
    if not GTADB.exists():
        run(["git", "clone", "--filter=blob:none", "--sparse", GTADB_URL, "gtadb.org"])
    if GTADB_TILES.exists():
        print(f"Found yanis,13 map tiles: {GTADB_TILES.relative_to(ROOT)}")
        return
    run(["git", "-C", "gtadb.org", "sparse-checkout", "set", GTADB_TILE_PATH])
    if not GTADB_TILES.exists():
        raise SystemExit(f"Missing yanis,13 map tiles after sparse checkout: {GTADB_TILES.relative_to(ROOT)}")


def main() -> None:
    ensure_optimizer_defaults()
    ensure_gtamaplib()
    ensure_gtadb_tiles()
    run([sys.executable, "utils/import_data.py"])
    run([sys.executable, "utils/generate_priors.py"])


if __name__ == "__main__":
    main()
