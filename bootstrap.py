#!/usr/bin/env python3
"""Prepare a local gtamaplib-vc checkout."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
GTAMAPLIB = ROOT / "gtamaplib"
GTADB = ROOT / "gtadb.org"
GTADB_TILES = ROOT / "gtadb.org" / "maps" / "tiles" / "6" / "yanis,12"
GTAMAPLIB_ASSETS = ("fonts.zip", "frames.zip", "maps.zip")
GTAMAPLIB_URL = "https://github.com/rolux/gtamaplib.git"
GTADB_URL = "https://github.com/rolux/gtadb.org.git"
GTADB_TILE_PATH = "maps/tiles/6/yanis,12"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def check_git_lfs() -> None:
    try:
        subprocess.run(["git", "lfs", "version"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        raise SystemExit(
            "Git LFS is required to fetch gtamaplib assets. Install Git LFS, then run python3 bootstrap.py again."
        ) from error


def ensure_gtamaplib_assets() -> None:
    check_git_lfs()
    run(["git", "-C", "gtamaplib", "lfs", "pull"])
    missing = [name for name in GTAMAPLIB_ASSETS if not (GTAMAPLIB / name).exists()]
    if missing:
        raise SystemExit(f"Missing gtamaplib LFS asset(s): {', '.join(missing)}")


def ensure_gtamaplib() -> None:
    if GTAMAPLIB.exists():
        print(f"Found gtamaplib: {GTAMAPLIB.relative_to(ROOT)}")
        ensure_gtamaplib_assets()
        return
    run(["git", "clone", GTAMAPLIB_URL, "gtamaplib"])
    ensure_gtamaplib_assets()


def ensure_gtadb_tiles() -> None:
    if not GTADB.exists():
        run(["git", "clone", "--filter=blob:none", "--sparse", GTADB_URL, "gtadb.org"])
    if GTADB_TILES.exists():
        print(f"Found yanis,12 map tiles: {GTADB_TILES.relative_to(ROOT)}")
        return
    run(["git", "-C", "gtadb.org", "sparse-checkout", "set", GTADB_TILE_PATH])
    if not GTADB_TILES.exists():
        raise SystemExit(f"Missing yanis,12 map tiles after sparse checkout: {GTADB_TILES.relative_to(ROOT)}")


def main() -> None:
    ensure_gtamaplib()
    ensure_gtadb_tiles()
    run([sys.executable, "import_data.py"])
    run([sys.executable, "generate_priors.py"])


if __name__ == "__main__":
    main()
