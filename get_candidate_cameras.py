#!/usr/bin/env python3
"""List non-rigid cameras with available calibration constraints."""

from __future__ import annotations

import json
from typing import Any

from import_data import (
    IMPORT_EXTRAS_JSON_PATH,
    add_import_path,
    is_ignored_triangulation_landmark,
    load_config,
    load_special,
    max_ray_pair_angle_degrees,
    rigid_camera_names,
)


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
        if max_ray_pair_angle_degrees(rays) < min_triangulation_delta_degrees:
            continue
        names.add(landmark_name)
    return names


def count_candidate_constraints(
    cam: Any,
    prior_landmarks: set[str],
    rigid_rays_by_landmark: dict[str, list[tuple[str, Any]]],
    min_triangulation_delta_degrees: float,
) -> tuple[int, int, list[str], list[str]]:
    landmark_names: list[str] = []
    ray_names: list[str] = []

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
        rigid_rays = [ray for _camera_name, ray in rigid_rays_by_landmark[landmark_name]]
        if not rigid_rays:
            continue
        if max_ray_pair_angle_degrees([candidate_ray, *rigid_rays]) < min_triangulation_delta_degrees:
            continue
        ray_names.append(landmark_name)

    return len(landmark_names), len(ray_names), landmark_names, ray_names


def main() -> None:
    add_import_path()
    from gtamaplib import gtamapdata as md
    from gtamaplib.gtamaplib import get_camera

    special = load_special(md)
    config = load_config()
    min_delta = float(config.get("min_triangulation_delta_degrees", 10.0))
    rigid_names = rigid_camera_names(special)
    rigid_rays_by_landmark = get_rigid_rays_by_landmark(rigid_names, get_camera)
    prior_landmarks = (
        get_fixed_landmark_names(special)
        | get_triangulatable_prior_landmark_names(rigid_rays_by_landmark, min_delta)
        | load_generated_landmark_names()
    )

    rows = []
    for order, camera_name in enumerate(md.cameras):
        if camera_name in rigid_names:
            continue
        try:
            cam = get_camera(camera_name)
        except Exception:
            continue
        landmark_count, ray_count, landmark_names, ray_names = count_candidate_constraints(
            cam,
            prior_landmarks,
            rigid_rays_by_landmark,
            min_delta,
        )
        if landmark_count == 0 and ray_count == 0:
            continue
        rows.append(
            {
                "order": order,
                "id": str(cam.id),
                "name": camera_name,
                "landmarks": landmark_count,
                "rays": ray_count,
                "total": landmark_count + ray_count,
                "landmark_names": landmark_names,
                "ray_names": ray_names,
            }
        )

    rows.sort(key=lambda row: (-row["total"], -row["landmarks"], -row["rays"], row["order"]))

    print(f"Candidate cameras using min_triangulation_delta_degrees={min_delta:g}")
    print(f"Prior landmarks available to candidates: {len(prior_landmarks)}")
    print(f"{'rank':>4}  {'lm':>3}  {'ray':>3}  {'all':>3}  {'id':<8}  camera")
    for rank, row in enumerate(rows, 1):
        print(
            f"{rank:>4}  {row['landmarks']:>3}  {row['rays']:>3}  {row['total']:>3}  "
            f"{row['id']:<8}  {row['name']}"
        )


if __name__ == "__main__":
    main()
