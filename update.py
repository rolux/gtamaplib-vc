#!/usr/bin/env python3
"""Update external data sources and regenerate local gtamaplib-vc data."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from utils.optimizer_defaults import ensure_optimizer_defaults


ROOT = Path(__file__).resolve().parent
GTAMAPLIB = ROOT / "gtamaplib"
GTADB = ROOT / "gtadb.org"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, check=True)


def update_repo(path: Path, name: str) -> None:
    if not path.exists():
        raise SystemExit(f"Missing {name}: {path.relative_to(ROOT)}. Run python3 bootstrap.py first.")
    run(["git", "-C", str(path.relative_to(ROOT)), "pull", "--ff-only"])


def main() -> None:
    print("Updating gtamaplib-vc external data sources.")
    print("Note: updating gtamaplib may change imported cameras, landmarks, observations, and optimizer inputs.")
    update_repo(GTAMAPLIB, "gtamaplib")
    update_repo(GTADB, "gtadb.org")
    ensure_optimizer_defaults()
    run([sys.executable, "utils/import_data.py"])
    run([sys.executable, "utils/generate_priors.py"])


if __name__ == "__main__":
    main()
