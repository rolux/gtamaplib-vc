"""Construct derived landmark geometry from the current world state."""

from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import numpy as np


def _point(value: Any) -> tuple[float, float, float]:
    return tuple(float(coord) for coord in value)


def _json_point(value: Any) -> list[float]:
    return [float(coord) for coord in value]


def _segment(a: Any, b: Any, style: str = "thin") -> dict[str, Any]:
    return {"points": [_json_point(a), _json_point(b)], "style": style}


def _camera_for_gtamapdata(camera: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": camera.get("id", ""),
        "player": camera.get("player"),
        "xyz": tuple(float(value) for value in camera["xyz"]) if camera.get("xyz") is not None else None,
        "ypr": tuple(float(value) for value in camera["ypr"]),
        "fov": tuple(float(value) if value is not None else None for value in camera["fov"]),
        "size": tuple(int(value) for value in camera["size"]),
        "source": camera.get("source", ""),
    }


@contextmanager
def _installed_world(cameras: dict[str, Any], landmarks: dict[str, Any]) -> Iterator[None]:
    from gtamaplib import gtamapdata as md
    from gtamaplib.gtamaplib import get_camera

    original_cameras = md.cameras
    original_landmarks = md.landmarks
    md.cameras = {name: _camera_for_gtamapdata(camera) for name, camera in cameras.items()}
    md.landmarks = {name: _point(xyz) for name, xyz in landmarks.items() if xyz is not None}
    get_camera.cache_clear()
    try:
        yield
    finally:
        md.cameras = original_cameras
        md.landmarks = original_landmarks
        get_camera.cache_clear()


def construct_wdna_fm(cameras: dict[str, Any], landmarks: dict[str, Any]) -> dict[str, list[float]]:
    required_landmarks = {"WDNA FM"}
    required_cameras = {"Prison"}
    if not required_landmarks <= set(landmarks) or not required_cameras <= set(cameras):
        return {}

    from gtamaplib.gtamaplib import (
        get_camera,
        get_direction,
        get_distance,
        get_midpoint,
        get_point,
        intersect_ray_and_plane,
        intersect_ray_and_ray,
    )

    with _installed_world(cameras, landmarks):
        cam = get_camera("Prison")
        top = np.asarray(landmarks["WDNA FM"], dtype=float)
        rays = {
            name: (cam.xyz, cam.get_landmark_direction(f"WDNA FM ({name})"))
            for name in ("SE1", "N2", "SW2", "SE2", "SE3")
        }

        z = float(top[2]) - 50
        point_n2 = point_sw2 = point_se2 = None
        for step in (1, -0.1, 0.01, -0.001):
            loss = float("inf")
            while True:
                plane = ((0, 0, z), (0, 0, 1))
                candidate_n2 = intersect_ray_and_plane(rays["N2"], plane)
                candidate_sw2 = intersect_ray_and_plane(rays["SW2"], plane)
                candidate_se2 = intersect_ray_and_plane(rays["SE2"], plane)
                midpoint = get_midpoint((candidate_n2, candidate_sw2, candidate_se2))
                distance = get_distance(midpoint, (top[0], top[1], z))
                if distance < loss:
                    loss = distance
                    point_n2, point_sw2, point_se2 = candidate_n2, candidate_sw2, candidate_se2
                else:
                    break
                z += step

        if point_n2 is None or point_sw2 is None or point_se2 is None:
            return {}

        vertical_se_ray = (point_se2, (0, 0, 1))
        z0 = 5.0
        z1 = float(intersect_ray_and_ray(vertical_se_ray, rays["SE1"])[1][2])
        z3 = float(intersect_ray_and_ray(vertical_se_ray, rays["SE3"])[1][2])
        z4 = (z3 + float(top[2])) / 2

        side_length = 5.0
        radius = side_length / np.sqrt(3)

        def resize(point: Any) -> np.ndarray:
            center = np.asarray((top[0], top[1], point[2]), dtype=float)
            return get_point(center, get_direction(center, point), radius)

        point_n2 = resize(point_n2)
        point_se2 = resize(point_se2)
        point_sw2 = resize(point_sw2)

        levels = {
            "0": z0,
            "1": z1,
            "2": float(point_n2[2]),
            "3": z3,
            "4": z4,
        }
        corners = {
            "N": point_n2,
            "SE": point_se2,
            "SW": point_sw2,
        }
        result: dict[str, list[float]] = {}
        for level, level_z in levels.items():
            for corner, point in corners.items():
                result[f"WDNA FM ({corner}{level})"] = [
                    float(point[0]),
                    float(point[1]),
                    float(level_z),
                ]
        return result


