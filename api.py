#!/usr/bin/env python3
"""Local edit API for gtamaplib-vc observations."""

from __future__ import annotations

import json
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from utils.import_data import (
    DATA_DIR,
    OBSERVATION_EDITS_JSON_PATH,
    add_import_path,
    get_color,
    quantize_xy,
)


PORT = 8027
SCHEMA = "gtamaplib-vc-observation-edits-v1"


def load_md() -> Any:
    add_import_path()
    from gtamaplib import gtamapdata as md

    return md


def upstream_observations(md: Any) -> list[dict[str, Any]]:
    observations = []
    for camera_name, camera_pixels in md.pixels.items():
        for landmark_name, xy in camera_pixels.items():
            observations.append(
                {
                    "camera": camera_name,
                    "landmark": landmark_name,
                    "xy": [float(xy[0]), float(xy[1])],
                }
            )
    return observations


def current_observations(md: Any) -> list[dict[str, Any]]:
    observations = upstream_observations(md)
    by_camera = observation_map(observations)
    for edit in load_edit_log()["edits"]:
        action = edit.get("action")
        if action == "add":
            camera = str(edit.get("camera", ""))
            if camera not in md.cameras:
                continue
            by_camera.setdefault(camera, {})[str(edit.get("landmark", ""))] = quantize_xy(edit.get("xy"))
        elif action == "edit":
            camera = str(edit.get("camera", ""))
            landmark = str(edit.get("landmark", ""))
            if camera not in by_camera or landmark not in by_camera[camera]:
                continue
            if "xy" in edit:
                by_camera[camera][landmark] = quantize_xy(edit.get("xy"))
            if "name" in edit:
                name = str(edit.get("name", "")).strip()
                if name and name not in by_camera[camera]:
                    by_camera[camera][name] = by_camera[camera].pop(landmark)
        elif action == "remove":
            camera = str(edit.get("camera", ""))
            landmark = str(edit.get("landmark", ""))
            if camera in by_camera:
                by_camera[camera].pop(landmark, None)
        elif action == "rename":
            landmark = str(edit.get("landmark", ""))
            name = str(edit.get("name", "")).strip()
            if not name:
                continue
            for camera_observations in by_camera.values():
                if landmark in camera_observations and name not in camera_observations:
                    camera_observations[name] = camera_observations.pop(landmark)

    observations = []
    for camera, camera_observations in by_camera.items():
        for landmark, xy in camera_observations.items():
            observations.append({"camera": camera, "landmark": landmark, "xy": xy})
    return observations


def observation_map(observations: list[dict[str, Any]]) -> dict[str, dict[str, list[float]]]:
    by_camera: dict[str, dict[str, list[float]]] = {}
    for observation in observations:
        by_camera.setdefault(observation["camera"], {})[observation["landmark"]] = observation["xy"]
    return by_camera


def all_landmark_names(md: Any, observations: list[dict[str, Any]]) -> set[str]:
    names = set(md.landmarks)
    names.update(observation["landmark"] for observation in observations)
    return names


def unique_unnamed_name(existing_names: set[str]) -> str:
    if "Unnamed" not in existing_names:
        return "Unnamed"
    index = 2
    while True:
        name = f"Unnamed [{index}]"
        if name not in existing_names:
            return name
        index += 1


def request_name(request: dict[str, Any], key: str) -> str:
    name = str(request[key]).strip()
    if not name:
        raise ValueError(f"{key} must not be empty")
    return name


def load_edit_log() -> dict[str, Any]:
    if not OBSERVATION_EDITS_JSON_PATH.exists():
        return {"schema": SCHEMA, "edits": []}
    data = json.loads(OBSERVATION_EDITS_JSON_PATH.read_text())
    if data.get("schema") != SCHEMA:
        raise ValueError(f"Unsupported observation edit schema: {data.get('schema')!r}")
    edits = data.get("edits")
    if not isinstance(edits, list):
        raise ValueError("Observation edit log has no edits list")
    return data


def write_edit_log(data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=4, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=DATA_DIR,
        prefix=".observation_edits.",
        suffix=".tmp",
        delete=False,
    ) as file:
        file.write(text)
        temp_path = Path(file.name)
    temp_path.replace(OBSERVATION_EDITS_JSON_PATH)


def append_edit(edit: dict[str, Any]) -> None:
    landmark = edit.get("name") or edit.get("landmark")
    if landmark and "color" not in edit:
        edit = {**edit, "color": get_color(str(landmark))}
    data = load_edit_log()
    data["edits"].append(edit)
    write_edit_log(data)


def edit_response(edit: dict[str, Any]) -> dict[str, Any]:
    landmark = edit.get("name") or edit.get("landmark")
    return {
        "ok": True,
        "edit": edit,
        "color": get_color(str(landmark)) if landmark else "#fff",
    }


def resolve_edit(request: dict[str, Any]) -> dict[str, Any]:
    md = load_md()
    observations = current_observations(md)
    by_camera = observation_map(observations)
    landmark_names = all_landmark_names(md, observations)
    action = request.get("action")

    if action == "add":
        camera = request_name(request, "camera")
        if camera not in md.cameras:
            raise ValueError(f"Unknown camera: {camera}")
        name = unique_unnamed_name(landmark_names)
        return {
            "action": "add",
            "camera": camera,
            "landmark": name,
            "xy": quantize_xy(request["xy"]),
        }

    if action == "edit":
        camera = request_name(request, "camera")
        landmark = request_name(request, "landmark")
        if camera not in by_camera or landmark not in by_camera[camera]:
            raise ValueError(f"Unknown observation: {camera} / {landmark}")
        edit = {
            "action": "edit",
            "camera": camera,
            "landmark": landmark,
        }
        if "xy" in request:
            edit["xy"] = quantize_xy(request["xy"])
        if "name" in request:
            name = request_name(request, "name")
            if name != landmark and name in by_camera[camera]:
                raise ValueError(f"Observation name already exists in camera: {name}")
            edit["name"] = name
        if "xy" not in edit and "name" not in edit:
            raise ValueError("Edit requires xy or name")
        return edit

    if action == "remove":
        camera = request_name(request, "camera")
        landmark = request_name(request, "landmark")
        if camera not in by_camera or landmark not in by_camera[camera]:
            raise ValueError(f"Unknown observation: {camera} / {landmark}")
        return {
            "action": "remove",
            "camera": camera,
            "landmark": landmark,
        }

    if action == "rename":
        landmark = request_name(request, "landmark")
        name = request_name(request, "name")
        if landmark not in landmark_names:
            raise ValueError(f"Unknown landmark: {landmark}")
        if name != landmark and name in landmark_names:
            raise ValueError(f"Landmark name already exists: {name}")
        return {
            "action": "rename",
            "landmark": landmark,
            "name": name,
        }

    raise ValueError(f"Unknown action: {action!r}")


class Handler(BaseHTTPRequestHandler):
    def end_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin in {"http://127.0.0.1:8026", "http://localhost:8026"}:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, indent=4, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/observations":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(request, dict):
                raise ValueError("Request body must be a JSON object")
            edit = resolve_edit(request)
            append_edit(edit)
            self.send_json(200, edit_response(edit))
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving gtamaplib-vc edit API at http://127.0.0.1:{PORT}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
