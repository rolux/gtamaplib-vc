#!/usr/bin/env python3
"""Render a local XY loss landscape for one optimizer chain camera."""

from __future__ import annotations

import argparse
import heapq
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares

import optimize as opt
from gtamaplib.gtamaplib import get_camera, get_map, get_vfov


OUTPUT_DIR = opt.RENDERS_DIR / "loss"
DEFAULT_CELL_PIXELS = 8
DEFAULT_MAX_NFEV = 100


def wrap_delta_degrees(value: float) -> float:
    return ((float(value) + 180.0) % 360.0) - 180.0


def snap(value: float, spacing: float) -> float:
    return round(float(value) / spacing) * spacing


def full_to_vars(params: np.ndarray, fixed_roll: bool) -> np.ndarray:
    if fixed_roll:
        return np.asarray([params[2], params[3], params[4], params[6]], dtype=float)
    return np.asarray([params[2], params[3], params[4], params[5], params[6]], dtype=float)


def vars_to_full(x: float, y: float, values: np.ndarray, fixed_roll: bool) -> np.ndarray:
    if fixed_roll:
        z, yaw_delta, pitch, hfov = values
        return np.asarray([x, y, z, yaw_delta, pitch, 0.0, hfov], dtype=float)
    z, yaw_delta, pitch, roll, hfov = values
    return np.asarray([x, y, z, yaw_delta, pitch, roll, hfov], dtype=float)


def variable_bounds(fixed_roll: bool) -> tuple[np.ndarray, np.ndarray]:
    if fixed_roll:
        return (
            np.asarray([-np.inf, -np.inf, -np.inf, 0.001], dtype=float),
            np.asarray([np.inf, np.inf, np.inf, 160.0], dtype=float),
        )
    return (
        np.asarray([-np.inf, -np.inf, -np.inf, -np.inf, 0.001], dtype=float),
        np.asarray([np.inf, np.inf, np.inf, np.inf, 160.0], dtype=float),
    )


def build_observation_targets(
    solve: dict[str, Any],
    priors: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    camera_name = solve["camera_name"]
    target_camera = get_camera(camera_name)

    point_targets: list[dict[str, Any]] = []
    for landmark_name in solve["landmarks"]:
        if landmark_name not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for {landmark_name!r}")
        prior = priors["landmarks"].get(landmark_name) or opt.camera_location_landmark_prior(landmark_name)
        if prior is None:
            raise KeyError(f"No landmark prior for {landmark_name!r}")
        point_targets.append(
            {
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[landmark_name]),
                "xyz": prior["xyz"],
            }
        )

    ray_targets: list[dict[str, Any]] = []
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
        source_direction = opt.camera_direction_from_pixel(
            source_pixel,
            source_prior["ypr"],
            source_prior["fov"],
            source_prior["size"],
        )
        ray_targets.append(
            {
                "pixel": tuple(float(value) for value in target_camera.landmark_pixels[target_name]),
                "source_origin": source_prior["xyz"],
                "source_direction": source_direction,
            }
        )

    object_targets: list[dict[str, Any]] = []
    for object_row in solve.get("horizontal_objects", []):
        point_a = object_row["point_a"]
        point_b = object_row["point_b"]
        if point_a not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for object point {point_a!r}")
        if point_b not in target_camera.landmark_pixels:
            raise KeyError(f"{camera_name!r} has no pixel for object point {point_b!r}")
        object_targets.append(
            {
                "pixel_a": tuple(float(value) for value in target_camera.landmark_pixels[point_a]),
                "pixel_b": tuple(float(value) for value in target_camera.landmark_pixels[point_b]),
                "orientation": object_row["orientation"],
                "length_m": float(object_row["length_m"]),
                "z": float(object_row["z"]),
            }
        )
    return point_targets, ray_targets, object_targets


def load_current_stage_params(
    stage_index: int,
    solve: dict[str, Any],
) -> np.ndarray:
    result_path = opt.result_path_for_stage(stage_index, solve["camera_name"])
    yaw0 = float(solve["ypr"][0])
    if result_path.exists():
        result = json.loads(result_path.read_text())
        params = opt.global_camera_params(result["global"], solve["camera_name"])
        return np.asarray(
            [
                params[0],
                params[1],
                params[2],
                wrap_delta_degrees(float(params[3]) - yaw0),
                params[4],
                params[5],
                params[6],
            ],
            dtype=float,
        )
    ypr = [float(value) for value in solve["ypr"]]
    return np.asarray(
        [
            float(solve["xyz"][0]),
            float(solve["xyz"][1]),
            float(solve["xyz"][2]),
            0.0,
            ypr[1],
            ypr[2],
            float(solve["hfov"]),
        ],
        dtype=float,
    )