def construct_sunshine_skyway_wireframe(landmarks: dict[str, Any]) -> dict[str, Any] | None:
    names = {
        "nt": "Sunshine Skyway Bridge (N)",
        "st": "Sunshine Skyway Bridge (S)",
        "nr": "Sunshine Skyway Bridge (NR)",
        "sr": "Sunshine Skyway Bridge (SR)",
        "nnr": "Sunshine Skyway Bridge (NNR)",
        "ssr": "Sunshine Skyway Bridge (SSR)",
    }
    if any(name not in landmarks for name in names.values()):
        return None

    from gtamaplib.gtamaplib import SunshineSkywayBridge

    bridge = SunshineSkywayBridge(**{
        key: _point(landmarks[name])
        for key, name in names.items()
    })
    segments: list[dict[str, Any]] = [
        _segment(bridge.nt, (bridge.nt[0], bridge.nt[1], 0), "bold"),
        _segment(bridge.st, (bridge.st[0], bridge.st[1], 0), "bold"),
    ]
    for index in range(len(bridge.road) - 1):
        segments.append(_segment(bridge.road[index], bridge.road[index + 1], "bold"))
    n_cables = 10
    gap = (bridge.nt[2] - bridge.nr[2]) / n_cables
    for pillar in (bridge.nt, bridge.st):
        for direction in (bridge.direction, -bridge.direction):
            for index in range(n_cables):
                base_point = (pillar[0], pillar[1], bridge.nr[2])
                road_point = bridge._get_road_point(base_point, direction, (index + 1) * gap)
                pillar_point = (base_point[0], base_point[1], base_point[2] + (index + 1) * gap)
                segments.append(_segment(road_point, pillar_point, "thin"))
    return {"schema": "gtamaplibvc-map3d-sunshine-skyway-v1", "segments": segments}


def construct_homestead_water_tower_wireframe(cameras: dict[str, Any], landmarks: dict[str, Any]) -> dict[str, Any] | None:
    lm_name = "Homestead Water Tower"
    camera_name = "Grassrivers 02 (Watson Bay)"
    if lm_name not in landmarks or camera_name not in cameras:
        return None

    from gtamaplib.gtamaplib import (
        get_camera,
        get_distance,
        get_point,
        intersect_ray_and_plane,
    )

    with _installed_world(cameras, landmarks):
        cam = get_camera(camera_name)
        top = np.asarray(landmarks[lm_name], dtype=float)
        plane = (top, cam.get_landmark_direction(lm_name))
        points = {}
        for corner in ("L1", "L2", "L3", "R1", "R2", "R3"):
            corner_name = f"{lm_name} ({corner})"
            ray = (cam.xyz, cam.get_landmark_direction(corner_name))
            points[corner] = intersect_ray_and_plane(ray, plane)

        r1 = get_distance(points["L1"], points["R1"]) / 2
        r2 = (get_distance(points["L2"], points["R2"]) + get_distance(points["L3"], points["R3"])) / 4
        z0 = 5.0
        z1 = (points["L1"][2] + points["R1"][2]) / 2
        z2 = (points["L2"][2] + points["R2"][2]) / 2
        z3 = (points["L3"][2] + points["R3"][2]) / 2
        z4 = top[2]

        segments = []
        step = 15
        zs = (z0, z1, z2, z3, z4)
        for zi, z in enumerate(zs[:4]):
            r = r1 if zi < 2 else r2
            next_r = r1 if zi == 0 else r2 if zi < 3 else 0
            for deg in range(0, 360, step):
                rad = np.radians(deg)
                next_rad = np.radians(deg + step)
                direction = (np.cos(rad), np.sin(rad), 0)
                next_direction = (np.cos(next_rad), np.sin(next_rad), 0)
                point = get_point((top[0], top[1], z), direction, r)
                next_point = get_point((top[0], top[1], z), next_direction, r)
                segments.append(_segment(point, next_point, "thin"))
                next_point = get_point((top[0], top[1], zs[zi + 1]), direction, next_r)
                segments.append(_segment(point, next_point, "thin"))

    return {"schema": "gtamaplibvc-map3d-homestead-water-tower-v1", "segments": segments}


