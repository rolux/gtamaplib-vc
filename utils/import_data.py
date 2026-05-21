#!/usr/bin/env python3
"""Export browser-friendly data from gtamaplib."""

from __future__ import annotations

import json
import hashlib
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / "gtamaplib"
DATA_DIR = ROOT / "data"
UI_DIR = ROOT / "ui"
UI_DATA_DIR = UI_DIR / "data"
THUMBNAIL_DIR = UI_DIR / "thumbnails"
GTAMAPDATA_JSON_PATH = DATA_DIR / "gtamapdata.json"
SPECIAL_JSON_PATH = DATA_DIR / "special.json"
CONFIG_JSON_PATH = DATA_DIR / "config.json"
IMPORT_EXTRAS_JSON_PATH = DATA_DIR / "import_extras.json"
OBSERVATION_EDITS_JSON_PATH = DATA_DIR / "observation_edits.json"
UI_OVERLAY_JSON_PATH = UI_DATA_DIR / "overlay.json"
MAP3D_COLORS_JSON_PATH = UI_DATA_DIR / "map3d-colors.json"
MAP3D_FOUR_SEASONS_JSON_PATH = UI_DATA_DIR / "map3d-four-seasons.json"
MAP3D_SUNSHINE_SKYWAY_JSON_PATH = UI_DATA_DIR / "map3d-sunshine-skyway.json"
MAP3D_HANKS_WAFFLES_JSON_PATH = UI_DATA_DIR / "map3d-hanks-waffles.json"
MAP_NAME = "yanis"
CAMERA_CONE_DISTANCE_M = 25
VERTICAL_GUIDE_SPACING_DEGREES = 1.0
PLAYER_CROSS_RADIUS_M = 1.0
PLAYER_CONFIDENCE_HALF_SIZE_M = 0.1
PLAYER_TIER3_CONFIDENCE_HALF_SIZE_M = 0.001
THUMBNAIL_SCALE = 4


L1_CAMERA_RIGIDITY = {
    "[L1/1] Diner": 1,
    "[L1/2] AI World Editor Map (4K)": 0,
    "[L1/3] Amphitheater": 0,
    "[L1/4] Diner (NE)": 1,
    "[L1/4] Diner (N)": 1,
    "[L1/4] Diner (NW)": 1,
    "[L1/4] Diner (W) (A)": 1,
    "[L1/4] Diner (W) (B)": 1,
    "[L1/4] Diner (SW)": 1,
    "[L1/4] Diner (S)": 1,
    "[L1/4] Diner (E)": 1,
    "[L1/4] Diner (SE) (A)": 1,
    "[L1/4] Diner (SE) (B)": 1,
    "[L1/4] Easy Inn": 1,
    "[L1/4] Car Wash": 1,
    "[L1/5] Trees": 2,
    "[L1/6] Sidewalk (Jason) (E)": 1,
    "[L1/7] Port": 2,
    "[L1/8] Gas Station (Lucia)": 1,
    "[L1/9] Motel": 1,
    "[L1/10] Pawn Shop (W)": 1,
    "[L1/10] Pawn Shop (S)": 1,
    "[L1/11] Sidewalk (Lucia)": 1,
    "[L1/12] Auto Shop (SE)": 1,
    "[L1/12] Auto Shop (SW)": 1,
    "[L1/12] Auto Shop (NW)": 2,
    "[L1/12] Auto Shop (NE)": 2,
    "[L1/13] House with Boat (X)": 1,
    "[L1/14] Shootout (S)": 1,
    "[L1/14] Shootout (W)": 1,
    "[L1/15] Park": 1,
    "[L1/15] Bar": 1,
    "[L1/15] Yard": 1,
    "[L1/15] Hedge (B) (X)": 1,
    "[L1/15] Hedge (C) (X)": 1,
    "[L1/15] Hedge (D)": 1,
    "[L1/15] Glitch (A)": 1,
    "[L1/16] Boat (Jason)": 1,
    "[L1/17] Hotel (E)": 1,
    "[L1/18] Hotel (W)": 1,
    "[L1/19] Farm": 2,
    "[L1/20] Gas Station (Jason)": 1,
    "[L1/21] Ocean near Keys (N)": 1,
    "[L1/21] Ocean near Keys (E)": 1,
    "[L1/22] Metro (SE) (A) (4K)": 1,
    "[L1/22] Metro (SE) (B)": 1,
    "[L1/22] Metro (NE) (B)": 1,
    "[L1/23] Tarmac": 1,
    "[L1/24] Sidewalk (Jason) (S)": 1,
    "[L1/25] Parking Lot": 1,
    "[L1/26] Loading Zone near Prison (N)": 1,
    "[L1/26] Loading Zone near Prison (SW)": 1,
    "[L1/27] Highway (N)": 1,
    "[L1/27] Highway (NE)": 2,
    "[L1/27] Highway (E)": 2,
    "[L1/28] Intersection (N)": 0,
    "[L1/29] Welcome Center (E)": 1,
    "[L1/29] Welcome Center (W)": 1,
    "[L1/30] Store (Lucia)": 1,
    "[L1/31] Intersection (W)": 3,
    "[L1/32] Police Chase (A)": 1,
    "[L2/32] Police Chase (B)": 1,
    "[L2/32] Police Chase (C)": 1,
    "[L1/32] Police Chase (D)": 1,
    "[L2/32] Police Chase (E)": 1,
    "[L2/32] Police Chase (F)": 1,
    "[L2/32] Police Chase (G)": 1,
    "[L2/32] Police Chase (H)": 1,
    "[L2/32] Police Chase (I)": 1,
    "[L1/32] Police Chase (J)": 1,
    "[L1/33] Strip Club (Jason) (U)": 1,
    "[L1/34] Strip Club (Jason) (D)": 1,
    "[L1/35] Intersection (SE)": 1,
    "[L1/36] Alley (W)": 2,
    "[L1/36] Alley (NW)": 2,
    "[L1/37] Airport (X)": 1,
    "[L1/38] Strip Club (Lucia)": 2,
    "[L1/39] Bedroom": 1,
    "[L1/40] Backyard": 1,
    "[L1/41] Grassrivers Sign": 1,
    "[L1/42] Tennis Court (SW)": 3,
    "[L1/42] Tennis Court (N)": 3,
    "[L1/42] Tennis Court (NE)": 3,
    "[L1/42] Tennis Court (E)": 3,
    "[L1/42] Tennis Court (SE)": 3,
    "[L1/43] Pool": 1,
    "[L1/44] Tennis Stadium (4K)": 1,
    "[L1/45] Street (Jason)": 0,
    "[L1/46] Street (Lucia) (S)": 0,
    "[L1/47] Street (Lucia) (N)": 0,
    "[L1/48] Hangar (A)": 2,
    "[L1/49] Hangar (B)": 2,
    "[L1/50] Hangar (C)": 2,
}

