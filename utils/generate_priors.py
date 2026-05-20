#!/usr/bin/env python3
"""Generate the initial optimizer priors from imported gtamaplib data."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OPTIMIZER_DIR = ROOT / "optimizer"
PRIORS_PATH = OPTIMIZER_DIR / "priors.json"

sys.path.insert(0, str(ROOT))

from gtamaplib import gtamapdata as md
from gtamaplib.gtamaplib import FourSeasons, get_camera, get_vfov, intersect_ray_and_ray, intersect_rays

from utils.import_data import (
    CONFIG_JSON_PATH,
    IMPORT_EXTRAS_JSON_PATH,
    SPECIAL_JSON_PATH,
    is_leonida_keys_pin_triangulation,
    is_ignored_triangulation_landmark,
    max_ray_pair_angle_degrees,
    mean_pair_delta_m,
)


FORMATS = {
    "landmark": [
        "landmark",
        "name",
        ["x", "y", "z"],
        "xyz_rigidity_m",
    ],
    "camera": [
        "camera",
        "name",
        ["player_x", "player_y", "player_z"],
        ["x", "y", "z"],
        ["yaw", "pitch", "roll"],
        ["hfov", "vfov"],
        ["width", "height"],
        "xyz_rigidity_m",
        "ypr_rigidity_deg",
        "fov_rigidity_deg",
    ],
}

RIGIDITY = {
    "fixed": 0.0,
    "free": None,
    "positive_scalar": "1-sigma uncertainty in the corresponding unit",
}

CAMERA_RIGIDITY_BY_LEVEL = {
    1: (0.05, None, 0.05),
    2: (0.05, 0.05, 0.05),
    3: (0.0005, 0.0005, 0.0005),
}

DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEG = 1.0


def point(value: Any) -> list[float] | None:
    if value is None:
        return None
    return [float(item) for item in value]


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text())


def import_extra_landmarks() -> dict[str, list[float]]:
    data = load_json(IMPORT_EXTRAS_JSON_PATH, {})
    landmarks: dict[str, list[float]] = {}
    for section in ("added_landmarks", "generated_landmarks"):
        for name, row in data.get(section, {}).items():
            if row and row[0]:
                landmarks[name] = [float(value) for value in row[0]]
    return landmarks


def four_seasons_landmarks(extra_landmarks: dict[str, list[float]]) -> dict[str, list[float]]:
    fs = FourSeasons()
    rows = {
        "Four Seasons Hotel Miami (BE)": fs.hb58se,
        "Four Seasons Hotel Miami (BW)": fs.hb58sw,
        "Four Seasons Hotel Miami (BNE)": fs.hb58ne,
        "Four Seasons Hotel Miami (BNW)": fs.hb58nw,
        "Four Seasons Hotel Miami (E)": fs.fs57e,
        "Four Seasons Hotel Miami (NE)": fs.fs57ne,
        "Four Seasons Hotel Miami (NW)": fs.fs57nw,
        "Four Seasons Hotel Miami (SE)": fs.fs56se,
        "Four Seasons Hotel Miami (SW)": fs.fs56sw,
        "Four Seasons Hotel Miami (W)": fs.fs57w,
        "Four Seasons Hotel Miami (40NE)": fs.fs40ne,
        "Four Seasons Hotel Miami (40NW)": fs.fs40nw,
        "Four Seasons Hotel Miami (40E)": fs.fs40e,
        "Four Seasons Hotel Miami (40W)": fs.fs40w,
        "Four Seasons Hotel Miami (56NE)": fs.fs56ne,
        "Four Seasons Hotel Miami (56NW)": fs.fs56nw,
        "Four Seasons Hotel Miami (56SE)": fs.fs56se,
        "Four Seasons Hotel Miami (56SW)": fs.fs56sw,
        "Four Seasons Hotel Miami (57NE)": fs.fs57ne,
        "Four Seasons Hotel Miami (57NW)": fs.fs57nw,
        "Four Seasons Hotel Miami (57E)": fs.fs57e,
        "Four Seasons Hotel Miami (57W)": fs.fs57w,
    }
    for name, xyz in extra_landmarks.items():
        if name.startswith("Four Seasons Hotel Miami"):
            rows[name] = xyz
    return {name: [float(value) for value in xyz] for name, xyz in rows.items()}


def rigid_camera_levels(special: dict[str, Any]) -> dict[str, int]:
    levels: dict[str, int] = {}
    for group in special.get("camera_rigidity", []):
        level = int(group["level"])
        if level not in CAMERA_RIGIDITY_BY_LEVEL:
            continue
        for camera_name in group.get("cameras", []):
            if camera_name in md.cameras:
                levels[camera_name] = level
    return levels


def camera_rows(camera_levels: dict[str, int]) -> list[list[Any]]:
    rows = []
    for camera_name in sorted(camera_levels):
        cam = get_camera(camera_name)
        xyz_sigma, ypr_sigma, fov_sigma = CAMERA_RIGIDITY_BY_LEVEL[camera_levels[camera_name]]
        rows.append(
            [
                "camera",
                camera_name,
                point(cam.player),
                point(cam.xyz),
                point(cam.ypr),
                [float(cam.hfov), float(cam.vfov)],
                [int(cam.size[0]), int(cam.size[1])],
                xyz_sigma,
                ypr_sigma,
                fov_sigma,
            ]
        )
    return rows


def triangulated_landmarks(
    camera_levels: dict[str, int],
    min_delta_degrees: float,
) -> dict[str, list[Any]]:
    cameras = []
    for camera_name in sorted(camera_levels):
        cam = get_camera(camera_name)
        if cam.xyz is not None:
            cameras.append(cam)

    by_landmark: dict[str, list[Any]] = {}
    for cam in cameras:
        for landmark_name in cam.landmark_pixels:
            if is_ignored_triangulation_landmark(landmark_name):
                continue
            by_landmark.setdefault(landmark_name, []).append(cam)

    generated: dict[str, list[Any]] = {}
    for landmark_name, cams in sorted(by_landmark.items()):
        if len(cams) < 2:
            continue
        rays = []
        ray_cameras = []
        for cam in cams:
            try:
                rays.append((cam.xyz, cam.get_landmark_direction(landmark_name)))
                ray_cameras.append(cam.name)
            except Exception:
                continue
        if len(rays) < 2:
            continue
        if (
            max_ray_pair_angle_degrees(rays) < min_delta_degrees
            and not is_leonida_keys_pin_triangulation(landmark_name, ray_cameras)
        ):
            continue
        try:
            point_xyz, _distances = intersect_rays(rays)
        except Exception:
            continue
        generated[landmark_name] = [
            [float(value) for value in point_xyz],
            mean_pair_delta_m(rays, intersect_ray_and_ray),
            ray_cameras,
        ]
    return generated


def fixed_elevation_lookup(special: dict[str, Any]) -> dict[str, float]:
    lookup: dict[str, float] = {}
    for group in special.get("landmarks_fixed_elevation", []):
        z = float(group["z"])
        for name in group.get("landmarks", []):
            lookup[name] = z
    return lookup


def intersect_ray_z(origin: Any, direction: Any, z: float) -> list[float] | None:
    dz = float(direction[2])
    if abs(dz) < 1e-12:
        return None
    t = (float(z) - float(origin[2])) / dz
    if t <= 0:
        return None
    return [
        float(origin[0]) + float(direction[0]) * t,
        float(origin[1]) + float(direction[1]) * t,
        float(z),
    ]


def fixed_elevation_intersection_angle_degrees(direction: Any) -> float:
    values = np.asarray(direction, dtype=float)
    norm = float(np.linalg.norm(values))
    if not np.isfinite(norm) or norm <= 0:
        return 0.0
    return float(np.degrees(np.arcsin(np.clip(abs(float(values[2])) / norm, 0.0, 1.0))))


def fixed_elevation_landmarks(
    special: dict[str, Any],
    camera_levels: dict[str, int],
    min_plane_angle_degrees: float,
) -> dict[str, list[float]]:
    fixed_elevations = fixed_elevation_lookup(special)
    points_by_name: dict[str, list[list[float]]] = {}
    for camera_name in sorted(camera_levels):
        cam = get_camera(camera_name)
        if cam.xyz is None:
            continue
        for landmark_name in cam.landmark_pixels:
            if landmark_name not in fixed_elevations:
                continue
            if is_ignored_triangulation_landmark(landmark_name):
                continue
            direction = cam.get_landmark_direction(landmark_name)
            if fixed_elevation_intersection_angle_degrees(direction) < min_plane_angle_degrees:
                continue
            point_xyz = intersect_ray_z(
                cam.xyz,
                direction,
                fixed_elevations[landmark_name],
            )
            if point_xyz is not None:
                points_by_name.setdefault(landmark_name, []).append(point_xyz)

    generated: dict[str, list[float]] = {}
    for landmark_name, points in points_by_name.items():
        count = len(points)
        generated[landmark_name] = [
            sum(point[index] for point in points) / count
            for index in range(3)
        ]
    return generated


def camera_location_landmark_rows(camera_levels: dict[str, int]) -> list[list[Any]]:
    names: set[str] = set()
    config_dir = ROOT / "optimizer" / "configs"
    for path in config_dir.glob("*.json"):
        data = load_json(path, {})
        for landmark_name in data.get("landmarks", []):
            if landmark_name in md.cameras and landmark_name not in md.landmarks:
                names.add(landmark_name)
    rows = []
    for name in sorted(names):
        cam = get_camera(name)
        level = camera_levels.get(name)
        xyz_sigma = CAMERA_RIGIDITY_BY_LEVEL[level][0] if level in CAMERA_RIGIDITY_BY_LEVEL else 0.05
        rows.append(["landmark", name, point(cam.xyz), xyz_sigma])
    return rows


def landmark_rows(special: dict[str, Any], camera_levels: dict[str, int]) -> list[list[Any]]:
    config = load_json(CONFIG_JSON_PATH, {})
    min_delta_degrees = float(config.get("min_triangulation_delta_degrees", 10.0))
    min_plane_angle_degrees = float(
        config.get(
            "min_fixed_elevation_intersection_angle_degrees",
            DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEG,
        )
    )
    extra_landmarks = import_extra_landmarks()

    rows: dict[str, list[Any]] = {}
    generated_names: set[str] = set()
    for name, xyz in triangulated_landmarks(camera_levels, min_delta_degrees).items():
        rows[name] = ["landmark", name, xyz[0], None]
        generated_names.add(name)
    for name, xyz in fixed_elevation_landmarks(special, camera_levels, min_plane_angle_degrees).items():
        rows.setdefault(name, ["landmark", name, xyz, None])
        generated_names.add(name)
    for name, xyz in extra_landmarks.items():
        if name not in generated_names:
            rows[name] = ["landmark", name, xyz, None]
    for name, xyz in four_seasons_landmarks(extra_landmarks).items():
        rows[name] = ["landmark", name, xyz, 0.0]
    for name in special.get("landmarks_fixed", []):
        if name in md.landmarks:
            rows[name] = ["landmark", name, point(md.landmarks[name]), 0.0]
        elif name in extra_landmarks:
            rows[name] = ["landmark", name, extra_landmarks[name], 0.0]
    for row in camera_location_landmark_rows(camera_levels):
        rows.setdefault(row[1], row)
    return [rows[name] for name in sorted(rows)]


def priors_data() -> dict[str, Any]:
    special = load_json(SPECIAL_JSON_PATH, {})
    camera_levels = rigid_camera_levels(special)
    rows = camera_rows(camera_levels) + landmark_rows(special, camera_levels)
    return {
        "schema": "gtamaplibvc-priors-v1",
        "formats": FORMATS,
        "rigidity": RIGIDITY,
        "batches": [["initial", rows]],
    }


def main() -> None:
    OPTIMIZER_DIR.mkdir(exist_ok=True)
    data = priors_data()
    PRIORS_PATH.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")
    rows = data["batches"][0][1]
    camera_count = sum(1 for row in rows if row[0] == "camera")
    landmark_count = sum(1 for row in rows if row[0] == "landmark")
    print(f"Wrote {PRIORS_PATH} with {camera_count} cameras and {landmark_count} landmarks.")


if __name__ == "__main__":
    main()
