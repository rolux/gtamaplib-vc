"""Install local optimizer working files from checked-in defaults."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OPTIMIZER_DIR = ROOT / "optimizer"
OPTIMIZER_DEFAULTS = OPTIMIZER_DIR / "defaults"


def copy_if_missing(source: Path, target: Path) -> bool:
    if target.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return True


def ensure_optimizer_defaults() -> None:
    copied = []
    if copy_if_missing(OPTIMIZER_DEFAULTS / "chain.json", OPTIMIZER_DIR / "chain.json"):
        copied.append("optimizer/chain.json")

    configs_source = OPTIMIZER_DEFAULTS / "configs"
    configs_target = OPTIMIZER_DIR / "configs"
    configs_target.mkdir(parents=True, exist_ok=True)
    for source in sorted(configs_source.glob("*.json")):
        target = configs_target / source.name
        if copy_if_missing(source, target):
            copied.append(str(target.relative_to(ROOT)))

    if copied:
        print("Installed optimizer working default(s):")
        for path in copied:
            print(f"  {path}")
    else:
        print("Optimizer working files already exist.")