LANDMARKS_FIXED = [
    "Four Seasons Hotel Miami (BE)",
    "Four Seasons Hotel Miami (BW)",
    "Four Seasons Hotel Miami (NW)",
    "Four Seasons Hotel Miami (SE)",
]

IGNORED_TRIANGULATION_LANDMARKS = {"Player"}
IGNORED_TRIANGULATION_PREFIXES = (
    "Minimap (BR",
    "Minimap (N",
    "Minimap (TL",
    "Minimap BR",
    "Minimap N",
    "Minimap TL",
)

EXTRA_FIXED_ELEVATION = [
    {
        "z": 0.0,
        "landmarks": [
            "Broken Keys Bridge (1B)",
            "Broken Keys Bridge (2B)",
            "Broken Keys Bridge (3B)",
            "Broken Keys Bridge (4B)",
            "Broken Keys Bridge (7B)",
            "Broken Keys Bridge (8B)",
            "Small Keys Bridge (NB)",
            "Small Keys Bridge (SB)",
        ],
    },
    {
        "z": 5.0,
        "landmarks": [
            "Lake Leonida (A)",
            "Lake Leonida (B)",
            "Lake Leonida (C)",
            "Lake Leonida (D)",
            "Lake Leonida (E)",
            "Lake Leonida (F)",
            "Lake Leonida (G)",
            "Lake Leonida (H)",
            "Lake Leonida (I)",
            "Lake Leonida (J)",
            "Lake Leonida (K)",
            "Lake Leonida (L)",
            "Lake Leonida (M)",
            "Lake Leonida (N)",
            "Lake Leonida (O)",
            "Lake Leonida (P)",
            "Lake Leonida (Q)",
            "Lake Leonida (R)",
            "Lake Leonida (S)",
            "Lake Leonida (T)",
            "Lake Leonida (U)",
            "Lake Leonida (V)",
            "Lake Leonida (W)",
            "Lake Leonida (X)",
            "Ambrosia Bridge (3B)",
            "Ambrosia Bridge (4B)",
        ],
    },
    {
        "z": 5.5,
        "landmarks": [
            "Red Boxville (BNE)",
            "Red Boxville (BNW)",
            "Red Boxville (TNW)",
            "Red Boxville (TSW)",
        ],
    },
]


def add_import_path() -> None:
    sys.path.insert(0, str(ROOT))


def jsonable_point(value: Any) -> list[float] | None:
    if value is None:
        return None
    return [float(item) for item in value]


def frame_path_for(camera_name: str) -> str | None:
    path = UPSTREAM / "frames" / f"{camera_name}.png"
    if path.exists():
        return f"../gtamaplib/frames/{path.name}"
    return None


def image_size(path: Path) -> tuple[int, int] | None:
    if not path.exists():
        return None
    with Image.open(path) as image:
        return image.size


def map_image_path(map_info: dict[str, Any]) -> tuple[str, tuple[int, int]]:
    source = Path(map_info["filename"])
    target = UI_DIR / f"{MAP_NAME}-{map_info['version']}-bw.jpg"
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        with Image.open(source) as image:
            image.convert("L").save(target, quality=88, optimize=True)
    size = image_size(target) or image_size(source) or (0, 0)
    return f"ui/{target.name}", size


