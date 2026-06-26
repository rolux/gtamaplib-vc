#!/usr/bin/env python3
"""Export local annotation edits in a gtamapdata-friendly format."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import api


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DEFAULT_OUTPUT_PATH = DATA_DIR / "export" / "observations.json"


def camera_id_map(md: Any) -> dict[str, str]:
    ids: dict[str, str] = {}
    for key, camera in getattr(md, "cameras", {}).items():
        if isinstance(camera, dict):
            camera_id = camera.get("id")
            camera_name = camera.get("name", key)
        else:
            camera_id = getattr(camera, "id", None)
            camera_name = getattr(camera, "name", key)
        if camera_id:
            ids[str(camera_name)] = str(camera_id)
    return ids


def camera_sort_key(camera_name: str, camera_ids: dict[str, str]) -> tuple[Any, ...]:
    camera_id = camera_ids.get(camera_name, "")
    match = re.fullmatch(r"([A-Z]+)(\d+)/(\d+)", camera_id)
    if not match:
        return (999, camera_id, camera_name)
    group_order = {"T": 0, "L": 1, "S": 2}.get(match.group(1), 9)
    return (group_order, int(match.group(2)), int(match.group(3)), camera_name)


def camera_label(camera_name: str, camera_ids: dict[str, str]) -> str:
    camera_id = camera_ids.get(camera_name)
    if camera_id:
        return f"[{camera_id}] {camera_name}"
    return camera_name


def fmt_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(float(value)).rstrip("0").rstrip(".")


def format_gtamapdata_block(rows_by_camera: dict[str, list[dict[str, Any]]]) -> str:
    lines: list[str] = []
    for camera_name, rows in rows_by_camera.items():
        lines.append(f'    "{camera_name}": [')
        for row in rows:
            x, y = row["xy"]
            lines.append(f'        (({fmt_number(x)}, {fmt_number(y)}), "{row["landmark"]}"),')
        lines.append("    ],")
    return "\n".join(lines) + ("\n" if lines else "")


def build_export() -> dict[str, Any]:
    md = api.load_md()
    camera_ids = camera_id_map(md)
    upstream = api.observation_map(api.upstream_observations(md))
    current = api.observation_map(api.current_observations(md))
    raw_edits = api.load_edit_log().get("edits", [])

    added: list[tuple[str, str, list[float]]] = []
    changed: list[tuple[str, str, list[float], list[float]]] = []
    removed: list[tuple[str, str, list[float]]] = []

    for camera_name, observations in current.items():
        for landmark_name, xy in observations.items():
            if landmark_name not in upstream.get(camera_name, {}):
                added.append((camera_name, landmark_name, xy))
            elif upstream[camera_name][landmark_name] != xy:
                changed.append((camera_name, landmark_name, upstream[camera_name][landmark_name], xy))

    for camera_name, observations in upstream.items():
        for landmark_name, xy in observations.items():
            if landmark_name not in current.get(camera_name, {}):
                removed.append((camera_name, landmark_name, xy))

    addition_set = {(camera_name, landmark_name, tuple(xy)) for camera_name, landmark_name, xy in added}
    rename_additions: list[tuple[str, str, list[float]]] = []
    for camera_name, old_landmark_name, old_xy in removed:
        for new_landmark_name, new_xy in current.get(camera_name, {}).items():
            key = (camera_name, new_landmark_name, tuple(new_xy))
            if new_landmark_name != old_landmark_name and new_xy == old_xy and key not in addition_set:
                rename_additions.append((camera_name, new_landmark_name, new_xy))
                addition_set.add(key)

    added_with_renames = added + rename_additions

    def grouped(rows: list[tuple[str, str, list[float]]]) -> dict[str, list[dict[str, Any]]]:
        camera_names = sorted({camera_name for camera_name, _, _ in rows}, key=lambda name: camera_sort_key(name, camera_ids))
        result: dict[str, list[dict[str, Any]]] = {}
        for camera_name in camera_names:
            camera_rows = [
                {"landmark": landmark_name, "xy": xy}
                for row_camera_name, landmark_name, xy in rows
                if row_camera_name == camera_name
            ]
            camera_rows.sort(key=lambda row: (row["xy"][0], row["xy"][1], row["landmark"]))
            result[camera_label(camera_name, camera_ids)] = camera_rows
        return result

    def grouped_changed(rows: list[tuple[str, str, list[float], list[float]]]) -> dict[str, list[dict[str, Any]]]:
        camera_names = sorted({camera_name for camera_name, _, _, _ in rows}, key=lambda name: camera_sort_key(name, camera_ids))
        result: dict[str, list[dict[str, Any]]] = {}
        for camera_name in camera_names:
            camera_rows = [
                {"landmark": landmark_name, "from": old_xy, "to": new_xy}
                for row_camera_name, landmark_name, old_xy, new_xy in rows
                if row_camera_name == camera_name
            ]
            camera_rows.sort(key=lambda row: (row["to"][0], row["to"][1], row["landmark"]))
            result[camera_label(camera_name, camera_ids)] = camera_rows
        return result

    additions = grouped(added_with_renames)
    removals = grouped(removed)

    return {
        "schema": "gtamaplib-vc-observation-export-v1",
        "sources": {
            "observation_edits": str(api.OBSERVATION_EDITS_JSON_PATH.relative_to(ROOT)),
        },
        "counts": {
            "raw_edits": len(raw_edits),
            "added": len(added),
            "added_with_renames": len(added_with_renames),
            "changed": len(changed),
            "removed": len(removed),
        },
        "additions": additions,
        "removals": removals,
        "changes": grouped_changed(changed),
        "gtamapdata": {
            "additions": format_gtamapdata_block(additions),
            "removals": format_gtamapdata_block(removals),
        },
    }


def clear_edits() -> None:
    api.write_edit_log({"schema": api.SCHEMA, "edits": []})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output JSON file. Defaults to data/export/observations.json.",
    )
    parser.add_argument(
        "--remove",
        action="store_true",
        help="Clear the local annotation edit overlay after exporting.",
    )
    args = parser.parse_args()

    data = build_export()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")

    if data["gtamapdata"]["additions"]:
        print(data["gtamapdata"]["additions"], end="")
    if data["gtamapdata"]["removals"]:
        print("\nRemoved observations:")
        print(data["gtamapdata"]["removals"], end="")
    print(
        "Wrote {path} with {added} additions ({added_with_renames} including renames), "
        "{changed} changes, {removed} removals.".format(path=args.output, **data["counts"])
    )

    if args.remove:
        clear_edits()
        print("Cleared local annotation edits.")


if __name__ == "__main__":
    main()
