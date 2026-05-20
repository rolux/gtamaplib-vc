#!/usr/bin/env python3
"""Run one local+global optimizer stage from the gtamaplibvc chain."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parent
OPTIMIZER_DIR = ROOT / "optimizer"
CHAIN_PATH = OPTIMIZER_DIR / "chain.json"
PRIORS_PATH = OPTIMIZER_DIR / "priors.json"
RESULTS_DIR = OPTIMIZER_DIR / "results"
RENDERS_DIR = OPTIMIZER_DIR / "renders"
GENERATED_OPTIMIZER_DIR = OPTIMIZER_DIR / "generated"
GENERATED_CHAIN_PATH = GENERATED_OPTIMIZER_DIR / "chain.json"
GENERATED_CONFIGS_DIR = GENERATED_OPTIMIZER_DIR / "configs"
GENERATED_RESULTS_DIR = GENERATED_OPTIMIZER_DIR / "results"
GENERATED_RENDERS_DIR = GENERATED_OPTIMIZER_DIR / "renders"
GENERATED_RESULT_PATH = GENERATED_OPTIMIZER_DIR / "result.json"
IMPORT_EXTRAS_PATH = ROOT / "data" / "import_extras.json"
CONFIG_PATH = ROOT / "data" / "config.json"
SPECIAL_PATH = ROOT / "data" / "special.json"
OPTIMIZER_RESULT_PATH = OPTIMIZER_DIR / "result.json"

ACTIVE_CHAIN_PATH = CHAIN_PATH
ACTIVE_CONFIGS_DIR = OPTIMIZER_DIR / "configs"
ACTIVE_RESULTS_DIR = RESULTS_DIR
ACTIVE_RENDERS_DIR = RENDERS_DIR
ACTIVE_OPTIMIZER_RESULT_PATH = OPTIMIZER_RESULT_PATH

sys.path.insert(0, str(ROOT))

import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix

from gtamaplib import gtamapdata as md
from gtamaplib.gtamaplib import (
    get_camera,
    get_color,
    get_map,
    get_point,
    get_pixel_direction,
    get_q,
    get_vfov,
    intersect_ray_and_ray,
    normalize_name,
)


PARAM_ORDER = ["x", "y", "z", "yaw_delta", "pitch", "roll", "hfov"]
CAMERA_PARAM_ORDER = ["x", "y", "z", "yaw", "pitch", "roll", "hfov"]
FIXED_SIGMA = 1e-6
GROUND_Z = 0.0
LAKE_LEONIDA_Z = 5.0
FAKE_CAMERA_SUFFIX = " Fake Cam"
# Pairwise triangulations with very narrow baselines are numerically fragile:
# the rays can nearly meet while the point is hundreds of meters wrong.
DEFAULT_MIN_TRIANGULATION_BASELINE_DEG = 10.0
DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEG = 1.0
DEFAULT_REFERENCED_CAMERA_RIGIDITY = (0.05, None, 0.05)
FIXED_ROLL_EPS = 1e-12
IGNORED_RENDER_RAY_NAMES = {"Player", "Minimap", "AIWE"}
DEFAULT_RENDER_MAP_NAME = "yanis"
DEFAULT_DELTA_MAP_SCALE = 0.25
DEFAULT_RENDER_CAMERA_SCALE = 2.0
DEFAULT_RENDER_RAY_DISTANCE = 20000.0
MANUAL_RENDER_LANDMARK_SOURCES = {
    "Portofino Tower (NW)": ["Port", "Sidewalk (Jason) (E)"],
}
MANUAL_RENDER_LANDMARK_PREFIX_SOURCES = {
    "Four Seasons Hotel Miami": ["Metro (SE) (A) (4K)", "Tennis Stadium (4K)"],
}


def use_generated_optimizer_paths() -> None:
    global ACTIVE_CHAIN_PATH
    global ACTIVE_CONFIGS_DIR
    global ACTIVE_RESULTS_DIR
    global ACTIVE_RENDERS_DIR
    global ACTIVE_OPTIMIZER_RESULT_PATH
    ACTIVE_CHAIN_PATH = GENERATED_CHAIN_PATH
    ACTIVE_CONFIGS_DIR = GENERATED_CONFIGS_DIR
    ACTIVE_RESULTS_DIR = GENERATED_RESULTS_DIR
    ACTIVE_RENDERS_DIR = GENERATED_RENDERS_DIR
    ACTIVE_OPTIMIZER_RESULT_PATH = GENERATED_RESULT_PATH


def unit(vector: np.ndarray) -> np.ndarray | None:
    norm = float(np.linalg.norm(vector))
    if not np.isfinite(norm) or norm <= 0:
        return None
    return vector / norm


def angle_arcmin(a: np.ndarray, b: np.ndarray) -> float:
    dot = float(np.dot(a, b))
    return float(np.degrees(np.arccos(np.clip(dot, -1.0, 1.0))) * 60.0)


def ray_baseline_degrees(a: np.ndarray, b: np.ndarray) -> float:
    dot = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    angle = float(np.degrees(np.arccos(np.clip(dot, -1.0, 1.0))))
    return min(angle, 180.0 - angle)


def is_leonida_keys_pin_triangulation(landmark_name: str, camera_names: list[str]) -> bool:
    # Hard-coded exception: the Leonida Keys pin pairs are intentionally kept even
    # when their ray baseline is below the general triangulation threshold.
    if not landmark_name.lower().startswith("pin "):
        return False
    return sum(name.startswith("Leonida Keys ") for name in camera_names) >= 2


def min_triangulation_baseline_degrees() -> float:
    if not CONFIG_PATH.exists():
        return DEFAULT_MIN_TRIANGULATION_BASELINE_DEG
    config = json.loads(CONFIG_PATH.read_text())
    return float(
        config.get(
            "min_triangulation_delta_degrees",
            DEFAULT_MIN_TRIANGULATION_BASELINE_DEG,
        )
    )


def min_fixed_elevation_intersection_angle_degrees() -> float:
    if not CONFIG_PATH.exists():
        return DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEG
    config = json.loads(CONFIG_PATH.read_text())
    return float(
        config.get(
            "min_fixed_elevation_intersection_angle_degrees",
            DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEG,
        )
    )


def fixed_elevation_intersection_angle_degrees(direction: np.ndarray) -> float:
    norm = float(np.linalg.norm(direction))
    if not np.isfinite(norm) or norm <= 0:
        return 0.0
    return float(np.degrees(np.arcsin(np.clip(abs(float(direction[2])) / norm, 0.0, 1.0))))


def fixed_elevation_lookup() -> dict[str, float]:
    if not SPECIAL_PATH.exists():
        return {}
    special = json.loads(SPECIAL_PATH.read_text())
    lookup: dict[str, float] = {}
    for group in special.get("landmarks_fixed_elevation", []):
        z = float(group["z"])
        for name in group.get("landmarks", []):
            lookup[name] = z
    return lookup


def object_elevation_lookup(solve: dict[str, Any]) -> dict[str, float]:
    lookup: dict[str, float] = {}
    for row in solve.get("horizontal_objects", []):
        z = float(row["z"])
        lookup[row["point_a"]] = z
        if row["orientation"] == "horizontal":
            lookup[row["point_b"]] = z
        elif row["orientation"] == "vertical":
            lookup[row["point_b"]] = z + float(row["length_m"])
        else:
            raise ValueError(f"Unsupported object orientation: {row['orientation']!r}")
    return lookup


def residual_summary(values: np.ndarray) -> dict[str, float]:
    if len(values) == 0:
        return {
            "loss_arcmin2": 0.0,
            "rms_arcmin": 0.0,
            "mean_abs_arcmin": 0.0,
            "median_abs_arcmin": 0.0,
            "max_abs_arcmin": 0.0,
        }
    abs_values = np.abs(values)
    return {
        "loss_arcmin2": float(np.mean(values ** 2)),
        "rms_arcmin": float(np.sqrt(np.mean(values ** 2))),
        "mean_abs_arcmin": float(np.mean(abs_values)),
        "median_abs_arcmin": float(np.median(abs_values)),
        "max_abs_arcmin": float(np.max(abs_values)),
    }


def camera_direction_from_pixel(
    pixel: tuple[float, float],
    ypr: tuple[float, float, float],
    fov: tuple[float, float],
    size: tuple[int, int],
) -> np.ndarray:
    return get_pixel_direction(pixel, get_q(ypr), fov, size)


def camera_fov_from_params(params: np.ndarray, size: tuple[int, int]) -> tuple[float, float]:
    hfov = float(params[6])
    return hfov, float(get_vfov(hfov, size))


def camera_has_fixed_zero_roll(name: str) -> bool:
    if name not in md.cameras:
        return False
    return abs(float(get_camera(name).ypr[2])) < 1e-9


def normalize_camera_ypr(name: str, ypr: tuple[float, float, float] | np.ndarray) -> tuple[float, float, float]:
    values = [float(value) for value in ypr]
    if camera_has_fixed_zero_roll(name):
        values[2] = 0.0
    return tuple(values)


def normalize_camera_params(name: str, params: np.ndarray) -> np.ndarray:
    values = np.asarray(params, dtype=float).copy()
    if camera_has_fixed_zero_roll(name):
        values[5] = 0.0
    return values


def normalize_global_params(params: np.ndarray, system: dict[str, Any]) -> np.ndarray:
    values = np.asarray(params, dtype=float).copy()
    for index, name in enumerate(system["camera_names"]):
        if camera_has_fixed_zero_roll(name):
            values[index * 7 + 5] = 0.0
    return values


def camera_direction_from_params(
    pixel: tuple[float, float],
    params: np.ndarray,
    size: tuple[int, int],
) -> np.ndarray:
    return camera_direction_from_pixel(
        pixel,
        (float(params[3]), float(params[4]), float(params[5])),
        camera_fov_from_params(params, size),
        size,
    )


def horizontal_object_residual_from_params(
    params: np.ndarray,
    size: tuple[int, int],
    pixel_a: tuple[float, float],
    pixel_b: tuple[float, float],
    length_m: float,
    z: float,
) -> float:
    origin = np.asarray(params[:3], dtype=float)
    direction_a = camera_direction_from_params(pixel_a, params, size)
    direction_b = camera_direction_from_params(pixel_b, params, size)
    point_a = intersect_ray_z(origin, direction_a, z)
    point_b = intersect_ray_z(origin, direction_b, z)
    if point_a is None or point_b is None:
        return 1e6
    horizontal_delta = point_b[:2] - point_a[:2]
    horizontal_norm = float(np.linalg.norm(horizontal_delta))
    if not np.isfinite(horizontal_norm) or horizontal_norm <= 1e-12:
        return 1e6
    horizontal_direction = horizontal_delta / horizontal_norm
    expected_b = np.asarray(
        [
            point_a[0] + horizontal_direction[0] * length_m,
            point_a[1] + horizontal_direction[1] * length_m,
            z,
        ],
        dtype=float,
    )
    expected_direction = unit(expected_b - origin)
    return 1e6 if expected_direction is None else angle_arcmin(direction_b, expected_direction)


def vertical_object_residual_from_params(
    params: np.ndarray,
    size: tuple[int, int],
    pixel_a: tuple[float, float],
    pixel_b: tuple[float, float],
    length_m: float,
    z: float,
) -> float:
    origin = np.asarray(params[:3], dtype=float)
    direction_a = camera_direction_from_params(pixel_a, params, size)
    direction_b = camera_direction_from_params(pixel_b, params, size)
    point_a = intersect_ray_z(origin, direction_a, z)
    if point_a is None:
        return 1e6
    expected_b = np.asarray([point_a[0], point_a[1], z + length_m], dtype=float)
    expected_direction = unit(expected_b - origin)
    return 1e6 if expected_direction is None else angle_arcmin(direction_b, expected_direction)


def object_residual_from_params(
    params: np.ndarray,
    size: tuple[int, int],
    pixel_a: tuple[float, float],
    pixel_b: tuple[float, float],
    orientation: str,
    length_m: float,
    z: float,
) -> float:
    if orientation == "horizontal":
        return horizontal_object_residual_from_params(params, size, pixel_a, pixel_b, length_m, z)
    if orientation == "vertical":
        return vertical_object_residual_from_params(params, size, pixel_a, pixel_b, length_m, z)
    raise ValueError(f"Unsupported object orientation: {orientation!r}")


def normalize_object_row(row: list[Any] | dict[str, Any]) -> dict[str, Any]:
    if isinstance(row, dict):
        row = [
            row["point_a"],
            row["point_b"],
            row["orientation"],
            row["length_m"],
            row["z"],
        ]
    if len(row) != 5:
        raise ValueError(
            "Object constraints must be [point_a, point_b, orientation, length_m, z]"
        )
    point_a, point_b, orientation, length_m, z = row
    if orientation not in {"horizontal", "vertical"}:
        raise ValueError(f"Unsupported object orientation: {orientation!r}")
    return {
        "point_a": point_a,
        "point_b": point_b,
        "orientation": orientation,
        "length_m": float(length_m),
        "z": float(z),
    }


def intersect_ray_z(
    origin: np.ndarray,
    direction: np.ndarray,
    z: float = GROUND_Z,
) -> np.ndarray | None:
    if abs(float(direction[2])) < 1e-12:
        return None
    t = (z - float(origin[2])) / float(direction[2])
    if t <= 0 or not np.isfinite(t):
        return None
    point = origin + t * direction
    point[2] = z
    return point


def pre_aiwe_landmark_names() -> set[str]:
    path = Path(md.__file__)
    names: set[str] = set()
    in_landmarks = False
    for line in path.read_text().splitlines():
        if line.startswith("landmarks = {"):
            in_landmarks = True
            continue
        if not in_landmarks:
            continue
        if "AIWE" in line:
            break
        match = re.match(r'\s*"([^"]+)":\s*\(', line)
        if match:
            names.add(match.group(1))
    return names


def is_ground_landmark(name: str, pre_aiwe_names: set[str]) -> bool:
    if name not in md.landmarks:
        return False
    z = float(md.landmarks[name][2])
    if abs(z) < 1e-9:
        return True
    return name in pre_aiwe_names and abs(z - 10.0) < 1e-9


def intersection_plane_z(
    name: str,
    pre_aiwe_names: set[str],
    fixed_elevations: dict[str, float],
) -> float | None:
    if name in fixed_elevations:
        return fixed_elevations[name]
    if re.fullmatch(r"Lake Leonida \([A-Z]\)", name):
        return LAKE_LEONIDA_Z
    if is_ground_landmark(name, pre_aiwe_names):
        return GROUND_Z
    return None


def sigma_value(value: float | None) -> float | None:
    if value is None:
        return None
    if float(value) == 0.0:
        return FIXED_SIGMA
    return float(value)


def fake_camera_origin(name: str, priors: dict[str, Any] | None = None) -> tuple[float, float, float] | None:
    if not name.endswith(FAKE_CAMERA_SUFFIX):
        return None
    landmark_name = name[: -len(FAKE_CAMERA_SUFFIX)]
    if priors is not None and landmark_name in priors.get("landmarks", {}):
        return tuple(float(value) for value in priors["landmarks"][landmark_name]["xyz"])
    if landmark_name in md.landmarks:
        return tuple(float(value) for value in md.landmarks[landmark_name])
    if landmark_name in md.cameras:
        return tuple(float(value) for value in get_camera(landmark_name).xyz)
    if IMPORT_EXTRAS_PATH.exists():
        vc_data = json.loads(IMPORT_EXTRAS_PATH.read_text())
        for section in ("added_landmarks", "generated_landmarks"):
            landmarks = vc_data.get(section, {})
            if landmark_name in landmarks:
                return tuple(float(value) for value in landmarks[landmark_name][0])
    return None


def ensure_top_down_fake_camera(
    name: str,
    target_name: str | None = None,
    priors: dict[str, Any] | None = None,
) -> bool:
    size = (3840, 2160)
    xyz = fake_camera_origin(name, priors)
    if xyz is None:
        return False
    if name not in md.cameras:
        md.cameras[name] = {
            "id": "[X]",
            "player": None,
            "xyz": xyz,
            "ypr": (0.0, -89.999, 0.0),
            "fov": (90.0, None),
            "size": size,
            "source": "Synthetic top-down constraint camera",
        }
    md.pixels.setdefault(name, {})
    if target_name is not None:
        md.pixels[name][target_name] = (size[0] / 2, size[1] / 2)
    get_camera.cache_clear()
    return True


def register_synthetic_cameras() -> None:
    get_camera.cache_clear()


def synthetic_camera_prior(
    name: str,
    target_name: str | None = None,
    priors: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if not ensure_top_down_fake_camera(name, target_name, priors):
        return None
    cam = get_camera(name)
    return {
        "name": name,
        "player": None,
        "xyz": np.asarray(cam.xyz, dtype=float),
        "ypr": normalize_camera_ypr(name, cam.ypr),
        "fov": (float(cam.hfov), float(cam.vfov)),
        "size": tuple(int(value) for value in cam.size),
        "xyz_rigidity_m": 0.0,
        "ypr_rigidity_deg": 0.0,
        "fov_rigidity_deg": 0.0,
    }


def referenced_camera_prior(name: str) -> dict[str, Any] | None:
    if name not in md.cameras:
        return None
    cam = get_camera(name)
    xyz_rigidity, ypr_rigidity, fov_rigidity = DEFAULT_REFERENCED_CAMERA_RIGIDITY
    return {
        "name": name,
        "player": list(cam.player) if cam.player else None,
        "xyz": np.asarray(cam.xyz, dtype=float),
        "ypr": normalize_camera_ypr(name, cam.ypr),
        "fov": (float(cam.hfov), float(cam.vfov)),
        "size": tuple(int(value) for value in cam.size),
        "xyz_rigidity_m": xyz_rigidity,
        "ypr_rigidity_deg": ypr_rigidity,
        "fov_rigidity_deg": fov_rigidity,
    }


def camera_location_landmark_prior(name: str) -> dict[str, Any] | None:
    if name not in md.cameras:
        return None
    camera = get_camera(name)
    return {
        "name": name,
        "xyz": np.asarray(camera.xyz, dtype=float),
        "xyz_rigidity_m": DEFAULT_REFERENCED_CAMERA_RIGIDITY[0],
    }


def add_required_synthetic_priors(
    priors: dict[str, Any],
    solve: dict[str, Any],
    blocked_cameras: set[str] | None = None,
) -> None:
    blocked_cameras = blocked_cameras or set()
    for source_camera_name, target_name in solve["rays"]:
        if source_camera_name in blocked_cameras:
            continue
        if source_camera_name in priors["cameras"]:
            if source_camera_name.endswith(FAKE_CAMERA_SUFFIX):
                ensure_top_down_fake_camera(source_camera_name, target_name, priors)
            continue
        prior = synthetic_camera_prior(source_camera_name, target_name, priors)
        if prior is None:
            prior = referenced_camera_prior(source_camera_name)
        if prior is not None:
            priors["cameras"][source_camera_name] = prior


def prior_rows_to_dict(rows: list[Any], batch_id: str = "initial") -> dict[str, Any]:
    cameras: dict[str, dict[str, Any]] = {}
    landmarks: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row[0] == "camera":
            _, name, player, xyz, ypr, fov, size, xyz_rigidity, ypr_rigidity, fov_rigidity = row
            cameras[name] = {
                "name": name,
                "player": player,
                "xyz": np.asarray(xyz, dtype=float),
                "ypr": normalize_camera_ypr(name, ypr),
                "fov": tuple(float(value) for value in fov),
                "size": tuple(int(value) for value in size),
                "xyz_rigidity_m": xyz_rigidity,
                "ypr_rigidity_deg": ypr_rigidity,
                "fov_rigidity_deg": fov_rigidity,
            }
        elif row[0] == "landmark":
            _, name, xyz, xyz_rigidity = row
            landmarks[name] = {
                "name": name,
                "xyz": np.asarray(xyz, dtype=float),
                "xyz_rigidity_m": xyz_rigidity,
            }
        else:
            raise ValueError(f"Unknown prior row type: {row[0]!r}")

    return {
        "schema": "gtamaplibvc-priors-v1",
        "batch_id": batch_id,
        "cameras": cameras,
        "landmarks": landmarks,
    }


def load_prior_batch(path: Path, batch_id: str | None = None) -> dict[str, Any]:
    data = json.loads(path.read_text())
    batches = data["batches"]
    if batch_id is None:
        batch_id, rows = batches[-1]
    else:
        rows = None
        for candidate_id, candidate_rows in batches:
            if candidate_id == batch_id:
                rows = candidate_rows
                break
        if rows is None:
            raise KeyError(f"No prior batch named {batch_id!r}")
    return prior_rows_to_dict(rows, batch_id)


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(", ", ": "))


def append_prior_batch(path: Path, batch: list[Any]) -> bool:
    data = json.loads(path.read_text())
    batch_id = batch[0]
    existing_ids = [candidate[0] for candidate in data["batches"]]
    if batch_id in existing_ids:
        return False
    data["batches"].append(batch)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return True


def load_solve(path: Path, solve_id: str | None = None) -> dict[str, Any]:
    data = json.loads(path.read_text())
    solves = data["solves"]
    if solve_id is None:
        row = solves[0]
    else:
        row = next((candidate for candidate in solves if candidate[1] == solve_id), None)
        if row is None:
            raise KeyError(f"No find-camera solve named {solve_id!r}")
    kind, solve_id, camera_name, xyz, ypr, hfov, size, landmarks, rays = row[:9]
    if kind != "solve":
        raise ValueError(f"Unknown solve row type: {kind!r}")
    horizontal_objects = [normalize_object_row(object_row) for object_row in row[9]] if len(row) > 9 else []
    return {
        "schema": data["schema"],
        "id": solve_id,
        "camera_name": camera_name,
        "xyz": np.asarray(xyz, dtype=float),
        "ypr": np.asarray(ypr, dtype=float),
        "hfov": float(hfov),
        "size": tuple(int(value) for value in size),
        "landmarks": landmarks,
        "rays": rays,
        "horizontal_objects": horizontal_objects,
    }


def load_solves(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text())
    rows = []
    for row in data["solves"]:
        kind, solve_id, camera_name, xyz, ypr, hfov, size, landmarks, rays = row[:9]
        horizontal_objects = [normalize_object_row(object_row) for object_row in row[9]] if len(row) > 9 else []
        if kind != "solve":
            raise ValueError(f"Unknown solve row type: {kind!r}")
        rows.append(
            {
                "schema": data["schema"],
                "id": solve_id,
                "camera_name": camera_name,
                "xyz": np.asarray(xyz, dtype=float),
                "ypr": np.asarray(ypr, dtype=float),
                "hfov": float(hfov),
                "size": tuple(int(value) for value in size),
                "landmarks": landmarks,
                "rays": rays,
                "horizontal_objects": horizontal_objects,
            }
        )
    return rows


def local_camera_residuals(
    params: np.ndarray,
    yaw0: float,
    size: tuple[int, int],
    point_targets: list[dict[str, Any]],
    ray_targets: list[dict[str, Any]],
    horizontal_targets: list[dict[str, Any]],
) -> np.ndarray:
    solved_xyz = np.asarray(params[:3], dtype=float)
    yaw = (yaw0 + float(params[3])) % 360.0
    pitch = float(params[4])
    roll = float(params[5])
    solved_hfov = float(params[6])
    solved_fov = (solved_hfov, get_vfov(solved_hfov, size))
    values: list[float] = []
    for target in point_targets:
        direction = camera_direction_from_pixel(
            target["pixel"],
            (yaw, pitch, roll),
            solved_fov,
            size,
        )
        expected = unit(target["xyz"] - solved_xyz)
        values.append(1e6 if expected is None else angle_arcmin(direction, expected))
    for target in ray_targets:
        direction = camera_direction_from_pixel(
            target["pixel"],
            (yaw, pitch, roll),
            solved_fov,
            size,
        )
        ray = (solved_xyz, direction)
        target_ray = (target["source_origin"], target["source_direction"])
        values.append(float(intersect_ray_and_ray(ray, target_ray)[-1]) * 60.0)
    for target in horizontal_targets:
        values.append(
            object_residual_from_params(
                np.asarray(
                    [
                        *solved_xyz,
                        yaw,
                        pitch,
                        roll,
                        solved_hfov,
                    ],
                    dtype=float,
                ),
                size,
                target["pixel_a"],
                target["pixel_b"],
                target["orientation"],
                target["length_m"],
                target["z"],
            )
        )
    return np.asarray(values, dtype=float)


def solve_camera(
    solve: dict[str, Any],
    priors: dict[str, Any],
    max_nfev: int = 1000,
    loss: str = "soft_l1",
    f_scale: float = 1.0,
    x_scale: str = "jac",
    verbose: int = 2,
) -> dict[str, Any]:
    camera_name = solve["camera_name"]
    target_camera = get_camera(camera_name)
    size = solve["size"]
    initial_xyz = np.asarray(solve["xyz"], dtype=float)
    initial_ypr = np.asarray(solve["ypr"], dtype=float)
    initial_hfov = float(solve["hfov"])
    yaw0 = float(initial_ypr[0])
    fixed_zero_roll = camera_has_fixed_zero_roll(camera_name)
    database_hfov = float(target_camera.hfov)
    database_yaw_delta = ((float(target_camera.ypr[0]) - yaw0 + 180.0) % 360.0) - 180.0
    database_params = np.asarray(
        [
            *target_camera.xyz,
            database_yaw_delta,
            float(target_camera.ypr[1]),
            0.0 if fixed_zero_roll else float(target_camera.ypr[2]),
            database_hfov,
        ],
        dtype=float,
    )

    point_targets: list[dict[str, Any]] = []
    for landmark_name in solve["landmarks"]:
        if landmark_name not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for {landmark_name!r}")
        prior = priors["landmarks"].get(landmark_name) or camera_location_landmark_prior(landmark_name)
        if prior is None:
            raise KeyError(f"No landmark prior for {landmark_name!r}")
        point_targets.append(
            {
                "name": landmark_name,
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[landmark_name]),
                "xyz": prior["xyz"],
                "xyz_rigidity_m": prior["xyz_rigidity_m"],
            }
        )

    database_point_targets: list[dict[str, Any]] = []
    for landmark_name in solve["landmarks"]:
        if landmark_name in md.landmarks:
            target_xyz = md.landmarks[landmark_name]
        elif landmark_name in md.cameras:
            target_xyz = get_camera(landmark_name).xyz
        else:
            target_xyz = priors["landmarks"][landmark_name]["xyz"]
        database_point_targets.append(
            {
                "name": landmark_name,
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[landmark_name]),
                "xyz": np.asarray(target_xyz, dtype=float),
            }
        )

    ray_targets: list[dict[str, Any]] = []
    database_ray_targets: list[dict[str, Any]] = []
    for source_camera_name, target_name in solve["rays"]:
        if target_name not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for ray target {target_name!r}")
        if source_camera_name not in priors["cameras"]:
            raise KeyError(f"No camera prior for source camera {source_camera_name!r}")
        source_prior = priors["cameras"][source_camera_name]
        source_camera = get_camera(source_camera_name)
        if target_name not in source_camera.landmark_pixels:
            raise KeyError(f"{source_camera_name!r} has no pixel for ray target {target_name!r}")
        source_pixel = tuple(float(value) for value in source_camera.landmark_pixels[target_name])
        source_direction = camera_direction_from_pixel(
            source_pixel,
            source_prior["ypr"],
            source_prior["fov"],
            source_prior["size"],
        )
        ray_targets.append(
            {
                "name": target_name,
                "source_camera": source_camera_name,
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[target_name]),
                "source_pixel": source_pixel,
                "source_origin": source_prior["xyz"],
                "source_direction": source_direction,
            }
        )
        database_source_camera = get_camera(source_camera_name)
        database_ray_targets.append(
            {
                "name": target_name,
                "source_camera": source_camera_name,
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[target_name]),
                "source_pixel": source_pixel,
                "source_origin": np.asarray(database_source_camera.xyz, dtype=float),
                "source_direction": np.asarray(
                    database_source_camera.get_landmark_direction(target_name),
                    dtype=float,
                ),
            }
        )

    horizontal_targets: list[dict[str, Any]] = []
    for horizontal_object in solve.get("horizontal_objects", []):
        point_a = horizontal_object["point_a"]
        point_b = horizontal_object["point_b"]
        if point_a not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for horizontal object point {point_a!r}")
        if point_b not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for horizontal object point {point_b!r}")
        horizontal_targets.append(
            {
                "point_a": point_a,
                "point_b": point_b,
                "pixel_a": tuple(float(value) for value in target_camera.landmark_pixels[point_a]),
                "pixel_b": tuple(float(value) for value in target_camera.landmark_pixels[point_b]),
                "orientation": horizontal_object["orientation"],
                "length_m": float(horizontal_object["length_m"]),
                "z": float(horizontal_object["z"]),
            }
        )

    x0 = np.asarray(
        [
            float(initial_xyz[0]),
            float(initial_xyz[1]),
            float(initial_xyz[2]),
            0.0,
            float(initial_ypr[1]),
            0.0 if fixed_zero_roll else float(initial_ypr[2]),
            float(initial_hfov),
        ],
        dtype=float,
    )
    lower = np.asarray([-np.inf, -np.inf, -np.inf, -np.inf, -np.inf, -np.inf, 0.001], dtype=float)
    upper = np.asarray([np.inf, np.inf, np.inf, np.inf, np.inf, np.inf, 160.0], dtype=float)
    if fixed_zero_roll:
        lower[5] = -FIXED_ROLL_EPS
        upper[5] = FIXED_ROLL_EPS

    def unpack(params: np.ndarray) -> tuple[np.ndarray, float, float, float, float]:
        solved_xyz = np.asarray(params[:3], dtype=float)
        yaw = (yaw0 + float(params[3])) % 360.0
        pitch = float(params[4])
        roll = float(params[5])
        solved_hfov = float(params[6])
        return solved_xyz, yaw, pitch, roll, solved_hfov

    def residuals(params: np.ndarray) -> np.ndarray:
        return local_camera_residuals(params, yaw0, size, point_targets, ray_targets, horizontal_targets)

    initial_residuals = residuals(x0)
    database_residuals = local_camera_residuals(
        database_params,
        yaw0,
        tuple(target_camera.size),
        database_point_targets,
        database_ray_targets,
        horizontal_targets,
    )
    start_time = time.perf_counter()
    result = least_squares(
        residuals,
        x0,
        bounds=(lower, upper),
        loss=loss,
        f_scale=f_scale,
        x_scale=x_scale,
        max_nfev=max_nfev,
        verbose=verbose,
    )
    if verbose:
        print()
    elapsed_seconds = time.perf_counter() - start_time
    final_params = normalize_camera_params(camera_name, result.x)
    final_residuals = residuals(final_params)
    solved_xyz, yaw, pitch, roll, solved_hfov = unpack(final_params)
    solved_vfov = get_vfov(solved_hfov, size)

    constraint_rows: list[dict[str, Any]] = []
    for index, target in enumerate(point_targets):
        constraint_rows.append(
            {
                "index": index,
                "type": "landmark",
                "name": target["name"],
                "pixel": [float(value) for value in target["pixel"]],
                "xyz_rigidity_m": target["xyz_rigidity_m"],
                "initial_error_arcmin": float(initial_residuals[index]),
                "final_error_arcmin": float(final_residuals[index]),
                "delta_error_arcmin": float(final_residuals[index] - initial_residuals[index]),
            }
        )
    offset = len(point_targets)
    for ray_index, target in enumerate(ray_targets):
        index = offset + ray_index
        constraint_rows.append(
            {
                "index": index,
                "type": "ray",
                "name": target["name"],
                "source_camera": target["source_camera"],
                "pixel": [float(value) for value in target["pixel"]],
                "source_pixel": [float(value) for value in target["source_pixel"]],
                "initial_error_arcmin": float(initial_residuals[index]),
                "final_error_arcmin": float(final_residuals[index]),
                "delta_error_arcmin": float(final_residuals[index] - initial_residuals[index]),
            }
        )
    offset += len(ray_targets)
    for horizontal_index, target in enumerate(horizontal_targets):
        index = offset + horizontal_index
        constraint_rows.append(
            {
                "index": index,
                "type": "horizontal_object",
                "point_a": target["point_a"],
                "point_b": target["point_b"],
                "pixel_a": [float(value) for value in target["pixel_a"]],
                "pixel_b": [float(value) for value in target["pixel_b"]],
                "orientation": target["orientation"],
                "length_m": float(target["length_m"]),
                "z": float(target["z"]),
                "initial_error_arcmin": float(initial_residuals[index]),
                "final_error_arcmin": float(final_residuals[index]),
                "delta_error_arcmin": float(final_residuals[index] - initial_residuals[index]),
            }
        )
    constraint_rows.sort(key=lambda row: abs(row["final_error_arcmin"]), reverse=True)
    for rank, row in enumerate(constraint_rows, start=1):
        row["rank"] = rank

    report = {
        "schema": "gtamaplib-chain-find-camera-result-v1",
        "solve_id": solve["id"],
        "camera_name": camera_name,
        "prior_batch_id": priors["batch_id"],
        "param_order": PARAM_ORDER,
        "constraints": {
            "landmark_count": len(point_targets),
            "ray_count": len(ray_targets),
            "horizontal_object_count": len(horizontal_targets),
            "items": constraint_rows,
        },
        "database": {
            "xyz": [float(value) for value in target_camera.xyz],
            "ypr": [float(value) for value in target_camera.ypr],
            "fov": [database_hfov, float(get_vfov(database_hfov, tuple(target_camera.size)))],
            "size": [int(value) for value in target_camera.size],
            "camera_loss_arcmin2": float(np.mean(database_residuals ** 2)),
            **residual_summary(database_residuals),
            "residuals_arcmin": [float(value) for value in database_residuals],
        },
        "initial": {
            "xyz": [float(value) for value in initial_xyz],
            "ypr": [float(value) for value in initial_ypr],
            "fov": [float(initial_hfov), float(get_vfov(initial_hfov, size))],
            "size": [int(value) for value in size],
            "camera_loss_arcmin2": float(np.mean(initial_residuals ** 2)),
            **residual_summary(initial_residuals),
            "residuals_arcmin": [float(value) for value in initial_residuals],
        },
        "optimization": {
            "success": bool(result.success),
            "status": int(result.status),
            "message": result.message,
            "cost": float(result.cost),
            "optimality": float(result.optimality),
            "nfev": int(result.nfev),
            "njev": int(result.njev) if result.njev is not None else None,
            "elapsed_seconds": float(elapsed_seconds),
            "loss": loss,
            "f_scale": float(f_scale),
            "x_scale": x_scale,
            "max_nfev": max_nfev,
        },
        "final": {
            "xyz": [float(value) for value in solved_xyz],
            "ypr": [float(yaw), float(pitch), float(roll)],
            "fov": [float(solved_hfov), float(solved_vfov)],
            "size": [int(value) for value in size],
            "camera_loss_arcmin2": float(np.mean(final_residuals ** 2)),
            **residual_summary(final_residuals),
            "residuals_arcmin": [float(value) for value in final_residuals],
        },
    }
    return report


def triangulate_from_local_solution(
    solve: dict[str, Any],
    priors: dict[str, Any],
    local_report: dict[str, Any],
) -> list[dict[str, Any]]:
    target_camera = get_camera(solve["camera_name"])
    target_xyz = np.asarray(local_report["final"]["xyz"], dtype=float)
    target_ypr = tuple(float(value) for value in local_report["final"]["ypr"])
    target_fov = tuple(float(value) for value in local_report["final"]["fov"])
    target_size = tuple(int(value) for value in local_report["final"]["size"])
    min_baseline_degrees = min_triangulation_baseline_degrees()
    min_plane_angle_degrees = min_fixed_elevation_intersection_angle_degrees()

    rows = []
    used_names = set(solve["landmarks"]) | {target_name for _, target_name in solve["rays"]}
    explicit_ray_pairs = {(source_camera_name, target_name) for source_camera_name, target_name in solve["rays"]}

    def is_known_prior_landmark(name: str) -> bool:
        return name in priors["landmarks"] or camera_location_landmark_prior(name) is not None

    for source_camera_name, target_name in solve["rays"]:
        if source_camera_name not in priors["cameras"]:
            prior = synthetic_camera_prior(source_camera_name, target_name, priors)
            if prior is None:
                prior = referenced_camera_prior(source_camera_name)
            if prior is not None:
                priors["cameras"][source_camera_name] = prior
        elif source_camera_name not in md.cameras:
            ensure_top_down_fake_camera(source_camera_name, target_name, priors)
        source_prior = priors["cameras"][source_camera_name]
        source_camera = get_camera(source_camera_name)
        target_pixel = tuple(float(value) for value in target_camera.landmark_pixels[target_name])
        source_pixel = tuple(float(value) for value in source_camera.landmark_pixels[target_name])
        target_direction = camera_direction_from_pixel(
            target_pixel,
            target_ypr,
            target_fov,
            target_size,
        )
        source_direction = camera_direction_from_pixel(
            source_pixel,
            source_prior["ypr"],
            source_prior["fov"],
            source_prior["size"],
        )
        baseline_degrees = ray_baseline_degrees(target_direction, source_direction)
        if (
            baseline_degrees < min_baseline_degrees
            and not is_leonida_keys_pin_triangulation(
                target_name,
                [solve["camera_name"], source_camera_name],
            )
        ):
            continue
        midpoint, point_a, point_b, distance, angle = intersect_ray_and_ray(
            (target_xyz, target_direction),
            (source_prior["xyz"], source_direction),
        )
        rows.append(
            {
                "type": "ray_triangulation",
                "name": target_name,
                "target_camera": solve["camera_name"],
                "source_camera": source_camera_name,
                "xyz": [float(value) for value in midpoint],
                "closest_point_target_ray": [float(value) for value in point_a],
                "closest_point_source_ray": [float(value) for value in point_b],
                "ray_distance_m": float(distance),
                "ray_angle_arcmin": float(angle) * 60.0,
                "ray_baseline_degrees": float(baseline_degrees),
                "target_pixel": [float(value) for value in target_pixel],
                "source_pixel": [float(value) for value in source_pixel],
                "xyz_rigidity_m": None,
                "explicit": True,
            }
        )
    for source_camera_name, source_prior in priors["cameras"].items():
        if source_camera_name == solve["camera_name"]:
            continue
        if source_camera_name not in md.cameras:
            continue
        source_camera = get_camera(source_camera_name)
        for target_name, target_pixel_raw in target_camera.landmark_pixels.items():
            if (source_camera_name, target_name) in explicit_ray_pairs:
                continue
            if is_known_prior_landmark(target_name):
                continue
            if target_name not in source_camera.landmark_pixels:
                continue
            target_pixel = tuple(float(value) for value in target_pixel_raw)
            source_pixel = tuple(float(value) for value in source_camera.landmark_pixels[target_name])
            target_direction = camera_direction_from_pixel(
                target_pixel,
                target_ypr,
                target_fov,
                target_size,
            )
            source_direction = camera_direction_from_pixel(
                source_pixel,
                source_prior["ypr"],
                source_prior["fov"],
                source_prior["size"],
            )
            baseline_degrees = ray_baseline_degrees(target_direction, source_direction)
            if (
                baseline_degrees < min_baseline_degrees
                and not is_leonida_keys_pin_triangulation(
                    target_name,
                    [solve["camera_name"], source_camera_name],
                )
            ):
                continue
            midpoint, point_a, point_b, distance, angle = intersect_ray_and_ray(
                (target_xyz, target_direction),
                (source_prior["xyz"], source_direction),
            )
            rows.append(
                {
                    "type": "ray_triangulation",
                    "name": target_name,
                    "target_camera": solve["camera_name"],
                    "source_camera": source_camera_name,
                    "pixel": [float(value) for value in target_pixel],
                    "source_pixel": [float(value) for value in source_pixel],
                    "xyz": [float(value) for value in midpoint],
                    "closest_point_target_ray": [float(value) for value in point_a],
                    "closest_point_source_ray": [float(value) for value in point_b],
                    "ray_distance_m": float(distance),
                    "ray_angle_arcmin": float(angle) * 60.0,
                    "ray_baseline_degrees": float(baseline_degrees),
                    "target_pixel": [float(value) for value in target_pixel],
                    "xyz_rigidity_m": None,
                    "discovered": True,
                    "explicit": False,
                }
            )
            used_names.add(target_name)
    pre_aiwe_names = pre_aiwe_landmark_names()
    fixed_elevations = fixed_elevation_lookup()
    fixed_elevations.update(object_elevation_lookup(solve))
    for name, pixel in target_camera.landmark_pixels.items():
        plane_z = intersection_plane_z(name, pre_aiwe_names, fixed_elevations)
        if name in used_names or is_known_prior_landmark(name) or plane_z is None:
            continue
        target_pixel = tuple(float(value) for value in pixel)
        target_direction = camera_direction_from_pixel(
            target_pixel,
            target_ypr,
            target_fov,
            target_size,
        )
        plane_angle_degrees = fixed_elevation_intersection_angle_degrees(target_direction)
        if plane_angle_degrees < min_plane_angle_degrees:
            continue
        point = intersect_ray_z(target_xyz, target_direction, plane_z)
        if point is None:
            continue
        rows.append(
            {
                "type": "plane_intersection",
                "name": name,
                "target_camera": solve["camera_name"],
                "xyz": [float(value) for value in point],
                "target_pixel": [float(value) for value in target_pixel],
                "ground_z": float(plane_z),
                "plane_angle_degrees": float(plane_angle_degrees),
                "xyz_rigidity_m": None,
                "explicit": False,
            }
        )
    return rows


def build_global_system(
    solve: dict[str, Any],
    priors: dict[str, Any],
    local_report: dict[str, Any],
    triangulations: list[dict[str, Any]],
    solves: list[dict[str, Any]],
) -> dict[str, Any]:
    cameras: dict[str, dict[str, Any]] = {
        name: {
            "name": name,
            "params": normalize_camera_params(
                name,
                np.asarray(
                    [
                        *prior["xyz"],
                        *prior["ypr"],
                        prior["fov"][0],
                    ],
                    dtype=float,
                ),
            ),
            "size": prior["size"],
            "prior": prior,
        }
        for name, prior in priors["cameras"].items()
    }
    cameras[solve["camera_name"]] = {
        "name": solve["camera_name"],
        "params": normalize_camera_params(
            solve["camera_name"],
            np.asarray(
                [
                    *local_report["final"]["xyz"],
                    *local_report["final"]["ypr"],
                    local_report["final"]["fov"][0],
                ],
                dtype=float,
            ),
        ),
        "size": tuple(local_report["final"]["size"]),
        "prior": {
            "xyz_rigidity_m": None,
            "ypr_rigidity_deg": None,
            "fov_rigidity_deg": None,
        },
    }

    landmarks: dict[str, dict[str, Any]] = {
        name: {
            "name": name,
            "xyz": prior["xyz"].copy(),
            "prior": prior,
            "source": "prior",
        }
        for name, prior in priors["landmarks"].items()
    }
    for row in triangulations:
        if row["name"] not in landmarks:
            landmarks[row["name"]] = {
                "name": row["name"],
                "xyz": np.asarray(row["xyz"], dtype=float),
                "prior": {"xyz_rigidity_m": None},
                "source": "triangulated",
                "triangulation": row,
            }

    def add_camera_location_landmark(name: str) -> None:
        if name in landmarks:
            return
        prior = camera_location_landmark_prior(name)
        if prior is None:
            return
        landmarks[name] = {
            "name": name,
            "xyz": prior["xyz"],
            "prior": {"xyz_rigidity_m": prior["xyz_rigidity_m"]},
            "source": "camera_location",
        }

    for landmark_name in solve["landmarks"]:
        add_camera_location_landmark(landmark_name)
    for chain_solve in solves:
        for landmark_name in chain_solve["landmarks"]:
            add_camera_location_landmark(landmark_name)

    observations: list[dict[str, Any]] = []
    observation_keys: set[tuple[str, str, tuple[float, float]]] = set()
    horizontal_objects: list[dict[str, Any]] = []
    horizontal_object_keys: set[tuple[str, str, str, str, float, float]] = set()

    def add_observation(observation: dict[str, Any]) -> None:
        key = (
            observation["camera"],
            observation["landmark"],
            tuple(round(float(value), 6) for value in observation["pixel"]),
        )
        if key in observation_keys:
            return
        observation_keys.add(key)
        observations.append(observation)

    def add_horizontal_object(camera_name: str, row: list[Any]) -> None:
        if camera_name not in cameras or camera_name not in md.cameras:
            return
        horizontal_object = normalize_object_row(row)
        point_a = horizontal_object["point_a"]
        point_b = horizontal_object["point_b"]
        length_m = horizontal_object["length_m"]
        z = horizontal_object["z"]
        camera = get_camera(camera_name)
        if point_a not in camera.landmark_pixels or point_b not in camera.landmark_pixels:
            return
        key = (
            camera_name,
            point_a,
            point_b,
            horizontal_object["orientation"],
            round(float(length_m), 6),
            round(float(z), 6),
        )
        if key in horizontal_object_keys:
            return
        horizontal_object_keys.add(key)
        horizontal_objects.append(
            {
                "type": "horizontal_object",
                "camera": camera_name,
                "point_a": point_a,
                "point_b": point_b,
                "pixel_a": tuple(float(value) for value in camera.landmark_pixels[point_a]),
                "pixel_b": tuple(float(value) for value in camera.landmark_pixels[point_b]),
                "orientation": horizontal_object["orientation"],
                "length_m": float(length_m),
                "z": float(z),
                "configured": True,
            }
        )

    target_camera = get_camera(solve["camera_name"])
    for landmark_name in solve["landmarks"]:
        add_observation(
            {
                "type": "landmark",
                "camera": solve["camera_name"],
                "landmark": landmark_name,
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[landmark_name]),
                "explicit": True,
                "configured": True,
            }
        )
    for row in triangulations:
        add_observation(
            {
                "type": "triangulated_target",
                "camera": row["target_camera"],
                "landmark": row["name"],
                "pixel": tuple(row["target_pixel"]),
                "source_camera": row.get("source_camera"),
                "explicit": bool(row.get("explicit")),
                "configured": bool(row.get("explicit")),
                "discovered": bool(row.get("discovered")),
            }
        )
        if row["type"] == "ray_triangulation":
            add_observation(
                {
                    "type": "triangulated_source",
                    "camera": row["source_camera"],
                    "landmark": row["name"],
                    "pixel": tuple(row["source_pixel"]),
                    "source_camera": row["source_camera"],
                    "target_camera": row["target_camera"],
                    "explicit": bool(row.get("explicit")),
                    "configured": bool(row.get("explicit")),
                    "discovered": bool(row.get("discovered")),
                }
            )

    for horizontal_object in solve.get("horizontal_objects", []):
        add_horizontal_object(solve["camera_name"], horizontal_object)

    for chain_solve in solves:
        camera_name = chain_solve["camera_name"]
        if camera_name not in cameras or camera_name not in md.cameras:
            continue
        camera = get_camera(camera_name)
        for landmark_name in chain_solve["landmarks"]:
            if landmark_name not in landmarks or landmark_name not in camera.landmark_pixels:
                continue
            add_observation(
                {
                    "type": "configured_landmark",
                    "camera": camera_name,
                    "landmark": landmark_name,
                    "pixel": tuple(float(value) for value in camera.landmark_pixels[landmark_name]),
                    "explicit": True,
                    "configured": True,
                    "chain_configured": True,
                }
            )
        for source_camera_name, target_name in chain_solve["rays"]:
            if target_name not in landmarks:
                continue
            if target_name in camera.landmark_pixels:
                add_observation(
                    {
                        "type": "configured_ray_target",
                        "camera": camera_name,
                        "landmark": target_name,
                        "pixel": tuple(float(value) for value in camera.landmark_pixels[target_name]),
                        "source_camera": source_camera_name,
                        "explicit": True,
                        "configured": True,
                        "chain_configured": True,
                    }
                )
            if (
                source_camera_name in cameras
                and source_camera_name in md.cameras
                and target_name in get_camera(source_camera_name).landmark_pixels
            ):
                source_camera = get_camera(source_camera_name)
                add_observation(
                    {
                        "type": "configured_ray_source",
                        "camera": source_camera_name,
                        "landmark": target_name,
                        "pixel": tuple(float(value) for value in source_camera.landmark_pixels[target_name]),
                        "target_camera": camera_name,
                        "explicit": True,
                        "configured": True,
                        "chain_configured": True,
                    }
                )
        for horizontal_object in chain_solve.get("horizontal_objects", []):
            add_horizontal_object(camera_name, horizontal_object)

    camera_names = list(cameras)
    landmark_names = list(landmarks)
    return {
        "cameras": cameras,
        "landmarks": landmarks,
        "camera_names": camera_names,
        "landmark_names": landmark_names,
        "observations": observations,
        "horizontal_objects": horizontal_objects,
    }


def pack_global(system: dict[str, Any]) -> np.ndarray:
    camera_params = [system["cameras"][name]["params"] for name in system["camera_names"]]
    landmark_params = [system["landmarks"][name]["xyz"] for name in system["landmark_names"]]
    return np.concatenate([np.asarray(camera_params).ravel(), np.asarray(landmark_params).ravel()])


def unpack_global(
    params: np.ndarray,
    system: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray]:
    n_cameras = len(system["camera_names"])
    n_landmarks = len(system["landmark_names"])
    camera_params = params[: n_cameras * 7].reshape((n_cameras, 7))
    landmark_params = params[n_cameras * 7 :].reshape((n_landmarks, 3))
    return camera_params, landmark_params


def global_observation_residuals(
    params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_params, landmark_params = unpack_global(params, system)
    return global_observation_residuals_from_arrays(camera_params, landmark_params, system)


def global_horizontal_object_residuals(
    params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_params, _landmark_params = unpack_global(params, system)
    return global_horizontal_object_residuals_from_arrays(camera_params, system)


def global_observation_residuals_from_arrays(
    camera_params: np.ndarray,
    landmark_params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_index = {name: index for index, name in enumerate(system["camera_names"])}
    landmark_index = {name: index for index, name in enumerate(system["landmark_names"])}
    values = []
    for observation in system["observations"]:
        cam_i = camera_index[observation["camera"]]
        lm_i = landmark_index[observation["landmark"]]
        cam_params = camera_params[cam_i]
        landmark_xyz = landmark_params[lm_i]
        direction = camera_direction_from_params(
            observation["pixel"],
            cam_params,
            system["cameras"][observation["camera"]]["size"],
        )
        expected = unit(landmark_xyz - cam_params[:3])
        values.append(1e6 if expected is None else angle_arcmin(direction, expected))
    return np.asarray(values, dtype=float)


def global_horizontal_object_residuals_from_arrays(
    camera_params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_index = {name: index for index, name in enumerate(system["camera_names"])}
    values = []
    for horizontal_object in system.get("horizontal_objects", []):
        camera_name = horizontal_object["camera"]
        cam_i = camera_index[camera_name]
        values.append(
            object_residual_from_params(
                camera_params[cam_i],
                system["cameras"][camera_name]["size"],
                horizontal_object["pixel_a"],
                horizontal_object["pixel_b"],
                horizontal_object["orientation"],
                horizontal_object["length_m"],
                horizontal_object["z"],
            )
        )
    return np.asarray(values, dtype=float)


def global_prior_residuals(
    params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_params, landmark_params = unpack_global(params, system)
    values: list[float] = []
    for index, name in enumerate(system["camera_names"]):
        prior = system["cameras"][name]["prior"]
        initial = system["cameras"][name]["params"]
        xyz_sigma = sigma_value(prior.get("xyz_rigidity_m"))
        ypr_sigma = sigma_value(prior.get("ypr_rigidity_deg"))
        fov_sigma = sigma_value(prior.get("fov_rigidity_deg"))
        if xyz_sigma is not None:
            values.extend(((camera_params[index, :3] - initial[:3]) / xyz_sigma).tolist())
        if ypr_sigma is not None:
            values.extend(((camera_params[index, 3:6] - initial[3:6]) / ypr_sigma).tolist())
        if fov_sigma is not None:
            values.append(float((camera_params[index, 6] - initial[6]) / fov_sigma))
    for index, name in enumerate(system["landmark_names"]):
        prior = system["landmarks"][name]["prior"]
        sigma = sigma_value(prior.get("xyz_rigidity_m"))
        if sigma is not None:
            initial = system["landmarks"][name]["xyz"]
            values.extend(((landmark_params[index] - initial) / sigma).tolist())
    return np.asarray(values, dtype=float)


def global_residuals(
    params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    return np.concatenate(
        [
            global_observation_residuals(params, system),
            global_horizontal_object_residuals(params, system),
            global_prior_residuals(params, system),
        ]
    )


def global_jac_sparsity(system: dict[str, Any]):
    n_cameras = len(system["camera_names"])
    n_landmarks = len(system["landmark_names"])
    n_params = n_cameras * 7 + n_landmarks * 3
    n_observations = len(system["observations"])
    n_horizontal_objects = len(system.get("horizontal_objects", []))
    n_prior_residuals = len(global_prior_residuals(pack_global(system), system))
    sparsity = lil_matrix((n_observations + n_horizontal_objects + n_prior_residuals, n_params), dtype=int)

    camera_index = {name: index for index, name in enumerate(system["camera_names"])}
    landmark_index = {name: index for index, name in enumerate(system["landmark_names"])}
    for row, observation in enumerate(system["observations"]):
        cam_i = camera_index[observation["camera"]]
        lm_i = landmark_index[observation["landmark"]]
        sparsity[row, cam_i * 7 : cam_i * 7 + 7] = 1
        landmark_offset = n_cameras * 7 + lm_i * 3
        sparsity[row, landmark_offset : landmark_offset + 3] = 1

    row = n_observations
    for horizontal_object in system.get("horizontal_objects", []):
        cam_i = camera_index[horizontal_object["camera"]]
        sparsity[row, cam_i * 7 : cam_i * 7 + 7] = 1
        row += 1
    for index, name in enumerate(system["camera_names"]):
        prior = system["cameras"][name]["prior"]
        xyz_sigma = sigma_value(prior.get("xyz_rigidity_m"))
        ypr_sigma = sigma_value(prior.get("ypr_rigidity_deg"))
        fov_sigma = sigma_value(prior.get("fov_rigidity_deg"))
        camera_offset = index * 7
        if xyz_sigma is not None:
            for param in range(3):
                sparsity[row, camera_offset + param] = 1
                row += 1
        if ypr_sigma is not None:
            for param in range(3, 6):
                sparsity[row, camera_offset + param] = 1
                row += 1
        if fov_sigma is not None:
            sparsity[row, camera_offset + 6] = 1
            row += 1
    for index, name in enumerate(system["landmark_names"]):
        prior = system["landmarks"][name]["prior"]
        sigma = sigma_value(prior.get("xyz_rigidity_m"))
        if sigma is not None:
            landmark_offset = n_cameras * 7 + index * 3
            for param in range(3):
                sparsity[row, landmark_offset + param] = 1
                row += 1

    return sparsity.tocsr()


def summarize_global(
    params: np.ndarray,
    system: dict[str, Any],
) -> dict[str, Any]:
    obs = global_observation_residuals(params, system)
    horizontal = global_horizontal_object_residuals(params, system)
    priors = global_prior_residuals(params, system)
    return {
        "observations": residual_summary(obs),
        "horizontal_objects": residual_summary(horizontal) if len(horizontal) else None,
        "priors": residual_summary(priors) if len(priors) else None,
        "total_residual_count": int(len(obs) + len(horizontal) + len(priors)),
    }


def global_observation_rows(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
) -> list[dict[str, Any]]:
    initial = global_observation_residuals(initial_params, system)
    final = global_observation_residuals(final_params, system)
    rows = []
    for index, observation in enumerate(system["observations"]):
        rows.append(
            {
                "rank": 0,
                "index": index,
                "type": observation["type"],
                "camera": observation["camera"],
                "landmark": observation["landmark"],
                "source_camera": observation.get("source_camera"),
                "target_camera": observation.get("target_camera"),
                "explicit": bool(observation.get("explicit")),
                "configured": bool(observation.get("configured")),
                "discovered": bool(observation.get("discovered")),
                "initial_error_arcmin": float(initial[index]),
                "final_error_arcmin": float(final[index]),
                "delta_error_arcmin": float(final[index] - initial[index]),
            }
        )
    rows.sort(key=lambda row: abs(row["final_error_arcmin"]), reverse=True)
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


def global_observation_subset_summary(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
    key: str,
) -> dict[str, Any]:
    initial = global_observation_residuals(initial_params, system)
    final = global_observation_residuals(final_params, system)
    indexes = [
        index
        for index, observation in enumerate(system["observations"])
        if observation.get(key)
    ]
    return {
        "count": len(indexes),
        "initial": residual_summary(initial[indexes]),
        "final": residual_summary(final[indexes]),
    }


def global_horizontal_object_rows(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
) -> list[dict[str, Any]]:
    initial_cameras, _ = unpack_global(initial_params, system)
    final_cameras, _ = unpack_global(final_params, system)
    initial = global_horizontal_object_residuals_from_arrays(initial_cameras, system)
    final = global_horizontal_object_residuals_from_arrays(final_cameras, system)
    rows = []
    for index, horizontal_object in enumerate(system.get("horizontal_objects", [])):
        rows.append(
            {
                "rank": 0,
                "index": index,
                "camera": horizontal_object["camera"],
                "point_a": horizontal_object["point_a"],
                "point_b": horizontal_object["point_b"],
                "orientation": horizontal_object["orientation"],
                "length_m": horizontal_object["length_m"],
                "z": horizontal_object["z"],
                "initial_error_arcmin": float(initial[index]),
                "final_error_arcmin": float(final[index]),
                "delta_error_arcmin": float(final[index] - initial[index]),
            }
        )
    rows.sort(key=lambda row: abs(row["final_error_arcmin"]), reverse=True)
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows


def global_camera_observation_rows(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
) -> list[dict[str, Any]]:
    initial_camera_params, initial_landmark_params = unpack_global(initial_params, system)
    final_camera_params, final_landmark_params = unpack_global(final_params, system)
    initial = global_observation_residuals_from_arrays(
        initial_camera_params,
        initial_landmark_params,
        system,
    )
    final = global_observation_residuals_from_arrays(
        final_camera_params,
        final_landmark_params,
        system,
    )
    rows = []
    for camera_name in system["camera_names"]:
        indexes = [
            index
            for index, observation in enumerate(system["observations"])
            if observation["camera"] == camera_name
        ]
        configured_indexes = [
            index for index in indexes if system["observations"][index].get("configured")
        ]
        rows.append(
            {
                "name": camera_name,
                "observation_count": len(indexes),
                "configured_count": len(configured_indexes),
                "initial": residual_summary(initial[indexes]),
                "final": residual_summary(final[indexes]),
                "configured_initial": residual_summary(initial[configured_indexes]),
                "configured_final": residual_summary(final[configured_indexes]),
            }
        )
    rows.sort(key=lambda row: row["configured_final"]["loss_arcmin2"], reverse=True)
    return rows


def gtamaplib_observation_residuals(system: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
    values: list[float] = []
    usable: list[bool] = []
    for observation in system["observations"]:
        camera_name = observation["camera"]
        landmark_name = observation["landmark"]
        if camera_name not in md.cameras:
            values.append(0.0)
            usable.append(False)
            continue
        if landmark_name in md.landmarks:
            landmark_xyz = np.asarray(md.landmarks[landmark_name], dtype=float)
        elif landmark_name in md.cameras:
            landmark_xyz = np.asarray(get_camera(landmark_name).xyz, dtype=float)
        else:
            values.append(0.0)
            usable.append(False)
            continue
        camera = get_camera(camera_name)
        direction = camera_direction_from_pixel(
            tuple(float(value) for value in observation["pixel"]),
            camera.ypr,
            camera.fov,
            camera.size,
        )
        expected = unit(landmark_xyz - np.asarray(camera.xyz, dtype=float))
        values.append(1e6 if expected is None else angle_arcmin(direction, expected))
        usable.append(True)
    return np.asarray(values, dtype=float), np.asarray(usable, dtype=bool)


def solve_gtamaplib_residuals(solve: dict[str, Any]) -> np.ndarray:
    camera = get_camera(solve["camera_name"])
    camera_xyz = np.asarray(camera.xyz, dtype=float)
    values: list[float] = []
    for landmark_name in solve["landmarks"]:
        if landmark_name not in camera.landmark_pixels:
            continue
        if landmark_name in md.landmarks:
            landmark_xyz = np.asarray(md.landmarks[landmark_name], dtype=float)
        elif landmark_name in md.cameras:
            landmark_xyz = np.asarray(get_camera(landmark_name).xyz, dtype=float)
        else:
            continue
        direction = camera_direction_from_pixel(
            tuple(float(value) for value in camera.landmark_pixels[landmark_name]),
            camera.ypr,
            camera.fov,
            camera.size,
        )
        expected = unit(landmark_xyz - camera_xyz)
        values.append(1e6 if expected is None else angle_arcmin(direction, expected))
    for source_camera_name, target_name in solve["rays"]:
        if target_name not in camera.landmark_pixels:
            continue
        if source_camera_name not in md.cameras:
            ensure_top_down_fake_camera(source_camera_name, target_name)
        if source_camera_name not in md.cameras:
            continue
        source_camera = get_camera(source_camera_name)
        if target_name not in source_camera.landmark_pixels:
            continue
        target_direction = camera_direction_from_pixel(
            tuple(float(value) for value in camera.landmark_pixels[target_name]),
            camera.ypr,
            camera.fov,
            camera.size,
        )
        source_direction = camera_direction_from_pixel(
            tuple(float(value) for value in source_camera.landmark_pixels[target_name]),
            source_camera.ypr,
            source_camera.fov,
            source_camera.size,
        )
        values.append(
            float(
                intersect_ray_and_ray(
                    (camera_xyz, target_direction),
                    (np.asarray(source_camera.xyz, dtype=float), source_direction),
                )[-1]
            )
            * 60.0
        )
    database_params = np.asarray(
        [
            *camera.xyz,
            *camera.ypr,
            camera.hfov,
        ],
        dtype=float,
    )
    for horizontal_object in solve.get("horizontal_objects", []):
        point_a = horizontal_object["point_a"]
        point_b = horizontal_object["point_b"]
        if point_a not in camera.landmark_pixels or point_b not in camera.landmark_pixels:
            continue
        values.append(
            object_residual_from_params(
                database_params,
                camera.size,
                tuple(float(value) for value in camera.landmark_pixels[point_a]),
                tuple(float(value) for value in camera.landmark_pixels[point_b]),
                horizontal_object["orientation"],
                float(horizontal_object["length_m"]),
                float(horizontal_object["z"]),
            )
        )
    return np.asarray(values, dtype=float)


def solve_optimizer_residuals(
    solve: dict[str, Any],
    final_params: np.ndarray,
    system: dict[str, Any],
) -> np.ndarray:
    camera_params, landmark_params = unpack_global(final_params, system)
    camera_index = {name: index for index, name in enumerate(system["camera_names"])}
    landmark_index = {name: index for index, name in enumerate(system["landmark_names"])}
    camera_name = solve["camera_name"]
    if camera_name not in camera_index:
        return np.asarray([], dtype=float)
    camera = get_camera(camera_name)
    cam_params = camera_params[camera_index[camera_name]]
    values: list[float] = []
    for landmark_name in solve["landmarks"]:
        if landmark_name not in landmark_index or landmark_name not in camera.landmark_pixels:
            continue
        landmark_xyz = landmark_params[landmark_index[landmark_name]]
        direction = camera_direction_from_params(
            tuple(float(value) for value in camera.landmark_pixels[landmark_name]),
            cam_params,
            system["cameras"][camera_name]["size"],
        )
        expected = unit(landmark_xyz - cam_params[:3])
        values.append(1e6 if expected is None else angle_arcmin(direction, expected))
    for source_camera_name, target_name in solve["rays"]:
        if source_camera_name not in camera_index or target_name not in camera.landmark_pixels:
            continue
        if source_camera_name not in md.cameras:
            ensure_top_down_fake_camera(source_camera_name, target_name)
        if source_camera_name not in md.cameras:
            continue
        source_camera = get_camera(source_camera_name)
        if target_name not in source_camera.landmark_pixels:
            continue
        source_params = camera_params[camera_index[source_camera_name]]
        target_direction = camera_direction_from_params(
            tuple(float(value) for value in camera.landmark_pixels[target_name]),
            cam_params,
            system["cameras"][camera_name]["size"],
        )
        source_direction = camera_direction_from_params(
            tuple(float(value) for value in source_camera.landmark_pixels[target_name]),
            source_params,
            system["cameras"][source_camera_name]["size"],
        )
        values.append(
            float(
                intersect_ray_and_ray(
                    (cam_params[:3], target_direction),
                    (source_params[:3], source_direction),
                )[-1]
            )
            * 60.0
        )
    for horizontal_object in solve.get("horizontal_objects", []):
        point_a = horizontal_object["point_a"]
        point_b = horizontal_object["point_b"]
        if point_a not in camera.landmark_pixels or point_b not in camera.landmark_pixels:
            continue
        values.append(
            object_residual_from_params(
                cam_params,
                system["cameras"][camera_name]["size"],
                tuple(float(value) for value in camera.landmark_pixels[point_a]),
                tuple(float(value) for value in camera.landmark_pixels[point_b]),
                horizontal_object["orientation"],
                float(horizontal_object["length_m"]),
                float(horizontal_object["z"]),
            )
        )
    return np.asarray(values, dtype=float)


def configured_camera_loss_rows(
    final_params: np.ndarray,
    system: dict[str, Any],
    solves: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = []
    for solve in solves:
        if solve["camera_name"] not in system["camera_names"]:
            continue
        gtamaplib_values = solve_gtamaplib_residuals(solve)
        optimizer_values = solve_optimizer_residuals(solve, final_params, system)
        rows.append(
            {
                "camera_name": solve["camera_name"],
                "gtamaplib": residual_summary(gtamaplib_values),
                "optimizer": residual_summary(optimizer_values),
                "gtamaplib_count": int(len(gtamaplib_values)),
                "optimizer_count": int(len(optimizer_values)),
            }
        )
    rows.sort(key=lambda row: row["optimizer"]["loss_arcmin2"], reverse=True)
    return rows


def global_camera_rows(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
) -> list[dict[str, Any]]:
    initial_cameras, _ = unpack_global(initial_params, system)
    final_cameras, _ = unpack_global(final_params, system)
    rows = []
    for index, name in enumerate(system["camera_names"]):
        delta = final_cameras[index] - initial_cameras[index]
        rows.append(
            {
                "name": name,
                "initial": [float(value) for value in initial_cameras[index]],
                "final": [float(value) for value in final_cameras[index]],
                "delta": [float(value) for value in delta],
                "position_delta_m": float(np.linalg.norm(delta[:3])),
            }
        )
    rows.sort(key=lambda row: row["position_delta_m"], reverse=True)
    return rows


def global_landmark_rows(
    initial_params: np.ndarray,
    final_params: np.ndarray,
    system: dict[str, Any],
) -> list[dict[str, Any]]:
    _, initial_landmarks = unpack_global(initial_params, system)
    _, final_landmarks = unpack_global(final_params, system)
    rows = []
    for index, name in enumerate(system["landmark_names"]):
        delta = final_landmarks[index] - initial_landmarks[index]
        rows.append(
            {
                "name": name,
                "initial": [float(value) for value in initial_landmarks[index]],
                "final": [float(value) for value in final_landmarks[index]],
                "delta": [float(value) for value in delta],
                "position_delta_m": float(np.linalg.norm(delta)),
                "source": system["landmarks"][name].get("source"),
            }
        )
    rows.sort(key=lambda row: row["position_delta_m"], reverse=True)
    return rows


def next_prior_batch(
    solve: dict[str, Any],
    params: np.ndarray,
    system: dict[str, Any],
) -> list[Any]:
    camera_params, landmark_params = unpack_global(params, system)
    rows: list[Any] = []
    for index, name in enumerate(system["camera_names"]):
        prior = system["cameras"][name]["prior"]
        params_row = normalize_camera_params(name, camera_params[index])
        size = system["cameras"][name]["size"]
        rows.append(
            [
                "camera",
                name,
                prior.get("player"),
                [float(value) for value in params_row[:3]],
                [float(value) for value in params_row[3:6]],
                [
                    float(params_row[6]),
                    float(get_vfov(float(params_row[6]), size)),
                ],
                [int(value) for value in size],
                prior.get("xyz_rigidity_m"),
                prior.get("ypr_rigidity_deg"),
                prior.get("fov_rigidity_deg"),
            ]
        )
    for index, name in enumerate(system["landmark_names"]):
        prior = system["landmarks"][name]["prior"]
        rows.append(
            [
                "landmark",
                name,
                [float(value) for value in landmark_params[index]],
                prior.get("xyz_rigidity_m"),
            ]
        )
    return [solve["id"], rows]


def solve_global_system(
    solve: dict[str, Any],
    priors: dict[str, Any],
    local_report: dict[str, Any],
    solves: list[dict[str, Any]],
    max_nfev: int,
    loss: str,
    f_scale: float,
    x_scale: str,
    verbose: int,
) -> dict[str, Any]:
    triangulations = triangulate_from_local_solution(solve, priors, local_report)
    system = build_global_system(solve, priors, local_report, triangulations, solves)
    initial_params = pack_global(system)
    lower = np.full_like(initial_params, -np.inf)
    upper = np.full_like(initial_params, np.inf)
    n_cameras = len(system["camera_names"])
    lower[6 : n_cameras * 7 : 7] = 0.001
    upper[6 : n_cameras * 7 : 7] = 160.0
    for index, name in enumerate(system["camera_names"]):
        if camera_has_fixed_zero_roll(name):
            lower[index * 7 + 5] = -FIXED_ROLL_EPS
            upper[index * 7 + 5] = FIXED_ROLL_EPS
    jac_sparsity = global_jac_sparsity(system)
    started_at = time.perf_counter()
    result = least_squares(
        global_residuals,
        initial_params,
        bounds=(lower, upper),
        jac_sparsity=jac_sparsity,
        loss=loss,
        f_scale=f_scale,
        x_scale=x_scale,
        max_nfev=max_nfev,
        verbose=verbose,
        args=(system,),
    )
    elapsed_seconds = time.perf_counter() - started_at
    final_params = normalize_global_params(result.x, system)
    generated_prior_batch = next_prior_batch(solve, final_params, system)
    return {
        "schema": "gtamaplib-chain-global-result-v1",
        "camera_name": solve["camera_name"],
        "triangulations": triangulations,
        "next_prior_batch": generated_prior_batch,
        "system": {
            "camera_names": system["camera_names"],
            "landmark_names": system["landmark_names"],
            "observation_count": len(system["observations"]),
            "horizontal_object_count": len(system.get("horizontal_objects", [])),
        },
        "optimization": {
            "success": bool(result.success),
            "status": int(result.status),
            "message": result.message,
            "cost": float(result.cost),
            "optimality": float(result.optimality),
            "nfev": int(result.nfev),
            "njev": int(result.njev) if result.njev is not None else None,
            "elapsed_seconds": float(elapsed_seconds),
            "loss": loss,
            "f_scale": float(f_scale),
            "x_scale": x_scale,
            "max_nfev": max_nfev,
        },
        "summary": {
            "initial": summarize_global(initial_params, system),
            "final": summarize_global(final_params, system),
            "configured_observations": global_observation_subset_summary(
                initial_params,
                final_params,
                system,
                "configured",
            ),
        },
        "observations": global_observation_rows(initial_params, final_params, system),
        "horizontal_objects": global_horizontal_object_rows(initial_params, final_params, system),
        "camera_observations": global_camera_observation_rows(
            initial_params,
            final_params,
            system,
        ),
        "configured_camera_losses": configured_camera_loss_rows(
            final_params,
            system,
            solves,
        ),
        "cameras": global_camera_rows(initial_params, final_params, system),
        "landmarks": global_landmark_rows(initial_params, final_params, system),
    }


def print_report(report: dict[str, Any]) -> None:
    final = report["final"]
    initial = report["initial"]
    database = report["database"]
    print(
        f"Final {report['camera_name']}: "
        f"XYZ ({final['xyz'][0]:.3f}, {final['xyz'][1]:.3f}, {final['xyz'][2]:.3f}) "
        f"YPR ({final['ypr'][0]:.3f}, {final['ypr'][1]:.3f}, {final['ypr'][2]:.3f}) "
        f"FOV ({final['fov'][0]:.3f}, {final['fov'][1]:.3f})"
    )
    print(
        "Camera loss (mean squared angular residual): "
        f"initial {initial['camera_loss_arcmin2']:.6f}, "
        f"final {final['camera_loss_arcmin2']:.6f} arcmin^2"
    )
    print(
        "Final angular residuals: "
        f"mean {final['mean_abs_arcmin']:.3f}', "
        f"median {final['median_abs_arcmin']:.3f}', "
        f"max {final['max_abs_arcmin']:.3f}'"
    )
    print()
    print(f"{'param':<8} {'init':>14} {'gtamaplib':>14} {'least_squares':>14} {'delta':>14}")
    initial_values = initial["xyz"] + initial["ypr"] + initial["fov"]
    database_values = database["xyz"] + database["ypr"] + database["fov"]
    final_values = final["xyz"] + final["ypr"] + final["fov"]
    for label, initial_value, database_value, final_value in zip(
        ["x", "y", "z", "yaw", "pitch", "roll", "hfov", "vfov"],
        initial_values,
        database_values,
        final_values,
    ):
        print(
            f"{label:<8} "
            f"{initial_value:14.6f} "
            f"{database_value:14.6f} "
            f"{final_value:14.6f} "
            f"{final_value - database_value:14.6f}"
        )
    print(f"Elapsed: {report['optimization']['elapsed_seconds']:.1f}s")
    print()
    print(f"{'rank':>4} {'type':<8} {'final':>10} {'initial':>10} {'delta':>10}  constraint")
    for row in report["constraints"]["items"]:
        if row["type"] == "ray":
            label = f"{row['source_camera']} -> {row['name']}"
        elif row["type"] == "horizontal_object":
            label = f"{row['point_a']} -> {row['point_b']} ({row['length_m']:.3f}m @ z={row['z']:g})"
        else:
            label = row["name"]
        print(
            f"{row['rank']:>4} "
            f"{row['type']:<8} "
            f"{row['final_error_arcmin']:10.3f} "
            f"{row['initial_error_arcmin']:10.3f} "
            f"{row['delta_error_arcmin']:10.3f}  "
            f"{label}"
        )


def print_local_summary(report: dict[str, Any]) -> None:
    initial = report["initial"]
    final = report["final"]
    database = report["database"]
    landmark_count = report["constraints"]["landmark_count"]
    ray_count = report["constraints"]["ray_count"]
    horizontal_object_count = report["constraints"].get("horizontal_object_count", 0)
    print(
        f"Local {report['camera_name']}: "
        f"loss {initial['camera_loss_arcmin2']:.6f} -> "
        f"{final['camera_loss_arcmin2']:.6f} arcmin^2, "
        f"mean {final['mean_abs_arcmin']:.3f}', "
        f"median {final['median_abs_arcmin']:.3f}', "
            f"max {final['max_abs_arcmin']:.3f}'."
    )
    print(
        f"Configured local constraints: {landmark_count} landmarks + {ray_count} rays "
        f"+ {horizontal_object_count} objects."
    )
    print()
    print(
        "gtamaplib vs optimizer camera loss: "
        f"{database['camera_loss_arcmin2']:.6f} -> "
        f"{final['camera_loss_arcmin2']:.6f} arcmin^2 "
        f"(delta {final['camera_loss_arcmin2'] - database['camera_loss_arcmin2']:+.6f})."
    )


def print_local_parameters(report: dict[str, Any]) -> None:
    final = report["final"]
    database = report["database"]
    print()
    print(f"{'param':<8} {'gtamaplib':>14} {'optimizer':>14} {'delta':>14}")
    database_values = database["xyz"] + database["ypr"] + database["fov"]
    final_values = final["xyz"] + final["ypr"] + final["fov"]
    for label, database_value, final_value in zip(
        ["x", "y", "z", "yaw", "pitch", "roll", "hfov", "vfov"],
        database_values,
        final_values,
    ):
        print(
            f"{label:<8} "
            f"{database_value:14.6f} "
            f"{final_value:14.6f} "
            f"{final_value - database_value:14.6f}"
        )


def print_local_residuals(report: dict[str, Any]) -> None:
    print()
    print("Local observation residuals after local solve, before global:")
    for index, row in enumerate(report["constraints"]["items"], start=1):
        if row["type"] == "ray":
            label = f"{row['source_camera']} | {row['name']} | ray"
        elif row["type"] == "horizontal_object":
            label = (
                f"{row['point_a']} -> {row['point_b']} | "
                f"{row.get('orientation', 'horizontal')} {row['length_m']:.3f}m @ z={row['z']:g}"
            )
        else:
            label = f"{row['name']} | landmark"
        print(f"  {index:>2}. {row['final_error_arcmin']:8.3f}' | {label}")


def print_current_step_global_residuals(report: dict[str, Any]) -> None:
    rows = [
        row for row in report["observations"]
        if row.get("configured") and row["camera"] == report["camera_name"]
    ]
    if not rows:
        return
    rows.sort(key=lambda row: abs(row["final_error_arcmin"]), reverse=True)
    print()
    print("Current stage observation residuals after global:")
    for index, row in enumerate(rows, start=1):
        details = []
        if row.get("source_camera") and row["source_camera"] != row["camera"]:
            details.append(f"via {row['source_camera']}")
        if row.get("target_camera") and row["target_camera"] != row["camera"]:
            details.append(f"to {row['target_camera']}")
        suffix = f" [{' ; '.join(details)}]" if details else ""
        print(
            f"  {index:>2}. {row['final_error_arcmin']:8.3f}' | "
            f"{row['landmark']} | {row['type']}{suffix}"
        )


def current_step_global_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [
        row for row in report["observations"]
        if row.get("configured") and row["camera"] == report["camera_name"]
    ]
    rows.sort(key=lambda row: abs(row["final_error_arcmin"]), reverse=True)
    return rows


def global_camera_params(report: dict[str, Any], camera_name: str) -> list[float]:
    for row in report["cameras"]:
        if row["name"] == camera_name:
            return row["final"]
    raise KeyError(f"No global camera row for {camera_name!r}")


def print_camera_parameter_table(
    database: dict[str, Any],
    final_values: list[float],
) -> None:
    database_values = database["xyz"] + database["ypr"] + database["fov"]
    print()
    print(f"{'param':<8} {'gtamaplib':>14} {'optimizer':>14} {'delta':>14}")
    for label, database_value, final_value in zip(
        ["x", "y", "z", "yaw", "pitch", "roll", "hfov", "vfov"],
        database_values,
        final_values,
    ):
        print(
            f"{label:<8} "
            f"{database_value:14.6f} "
            f"{final_value:14.6f} "
            f"{final_value - database_value:14.6f}"
        )


def print_global_observation_rows(rows: list[dict[str, Any]]) -> None:
    print()
    print("Observation residuals:")
    for index, row in enumerate(rows, start=1):
        details = []
        if row.get("source_camera") and row["source_camera"] != row["camera"]:
            details.append(f"via {row['source_camera']}")
        if row.get("target_camera") and row["target_camera"] != row["camera"]:
            details.append(f"to {row['target_camera']}")
        suffix = f" [{' ; '.join(details)}]" if details else ""
        print(
            f"  {index:>2}. {row['final_error_arcmin']:8.3f}' | "
            f"{row['landmark']} | {row['type']}{suffix}"
        )


def print_local_observation_rows(local_report: dict[str, Any]) -> None:
    print()
    print("Observation residuals:")
    for index, row in enumerate(local_report["constraints"]["items"], start=1):
        if row["type"] == "ray":
            label = f"{row['source_camera']} | {row['name']} | ray"
        elif row["type"] == "horizontal_object":
            label = (
                f"{row['point_a']} -> {row['point_b']} | "
                f"{row.get('orientation', 'horizontal')} {row['length_m']:.3f}m @ z={row['z']:g}"
            )
        else:
            label = f"{row['name']} | landmark"
        print(f"  {index:>2}. {row['final_error_arcmin']:8.3f}' | {label}")


def print_optimizer_camera_report(
    local_report: dict[str, Any],
    global_report: dict[str, Any],
    *,
    local_pass: bool = True,
) -> None:
    database = local_report["database"]
    global_rows = current_step_global_rows(global_report)
    global_values = np.asarray([row["final_error_arcmin"] for row in global_rows], dtype=float)
    global_summary = residual_summary(global_values)
    landmark_count = local_report["constraints"]["landmark_count"]
    ray_count = local_report["constraints"]["ray_count"]
    object_count = local_report["constraints"].get("horizontal_object_count", 0)
    print()
    print(f"{global_report['camera_name']}")
    print(f"Configured constraints: {landmark_count} landmarks + {ray_count} rays + {object_count} objects.")
    print()

    if local_pass:
        print("Local pass")
        print(
            "gtamaplib vs optimizer camera loss: "
            f"{database['camera_loss_arcmin2']:.6f} -> "
            f"{local_report['final']['camera_loss_arcmin2']:.6f} arcmin^2 "
            f"(delta {local_report['final']['camera_loss_arcmin2'] - database['camera_loss_arcmin2']:+.6f})."
        )
        print(
            "Final observation residuals: "
            f"mean {local_report['final']['mean_abs_arcmin']:.3f}', "
            f"median {local_report['final']['median_abs_arcmin']:.3f}', "
            f"max {local_report['final']['max_abs_arcmin']:.3f}'."
        )
        local_final = local_report["final"]["xyz"] + local_report["final"]["ypr"] + local_report["final"]["fov"]
        print_camera_parameter_table(database, local_final)
        print_local_observation_rows(local_report)
        print()
    print("Global pass")
    print(
        "gtamaplib vs optimizer camera loss: "
        f"{database['camera_loss_arcmin2']:.6f} -> "
        f"{global_summary['loss_arcmin2']:.6f} arcmin^2 "
        f"(delta {global_summary['loss_arcmin2'] - database['camera_loss_arcmin2']:+.6f})."
    )
    print(
        "Final observation residuals: "
        f"mean {global_summary['mean_abs_arcmin']:.3f}', "
        f"median {global_summary['median_abs_arcmin']:.3f}', "
        f"max {global_summary['max_abs_arcmin']:.3f}'."
    )
    final_params = global_camera_params(global_report, global_report["camera_name"])
    final_fov = [float(final_params[6]), float(get_vfov(float(final_params[6]), tuple(database["size"])))]
    final_values = final_params[:3] + final_params[3:6] + final_fov
    print_camera_parameter_table(database, final_values)
    print_global_observation_rows(global_rows)


def print_global_report(report: dict[str, Any]) -> None:
    initial_obs = report["summary"]["initial"]["observations"]
    final_obs = report["summary"]["final"]["observations"]
    initial_horizontal = report["summary"]["initial"].get("horizontal_objects")
    final_horizontal = report["summary"]["final"].get("horizontal_objects")
    configured = report["summary"].get("configured_observations")
    print()
    print("Global system")
    print(
        "{camera_count} cameras, {landmark_count} landmarks, {observation_count} observations, "
        "{horizontal_object_count} objects.".format(
            camera_count=len(report["system"]["camera_names"]),
            landmark_count=len(report["system"]["landmark_names"]),
            observation_count=report["system"]["observation_count"],
            horizontal_object_count=report["system"].get("horizontal_object_count", 0),
        )
    )
    print(
        "Observation loss: initial {initial:.6f}, final {final:.6f} arcmin^2 "
        "(RMS {initial_rms:.3f}' -> {final_rms:.3f}')".format(
            initial=initial_obs["loss_arcmin2"],
            final=final_obs["loss_arcmin2"],
            initial_rms=initial_obs["rms_arcmin"],
            final_rms=final_obs["rms_arcmin"],
        )
    )
    if final_horizontal is not None:
        print(
            "Object loss: initial {initial:.6f}, final {final:.6f} arcmin^2, "
            "max {max_error:.3f}'.".format(
                initial=initial_horizontal["loss_arcmin2"],
                final=final_horizontal["loss_arcmin2"],
                max_error=final_horizontal["max_abs_arcmin"],
            )
        )
    print(
        "Final observation residuals: mean {mean_abs_arcmin:.3f}', "
        "median {median_abs_arcmin:.3f}', max {max_abs_arcmin:.3f}'.".format(
            **final_obs
        )
    )
    if configured:
        print(
            "Configured global observations: {count} obs, loss {initial:.6f} -> "
            "{final:.6f} arcmin^2 (RMS {initial_rms:.3f}' -> {final_rms:.3f}')".format(
                count=configured["count"],
                initial=configured["initial"]["loss_arcmin2"],
                final=configured["final"]["loss_arcmin2"],
                initial_rms=configured["initial"]["rms_arcmin"],
                final_rms=configured["final"]["rms_arcmin"],
            )
        )
    if report["summary"]["final"]["priors"] is not None:
        final_priors = report["summary"]["final"]["priors"]
        print(
            "Final prior residuals: mean {mean_abs_arcmin:.3f}, "
            "median {median_abs_arcmin:.3f}, max {max_abs_arcmin:.3f} sigma.".format(
                **final_priors
            )
        )
    print()
    print("Top global observation residuals:")
    for row in report["observations"][:20]:
        details = []
        if row.get("source_camera") and row["source_camera"] != row["camera"]:
            details.append(f"via {row['source_camera']}")
        if row.get("target_camera") and row["target_camera"] != row["camera"]:
            details.append(f"to {row['target_camera']}")
        if row.get("configured"):
            details.append("configured")
        elif row.get("discovered"):
            details.append("discovered")
        suffix = f" [{' ; '.join(details)}]" if details else ""
        print(
            f"  {row['rank']:>2}. {row['final_error_arcmin']:8.3f}' "
            f"{row['camera']} | {row['landmark']} | {row['type']}{suffix}"
        )
    if report.get("horizontal_objects"):
        print()
        print("Top object residuals:")
        for row in report["horizontal_objects"][:20]:
            print(
                f"  {row['rank']:>2}. {row['final_error_arcmin']:8.3f}' "
                f"{row['camera']} | {row['point_a']} -> {row['point_b']} | "
                f"{row['orientation']} {row['length_m']:.3f}m @ z={row['z']:g}"
            )
    print()
    print("Top global camera position changes:")
    for index, row in enumerate(report["cameras"][:10], start=1):
        print(f"  {index:>2}. {row['position_delta_m']:8.3f}m | {row['name']}")
    print()
    print("Top global landmark position changes:")
    for index, row in enumerate(report["landmarks"][:10], start=1):
        print(f"  {index:>2}. {row['position_delta_m']:8.3f}m | {row['name']} | {row['source']}")


def print_new_priors(report: dict[str, Any]) -> None:
    print()
    print("New triangulated landmarks:")
    landmark_sources = {
        row["name"]: row.get("source")
        for row in report.get("landmarks", [])
    }
    triangulations_by_name: dict[str, list[dict[str, Any]]] = {}
    for row in report["triangulations"]:
        triangulations_by_name.setdefault(row["name"], []).append(row)
    printed_names: set[str] = set()
    for row in report["triangulations"]:
        if landmark_sources.get(row["name"]) != "triangulated":
            continue
        if row["name"] in printed_names:
            continue
        printed_names.add(row["name"])
        xyz = row["xyz"]
        landmark_line = (
            f'    "{row["name"]}": '
            f"({xyz[0]:.3f}, {xyz[1]:.3f}, {xyz[2]:.3f}),"
        )
        if row["type"] == "ray_triangulation":
            cameras: list[str] = []
            distances: list[float] = []
            for candidate in triangulations_by_name[row["name"]]:
                if candidate["type"] != "ray_triangulation":
                    continue
                distances.append(float(candidate["ray_distance_m"]))
                for camera_name in (candidate["source_camera"], candidate["target_camera"]):
                    if camera_name not in cameras:
                        cameras.append(camera_name)
            distance = sum(distances) / len(distances) if distances else float(row["ray_distance_m"])
            comment = (
                f"d={distance:.3f} "
                f"via {' & '.join(cameras)}"
            )
        else:
            comment = f"z={row.get('ground_z', GROUND_Z):g} via {row['target_camera']}"
        print(f"{landmark_line}  # {comment}")


def patch_missing_map_image(map_name: str) -> None:
    filename = Path(md.maps[map_name]["filename"])
    if filename.exists():
        return
    candidates = sorted(filename.parent.glob(f"{map_name},*.png"))
    if candidates:
        md.maps[map_name]["filename"] = str(candidates[-1])


def prior_rows_to_gtamapdata(
    rows: list[list[Any]],
    camera_names: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    cameras: dict[str, Any] = {}
    landmarks: dict[str, Any] = {}
    for row in rows:
        if row[0] == "camera":
            _, name, player, xyz, ypr, fov, size, *_ = row
            if camera_names is not None and name not in camera_names:
                continue
            existing = md.cameras.get(name, {})
            cameras[name] = {
                "id": existing.get("id", name),
                "player": player,
                "xyz": tuple(float(value) for value in xyz),
                "ypr": tuple(float(value) for value in ypr),
                "fov": tuple(float(value) if value is not None else None for value in fov),
                "size": tuple(int(value) for value in size),
                "source": existing.get("source", "gtamaplibvc optimizer"),
            }
        elif row[0] == "landmark":
            _, name, xyz, *_ = row
            landmarks[name] = tuple(float(value) for value in xyz)
        else:
            raise ValueError(f"Unknown prior row type: {row[0]!r}")
    return cameras, landmarks


@contextmanager
def registered_render_batch(
    rows: list[list[Any]],
    camera_names: set[str] | None = None,
) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    original_cameras = md.cameras
    original_landmarks = md.landmarks
    cameras, landmarks = prior_rows_to_gtamapdata(rows, camera_names)
    md.cameras = cameras
    md.landmarks = landmarks
    get_camera.cache_clear()
    try:
        yield cameras, landmarks
    finally:
        md.cameras = original_cameras
        md.landmarks = original_landmarks
        get_camera.cache_clear()


def draw_render_rays(map_obj: Any, cameras: dict[str, Any], landmarks: dict[str, Any], distance: float) -> None:
    for camera_name in cameras:
        cam = get_camera(camera_name)
        for landmark_name in cam.landmark_pixels:
            if landmark_name not in landmarks:
                continue
            if normalize_name(landmark_name) in IGNORED_RENDER_RAY_NAMES:
                continue
            direction = cam.get_landmark_direction(landmark_name)
            target_xy = get_point(cam.xyz, direction, distance)[:2]
            map_obj.draw_line((cam.xy, target_xy), get_color(landmark_name), 1)


def render_optimizer_maps(
    rows: list[list[Any]],
    output_dir: Path,
    map_name: str,
    sections: list[str] | None,
    ray_distance: float,
    camera_names: set[str] | None,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    with registered_render_batch(rows, camera_names) as (cameras, landmarks):
        patch_missing_map_image(map_name)
        selected_sections = sections or list(md.map_sections)
        map_obj = get_map(map_name).open()
        draw_render_rays(map_obj, cameras, landmarks, ray_distance)
        map_obj.draw_cameras()
        map_obj.draw_landmarks()
        for section_name in selected_sections:
            if section_name not in md.map_sections:
                raise KeyError(f"No map section named {section_name!r}")
            output = output_dir / f"{map_name} {section_name}.png"
            map_obj.save(str(output), md.map_sections[section_name], section_name, map_info_height=16)
            paths.append(output)
    return paths


def row_xyz_by_type(rows: list[list[Any]], row_type: str) -> dict[str, tuple[float, float, float]]:
    values: dict[str, tuple[float, float, float]] = {}
    for row in rows:
        if row[0] != row_type:
            continue
        values[row[1]] = tuple(float(value) for value in row[3 if row_type == "camera" else 2])
    return values


def original_camera_xyz(name: str) -> tuple[float, float, float] | None:
    if name not in md.cameras:
        return None
    return tuple(float(value) for value in get_camera(name).xyz)


def original_landmark_xyz(name: str) -> tuple[float, float, float] | None:
    if name in md.landmarks:
        return tuple(float(value) for value in md.landmarks[name])
    if name in md.cameras:
        return tuple(float(value) for value in get_camera(name).xyz)
    return None


def blend_rgb(color: tuple[int, int, int], target: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(int(round(color[i] * (1.0 - amount) + target[i] * amount)) for i in range(3))


def draw_delta_marker(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    color: tuple[int, int, int],
    radius: int,
    *,
    alpha: int,
    outline: tuple[int, int, int] | None = None,
) -> None:
    x, y = xy
    fill = (*color, alpha)
    outline_color = outline or (255, 255, 255)
    stroke = (*outline_color, min(255, alpha + 40))
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill, outline=stroke, width=1)


def draw_delta_camera_marker(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    color: tuple[int, int, int],
    radius: int,
    *,
    alpha: int,
) -> None:
    x, y = xy
    draw.ellipse(
        (x - radius, y - radius, x + radius, y + radius),
        fill=(255, 255, 255, alpha),
        outline=(*color, min(255, alpha + 40)),
        width=1,
    )


def draw_delta_original_position(
    draw: ImageDraw.ImageDraw,
    map_obj: Any,
    name: str,
    original_xyz: tuple[float, float, float] | None,
    optimizer_xyz: tuple[float, float, float],
    radius: int,
    *,
    camera: bool = False,
) -> None:
    if original_xyz is None:
        return
    color = get_color(name)
    final_xy = map_obj.get_map_xy(optimizer_xyz[:2])
    delta_m = float(np.linalg.norm(np.asarray(optimizer_xyz[:3]) - np.asarray(original_xyz[:3])))
    if delta_m <= 1e-6:
        return
    original_xy = map_obj.get_map_xy(original_xyz[:2])
    old_color = blend_rgb(color, (255, 255, 255), 0.35)
    draw.line((original_xy[0], original_xy[1], final_xy[0], final_xy[1]), fill=(*color, 110), width=1)
    if camera:
        draw_delta_camera_marker(draw, original_xy, old_color, radius, alpha=85)
    else:
        draw_delta_marker(draw, original_xy, old_color, radius, alpha=85)


def draw_delta_current_position(
    draw: ImageDraw.ImageDraw,
    map_obj: Any,
    name: str,
    optimizer_xyz: tuple[float, float, float],
    radius: int,
    *,
    camera: bool = False,
) -> None:
    color = get_color(name)
    final_xy = map_obj.get_map_xy(optimizer_xyz[:2])
    if camera:
        draw_delta_camera_marker(draw, final_xy, color, radius, alpha=235)
    else:
        draw_delta_marker(draw, final_xy, color, radius, alpha=235)


def render_optimizer_delta_map(
    rows: list[list[Any]],
    output_dir: Path,
    map_name: str,
    scale: float,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    patch_missing_map_image(map_name)
    map_obj = get_map(map_name).open(scale=scale)
    image = map_obj.image.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    positions: list[dict[str, Any]] = []
    landmarks = row_xyz_by_type(rows, "landmark")
    cameras = row_xyz_by_type(rows, "camera")
    for name, xyz in landmarks.items():
        positions.append(
            {
                "name": name,
                "xyz": xyz,
                "original_xyz": original_landmark_xyz(name),
                "camera": False,
            }
        )
    for name, xyz in cameras.items():
        if name.endswith(FAKE_CAMERA_SUFFIX):
            continue
        positions.append(
            {
                "name": name,
                "xyz": xyz,
                "original_xyz": original_camera_xyz(name),
                "camera": True,
            }
        )
    positions.sort(key=lambda row: (row["xyz"][2], row["xyz"][1], row["xyz"][0], row["name"]))

    for row in positions:
        draw_delta_original_position(
            draw,
            map_obj,
            row["name"],
            row["original_xyz"],
            row["xyz"],
            radius=4,
            camera=row["camera"],
        )
    for row in positions:
        draw_delta_current_position(
            draw,
            map_obj,
            row["name"],
            row["xyz"],
            radius=4,
            camera=row["camera"],
        )

    image = Image.alpha_composite(image, overlay).convert("RGB")
    output = output_dir / "delta.jpg"
    image.save(output, quality=88, optimize=True)
    print(f"Writing {output} ... Done")
    return output


def render_optimizer_cameras(
    rows: list[list[Any]],
    output_dir: Path,
    camera_names: list[str] | None,
    scale: float,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    with registered_render_batch(rows, set(camera_names) if camera_names else None) as (cameras, _landmarks):
        selected_cameras = camera_names or list(cameras)
        for camera_name in selected_cameras:
            if camera_name not in cameras:
                continue
            cam = get_camera(camera_name).open(scale=scale)
            cam.render_all()
            output = output_dir / f"{camera_name}.png"
            cam.save(str(output))
            paths.append(output)
    return paths


def render_optimizer_result(
    report: dict[str, Any],
    output_dir: Path,
    map_name: str,
    sections: list[str] | None,
    camera_scale: float,
    ray_distance: float,
    camera_names: set[str],
) -> list[Path]:
    _batch_id, rows = report["global"]["next_prior_batch"]
    rendered: list[Path] = []
    rendered.extend(render_optimizer_maps(rows, output_dir / "maps", map_name, sections, ray_distance, camera_names))
    rendered.append(render_optimizer_delta_map(rows, output_dir / "maps", map_name, DEFAULT_DELTA_MAP_SCALE))
    rendered.extend(render_optimizer_cameras(rows, output_dir / "cameras", sorted(camera_names), camera_scale))
    return rendered


def vc_generated_landmark_sources() -> dict[str, list[str]]:
    if not IMPORT_EXTRAS_PATH.exists():
        return {}
    data = json.loads(IMPORT_EXTRAS_PATH.read_text())
    sources: dict[str, list[str]] = {}
    for name, row in data.get("generated_landmarks", {}).items():
        if len(row) >= 3:
            sources[name] = [camera for camera in row[2] if camera in md.cameras]
    return sources


def load_import_extras() -> dict[str, Any]:
    if not IMPORT_EXTRAS_PATH.exists():
        return {"added_landmarks": {}, "generated_landmarks": {}}
    return json.loads(IMPORT_EXTRAS_PATH.read_text())


def write_optimizer_result_snapshot(report: dict[str, Any], result_path: Path) -> None:
    result_path = result_path.resolve()
    try:
        source_result = str(result_path.relative_to(ROOT))
    except ValueError:
        source_result = str(result_path)
    global_report = report["global"]
    final_cameras = {
        row["name"]: row["final"]
        for row in global_report.get("cameras", [])
    }
    final_landmarks = {
        row["name"]: row["final"]
        for row in global_report.get("landmarks", [])
    }
    import_extras = load_import_extras()

    cameras = {}
    for camera_name, camera in md.cameras.items():
        if camera_name in final_cameras:
            values = [float(value) for value in final_cameras[camera_name]]
            xyz = values[:3]
            ypr = values[3:6]
            hfov = values[6]
            vfov = float(get_vfov(hfov, camera["size"]))
        else:
            cam = get_camera(camera_name)
            xyz = [float(value) for value in cam.xyz] if cam.xyz is not None else None
            ypr = [float(value) for value in cam.ypr]
            hfov = float(cam.hfov)
            vfov = float(cam.vfov)
        cameras[camera_name] = {
            "id": str(camera["id"]),
            "player": [float(value) for value in camera["player"]] if camera.get("player") else None,
            "xyz": xyz,
            "ypr": ypr,
            "fov": [hfov, vfov],
            "size": [int(camera["size"][0]), int(camera["size"][1])],
            "source": str(camera.get("source", "")),
        }

    landmarks = {
        landmark_name: [float(value) for value in xyz]
        for landmark_name, xyz in md.landmarks.items()
    }
    landmark_sources = {
        landmark_name: "gtamaplib"
        for landmark_name in landmarks
    }
    for section in ("added_landmarks", "generated_landmarks"):
        for landmark_name, row in import_extras.get(section, {}).items():
            landmarks[landmark_name] = [float(value) for value in row[0]]
            landmark_sources[landmark_name] = f"import_extras.{section}"
    for landmark_name, xyz in final_landmarks.items():
        landmarks[landmark_name] = [float(value) for value in xyz]
        landmark_sources[landmark_name] = "optimizer"

    maps = {}
    for map_name, map_info in md.maps.items():
        maps[map_name] = {
            "version": int(map_info["version"]),
            "scale": float(map_info["scale"]),
            "zero": [float(map_info["zero"][0]), float(map_info["zero"][1])],
            "filename": str(map_info["filename"]),
        }

    data = {
        "schema": "gtamaplibvc-world-v1",
        "source_result": source_result,
        "camera_name": report["camera_name"],
        "prior_batch_id": report["prior_batch_id"],
        "counts": {
            "cameras": len(cameras),
            "landmarks": len(landmarks),
        },
        "maps": maps,
        "cameras": cameras,
        "landmarks": landmarks,
        "landmark_sources": landmark_sources,
    }
    ACTIVE_OPTIMIZER_RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ACTIVE_OPTIMIZER_RESULT_PATH.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n")
    print(f"Wrote {ACTIVE_OPTIMIZER_RESULT_PATH}")


def world_snapshot_render_rows(path: Path) -> list[list[Any]]:
    data = json.loads(path.read_text())
    rows: list[list[Any]] = []
    for camera_name, camera in data.get("cameras", {}).items():
        if camera.get("xyz") is None:
            continue
        rows.append(
            [
                "camera",
                camera_name,
                camera.get("player"),
                [float(value) for value in camera["xyz"]],
                [float(value) for value in camera["ypr"]],
                [float(value) for value in camera["fov"]],
                [int(value) for value in camera["size"]],
                None,
                None,
                None,
            ]
        )
    for landmark_name, xyz in data.get("landmarks", {}).items():
        rows.append(
            [
                "landmark",
                landmark_name,
                [float(value) for value in xyz],
                None,
            ]
        )
    return rows


def world_snapshot_cameras(path: Path) -> dict[str, dict[str, Any]]:
    data = json.loads(path.read_text())
    cameras: dict[str, dict[str, Any]] = {}
    for camera_name, camera in data.get("cameras", {}).items():
        cameras[camera_name] = {
            "id": camera.get("id", camera_name),
            "player": tuple(float(value) for value in camera["player"]) if camera.get("player") else None,
            "xyz": tuple(float(value) for value in camera["xyz"]) if camera.get("xyz") is not None else None,
            "ypr": tuple(float(value) for value in camera["ypr"]),
            "fov": tuple(float(value) for value in camera["fov"]),
            "size": tuple(int(value) for value in camera["size"]),
            "source": camera.get("source", ""),
        }
    return cameras


def refresh_ui_overlay_from_world_snapshot(path: Path | None = None) -> None:
    from utils.import_data import write_ui_overlay_data

    path = path or ACTIVE_OPTIMIZER_RESULT_PATH
    original_cameras = md.cameras
    md.cameras = world_snapshot_cameras(path)
    get_camera.cache_clear()
    try:
        write_ui_overlay_data(md, get_camera, get_point)
    finally:
        md.cameras = original_cameras
        get_camera.cache_clear()


def render_source_cameras_for_landmark(landmark_name: str, generated_sources: dict[str, list[str]]) -> list[str]:
    sources = list(generated_sources.get(landmark_name, []))
    sources.extend(MANUAL_RENDER_LANDMARK_SOURCES.get(landmark_name, []))
    for prefix, prefix_sources in MANUAL_RENDER_LANDMARK_PREFIX_SOURCES.items():
        if landmark_name.startswith(prefix):
            sources.extend(prefix_sources)
    return [camera_name for camera_name in dict.fromkeys(sources) if camera_name in md.cameras]


def render_camera_names_for_step(solves: list[dict[str, Any]], report: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    generated_sources = vc_generated_landmark_sources()
    for solve in solves:
        camera_name = solve["camera_name"]
        if camera_name in md.cameras:
            names.add(camera_name)
        for source_camera_name, _target_name in solve["rays"]:
            if source_camera_name in md.cameras:
                names.add(source_camera_name)
        for landmark_name in solve["landmarks"]:
            for source_camera_name in render_source_cameras_for_landmark(landmark_name, generated_sources):
                names.add(source_camera_name)
    for row in report["global"].get("triangulations", []):
        for key in ("source_camera", "target_camera"):
            camera_name = row.get(key)
            if camera_name in md.cameras:
                names.add(camera_name)
    return names


def load_chain(path: Path | None = None) -> list[str]:
    path = path or ACTIVE_CHAIN_PATH
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON list of camera names")
    for index, stage in enumerate(data, start=1):
        if isinstance(stage, str):
            continue
        if isinstance(stage, dict) and "camera" in stage:
            data[index - 1] = stage["camera"]
            continue
        raise ValueError(f"Optimizer stage {index} must be a camera name")
    return data


def load_optimizer_config(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    return {
        "initial": dict(data.get("initial", {})),
        "landmarks": list(data.get("landmarks", [])),
        "rays": [list(row) for row in data.get("rays", [])],
        "horizontal_objects": [
            normalize_object_row(list(row))
            for row in data.get("objects", data.get("horizontal_objects", []))
        ],
    }


def config_path_for_camera(camera_name: str) -> Path:
    return ACTIVE_CONFIGS_DIR / f"{camera_name}.json"


def result_path_for_stage(stage_index: int, camera_name: str) -> Path:
    return ACTIVE_RESULTS_DIR / f"{stage_index + 1:02d} {camera_name}.json"


def latest_chain_result(chain: list[str]) -> tuple[int, dict[str, Any]] | None:
    latest: tuple[int, dict[str, Any]] | None = None
    for stage_index, camera_name in enumerate(chain):
        path = result_path_for_stage(stage_index, camera_name)
        if not path.exists():
            continue
        latest = (stage_index, json.loads(path.read_text()))
    return latest


def write_optimizer_stage_result(report: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=4, ensure_ascii=False) + "\n")
    print()
    print(f"Wrote {output}")
    write_optimizer_result_snapshot(report, output)


def solve_from_chain_stage(camera_name: str) -> dict[str, Any]:
    config_path = config_path_for_camera(camera_name)
    config = load_optimizer_config(config_path)
    camera = get_camera(camera_name)
    init = config.get("initial", {})
    xyz = init.get("xyz", camera.xyz)
    ypr = init.get("ypr", camera.ypr)
    hfov = init.get("hfov", camera.hfov)
    size = init.get("size", camera.size)
    return {
        "schema": "gtamaplibvc-optimizer-stage-v1",
        "id": camera_name,
        "camera_name": camera_name,
        "xyz": np.asarray(xyz, dtype=float),
        "ypr": np.asarray(ypr, dtype=float),
        "hfov": float(hfov),
        "size": tuple(int(value) for value in size),
        "landmarks": config["landmarks"],
        "rays": config["rays"],
        "horizontal_objects": config["horizontal_objects"],
    }


def stage_index_for_id(chain: list[str], stage_id: str) -> int:
    if stage_id.isdigit():
        stage_index = int(stage_id) - 1
        if 0 <= stage_index < len(chain):
            return stage_index
    for index, camera_name in enumerate(chain):
        if camera_name == stage_id:
            return index
    raise KeyError(f"No optimizer stage named {stage_id!r}")


def load_optimizer_priors(stage_index: int, chain: list[str]) -> dict[str, Any]:
    data = json.loads(PRIORS_PATH.read_text())
    batch_id, rows = data["batches"][0]
    for previous_index in range(stage_index):
        previous_camera = chain[previous_index]
        result_path = result_path_for_stage(previous_index, previous_camera)
        if not result_path.exists():
            raise FileNotFoundError(
                f"Missing accepted result for previous stage {previous_camera!r}: {result_path}"
            )
        result = json.loads(result_path.read_text())
        batch_id, rows = result["global"]["next_prior_batch"]
    return prior_rows_to_dict(rows, batch_id)


def load_chain_solves(chain: list[str], through_index: int) -> list[dict[str, Any]]:
    return [solve_from_chain_stage(stage) for stage in chain[: through_index + 1]]


def future_chain_cameras(chain: list[str], stage_index: int) -> set[str]:
    return set(chain[stage_index + 1 :])


def configured_future_camera_references(
    solve: dict[str, Any],
    future_cameras: set[str],
) -> list[tuple[str, str]]:
    return [
        (source_camera_name, target_name)
        for source_camera_name, target_name in solve["rays"]
        if source_camera_name in future_cameras
    ]


def future_prior_cameras(priors: dict[str, Any], future_cameras: set[str]) -> list[str]:
    return sorted(set(priors["cameras"]) & future_cameras)


def landmark_source_cameras_for_stage(chain: list[str], stage_index: int) -> dict[str, list[str]]:
    sources: dict[str, list[str]] = {}
    for previous_index in range(stage_index):
        camera_name = chain[previous_index]
        result_path = result_path_for_stage(previous_index, camera_name)
        if not result_path.exists():
            continue
        result = json.loads(result_path.read_text())
        for row in result.get("global", {}).get("triangulations", []):
            cameras = [row.get("source_camera"), row.get("target_camera")]
            known = [camera for camera in cameras if camera]
            if not known:
                continue
            landmark_sources = sources.setdefault(row["name"], [])
            for camera in known:
                if camera not in landmark_sources:
                    landmark_sources.append(camera)
    return sources


def stage_available_landmarks(
    solve: dict[str, Any],
    priors: dict[str, Any],
    landmark_sources: dict[str, list[str]] | None = None,
    blocked_cameras: set[str] | None = None,
) -> list[str]:
    camera = get_camera(solve["camera_name"])
    landmark_sources = landmark_sources or {}
    blocked_cameras = blocked_cameras or set()
    names = []
    for landmark_name in sorted(camera.landmark_pixels):
        if any(source in blocked_cameras for source in landmark_sources.get(landmark_name, [])):
            continue
        if landmark_name in priors["landmarks"] or camera_location_landmark_prior(landmark_name) is not None:
            names.append(landmark_name)
    return names


def config_landmark_note(name: str) -> str:
    if name not in md.landmarks and name in md.cameras:
        return " [camera]"
    return ""


def landmark_via_note(name: str, sources: dict[str, list[str]]) -> str:
    if name not in sources:
        return ""
    return f" [via {', '.join(sources[name])}]"


def stage_available_rays(
    solve: dict[str, Any],
    priors: dict[str, Any],
    blocked_cameras: set[str] | None = None,
) -> list[tuple[str, str, float]]:
    camera = get_camera(solve["camera_name"])
    blocked_cameras = blocked_cameras or set()
    min_baseline_degrees = min_triangulation_baseline_degrees()
    target_ypr = tuple(float(value) for value in solve["ypr"])
    target_fov = camera_fov_from_params(
        np.asarray([0, 0, 0, 0, target_ypr[1], target_ypr[2], solve["hfov"]], dtype=float),
        solve["size"],
    )
    rows = []
    for landmark_name, pixel in sorted(camera.landmark_pixels.items()):
        for source_camera_name, source_prior in sorted(priors["cameras"].items()):
            if source_camera_name in blocked_cameras:
                continue
            if source_camera_name == solve["camera_name"]:
                continue
            if source_camera_name not in md.cameras:
                continue
            source_camera = get_camera(source_camera_name)
            if landmark_name not in source_camera.landmark_pixels:
                continue
            target_direction = camera_direction_from_pixel(
                tuple(float(value) for value in pixel),
                target_ypr,
                target_fov,
                solve["size"],
            )
            source_direction = camera_direction_from_pixel(
                tuple(float(value) for value in source_camera.landmark_pixels[landmark_name]),
                source_prior["ypr"],
                source_prior["fov"],
                source_prior["size"],
            )
            baseline = ray_baseline_degrees(target_direction, source_direction)
            if (
                baseline < min_baseline_degrees
                and not is_leonida_keys_pin_triangulation(
                    landmark_name,
                    [solve["camera_name"], source_camera_name],
                )
            ):
                continue
            rows.append((source_camera_name, landmark_name, baseline))
    return rows


def configured_ray_baseline(
    solve: dict[str, Any],
    priors: dict[str, Any],
    source_camera_name: str,
    landmark_name: str,
    blocked_cameras: set[str] | None = None,
) -> float | None:
    if source_camera_name in (blocked_cameras or set()):
        return None
    if source_camera_name not in priors["cameras"]:
        return None
    if source_camera_name not in md.cameras:
        ensure_top_down_fake_camera(source_camera_name, landmark_name, priors)
    if source_camera_name not in md.cameras:
        return None
    camera = get_camera(solve["camera_name"])
    source_camera = get_camera(source_camera_name)
    if landmark_name not in camera.landmark_pixels or landmark_name not in source_camera.landmark_pixels:
        return None
    target_ypr = tuple(float(value) for value in solve["ypr"])
    target_fov = camera_fov_from_params(
        np.asarray([0, 0, 0, 0, target_ypr[1], target_ypr[2], solve["hfov"]], dtype=float),
        solve["size"],
    )
    source_prior = priors["cameras"][source_camera_name]
    target_direction = camera_direction_from_pixel(
        tuple(float(value) for value in camera.landmark_pixels[landmark_name]),
        target_ypr,
        target_fov,
        solve["size"],
    )
    source_direction = camera_direction_from_pixel(
        tuple(float(value) for value in source_camera.landmark_pixels[landmark_name]),
        source_prior["ypr"],
        source_prior["fov"],
        source_prior["size"],
    )
    return ray_baseline_degrees(target_direction, source_direction)


def print_stage_config_report(
    solve: dict[str, Any],
    priors: dict[str, Any],
    landmark_sources: dict[str, list[str]],
    blocked_cameras: set[str] | None = None,
) -> None:
    blocked_cameras = blocked_cameras or set()
    configured_landmarks = list(solve["landmarks"])
    configured_rays = [tuple(row) for row in solve["rays"]]
    available_landmarks = stage_available_landmarks(solve, priors, landmark_sources, blocked_cameras)
    available_rays = stage_available_rays(solve, priors, blocked_cameras)
    configured_landmark_set = set(configured_landmarks)
    configured_ray_set = set(configured_rays)
    unused_landmarks = [name for name in available_landmarks if name not in configured_landmark_set]
    unused_rays = [
        row
        for row in available_rays
        if row[1] not in configured_landmark_set and (row[0], row[1]) not in configured_ray_set
    ]

    print(f"Stage config: {solve['camera_name']}")
    print(f"Prior batch: {priors['batch_id']}")
    blocked_prior_cameras = future_prior_cameras(priors, blocked_cameras)
    if blocked_prior_cameras:
        print(f"Future cameras in prior batch: {', '.join(blocked_prior_cameras)}")
    print()
    print(f"Configured landmarks ({len(configured_landmarks)}):")
    for name in configured_landmarks:
        status = "ok" if name in available_landmarks else "missing"
        print(f"  [{status}] {compact_json(name)}{config_landmark_note(name)}")
    print()
    print(f"Configured rays ({len(configured_rays)}):")
    available_ray_lookup = {
        (source_camera_name, landmark_name): baseline
        for source_camera_name, landmark_name, baseline in available_rays
    }
    for source_camera_name, landmark_name in configured_rays:
        baseline = available_ray_lookup.get((source_camera_name, landmark_name))
        if baseline is None:
            baseline = configured_ray_baseline(solve, priors, source_camera_name, landmark_name, blocked_cameras)
        if baseline is None:
            print(f"  [missing] {compact_json([source_camera_name, landmark_name])}")
        elif (
            baseline < min_triangulation_baseline_degrees()
            and not is_leonida_keys_pin_triangulation(
                landmark_name,
                [solve["camera_name"], source_camera_name],
            )
        ):
            print(f"  [!! {baseline:.3f}°] {compact_json([source_camera_name, landmark_name])}")
        else:
            print(f"  [ok {baseline:.3f}°] {compact_json([source_camera_name, landmark_name])}")
    print()
    configured_objects = solve.get("horizontal_objects", [])
    print(f"Configured objects ({len(configured_objects)}):")
    for row in configured_objects:
        print(f"  {compact_json([row['point_a'], row['point_b'], row['orientation'], row['length_m'], row['z']])}")
    print()
    print(f"Available unused landmarks ({len(unused_landmarks)}):")
    for name in unused_landmarks:
        print(f"  {compact_json(name)}{config_landmark_note(name)}{landmark_via_note(name, landmark_sources)}")
    print()
    print(f"Available unused rays ({len(unused_rays)}):")
    for source_camera_name, landmark_name, baseline in unused_rays:
        print(f"  [{baseline:.3f}°] {compact_json([source_camera_name, landmark_name])}")
    print()


def print_chain_results_summary(chain: list[str]) -> None:
    latest = latest_chain_result(chain)
    if latest is None:
        print("Chain results")
        for index, camera_name in enumerate(chain, start=1):
            print(f"  {index:>2}. {'':>12} | {camera_name}")
        print()
        print("Top global observation residuals:")
        return

    latest_index, result = latest
    global_report = result["global"]
    configured_rows_by_camera: dict[str, list[dict[str, Any]]] = {}
    for row in global_report.get("observations", []):
        if row.get("configured"):
            configured_rows_by_camera.setdefault(row["camera"], []).append(row)
    print("Chain results")
    print(f"Current world: {latest_index + 1:02d} {chain[latest_index]}")
    for index, camera_name in enumerate(chain, start=1):
        path = result_path_for_stage(index - 1, camera_name)
        if not path.exists():
            print(f"  {index:>2}. {'':>12} | {camera_name}")
            continue
        rows = configured_rows_by_camera.get(camera_name)
        if rows:
            values = np.asarray([row["final_error_arcmin"] for row in rows], dtype=float)
            loss = residual_summary(values)["loss_arcmin2"]
        else:
            stage_result = json.loads(path.read_text())
            rows = current_step_global_rows(stage_result["global"])
            values = np.asarray([row["final_error_arcmin"] for row in rows], dtype=float)
            loss = residual_summary(values)["loss_arcmin2"]
        print(f"  {index:>2}. {loss:12.6f} | {camera_name}")

    print()
    print("Top global observation residuals:")
    for row in global_report.get("observations", [])[:20]:
        details = []
        if row.get("source_camera") and row["source_camera"] != row["camera"]:
            details.append(f"via {row['source_camera']}")
        if row.get("target_camera") and row["target_camera"] != row["camera"]:
            details.append(f"to {row['target_camera']}")
        suffix = f" [{' ; '.join(details)}]" if details else ""
        print(
            f"  {row['rank']:>2}. {row['final_error_arcmin']:8.3f}' | "
            f"{row['camera']} | {row['landmark']} | {row['type']}{suffix}"
        )
    total_landmarks = sum(1 for row in global_report["next_prior_batch"][1] if row[0] == "landmark")
    print()
    print(f"Total landmarks: {total_landmarks}")


def print_world_audit(limit: int = 50) -> None:
    rows: list[dict[str, Any]] = []
    missing_counts: dict[str, int] = {}
    for camera_name in sorted(md.pixels):
        if camera_name not in md.cameras:
            continue
        camera = get_camera(camera_name)
        if camera.xyz is None:
            continue
        for landmark_name, pixel in md.pixels[camera_name].items():
            if landmark_name not in md.landmarks:
                missing_counts[landmark_name] = missing_counts.get(landmark_name, 0) + 1
                continue
            landmark_xyz = np.asarray(md.landmarks[landmark_name], dtype=float)
            direction = camera_direction_from_pixel(
                tuple(float(value) for value in pixel),
                camera.ypr,
                camera.fov,
                camera.size,
            )
            expected = unit(landmark_xyz - np.asarray(camera.xyz, dtype=float))
            error = 1e6 if expected is None else angle_arcmin(direction, expected)
            rows.append(
                {
                    "camera": camera_name,
                    "landmark": landmark_name,
                    "error_arcmin": float(error),
                }
            )

    values = np.asarray([row["error_arcmin"] for row in rows], dtype=float)
    summary = residual_summary(values)
    rows.sort(key=lambda row: abs(row["error_arcmin"]), reverse=True)

    print("gtamaplib world audit")
    print(
        f"{len(rows)} known-landmark observations, "
        f"{len(missing_counts)} observed landmark name(s) without XYZ."
    )
    print(
        "Observation residuals: "
        f"mean {summary['mean_abs_arcmin']:.3f}', "
        f"median {summary['median_abs_arcmin']:.3f}', "
        f"max {summary['max_abs_arcmin']:.3f}'."
    )
    print()
    print("Top observation residuals:")
    for rank, row in enumerate(rows[:limit], 1):
        print(
            f"{rank:>4}. {row['error_arcmin']:8.3f}' | "
            f"{row['camera']} | {row['landmark']}"
        )

    if missing_counts:
        print()
        print("Most common observed names without XYZ:")
        for name, count in sorted(missing_counts.items(), key=lambda item: (-item[1], item[0]))[:20]:
            print(f"{count:>4} | {name}")


def validate_stage_order(
    solve: dict[str, Any],
    priors: dict[str, Any],
    future_cameras: set[str],
) -> None:
    future_refs = configured_future_camera_references(solve, future_cameras)
    if future_refs:
        lines = [
            f"{source_camera_name} -> {target_name}"
            for source_camera_name, target_name in future_refs
        ]
        raise ValueError(
            "Configured rays reference later chain cameras:\n  " + "\n  ".join(lines)
        )
    prior_cameras = future_prior_cameras(priors, future_cameras)
    if prior_cameras:
        raise ValueError(
            "Prior batch already contains later chain cameras: " + ", ".join(prior_cameras)
        )


def prune_generated_solve(
    solve: dict[str, Any],
    priors: dict[str, Any],
    blocked_cameras: set[str],
) -> None:
    original_landmarks = len(solve["landmarks"])
    original_rays = len(solve["rays"])
    solve["landmarks"] = [
        name
        for name in solve["landmarks"]
        if name in priors["landmarks"] or camera_location_landmark_prior(name) is not None
    ]
    rays = []
    min_baseline = min_triangulation_baseline_degrees()
    for source_camera_name, landmark_name in solve["rays"]:
        if source_camera_name in blocked_cameras:
            continue
        baseline = configured_ray_baseline(
            solve,
            priors,
            source_camera_name,
            landmark_name,
            blocked_cameras,
        )
        if baseline is None:
            continue
        if (
            baseline < min_baseline
            and not is_leonida_keys_pin_triangulation(
                landmark_name,
                [solve["camera_name"], source_camera_name],
            )
        ):
            continue
        rays.append([source_camera_name, landmark_name])
    solve["rays"] = rays
    removed_landmarks = original_landmarks - len(solve["landmarks"])
    removed_rays = original_rays - len(solve["rays"])
    if removed_landmarks or removed_rays:
        print(
            f"Pruned generated config: {removed_landmarks} landmark(s), "
            f"{removed_rays} ray(s)."
        )


def run_optimizer_stage(
    args: argparse.Namespace,
    chain: list[str],
    stage_index: int,
    *,
    render: bool,
    output_override: Path | None = None,
) -> dict[str, Any]:
    solve = solve_from_chain_stage(chain[stage_index])
    solves = load_chain_solves(chain, stage_index)
    priors = load_optimizer_priors(stage_index, chain)
    blocked_cameras = future_chain_cameras(chain, stage_index)
    add_required_synthetic_priors(priors, solve, blocked_cameras)
    validate_stage_order(solve, priors, blocked_cameras)
    if getattr(args, "generated", False):
        prune_generated_solve(solve, priors, blocked_cameras)
    report = solve_camera(
        solve,
        priors,
        max_nfev=args.max_steps_local,
        loss=args.loss,
        f_scale=args.f_scale,
        x_scale=args.x_scale,
        verbose=0,
    )
    global_report = solve_global_system(
        solve,
        priors,
        report,
        solves,
        max_nfev=args.max_steps_global or args.max_steps_local,
        loss=args.loss,
        f_scale=args.f_scale,
        x_scale=args.x_scale,
        verbose=args.verbose,
    )
    print_optimizer_camera_report(report, global_report)
    if args.local_details:
        print_report(report)
    print_global_report(global_report)
    print_new_priors(global_report)
    pipeline_report = {
        "schema": "gtamaplib-chain-find-camera-pipeline-result-v1",
        "solve_id": report["solve_id"],
        "camera_name": report["camera_name"],
        "prior_batch_id": report["prior_batch_id"],
        "local": report,
        "global": global_report,
    }

    output = output_override or result_path_for_stage(stage_index, pipeline_report["camera_name"])
    write_optimizer_stage_result(pipeline_report, output)
    if render:
        refresh_ui_overlay_from_world_snapshot()
        print()
        render_camera_names = render_camera_names_for_step(solves, pipeline_report)
        rendered = render_optimizer_result(
            pipeline_report,
            ACTIVE_RENDERS_DIR,
            DEFAULT_RENDER_MAP_NAME,
            None,
            DEFAULT_RENDER_CAMERA_SCALE,
            DEFAULT_RENDER_RAY_DISTANCE,
            render_camera_names,
        )
        print(f"Rendered {len(rendered)} image(s) to {ACTIVE_RENDERS_DIR}")
        print()
    return pipeline_report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", help="Camera name or 1-based index from optimizer/chain.json")
    parser.add_argument("--all", action="store_true", help="Run all optimizer stages and render once at the end.")
    parser.add_argument("--generated", action="store_true", help="Run all stages from optimizer/generated/ and write results/renders there.")
    parser.add_argument("--config", action="store_true", help="Print available and configured inputs for the stage.")
    parser.add_argument("--result", action="store_true", help="Print the saved result summary for the stage.")
    parser.add_argument("--results", action="store_true", help="Print the latest chain result summary.")
    parser.add_argument("--audit", action="store_true", help="Audit raw gtamaplib observation residuals without optimization.")
    parser.add_argument("--run", action="store_true", help="Run the optimizer stage. This is the default mode.")
    parser.add_argument(
        "--max-steps-local",
        type=int,
        default=2000,
        help="Maximum function evaluations for the local camera solve.",
    )
    parser.add_argument(
        "--max-steps-global",
        type=int,
        help="Maximum function evaluations for the global system solve. Defaults to --max-steps-local.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output result JSON path. Defaults to optimizer/results/NN Camera Name.json.",
    )
    parser.add_argument("--loss", default="soft_l1")
    parser.add_argument("--f-scale", type=float, default=1.0)
    parser.add_argument("--x-scale", default="jac")
    parser.add_argument("--verbose", type=int, default=2)
    parser.add_argument(
        "--local-details",
        action="store_true",
        help="Print the full local camera-solve parameter and residual tables.",
    )
    args = parser.parse_args()

    if args.generated:
        use_generated_optimizer_paths()
        args.all = True

    register_synthetic_cameras()
    if args.audit:
        if args.generated:
            parser.error("--audit cannot be combined with --generated")
        print_world_audit()
        return
    chain = load_chain()
    if args.results:
        print_chain_results_summary(chain)
        return
    if args.all:
        if args.config or args.result:
            parser.error("--all cannot be combined with --config or --result")
        if args.output:
            parser.error("--output cannot be used with --all")
        final_report = None
        for stage_index, camera_name in enumerate(chain):
            print()
            print(f"Running stage {stage_index + 1}/{len(chain)}: {camera_name}")
            final_report = run_optimizer_stage(args, chain, stage_index, render=False)
        if final_report is None:
            parser.error(f"{ACTIVE_CHAIN_PATH} is empty")
        if not args.generated:
            refresh_ui_overlay_from_world_snapshot()
        print()
        solves = load_chain_solves(chain, len(chain) - 1)
        render_camera_names = render_camera_names_for_step(solves, final_report)
        rendered = render_optimizer_result(
            final_report,
            ACTIVE_RENDERS_DIR,
            DEFAULT_RENDER_MAP_NAME,
            None,
            DEFAULT_RENDER_CAMERA_SCALE,
            DEFAULT_RENDER_RAY_DISTANCE,
            render_camera_names,
        )
        print(f"Rendered {len(rendered)} image(s) to {ACTIVE_RENDERS_DIR}")
        print()
        return
    if not args.stage:
        parser.error("--stage is required unless --all or --results is used")
    stage_index = stage_index_for_id(chain, args.stage)
    solve = solve_from_chain_stage(chain[stage_index])
    solves = load_chain_solves(chain, stage_index)
    priors = load_optimizer_priors(stage_index, chain)
    blocked_cameras = future_chain_cameras(chain, stage_index)
    add_required_synthetic_priors(priors, solve, blocked_cameras)
    if args.config:
        print_stage_config_report(
            solve,
            priors,
            landmark_source_cameras_for_stage(chain, stage_index),
            blocked_cameras,
        )
        return
    if args.result:
        output = args.output or result_path_for_stage(stage_index, solve["camera_name"])
        result = json.loads(output.read_text())
        print_optimizer_camera_report(result["local"], result["global"], local_pass=False)
        return
    run_optimizer_stage(args, chain, stage_index, render=True, output_override=args.output)


if __name__ == "__main__":
    main()