def thumbnail_path_for(camera_name: str) -> str | None:
    source = UPSTREAM / "frames" / f"{camera_name}.png"
    if not source.exists():
        return None
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha1(camera_name.encode("utf-8")).hexdigest()[:12]
    target = THUMBNAIL_DIR / f"{digest}-{THUMBNAIL_SCALE}x.jpg"
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return f"ui/thumbnails/{target.name}"
    with Image.open(source) as image:
        width = max(1, image.size[0] // THUMBNAIL_SCALE)
        height = max(1, image.size[1] // THUMBNAIL_SCALE)
        thumbnail = image.convert("RGB").resize((width, height), Image.LANCZOS)
        thumbnail.save(target, quality=82, optimize=True)
    return f"ui/thumbnails/{target.name}"


def get_color(name: str) -> str:
    name = normalize_name(name)
    sha1 = hashlib.sha1(name.encode("utf-8")).hexdigest()[-6:]
    rgb = [int(int(sha1[index * 2 : index * 2 + 2], 16) * 0.75) for index in range(3)]
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def normalize_name(name: str) -> str:
    for _ in range(3):
        name = re.sub(r" \([A-Z0-9\?]+\)$", "", name)
        if not name.endswith(")"):
            break
    return name


def quantize_xy(value: Any) -> list[float]:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError("xy must be a two-item list or tuple")
    return [round(float(value[0]) * 2) / 2, round(float(value[1]) * 2) / 2]


def observation_counts(observations: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for observation in observations:
        value = observation[key]
        counts[value] = counts.get(value, 0) + 1
    return counts


def qualified_camera_name(camera_name: str, camera_id: str) -> str:
    return f"[{camera_id}] {camera_name}"


def camera_rigidity(md: Any) -> list[dict[str, Any]]:
    groups: dict[int, list[str]] = {0: [], 1: [], 2: [], 3: []}
    for camera_name, camera in md.cameras.items():
        qualified_name = qualified_camera_name(camera_name, camera["id"])
        group = L1_CAMERA_RIGIDITY.get(qualified_name)
        if group in groups:
            groups[group].append(camera_name)
    return [
        {
            "level": level,
            "cameras": sorted(cameras),
        }
        for level, cameras in groups.items()
        if cameras
    ]


def gtamapdata_landmark_source_lines(md: Any) -> dict[str, str]:
    lines: dict[str, str] = {}
    for line in Path(md.__file__).read_text().splitlines():
        match = re.match(r'\s*"([^"]+)":\s*\(', line)
        if match:
            lines[match.group(1)] = line
    return lines


def fixed_elevation_zero_landmarks(md: Any) -> list[str]:
    source_lines = gtamapdata_landmark_source_lines(md)
    landmarks: list[str] = []
    in_landmarks = False
    for line in Path(md.__file__).read_text().splitlines():
        if line.startswith("landmarks = {"):
            in_landmarks = True
            continue
        if not in_landmarks:
            continue
        if "AIWE MAP" in line:
            break
        match = re.match(r'\s*"([^"]+)":\s*\(', line)
        if not match:
            continue
        name = match.group(1)
        if name not in md.landmarks:
            continue
        z = float(md.landmarks[name][2])
        if abs(z) < 1e-9 or abs(z - 10.0) < 1e-9:
            landmarks.append(name)
    return landmarks


def fixed_elevation(md: Any) -> list[dict[str, Any]]:
    rows = [
        {
            "z": 0.0,
            "landmarks": fixed_elevation_zero_landmarks(md),
        }
    ]
    rows.extend(EXTRA_FIXED_ELEVATION)
    return rows


def write_special_if_missing(md: Any) -> None:
    if SPECIAL_JSON_PATH.exists():
        return
    special = {
        "schema": "gtamaplibvc-special-v1",
        "camera_rigidity": camera_rigidity(md),
        "landmarks_fixed": LANDMARKS_FIXED,
        "landmarks_fixed_elevation": fixed_elevation(md),
    }
    SPECIAL_JSON_PATH.write_text(json.dumps(special, indent=4, ensure_ascii=False) + "\n")
    print(f"Wrote editable {SPECIAL_JSON_PATH}")


def write_config_if_missing() -> None:
    if CONFIG_JSON_PATH.exists():
        return
    config = {
        "schema": "gtamaplibvc-config-v1",
        "min_triangulation_delta_degrees": 10.0,
        "min_fixed_elevation_intersection_angle_degrees": 1.0,
    }
    CONFIG_JSON_PATH.write_text(json.dumps(config, indent=4, ensure_ascii=False) + "\n")
    print(f"Wrote editable {CONFIG_JSON_PATH}")


def load_config() -> dict[str, Any]:
    write_config_if_missing()
    return json.loads(CONFIG_JSON_PATH.read_text())


def load_special(md: Any) -> dict[str, Any]:
    write_special_if_missing(md)
    return json.loads(SPECIAL_JSON_PATH.read_text())


def rigid_camera_names(special: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    for group in special.get("camera_rigidity", []):
        if int(group["level"]) in {1, 2, 3}:
            names.update(group.get("cameras", []))
    return names


def mean_pair_delta_m(rays: list[tuple[Any, Any]], intersect_ray_and_ray: Any) -> float:
    deltas = []
    for index_a, ray_a in enumerate(rays):
        for ray_b in rays[index_a + 1 :]:
            try:
                deltas.append(float(intersect_ray_and_ray(ray_a, ray_b)[3]))
            except Exception:
                continue
    return float(np.mean(deltas)) if deltas else 0.0


def is_ignored_triangulation_landmark(landmark_name: str) -> bool:
    return landmark_name in IGNORED_TRIANGULATION_LANDMARKS or landmark_name.startswith(
        IGNORED_TRIANGULATION_PREFIXES
    )


def ray_angle_degrees(ray_a: tuple[Any, Any], ray_b: tuple[Any, Any]) -> float:
    direction_a = np.asarray(ray_a[1], dtype=float)
    direction_b = np.asarray(ray_b[1], dtype=float)
    norm_a = np.linalg.norm(direction_a)
    norm_b = np.linalg.norm(direction_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    cosine = float(np.dot(direction_a, direction_b) / (norm_a * norm_b))
    return float(np.degrees(np.arccos(np.clip(abs(cosine), -1.0, 1.0))))


def max_ray_pair_angle_degrees(rays: list[tuple[Any, Any]]) -> float:
    angles = []
    for index_a, ray_a in enumerate(rays):
        for ray_b in rays[index_a + 1 :]:
            angles.append(ray_angle_degrees(ray_a, ray_b))
    return float(max(angles)) if angles else 0.0


def is_leonida_keys_pin_triangulation(landmark_name: str, camera_names: list[str]) -> bool:
    # Hard-coded exception: the Leonida Keys pin pairs are intentionally kept even
    # when their ray baseline is below the general triangulation threshold.
    if not landmark_name.lower().startswith("pin "):
        return False
    return sum(name.startswith("Leonida Keys ") for name in camera_names) >= 2


def jsonable_segment(segment: list[list[float]] | None) -> list[list[float]] | None:
    if segment is None:
        return None
    return [[float(point[0]), float(point[1])] for point in segment]


def map_point(map_info: dict[str, Any], xyz: tuple[float, float, float] | list[float]) -> dict[str, float]:
    return {
        "x": float(map_info["zero"][0] + xyz[0] * map_info["scale"]),
        "y": float(map_info["zero"][1] - xyz[1] * map_info["scale"]),
    }


def map_camera_cone_lines(cam: Any, map_info: dict[str, Any], get_point: Any) -> list[list[dict[str, float]]]:
    if cam.xyz is None or cam.hfov < 1:
        return []
    origin = map_point(map_info, cam.xyz)
    corners = (
        get_point(cam.xyz, cam.get_pixel_direction((0, cam.h / 2)), CAMERA_CONE_DISTANCE_M),
        get_point(cam.xyz, cam.get_pixel_direction((cam.w, cam.h / 2)), CAMERA_CONE_DISTANCE_M),
    )
    return [
        [origin, map_point(map_info, corner)]
        for corner in corners
    ]


def project_line(viewer: Any, point_a: Any, point_b: Any) -> list[list[float]] | None:
    pixel_a = viewer.get_pixel(point_a)
    pixel_b = viewer.get_pixel(point_b)
    if pixel_a is None or pixel_b is None:
        return None
    return [[float(pixel_a[0]), float(pixel_a[1])], [float(pixel_b[0]), float(pixel_b[1])]]


def point_in_frame(point: Any, width: float, height: float) -> bool:
    return 0 <= float(point[0]) <= width and 0 <= float(point[1]) <= height


def orientation(a: list[float], b: list[float], c: tuple[float, float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segments_intersect(a: list[float], b: list[float], c: tuple[float, float], d: tuple[float, float]) -> bool:
    ab_c = orientation(a, b, c)
    ab_d = orientation(a, b, d)
    cd_a = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0])
    cd_b = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0])
    return ab_c * ab_d <= 0 and cd_a * cd_b <= 0


def segment_intersects_frame(segment: list[list[float]], width: float, height: float) -> bool:
    a, b = segment
    if point_in_frame(a, width, height) or point_in_frame(b, width, height):
        return True
    edges = [
        ((0.0, 0.0), (width, 0.0)),
        ((width, 0.0), (width, height)),
        ((width, height), (0.0, height)),
        ((0.0, height), (0.0, 0.0)),
    ]
    return any(segments_intersect(a, b, c, d) for c, d in edges)


def cone_intersects_frame(segments: list[list[list[float]]], quad: list[list[float]] | None, width: float, height: float) -> bool:
    if quad and any(point_in_frame(point, width, height) for point in quad):
        return True
    return any(segment_intersects_frame(segment, width, height) for segment in segments)


def pixel_to_ndc_x(x: float, width: float) -> float:
    return 2.0 * ((x + 0.5) / width) - 1.0


def pixel_to_ndc_y(y: float, height: float) -> float:
    return 2.0 * ((y + 0.5) / height) - 1.0


def ndc_to_pixel_x(ndc_x: float, width: float) -> float:
    return (ndc_x + 1.0) * width * 0.5 - 0.5


def ndc_to_pixel_y(ndc_y: float, height: float) -> float:
    return (ndc_y + 1.0) * height * 0.5 - 0.5


def camera_horizon_segment(cam: Any, get_rotation: Any) -> list[list[float]] | None:
    rot = get_rotation(tuple(cam.q))
    world_x_z = float(rot.apply([1.0, 0.0, 0.0])[2])
    world_y_z = float(rot.apply([0.0, 1.0, 0.0])[2])
    world_z_z = float(rot.apply([0.0, 0.0, 1.0])[2])
    tan_h = float(np.tan(np.radians(cam.hfov / 2.0)))
    tan_v = float(np.tan(np.radians(cam.vfov / 2.0)))
    a = world_x_z * tan_h
    b = -world_z_z * tan_v
    c = world_y_z
    points: list[list[float]] = []

    def add_point(x: float, y: float) -> None:
        if -1e-6 <= x <= cam.w + 1e-6 and -1e-6 <= y <= cam.h + 1e-6:
            point = [float(x), float(y)]
            if not any(np.hypot(point[0] - other[0], point[1] - other[1]) < 1e-6 for other in points):
                points.append(point)

    if abs(b) > 1e-12:
        for x in (0.0, float(cam.w)):
            ndc_x = pixel_to_ndc_x(x, cam.w)
            ndc_y = -(a * ndc_x + c) / b
            add_point(x, ndc_to_pixel_y(ndc_y, cam.h))
    if abs(a) > 1e-12:
        for y in (0.0, float(cam.h)):
            ndc_y = pixel_to_ndc_y(y, cam.h)
            ndc_x = -(b * ndc_y + c) / a
            add_point(ndc_to_pixel_x(ndc_x, cam.w), y)
    if len(points) < 2:
        return None
    points.sort(key=lambda point: (point[0], point[1]))
    return [points[0], points[-1]]


def camera_cones_for_viewer(viewer_name: str, camera_names: list[str], get_camera: Any, get_point: Any) -> list[dict[str, Any]]:
    viewer = get_camera(viewer_name)
    cones = []
    for camera_name in camera_names:
        if camera_name == viewer_name:
            continue
        cam = get_camera(camera_name)
        if cam.xyz is None or cam.hfov < 1:
            continue
        segments = []
        vertical = project_line(viewer, cam.xyz, (cam.x, cam.y, 0))
        if vertical:
            segments.append(vertical)
        corners = (
            get_point(cam.xyz, cam.get_pixel_direction((0, 0)), CAMERA_CONE_DISTANCE_M),
            get_point(cam.xyz, cam.get_pixel_direction((cam.w, 0)), CAMERA_CONE_DISTANCE_M),
            get_point(cam.xyz, cam.get_pixel_direction((cam.w, cam.h)), CAMERA_CONE_DISTANCE_M),
            get_point(cam.xyz, cam.get_pixel_direction((0, cam.h)), CAMERA_CONE_DISTANCE_M),
        )
        projected_corners = [viewer.get_pixel(corner) for corner in corners]
        quad = None
        if all(pixel is not None for pixel in projected_corners):
            quad = [[float(pixel[0]), float(pixel[1])] for pixel in projected_corners]
        for index, corner in enumerate(corners):
            ray = project_line(viewer, cam.xyz, corner)
            edge = project_line(viewer, corner, corners[(index + 1) % len(corners)])
            if ray:
                segments.append(ray)
            if edge:
                segments.append(edge)
        if segments and cone_intersects_frame(segments, quad, viewer.w, viewer.h):
            cone = {"camera": camera_name, "segments": segments}
            if quad:
                cone["quad"] = quad
            cones.append(cone)
    return cones


def camera_guides(cam: Any, get_rotation: Any) -> dict[str, Any]:
    horizon = camera_horizon_segment(cam, get_rotation)
    guides: dict[str, Any] = {
        "horizon": horizon,
        "verticals": [],
    }
    start = int(cam.yaw - 60)
    stop = int(cam.yaw + 60)
    for deg in np.arange(start, stop, VERTICAL_GUIDE_SPACING_DEGREES):
        rad = np.radians(deg + 90)
        x = cam.x + np.cos(rad) * 10
        y = cam.y + np.sin(rad) * 10
        segment = project_line(cam, (x, y, cam.z - 10), (x, y, cam.z + 10))
        if segment:
            guides["verticals"].append(segment)
    return guides


def is_tier3_camera(cam: Any) -> bool:
    return re.match(r"^[A-Z]3(?:/|$)", str(cam.id)) is not None


def camera_player_overlay(cam: Any) -> dict[str, Any] | None:
    if not cam.player:
        return None
    px, py, pz = (float(value) for value in cam.player)
    axes = [
        (
            "x",
            "#ff0000",
            (px - PLAYER_CROSS_RADIUS_M, py, pz),
            (px + PLAYER_CROSS_RADIUS_M, py, pz),
        ),
        (
            "y",
            "#00ff00",
            (px, py - PLAYER_CROSS_RADIUS_M, pz),
            (px, py + PLAYER_CROSS_RADIUS_M, pz),
        ),
        (
            "z",
            "#0000ff",
            (px, py, pz - PLAYER_CROSS_RADIUS_M),
            (px, py, pz + PLAYER_CROSS_RADIUS_M),
        ),
    ]
    cross = []
    for axis, color, start, end in axes:
        segment = project_line(cam, start, end)
        if segment:
            cross.append({"axis": axis, "color": color, "segment": segment})

    half_size = PLAYER_TIER3_CONFIDENCE_HALF_SIZE_M if is_tier3_camera(cam) else PLAYER_CONFIDENCE_HALF_SIZE_M
    box = []
    for dz in (-half_size, half_size):
        for dy in (-half_size, half_size):
            segment = project_line(cam, (px - half_size, py + dy, pz + dz), (px + half_size, py + dy, pz + dz))
            if segment:
                box.append({"axis": "x", "color": "#ff0000", "segment": segment})
    for dz in (-half_size, half_size):
        for dx in (-half_size, half_size):
            segment = project_line(cam, (px + dx, py - half_size, pz + dz), (px + dx, py + half_size, pz + dz))
            if segment:
                box.append({"axis": "y", "color": "#00ff00", "segment": segment})
    for dy in (-half_size, half_size):
        for dx in (-half_size, half_size):
            segment = project_line(cam, (px + dx, py + dy, pz - half_size), (px + dx, py + dy, pz + half_size))
            if segment:
                box.append({"axis": "z", "color": "#0000ff", "segment": segment})

    if not cross and not box:
        return None
    return {
        "tier3": is_tier3_camera(cam),
        "cross": cross,
        "box": box,
    }


def write_ui_overlay_data(md: Any, get_camera: Any, get_point: Any, get_rotation: Any) -> None:
    UI_DATA_DIR.mkdir(parents=True, exist_ok=True)
    camera_names = list(md.cameras)
    cones = {
        camera_name: camera_cones_for_viewer(camera_name, camera_names, get_camera, get_point)
        for camera_name in camera_names
    }
    guides = {}
    for camera_name in camera_names:
        try:
            guides[camera_name] = camera_guides(get_camera(camera_name), get_rotation)
        except Exception:
            guides[camera_name] = {"horizon": None, "verticals": []}
    players = {}
    for camera_name in camera_names:
        try:
            player = camera_player_overlay(get_camera(camera_name))
        except Exception:
            player = None
        if player:
            players[camera_name] = player
    overlay = {
        "schema": "gtamaplibvc-ui-overlay-v1",
        "camera_cone_distance_m": CAMERA_CONE_DISTANCE_M,
        "cones": cones,
        "guides": guides,
        "players": players,
    }
    UI_OVERLAY_JSON_PATH.write_text(json.dumps(overlay, indent=4, ensure_ascii=False) + "\n")
    print(f"Wrote {UI_OVERLAY_JSON_PATH}")


def triangulate_missing_landmarks(
    md: Any,
    get_camera: Any,
    intersect_rays: Any,
    intersect_ray_and_ray: Any,
    special: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, list[Any]]:
    min_delta_degrees = float(config.get("min_triangulation_delta_degrees", 10.0))
    cameras = []
    for camera_name in sorted(rigid_camera_names(special)):
        if camera_name not in md.cameras:
            continue
        cam = get_camera(camera_name)
        if cam.xyz is None:
            continue
        cameras.append(cam)

    by_landmark: dict[str, list[Any]] = {}
    for cam in cameras:
        for landmark_name in cam.landmark_pixels:
            if is_ignored_triangulation_landmark(landmark_name):
                continue
            if landmark_name in md.landmarks:
                continue
            by_landmark.setdefault(landmark_name, []).append(cam)

    generated = {}
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
            point, _distances = intersect_rays(rays)
        except Exception:
            continue
        generated[landmark_name] = [
            [float(value) for value in point],
            mean_pair_delta_m(rays, intersect_ray_and_ray),
            ray_cameras,
        ]
    return generated


def compact_json_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(", ", ": "))


def dumps_import_extras(data: dict[str, Any]) -> str:
    lines = [
        "{",
        f'    "schema": {compact_json_value(data["schema"])},',
        '    "formats": {',
        f'        "added_landmarks": {compact_json_value(data["formats"]["added_landmarks"])},',
        f'        "generated_landmarks": {compact_json_value(data["formats"]["generated_landmarks"])}',
        "    },",
        '    "added_landmarks": {',
    ]
    added_items = list(data["added_landmarks"].items())
    for index, (name, value) in enumerate(added_items):
        comma = "," if index < len(added_items) - 1 else ""
        lines.append(f"        {compact_json_value(name)}: {compact_json_value(value)}{comma}")
    lines.extend([
        "    },",
        '    "generated_landmarks": {',
    ])
    items = list(data["generated_landmarks"].items())
    for index, (name, value) in enumerate(items):
        comma = "," if index < len(items) - 1 else ""
        lines.append(f"        {compact_json_value(name)}: {compact_json_value(value)}{comma}")
    lines.extend(["    }", "}"])
    return "\n".join(lines) + "\n"


def write_import_extras(md: Any, get_camera: Any, intersect_rays: Any, intersect_ray_and_ray: Any) -> None:
    from gtamaplib.gtamaplib import FourSeasons

    special = load_special(md)
    config = load_config()
    fs = FourSeasons()
    # Extra Four Seasons construction points that are not upstream landmarks
    # yet, but are useful as explicit anchors for top-down fake cameras.
    added_landmarks = {
        "Four Seasons Hotel Miami (BNW)": [
            [float(value) for value in fs.hb58nw],
            "FourSeasons().hb58nw",
        ],
        "Four Seasons Hotel Miami (BNE)": [
            [float(value) for value in fs.hb58ne],
            "FourSeasons().hb58ne",
        ],
    }
    import_extras = {
        "schema": "gtamaplibvc-import-extras-v1",
        "formats": {
            "added_landmarks": {
                "<landmark_name>": [
                    ["x", "y", "z"],
                    "source",
                ]
            },
            "generated_landmarks": {
                "<landmark_name>": [
                    ["x", "y", "z"],
                    "mean_pair_delta_m",
                    ["camera_name"],
                ]
            }
        },
        "added_landmarks": added_landmarks,
        "generated_landmarks": triangulate_missing_landmarks(
            md,
            get_camera,
            intersect_rays,
            intersect_ray_and_ray,
            special,
            config,
        ),
    }
    IMPORT_EXTRAS_JSON_PATH.write_text(dumps_import_extras(import_extras))
    print(
        "Wrote {path} with {count} generated landmarks.".format(
            path=IMPORT_EXTRAS_JSON_PATH,
            count=len(import_extras["generated_landmarks"]),
        )
    )


def map3d_point(value: Any) -> list[float]:
    return [float(coord) for coord in value]


def map3d_segment(a: Any, b: Any, style: str = "thin") -> dict[str, Any]:
    return {"points": [map3d_point(a), map3d_point(b)], "style": style}


def map3d_four_seasons_wireframe() -> dict[str, Any]:
    from gtamaplib.gtamaplib import FourSeasons

    fs = FourSeasons()
    segments: list[dict[str, Any]] = []
    for bottom, top, has_box, has_south in (
        (-1, 0, 0, 1),
        (0, 8, 1, 1),
        (8, 16, 0, 1),
        (16, 24, 1, 1),
        (24, 32, 0, 1),
        (32, 40, 1, 1),
        (40, 56, 0, 1),
        (56, 57, 0, 0),
    ):
        for floor in range(bottom, top + 1):
            ne = fs._get_point_at_floor((fs.fs56ne, fs.fs40ne)[has_box], floor)
            nw = fs._get_point_at_floor((fs.fs56nw, fs.fs40nw)[has_box], floor)
            wo = fs._get_point_at_floor((fs.fs56w, fs.fs40w)[has_box], floor)
            wi = fs._get_point_at_floor(fs.fs56w, floor)
            hbnw = fs._get_point_at_floor(fs.hb58nw, floor)
            hbsw = fs._get_hbs_at_floor("w", floor)
            sw = fs._get_point_at_floor((fs.fs56w, fs.fs56sw)[has_south], floor)
            se = fs._get_point_at_floor((fs.fs56e, fs.fs56se)[has_south], floor)
            hbse = fs._get_hbs_at_floor("e", floor)
            hbne = fs._get_point_at_floor(fs.hb58ne, floor)
            ei = fs._get_point_at_floor(fs.fs56e, floor)
            eo = fs._get_point_at_floor((fs.fs56e, fs.fs40e)[has_box], floor)
            horizontal_style = "bold" if floor % 2 == 0 and has_south else "thin"

            segments.append(map3d_segment(ne, nw))
            segments.append(map3d_segment(nw, wo))
            if floor <= 8:
                segments.append(map3d_segment(wi, sw, horizontal_style))
            elif floor < 28:
                segments.append(map3d_segment(wi, hbnw, "bold"))
                segments.append(map3d_segment(hbsw, sw, horizontal_style))
            elif has_south:
                segments.append(map3d_segment(wi, hbnw, "bold"))
                segments.append(map3d_segment(hbnw, sw, horizontal_style))
            segments.append(map3d_segment(wo, wi))
            segments.append(map3d_segment(sw, se, horizontal_style))
            segments.append(map3d_segment(ei, eo))
            if floor <= 8:
                segments.append(map3d_segment(se, ei, horizontal_style))
            elif floor < 28:
                segments.append(map3d_segment(se, hbse, horizontal_style))
                segments.append(map3d_segment(hbne, ei, "bold"))
            elif has_south:
                segments.append(map3d_segment(se, hbne, horizontal_style))
                segments.append(map3d_segment(hbne, ei, "bold"))
            segments.append(map3d_segment(eo, ne))

            if floor == top:
                continue
            segments += [
                map3d_segment(ne, fs._get_point_at_floor(ne, floor + 1)),
                map3d_segment(nw, fs._get_point_at_floor(nw, floor + 1)),
                map3d_segment(wo, fs._get_point_at_floor(wo, floor + 1)),
                map3d_segment(wi, fs._get_point_at_floor(wi, floor + 1)),
                map3d_segment(sw, fs._get_point_at_floor(sw, floor + 1)),
                map3d_segment(se, fs._get_point_at_floor(se, floor + 1)),
                map3d_segment(ei, fs._get_point_at_floor(ei, floor + 1)),
                map3d_segment(eo, fs._get_point_at_floor(eo, floor + 1)),
            ]

        segments += [
            map3d_segment(fs.hb58nw, fs._get_point_at_floor(fs.hb58nw, 56), "bold"),
            map3d_segment(fs.hb58nw, fs.hb58ne, "bold"),
            map3d_segment(fs.hb58ne, fs._get_point_at_floor(fs.hb58ne, 56), "bold"),
            map3d_segment(fs.hb58sw, fs._get_hbs_at_floor("w", 56), "bold"),
            map3d_segment(fs.hb58sw, fs.hb58se, "bold"),
            map3d_segment(fs.hb58se, fs._get_hbs_at_floor("e", 56), "bold"),
            map3d_segment(fs.hb58nw, fs._get_point_at_floor(fs.hb58nw, 8), "bold"),
            map3d_segment(fs.hb58sw, fs.hb28sw, "bold"),
            map3d_segment(fs.hb28sw, fs.hb8sw, "bold"),
            map3d_segment(fs.hb58ne, fs._get_point_at_floor(fs.hb58ne, 8), "bold"),
            map3d_segment(fs.hb58se, fs.hb28se, "bold"),
            map3d_segment(fs.hb28se, fs.hb8se, "bold"),
        ]
    return {"schema": "gtamaplibvc-map3d-four-seasons-v1", "segments": segments}


def map3d_sunshine_skyway_wireframe() -> dict[str, Any]:
    from gtamaplib.gtamaplib import SunshineSkywayBridge

    bridge = SunshineSkywayBridge()
    segments: list[dict[str, Any]] = [
        map3d_segment(bridge.nt, (bridge.nt[0], bridge.nt[1], 0), "bold"),
        map3d_segment(bridge.st, (bridge.st[0], bridge.st[1], 0), "bold"),
    ]
    for index in range(len(bridge.road) - 1):
        segments.append(map3d_segment(bridge.road[index], bridge.road[index + 1], "bold"))
    n_cables = 10
    gap = (bridge.nt[2] - bridge.nr[2]) / n_cables
    for pillar in (bridge.nt, bridge.st):
        for direction in (bridge.direction, -bridge.direction):
            for index in range(n_cables):
                base_point = (pillar[0], pillar[1], bridge.nr[2])
                road_point = bridge._get_road_point(base_point, direction, (index + 1) * gap)
                pillar_point = (base_point[0], base_point[1], base_point[2] + (index + 1) * gap)
                segments.append(map3d_segment(road_point, pillar_point, "thin"))
    return {"schema": "gtamaplibvc-map3d-sunshine-skyway-v1", "segments": segments}


def map3d_hanks_waffles_wireframe() -> dict[str, Any]:
    from gtamaplib.gtamaplib import HanksWaffles

    hw = HanksWaffles()
    segments: list[dict[str, Any]] = []
    bz = 14.0
    rz = 17.0
    corners = (hw.rne, hw.rse, hw.rsw)
    for corner in corners:
        segments.append(map3d_segment(corner, (corner[0], corner[1], bz), "bold"))
    for index in range(len(corners) - 1):
        z = bz
        row = 0
        while z <= rz + 0.001:
            style = "bold" if row % 5 == 0 else "thin"
            segments.append(
                map3d_segment(
                    (corners[index][0], corners[index][1], z),
                    (corners[index + 1][0], corners[index + 1][1], z),
                    style,
                )
            )
            z += 0.1
            row += 1
    return {
        "schema": "gtamaplibvc-map3d-hanks-waffles-v1",
        "name": "536 Richard Jackson Blvd",
        "segments": segments,
    }


def write_map3d_data(md: Any) -> None:
    from gtamaplib.gtamaplib import get_color as gtamaplib_get_color

    UI_DATA_DIR.mkdir(parents=True, exist_ok=True)
    names = set(md.cameras) | set(md.landmarks)
    result_path = ROOT / "optimizer" / "result.json"
    if result_path.exists():
        result = json.loads(result_path.read_text())
        names.update(result.get("cameras", {}))
        names.update(result.get("landmarks", {}))
    names.update({"Four Seasons Hotel Miami", "Sunshine Skyway Bridge", "536 Richard Jackson Blvd"})
    colors = {
        "schema": "gtamaplibvc-map3d-colors-v1",
        "colors": {
            name: [channel / 255 for channel in gtamaplib_get_color(name)]
            for name in sorted(names)
        },
    }
    payloads = [
        (MAP3D_COLORS_JSON_PATH, colors),
        (MAP3D_FOUR_SEASONS_JSON_PATH, map3d_four_seasons_wireframe()),
        (MAP3D_SUNSHINE_SKYWAY_JSON_PATH, map3d_sunshine_skyway_wireframe()),
        (MAP3D_HANKS_WAFFLES_JSON_PATH, map3d_hanks_waffles_wireframe()),
    ]
    for path, payload in payloads:
        path.write_text(json.dumps(payload, indent=4, ensure_ascii=False) + "\n")
        print(f"Wrote {path}.")


def main() -> None:
    add_import_path()
    from gtamaplib import gtamapdata as md
    from gtamaplib.gtamaplib import get_camera, get_point, get_rotation, intersect_ray_and_ray, intersect_rays

    map_info = md.maps[MAP_NAME]
    map_image, map_size = map_image_path(map_info)
    cameras = []
    observations = []

    for order, camera_name in enumerate(md.cameras):
        cam = get_camera(camera_name)
        camera_pixels = md.pixels.get(camera_name, {})
        frame = frame_path_for(camera_name)
        thumbnail = thumbnail_path_for(camera_name)
        cameras.append(
            {
                "name": camera_name,
                "id": str(cam.id),
                "order": order,
                "player": jsonable_point(cam.player),
                "xyz": jsonable_point(cam.xyz),
                "ypr": jsonable_point(cam.ypr),
                "fov": [float(cam.hfov), float(cam.vfov)],
                "size": [int(cam.size[0]), int(cam.size[1])],
                "source": str(getattr(cam, "source", "")),
                "frame": frame,
                "thumbnail": thumbnail,
                "color": get_color(camera_name),
                "observation_count": 0,
                "map": map_point(map_info, cam.xyz),
                "mapCone": map_camera_cone_lines(cam, map_info, get_point),
            }
        )
        for landmark_name, pixel in camera_pixels.items():
            observations.append(
                {
                    "camera": camera_name,
                    "landmark": landmark_name,
                    "xy": [float(pixel[0]), float(pixel[1])],
                    "color": get_color(landmark_name),
                }
            )

    camera_observation_counts = observation_counts(observations, "camera")
    landmark_observation_counts = observation_counts(observations, "landmark")
    for camera in cameras:
        camera["observation_count"] = camera_observation_counts.get(camera["name"], 0)

    landmarks = []
    landmark_names = set()
    for order, (landmark_name, xyz) in enumerate(md.landmarks.items()):
        if landmark_name in landmark_names:
            continue
        landmark_names.add(landmark_name)
        landmarks.append(
            {
                "name": landmark_name,
                "order": order,
                "xyz": jsonable_point(xyz),
                "color": get_color(landmark_name),
                "observation_count": landmark_observation_counts.get(landmark_name, 0),
                "map": map_point(map_info, xyz),
            }
        )
    observed_only_landmarks = sorted(set(landmark_observation_counts) - landmark_names)
    for index, landmark_name in enumerate(observed_only_landmarks, len(landmarks)):
        landmarks.append(
            {
                "name": landmark_name,
                "order": index,
                "xyz": None,
                "color": get_color(landmark_name),
                "observation_count": landmark_observation_counts.get(landmark_name, 0),
                "map": None,
            }
        )

    gtamapdata = {
        "schema": "gtamaplibvc-gtamapdata-v1",
        "upstream": {
            "path": str(UPSTREAM),
            "gtamapdata": str(Path(md.__file__).resolve()),
        },
        "counts": {
            "cameras": len(cameras),
            "landmarks": len(landmarks),
            "observations": len(observations),
        },
        "map": {
            "name": MAP_NAME,
            "version": int(map_info["version"]),
            "image": map_image,
            "size": [int(map_size[0]), int(map_size[1])],
            "scale": float(map_info["scale"]),
            "zero": [float(map_info["zero"][0]), float(map_info["zero"][1])],
        },
        "cameras": cameras,
        "landmarks": landmarks,
        "observations": observations,
    }

    DATA_DIR.mkdir(exist_ok=True)
    GTAMAPDATA_JSON_PATH.write_text(json.dumps(gtamapdata, indent=4, ensure_ascii=False) + "\n")
    write_special_if_missing(md)
    write_import_extras(md, get_camera, intersect_rays, intersect_ray_and_ray)
    write_ui_overlay_data(md, get_camera, get_point, get_rotation)
    write_map3d_data(md)
    print(
        "Wrote {path} with {cameras} cameras, {landmarks} landmarks, "
        "{observations} observations.".format(path=GTAMAPDATA_JSON_PATH, **gtamapdata["counts"])
    )


if __name__ == "__main__":
    main()