def loss_for_xy(
    x: float,
    y: float,
    start_params: np.ndarray,
    solve: dict[str, Any],
    point_targets: list[dict[str, Any]],
    ray_targets: list[dict[str, Any]],
    object_targets: list[dict[str, Any]],
    fixed_roll: bool,
    max_nfev: int,
) -> dict[str, Any]:
    yaw0 = float(solve["ypr"][0])
    size = tuple(int(value) for value in solve["size"])
    lower, upper = variable_bounds(fixed_roll)
    x0 = np.clip(full_to_vars(start_params, fixed_roll), lower, upper)

    def residuals(values: np.ndarray) -> np.ndarray:
        full = vars_to_full(x, y, values, fixed_roll)
        return opt.local_camera_residuals(full, yaw0, size, point_targets, ray_targets, object_targets)

    result = least_squares(
        residuals,
        x0,
        bounds=(lower, upper),
        loss="linear",
        x_scale="jac",
        max_nfev=max_nfev,
        verbose=0,
    )
    params = opt.normalize_camera_params(solve["camera_name"], vars_to_full(x, y, result.x, fixed_roll))
    residual_values = residuals(full_to_vars(params, fixed_roll))
    summary = opt.residual_summary(residual_values)
    return {
        "x": float(x),
        "y": float(y),
        "loss": float(summary["loss_arcmin2"]),
        "mean": float(summary["mean_abs_arcmin"]),
        "median": float(summary["median_abs_arcmin"]),
        "max": float(summary["max_abs_arcmin"]),
        "nfev": int(result.nfev),
        "params": [float(value) for value in params],
    }


def explore_loss(
    solve: dict[str, Any],
    priors: dict[str, Any],
    stage_index: int,
    spacing: float,
    budget: int,
    max_nfev: int,
    radius: float | None,
) -> list[dict[str, Any]]:
    point_targets, ray_targets, object_targets = build_observation_targets(solve, priors)
    initial_params = load_current_stage_params(stage_index, solve)
    center_x = snap(initial_params[0], spacing)
    center_y = snap(initial_params[1], spacing)
    fixed_roll = opt.camera_has_fixed_zero_roll(solve["camera_name"])

    samples: dict[tuple[int, int], dict[str, Any]] = {}
    expanded: set[tuple[int, int]] = set()
    heap: list[tuple[float, int, tuple[int, int]]] = []
    counter = 0

    def evaluate(cell: tuple[int, int], start_params: np.ndarray) -> None:
        nonlocal counter
        if cell in samples or len(samples) >= budget:
            return
        x = center_x + cell[0] * spacing
        y = center_y + cell[1] * spacing
        if radius is not None and math.hypot(x - center_x, y - center_y) > radius:
            return
        sample = loss_for_xy(
            x,
            y,
            start_params,
            solve,
            point_targets,
            ray_targets,
            object_targets,
            fixed_roll,
            max_nfev,
        )
        sample["grid"] = [int(cell[0]), int(cell[1])]
        samples[cell] = sample
        heapq.heappush(heap, (sample["loss"], counter, cell))
        counter += 1
        if len(samples) == 1 or len(samples) % 50 == 0:
            print(f"{len(samples):>5}/{budget} | loss {sample['loss']:.6f} | x {x:.3f} y {y:.3f}")

    evaluate((0, 0), initial_params)
    while heap and len(samples) < budget:
        _loss, _counter, cell = heapq.heappop(heap)
        if cell in expanded:
            continue
        expanded.add(cell)
        parent_params = np.asarray(samples[cell]["params"], dtype=float)
        i, j = cell
        for neighbor in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            evaluate(neighbor, parent_params)

    return sorted(samples.values(), key=lambda row: row["loss"])


def loss_color(loss: float) -> tuple[int, int, int]:
    colors = [
        (80, 220, 255),   # 0.1
        (60, 210, 90),    # 1
        (255, 220, 40),   # 10
        (230, 45, 35),    # 100
        (225, 55, 230),   # 1000
        (70, 95, 255),    # 10000
    ]
    value = math.log10(max(float(loss), 1e-12))
    left_power = math.floor(value)
    t = value - left_power
    left_color = colors[(left_power + 1) % len(colors)]
    right_color = colors[(left_power + 2) % len(colors)]
    return tuple(
        int(round(left_color[index] * (1.0 - t) + right_color[index] * t))
        for index in range(3)
    )


def world_crop(samples: list[dict[str, Any]]) -> tuple[float, float, float, float]:
    margin = 500.0
    min_x = min(float(row["x"]) for row in samples)
    max_x = max(float(row["x"]) for row in samples)
    min_y = min(float(row["y"]) for row in samples)
    max_y = max(float(row["y"]) for row in samples)
    return min_x - margin, max_x + margin, min_y - margin, max_y + margin


