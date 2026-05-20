#!/usr/bin/env python3
"""Propose a greedy optimizer chain from available calibration constraints."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np

from utils.import_data import (
    IMPORT_EXTRAS_JSON_PATH,
    add_import_path,
    is_leonida_keys_pin_triangulation,
    is_ignored_triangulation_landmark,
    load_config,
    load_special,
    max_ray_pair_angle_degrees,
    rigid_camera_names,
)

DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEGREES = 1.0
MIN_CANDIDATE_SCORE = 5
ROOT = Path(__file__).resolve().parent
GENERATED_DIR = ROOT / "optimizer" / "generated"
GENERATED_CHAIN_PATH = GENERATED_DIR / "chain.json"
GENERATED_CONFIGS_DIR = GENERATED_DIR / "configs"


def load_generated_landmark_names() -> set[str]:
    if not IMPORT_EXTRAS_JSON_PATH.exists():
        return set()
    data = json.loads(IMPORT_EXTRAS_JSON_PATH.read_text())
    return set(data.get("generated_landmarks", {}))


def get_rigid_rays_by_landmark(rigid_names: set[str], get_camera: Any) -> dict[str, list[tuple[str, Any]]]:
    by_landmark: dict[str, list[tuple[str, Any]]] = {}
    for camera_name in sorted(rigid_names):
        try:
            cam = get_camera(camera_name)
        except Exception:
            continue
        if cam.xyz is None:
            continue
        for landmark_name in cam.landmark_pixels:
            if is_ignored_triangulation_landmark(landmark_name):
                continue
            try:
                ray = (cam.xyz, cam.get_landmark_direction(landmark_name))
            except Exception:
                continue
            by_landmark.setdefault(landmark_name, []).append((camera_name, ray))
    return by_landmark


def get_fixed_landmark_names(special: dict[str, Any]) -> set[str]:
    return set(special.get("landmarks_fixed", []))


def get_triangulatable_prior_landmark_names(
    rigid_rays_by_landmark: dict[str, list[tuple[str, Any]]],
    min_triangulation_delta_degrees: float,
) -> set[str]:
    names: set[str] = set()
    for landmark_name, named_rays in rigid_rays_by_landmark.items():
        if len(named_rays) < 2:
            continue
        rays = [ray for _camera_name, ray in named_rays]
        camera_names = [camera_name for camera_name, _ray in named_rays]
        if (
            max_ray_pair_angle_degrees(rays) < min_triangulation_delta_degrees
            and not is_leonida_keys_pin_triangulation(landmark_name, camera_names)
        ):
            continue
        names.add(landmark_name)
    return names


def fixed_elevation_lookup(special: dict[str, Any]) -> dict[str, float]:
    lookup: dict[str, float] = {}
    for group in special.get("landmarks_fixed_elevation", []):
        z = float(group["z"])
        for name in group.get("landmarks", []):
            lookup[name] = z
    return lookup


def fixed_elevation_intersection_angle_degrees(direction: Any) -> float:
    values = np.asarray(direction, dtype=float)
    norm = float(np.linalg.norm(values))
    if not np.isfinite(norm) or norm <= 0:
        return 0.0
    return float(np.degrees(np.arcsin(np.clip(abs(float(values[2])) / norm, 0.0, 1.0))))


def count_candidate_constraints(
    cam: Any,
    prior_landmarks: set[str],
    rigid_rays_by_landmark: dict[str, list[tuple[str, Any]]],
    min_triangulation_delta_degrees: float,
) -> tuple[int, int, list[str], list[list[str]]]:
    landmark_names: list[str] = []
    ray_pairs: list[list[str]] = []

    for landmark_name in cam.landmark_pixels:
        if is_ignored_triangulation_landmark(landmark_name):
            continue
        if landmark_name in prior_landmarks:
            landmark_names.append(landmark_name)
            continue
        if landmark_name not in rigid_rays_by_landmark:
            continue
        try:
            candidate_ray = (cam.xyz, cam.get_landmark_direction(landmark_name))
        except Exception:
            continue
        source_rows = rigid_rays_by_landmark[landmark_name]
        if (
            max_ray_pair_angle_degrees([candidate_ray, *[ray for _camera_name, ray in source_rows]]) < min_triangulation_delta_degrees
            and not is_leonida_keys_pin_triangulation(
                landmark_name,
                [cam.name, *[camera_name for camera_name, _ray in source_rows]],
            )
        ):
            continue
        for source_camera_name, source_ray in source_rows:
            if (
                max_ray_pair_angle_degrees([candidate_ray, source_ray]) >= min_triangulation_delta_degrees
                or is_leonida_keys_pin_triangulation(landmark_name, [cam.name, source_camera_name])
            ):
                ray_pairs.append([source_camera_name, landmark_name])

    return len(landmark_names), len(ray_pairs), landmark_names, ray_pairs


def initial_prior_landmarks(
    special: dict[str, Any],
    rigid_rays_by_landmark: dict[str, list[tuple[str, Any]]],
    min_delta: float,
) -> set[str]:
    return (
        get_fixed_landmark_names(special)
        | get_triangulatable_prior_landmark_names(rigid_rays_by_landmark, min_delta)
        | load_generated_landmark_names()
    )


def add_camera_rays(rays_by_landmark: dict[str, list[tuple[str, Any]]], cam: Any) -> None:
    if cam.xyz is None:
        return
    for landmark_name in cam.landmark_pixels:
        if is_ignored_triangulation_landmark(landmark_name):
            continue
        try:
            ray = (cam.xyz, cam.get_landmark_direction(landmark_name))
        except Exception:
            continue
        named_rays = rays_by_landmark.setdefault(landmark_name, [])
        if not any(camera_name == cam.name for camera_name, _ray in named_rays):
            named_rays.append((cam.name, ray))


def update_priors_after_camera(
    cam: Any,
    prior_landmarks: set[str],
    rays_by_landmark: dict[str, list[tuple[str, Any]]],
    fixed_elevations: dict[str, float],
    min_delta: float,
    min_plane_angle: float,
) -> set[str]:
    before = set(prior_landmarks)
    add_camera_rays(rays_by_landmark, cam)
    prior_landmarks.update(get_triangulatable_prior_landmark_names(rays_by_landmark, min_delta))
    for landmark_name in cam.landmark_pixels:
        if landmark_name not in fixed_elevations:
            continue
        if is_ignored_triangulation_landmark(landmark_name):
            continue
        try:
            direction = cam.get_landmark_direction(landmark_name)
        except Exception:
            continue
        if fixed_elevation_intersection_angle_degrees(direction) >= min_plane_angle:
            prior_landmarks.add(landmark_name)
    return prior_landmarks - before


def candidate_rows(md: Any, get_camera: Any, rigid_names: set[str], selected_names: set[str], prior_landmarks: set[str], rays_by_landmark: dict[str, list[tuple[str, Any]]], min_delta: float) -> list[dict[str, Any]]:
    rows = []
    for order, camera_name in enumerate(md.cameras):
        if camera_name in rigid_names or camera_name in selected_names:
            continue
        try:
            cam = get_camera(camera_name)
        except Exception:
            continue
        landmark_count, ray_count, landmark_names, ray_pairs = count_candidate_constraints(
            cam,
            prior_landmarks,
            rays_by_landmark,
            min_delta,
        )
        if landmark_count == 0 and ray_count == 0:
            continue
        score = landmark_count * 2 + ray_count
        if score < MIN_CANDIDATE_SCORE:
            continue
        rows.append(
            {
                "order": order,
                "id": str(cam.id),
                "name": camera_name,
                "landmarks": landmark_count,
                "rays": ray_count,
                "score": score,
                "landmark_names": landmark_names,
                "ray_pairs": ray_pairs,
            }
        )
    rows.sort(key=lambda row: (-row["score"], -row["landmarks"], -row["rays"], row["order"]))
    return rows


def format_string_array(values: list[str], indent: int) -> list[str]:
    pad = " " * indent
    return [f'{pad}"{value}"' for value in values]


def format_array_rows(rows: list[list[Any]], indent: int) -> list[str]:
    pad = " " * indent
    lines = []
    for row in rows:
        values = []
        for value in row:
            if isinstance(value, str):
                values.append(json.dumps(value, ensure_ascii=False))
            else:
                values.append(json.dumps(value, ensure_ascii=False))
        lines.append(f"{pad}[{', '.join(values)}]")
    return lines


def write_optimizer_config(path: Path, row: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "{",
        '    "schema": "gtamaplibvc-optimizer-config-v1",',
        '    "landmarks": [',
    ]
    landmarks = format_string_array(row["landmark_names"], 8)
    lines.extend(f"{line}{',' if index < len(landmarks) - 1 else ''}" for index, line in enumerate(landmarks))
    lines.extend([
        "    ],",
        '    "rays": [',
    ])
    rays = format_array_rows(row["ray_pairs"], 8)
    lines.extend(f"{line}{',' if index < len(rays) - 1 else ''}" for index, line in enumerate(rays))
    lines.extend([
        "    ],",
        '    "objects": []',
        "}",
    ])
    path.write_text("\n".join(lines) + "\n")


def write_generated_files(chain: list[str], configs: list[dict[str, Any]]) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_CONFIGS_DIR.mkdir(parents=True, exist_ok=True)
    for path in GENERATED_CONFIGS_DIR.glob("*.json"):
        path.unlink()
    GENERATED_CHAIN_PATH.write_text(json.dumps(chain, indent=4, ensure_ascii=False) + "\n")
    for row in configs:
        write_optimizer_config(GENERATED_CONFIGS_DIR / f"{row['name']}.json", row)
    print()
    print(f"Wrote {GENERATED_CHAIN_PATH}")
    print(f"Wrote {len(configs)} config(s) to {GENERATED_CONFIGS_DIR}")


def print_candidate_table(rows: list[dict[str, Any]], min_delta: float, prior_landmarks: set[str]) -> None:

    print(f"Candidate cameras using min_triangulation_delta_degrees={min_delta:g}, min_score={MIN_CANDIDATE_SCORE}")
    print(f"Prior landmarks available to candidates: {len(prior_landmarks)}")
    print(f"{'rank':>4}  {'lm':>3}  {'ray':>3}  {'score':>5}  camera")
    for rank, row in enumerate(rows, 1):
        print(
            f"{rank:>4}  {row['landmarks']:>3}  {row['rays']:>3}  {row['score']:>5}  "
            f"[{row['id']}] {row['name']}"
        )


def print_greedy_chain(
    md: Any,
    get_camera: Any,
    rigid_names: set[str],
    prior_landmarks: set[str],
    rays_by_landmark: dict[str, list[tuple[str, Any]]],
    fixed_elevations: dict[str, float],
    min_delta: float,
    min_plane_angle: float,
    limit: int | None,
    write_files: bool,
) -> None:
    selected_names: set[str] = set()
    chain: list[str] = []
    configs: list[dict[str, Any]] = []
    print(f"Greedy candidate chain using min_triangulation_delta_degrees={min_delta:g}, min_score={MIN_CANDIDATE_SCORE}")
    print(f"Initial prior landmarks: {len(prior_landmarks)}")
    print(f"{'stage':>5}  {'lm':>3}  {'ray':>3}  {'score':>5}  {'new':>4}  camera")
    stage = 1
    while limit is None or stage <= limit:
        rows = candidate_rows(md, get_camera, rigid_names, selected_names, prior_landmarks, rays_by_landmark, min_delta)
        if not rows:
            break
        row = rows[0]
        cam = get_camera(row["name"])
        chain.append(row["name"])
        configs.append(row)
        new_landmarks = update_priors_after_camera(
            cam,
            prior_landmarks,
            rays_by_landmark,
            fixed_elevations,
            min_delta,
            min_plane_angle,
        )
        selected_names.add(row["name"])
        print(
            f"{stage:>5}  {row['landmarks']:>3}  {row['rays']:>3}  {row['score']:>5}  "
            f"{len(new_landmarks):>4}  [{row['id']}] {row['name']}"
        )
        stage += 1
    if write_files:
        write_generated_files(chain, configs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--single", action="store_true", help="Print the one-shot candidate ranking only.")
    parser.add_argument("--limit", type=int, help="Maximum number of greedy stages to print.")
    parser.add_argument("--no-write", action="store_true", help="Do not write optimizer/generated chain/config files.")
    args = parser.parse_args()

    add_import_path()
    from gtamaplib import gtamapdata as md
    from gtamaplib.gtamaplib import get_camera

    special = load_special(md)
    config = load_config()
    min_delta = float(config.get("min_triangulation_delta_degrees", 10.0))
    min_plane_angle = float(
        config.get(
            "min_fixed_elevation_intersection_angle_degrees",
            DEFAULT_MIN_FIXED_ELEVATION_INTERSECTION_ANGLE_DEGREES,
        )
    )
    rigid_names = rigid_camera_names(special)
    rays_by_landmark = get_rigid_rays_by_landmark(rigid_names, get_camera)
    prior_landmarks = initial_prior_landmarks(special, rays_by_landmark, min_delta)
    fixed_elevations = fixed_elevation_lookup(special)

    if args.single:
        rows = candidate_rows(md, get_camera, rigid_names, set(), prior_landmarks, rays_by_landmark, min_delta)
        print_candidate_table(rows, min_delta, prior_landmarks)
    else:
        print_greedy_chain(
            md,
            get_camera,
            rigid_names,
            prior_landmarks,
            rays_by_landmark,
            fixed_elevations,
            min_delta,
            min_plane_angle,
            args.limit,
            not args.no_write,
        )


if __name__ == "__main__":
    main()