def construct_jasons_house_wireframe(landmarks: dict[str, Any]) -> dict[str, Any] | None:
    names = {
        "roof_ne": "Jason's House (Roof) (NE)",
        "roof_s": "Jason's House (Roof) (S)",
        "roof_se": "Jason's House (Roof) (SE)",
        "roof_sw": "Jason's House (Roof) (SW)",
        "base_ne": "Jason's House (Main) (BNE)",
        "top_ne": "Jason's House (Main) (TNE)",
        "top_se": "Jason's House (Main) (TSE)",
        "top_sw": "Jason's House (Main) (TSW)",
    }
    if any(name not in landmarks for name in names.values()):
        return None

    points = {key: _point(landmarks[name]) for key, name in names.items()}
    base_ne = points["base_ne"]
    top_ne = points["top_ne"]
    top_se = points["top_se"]
    top_sw = points["top_sw"]
    roof_ne = points["roof_ne"]
    roof_s = points["roof_s"]
    roof_se = points["roof_se"]
    roof_sw = points["roof_sw"]

    z = 1.9
    base_se = (top_se[0], top_se[1], base_ne[2])
    base_sw = (top_sw[0], top_sw[1], base_ne[2])
    base_nw = (top_sw[0], top_ne[1], base_ne[2])
    ground_se = (base_se[0], base_se[1], z)
    ground_sw = (base_sw[0], base_sw[1], z)
    ground_nw = (base_nw[0], base_nw[1], z)
    ground_ne = (base_ne[0], base_ne[1], z)
    top_nw = (base_nw[0], base_nw[1], (top_sw[2] + top_ne[2]) / 2)
    roof_n = (
        roof_ne[0] + (roof_s[0] - roof_se[0]),
        roof_ne[1] + (roof_s[1] - roof_se[1]),
        roof_ne[2] + (roof_s[2] - roof_se[2]),
    )
    roof_nw = (
        roof_ne[0] + (roof_sw[0] - roof_se[0]),
        roof_ne[1] + (roof_sw[1] - roof_se[1]),
        roof_ne[2] + (roof_sw[2] - roof_se[2]),
    )

    lines = (
        (ground_se, base_se),
        (ground_sw, base_sw),
        (ground_nw, base_nw),
        (ground_ne, base_ne),
        (base_se, base_sw),
        (base_sw, base_nw),
        (base_nw, base_ne),
        (base_ne, base_se),
        (base_se, top_se),
        (base_sw, top_sw),
        (base_nw, top_nw),
        (base_ne, top_ne),
        (roof_se, roof_s),
        (roof_s, roof_sw),
        (roof_sw, roof_nw),
        (roof_nw, roof_n),
        (roof_n, roof_ne),
        (roof_ne, roof_se),
        (roof_s, roof_n),
    )
    return {
        "schema": "gtamaplibvc-map3d-jasons-house-v1",
        "segments": [_segment(a, b, "bold") for a, b in lines],
    }


def construct_landmarks(cameras: dict[str, Any], landmarks: dict[str, Any]) -> dict[str, Any]:
    constructed_landmarks = construct_wdna_fm(cameras, landmarks)
    current_landmarks = {**landmarks, **constructed_landmarks}
    wireframes = {}
    sunshine_skyway = construct_sunshine_skyway_wireframe(current_landmarks)
    if sunshine_skyway:
        wireframes["map3d-sunshine-skyway.json"] = sunshine_skyway
    homestead_water_tower = construct_homestead_water_tower_wireframe(cameras, current_landmarks)
    if homestead_water_tower:
        wireframes["map3d-homestead-water-tower.json"] = homestead_water_tower
    jasons_house = construct_jasons_house_wireframe(current_landmarks)
    if jasons_house:
        wireframes["map3d-jasons-house.json"] = jasons_house
    return {
        "landmarks": constructed_landmarks,
        "wireframes": wireframes,
    }


def write_map3d_constructed_data(cameras: dict[str, Any], landmarks: dict[str, Any], ui_data_dir: Path) -> dict[str, Any]:
    constructed = construct_landmarks(cameras, landmarks)
    ui_data_dir.mkdir(parents=True, exist_ok=True)
    for filename, payload in constructed["wireframes"].items():
        path = ui_data_dir / filename
        path.write_text(json.dumps(payload, indent=4, ensure_ascii=False) + "\n")
        print(f"Wrote {path}.")
    return constructed