def crop_box_for_world(map_obj: Any, bounds: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    left, right, bottom, top = bounds
    points = [
        map_obj.get_map_xy((left, bottom)),
        map_obj.get_map_xy((left, top)),
        map_obj.get_map_xy((right, bottom)),
        map_obj.get_map_xy((right, top)),
    ]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    width, height = map_obj.image.size
    return (
        max(0, int(math.floor(min(xs)))),
        max(0, int(math.floor(min(ys)))),
        min(width, int(math.ceil(max(xs)))),
        min(height, int(math.ceil(max(ys)))),
    )


def render_loss_image(
    camera_name: str,
    samples: list[dict[str, Any]],
    spacing: float,
    map_name: str,
) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    opt.patch_missing_map_image(map_name)
    map_obj = get_map(map_name).open(scale=1.0)
    bounds = world_crop(samples)
    crop_box = crop_box_for_world(map_obj, bounds)
    image = map_obj.image.convert("RGB").crop(crop_box)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    half = max(2.0, spacing * float(md_scale(map_obj)) / 2.0)
    for row in reversed(samples):
        x, y = map_obj.get_map_xy((row["x"], row["y"]))
        x -= crop_box[0]
        y -= crop_box[1]
        color = loss_color(row["loss"])
        draw.rectangle((x - half, y - half, x + half, y + half), fill=(*color, 180))
    best = samples[0]
    bx, by = map_obj.get_map_xy((best["x"], best["y"]))
    bx -= crop_box[0]
    by -= crop_box[1]
    draw.ellipse((bx - half, by - half, bx + half, by + half), outline=(255, 255, 255, 255), width=2)
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    output = OUTPUT_DIR / f"{camera_name}.jpg"
    image.save(output, quality=90, optimize=True)
    return output


def md_scale(map_obj: Any) -> float:
    # gtamaplib maps expose world meters as map pixels through get_map_xy(); measuring it is safer
    # than relying on a private map attribute.
    x0, y0 = map_obj.get_map_xy((0.0, 0.0))
    x1, y1 = map_obj.get_map_xy((1.0, 0.0))
    return float(math.hypot(x1 - x0, y1 - y0))


def render_camera_loss(
    chain: list[str],
    stage_index: int,
    spacing: float,
    budget: int,
    max_steps: int,
    map_name: str,
    radius: float | None,
) -> Path:
    solve = opt.solve_from_chain_stage(chain[stage_index])
    priors = opt.load_optimizer_priors(stage_index, chain)
    blocked_cameras = opt.future_chain_cameras(chain, stage_index)
    opt.add_required_synthetic_priors(priors, solve, blocked_cameras)
    opt.validate_stage_order(solve, priors, blocked_cameras)

    print(f"Rendering loss landscape for {solve['camera_name']}")
    radius_text = "unbounded" if radius is None else f"{radius:g}m"
    print(f"spacing {spacing:g}m, radius {radius_text}, budget {budget}, max steps {max_steps}")
    samples = explore_loss(solve, priors, stage_index, spacing, budget, max_steps, radius)
    image_path = render_loss_image(solve["camera_name"], samples, spacing, map_name)
    best = samples[0]
    print()
    print(
        "Best loss "
        f"{best['loss']:.6f} arcmin^2 at ({best['x']:.3f}, {best['y']:.3f}) "
        f"after {len(samples)} samples."
    )
    print(f"Wrote {image_path}")
    print()
    return image_path


def main() -> None:
    parser = argparse.ArgumentParser()
    camera_group = parser.add_mutually_exclusive_group(required=True)
    camera_group.add_argument("--camera", help="Camera name or 1-based index from optimizer/chain.json")
    camera_group.add_argument("--all", action="store_true", help="Render all cameras in optimizer/chain.json.")
    parser.add_argument("--spacing", type=float, default=10.0, help="Grid spacing in meters.")
    parser.add_argument("--budget", "-n", type=int, default=1000, help="Maximum number of grid cells to solve.")
    parser.add_argument("--max-steps", type=int, default=DEFAULT_MAX_NFEV, help="Maximum function evaluations per grid cell.")
    parser.add_argument("--radius", type=float, help="Maximum XY radius in meters around the current camera position.")
    parser.add_argument("--map", default=opt.DEFAULT_RENDER_MAP_NAME, help="Map name to render.")
    args = parser.parse_args()

    opt.register_synthetic_cameras()
    chain = opt.load_chain()
    if args.all:
        for stage_index in range(len(chain)):
            render_camera_loss(chain, stage_index, args.spacing, args.budget, args.max_steps, args.map, args.radius)
    else:
        stage_index = opt.stage_index_for_id(chain, args.camera)
        render_camera_loss(chain, stage_index, args.spacing, args.budget, args.max_steps, args.map, args.radius)


if __name__ == "__main__":
    main()
