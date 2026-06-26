#!/usr/bin/env python3
"""Export the current gtamaplib-vc world in a compact data format."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
GTAMAPDATA_PATH = DATA_DIR / "gtamapdata.json"
IMPORT_EXTRAS_PATH = DATA_DIR / "import_extras.json"
OBSERVATION_EDITS_PATH = DATA_DIR / "observation_edits.json"
OPTIMIZER_RESULT_PATH = ROOT / "optimizer" / "result.json"
DEFAULT_OUTPUT_PATH = DATA_DIR / "export" / "data.json"
FAKE_CAMERA_SUFFIX = " Fake Cam"


def compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(", ", ": "))


def natural_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text())


def camera_export_value(camera: dict[str, Any]) -> list[Any]:
    return [
        camera.get("player"),
        camera.get("xyz"),
        camera.get("ypr"),
        camera.get("fov"),
        camera.get("size"),
        camera.get("source", ""),
    ]


def camera_export_key(camera_name: str, camera: dict[str, Any]) -> str:
    camera_id = camera.get("id")
    if camera_id:
        return f"[{camera_id}] {camera_name}"
    return camera_name


def is_exported_camera(camera_name: str) -> bool:
    return not camera_name.endswith(FAKE_CAMERA_SUFFIX)


def apply_world_snapshot(
    cameras: dict[str, dict[str, Any]],
    camera_order: list[str],
    landmarks: dict[str, list[float]],
    landmark_order: list[str],
    snapshot: dict[str, Any],
) -> None:
    if snapshot.get("schema") != "gtamaplibvc-world-v1":
        return
    for camera_name, camera in snapshot.get("cameras", {}).items():
        if camera_name not in cameras:
            camera_order.append(camera_name)
        cameras[camera_name] = camera
    for landmark_name, xyz in snapshot.get("landmarks", {}).items():
        if xyz is None:
            continue
        if landmark_name not in landmarks:
            landmark_order.append(landmark_name)
        landmarks[landmark_name] = xyz


def apply_import_extras(landmarks: dict[str, list[float]], landmark_order: list[str]) -> None:
    import_extras = load_json(IMPORT_EXTRAS_PATH, {})
    for section in ("added_landmarks", "generated_landmarks"):
        for landmark_name, row in import_extras.get(section, {}).items():
            if not row or row[0] is None:
                continue
            if landmark_name not in landmarks:
                landmark_order.append(landmark_name)
            landmarks[landmark_name] = row[0]


def observation_map(observations: list[dict[str, Any]]) -> dict[str, dict[str, list[float]]]:
    by_camera: dict[str, dict[str, list[float]]] = {}
    for observation in observations:
        by_camera.setdefault(observation["camera"], {})[observation["landmark"]] = observation["xy"]
    return by_camera


def apply_observation_edits(
    observations: dict[str, dict[str, list[float]]],
    landmarks: dict[str, list[float]],
    landmark_order: list[str],
) -> None:
    edit_log = load_json(OBSERVATION_EDITS_PATH, {"edits": []})
    for edit in edit_log.get("edits", []):
        action = edit.get("action")
        if action == "add":
            camera_name = edit.get("camera")
            landmark_name = edit.get("landmark")
            if not camera_name or not landmark_name or "xy" not in edit:
                continue
            observations.setdefault(camera_name, {})[landmark_name] = edit["xy"]
        elif action == "edit":
            camera_name = edit.get("camera")
            landmark_name = edit.get("landmark")
            if camera_name not in observations or landmark_name not in observations[camera_name]:
                continue
            if "xy" in edit:
                observations[camera_name][landmark_name] = edit["xy"]
            if edit.get("name") and edit["name"] != landmark_name:
                observations[camera_name][edit["name"]] = observations[camera_name].pop(landmark_name)
        elif action == "remove":
            camera_name = edit.get("camera")
            landmark_name = edit.get("landmark")
            if camera_name in observations:
                observations[camera_name].pop(landmark_name, None)
        elif action == "rename":
            old_name = edit.get("landmark")
            new_name = edit.get("name")
            if not old_name or not new_name or old_name == new_name:
                continue
            for camera_observations in observations.values():
                if old_name in camera_observations:
                    camera_observations[new_name] = camera_observations.pop(old_name)
            if old_name in landmarks and new_name not in landmarks:
                landmarks[new_name] = landmarks.pop(old_name)
                try:
                    landmark_order[landmark_order.index(old_name)] = new_name
                except ValueError:
                    landmark_order.append(new_name)


def exported_world() -> dict[str, Any]:
    gtamapdata = load_json(GTAMAPDATA_PATH, None)
    if gtamapdata is None:
        raise FileNotFoundError(f"Missing {GTAMAPDATA_PATH}; run python3 utils/import_data.py first.")

    camera_order = [camera["name"] for camera in gtamapdata.get("cameras", [])]
    cameras = {camera["name"]: camera for camera in gtamapdata.get("cameras", [])}
    landmark_order = [
        landmark["name"]
        for landmark in gtamapdata.get("landmarks", [])
        if landmark.get("xyz") is not None
    ]
    landmarks = {
        landmark["name"]: landmark["xyz"]
        for landmark in gtamapdata.get("landmarks", [])
        if landmark.get("xyz") is not None
    }
    apply_import_extras(landmarks, landmark_order)
    if OPTIMIZER_RESULT_PATH.exists():
        apply_world_snapshot(
            cameras,
            camera_order,
            landmarks,
            landmark_order,
            load_json(OPTIMIZER_RESULT_PATH, {}),
        )

    observations = observation_map(gtamapdata.get("observations", []))
    apply_observation_edits(observations, landmarks, landmark_order)
    total_observations = sum(len(camera_observations) for camera_observations in observations.values())

    return {
        "schema": "gtamaplib-vc-export-v1",
        "sources": {
            "gtamapdata": str(GTAMAPDATA_PATH.relative_to(ROOT)),
            "import_extras": str(IMPORT_EXTRAS_PATH.relative_to(ROOT)) if IMPORT_EXTRAS_PATH.exists() else None,
            "observation_edits": str(OBSERVATION_EDITS_PATH.relative_to(ROOT)) if OBSERVATION_EDITS_PATH.exists() else None,
            "optimizer_result": str(OPTIMIZER_RESULT_PATH.relative_to(ROOT)) if OPTIMIZER_RESULT_PATH.exists() else None,
        },
        "counts": {
            "cameras": sum(1 for camera_name in cameras if is_exported_camera(camera_name)),
            "observations": total_observations,
            "landmarks": len(landmarks),
        },
        "formats": {
            "cameras": {
                "[<id>] <camera_name>": ["player", "xyz", "ypr", "fov", "size", "source"],
            },
            "observations": {
                "[<id>] <camera_name>": {
                    "<landmark_name>": ["x", "y"],
                },
            },
            "landmarks": {
                "<landmark_name>": ["x", "y", "z"],
            },
        },
        "cameras": {
            camera_export_key(camera_name, cameras[camera_name]): camera_export_value(cameras[camera_name])
            for camera_name in camera_order
            if camera_name in cameras and is_exported_camera(camera_name)
        },
        "observations": {
            camera_export_key(camera_name, cameras[camera_name]): {
                landmark_name: observations[camera_name][landmark_name]
                for landmark_name in sorted(observations[camera_name], key=natural_key)
            }
            for camera_name in camera_order
            if camera_name in cameras and is_exported_camera(camera_name) and camera_name in observations
        },
        "landmarks": {
            landmark_name: landmarks[landmark_name]
            for landmark_name in sorted(landmarks, key=natural_key)
        },
    }


def dumps_export(data: dict[str, Any]) -> str:
    lines = [
        "{",
        f'    "schema": {compact(data["schema"])},',
        f'    "sources": {compact(data["sources"])},',
        f'    "counts": {compact(data["counts"])},',
        f'    "formats": {compact(data["formats"])},',
        '    "cameras": {',
    ]
    camera_items = list(data["cameras"].items())
    for index, (name, value) in enumerate(camera_items):
        comma = "," if index < len(camera_items) - 1 else ""
        lines.append(f"        {compact(name)}: {compact(value)}{comma}")
    lines.extend([
        "    },",
        '    "observations": {',
    ])
    observation_items = list(data["observations"].items())
    for camera_index, (camera_name, camera_observations) in enumerate(observation_items):
        comma = "," if camera_index < len(observation_items) - 1 else ""
        lines.append(f"        {compact(camera_name)}: {{")
        items = list(camera_observations.items())
        for observation_index, (landmark_name, xy) in enumerate(items):
            observation_comma = "," if observation_index < len(items) - 1 else ""
            lines.append(f"            {compact(landmark_name)}: {compact(xy)}{observation_comma}")
        lines.append(f"        }}{comma}")
    lines.extend([
        "    },",
        '    "landmarks": {',
    ])
    landmark_items = list(data["landmarks"].items())
    for index, (name, value) in enumerate(landmark_items):
        comma = "," if index < len(landmark_items) - 1 else ""
        lines.append(f"        {compact(name)}: {compact(value)}{comma}")
    lines.extend(["    }", "}"])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Output JSON file. Defaults to data/export/data.json.",
    )
    args = parser.parse_args()
    data = exported_world()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(dumps_export(data))
    print(
        "Wrote {path} with {cameras} cameras, {observations} observations, "
        "{landmarks} landmarks.".format(
            path=args.output,
            cameras=data["counts"]["cameras"],
            observations=data["counts"]["observations"],
            landmarks=data["counts"]["landmarks"],
        )
    )


if __name__ == "__main__":
    main()
