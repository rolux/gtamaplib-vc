#!/usr/bin/env python3

import argparse
import json
import math
from contextlib import contextmanager
from pathlib import Path

from gtamaplib import gtamapdata as md
from gtamaplib.gtamaplib import Camera, get_camera, get_map, get_point


OUTPUT_DIR = Path("optimizer/renders/projections")
OPTIMIZER_RESULT_PATH = Path("optimizer/result.json")
MAP_NAME = "yanis"
DEFAULT_DISTANCE = 10000.0
DEFAULT_MARGIN = 500.0
DEFAULT_OPACITY = 0.5
DEFAULT_MAP_OPACITY = 1.0
DEFAULT_SIZE = (3840, 2160)


def output_path(filename):
    path = Path(filename)
    if path.is_absolute() or path.name != filename:
        raise ValueError("output must be a filename, not a path")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR / filename


def world_snapshot_cameras(path):
    data = json.loads(path.read_text())
    if data.get("schema") != "gtamaplibvc-world-v1":
        return None
    cameras = {}
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


@contextmanager
def using_optimizer_result():
    if not OPTIMIZER_RESULT_PATH.exists():
        yield
        return
    cameras = world_snapshot_cameras(OPTIMIZER_RESULT_PATH)
    if not cameras:
        yield
        return
    original_cameras = md.cameras
    md.cameras = cameras
    get_camera.cache_clear()
    try:
        print(f"Using {OPTIMIZER_RESULT_PATH}")
        yield
    finally:
        md.cameras = original_cameras
        get_camera.cache_clear()


def edge_ray_points(camera_names, distance):
    points = []
    for camera_name in camera_names:
        cam = get_camera(camera_name)
        points.append(cam.xyz)
        for pixel in ((0, cam.h / 2), (cam.w, cam.h / 2)):
            points.append(get_point(cam.xyz, cam.get_pixel_direction(pixel), distance))
    return points


def projection_area(camera_names, distance, margin):
    points = edge_ray_points(camera_names, distance)
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (
        math.floor(min(xs) - margin),
        math.floor(min(ys) - margin),
        math.ceil(max(xs) + margin),
        math.ceil(max(ys) + margin),
    )


def clamp_area_to_map(area, m):
    map_corners = [
        m.get_world_xy((0, 0)),
        m.get_world_xy((m.size[0], 0)),
        m.get_world_xy((0, m.size[1])),
        m.get_world_xy(m.size),
    ]
    map_xs = [xy[0] for xy in map_corners]
    map_ys = [xy[1] for xy in map_corners]
    map_x_min, map_x_max = min(map_xs), max(map_xs)
    map_y_min, map_y_max = min(map_ys), max(map_ys)

    def clamp(value, low, high):
        return min(max(value, low), high)

    x_min = clamp(area[0], math.floor(map_x_min), math.ceil(map_x_max))
    y_min = clamp(area[1], math.floor(map_y_min), math.ceil(map_y_max))
    x_max = clamp(area[2], math.floor(map_x_min), math.ceil(map_x_max))
    y_max = clamp(area[3], math.floor(map_y_min), math.ceil(map_y_max))

    if x_min == x_max:
        if x_min <= math.floor(map_x_min):
            x_max = min(math.ceil(map_x_max), x_min + 1)
        else:
            x_min = max(math.floor(map_x_min), x_max - 1)
    if y_min == y_max:
        if y_min <= math.floor(map_y_min):
            y_max = min(math.ceil(map_y_max), y_min + 1)
        else:
            y_min = max(math.floor(map_y_min), y_max - 1)

    return (x_min, y_min, x_max, y_max)


def cam_onto_map(args):
    out = output_path(args.output)
    m = get_map(MAP_NAME).open()
    area = clamp_area_to_map(
        projection_area(args.cameras, args.distance, args.margin),
        m,
    )
    m.project_camera_parallel(
        args.cameras,
        area=area,
        r=(0, args.distance),
    ).save(out, crop=area)


def map_into_cam(args):
    out = output_path(args.output)
    get_camera(args.camera).open(scale=1).project_map(
        MAP_NAME,
        opacity=args.opacity,
    ).save(out)


def cam_into_cam(args):
    out = output_path(args.output)
    get_camera(args.target_camera).open(scale=1).project_camera(
        args.source_camera,
        opacity=args.opacity,
    ).save(out)


def project_map(args):
    out = output_path(args.output)
    camera = Camera(
        id="X",
        name="synthetic cam",
        player=None,
        xyz=(args.x, args.y, args.z),
        ypr=(args.yaw, args.pitch, args.roll),
        fov=(args.hfov, None),
        size=tuple(args.size),
        source="",
    )
    camera.open(scale=1).project_map(
        MAP_NAME,
        opacity=args.opacity,
    ).save(out)


def positive_float(value):
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def opacity_float(value):
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def build_parser():
    parser = argparse.ArgumentParser(
        description="Render gtamaplib projection images into optimizer/renders/projections/."
    )
    subparsers = parser.add_subparsers(dest="operation", required=True)

    onto_map = subparsers.add_parser(
        "cam-onto-map",
        help="project one or more camera images onto the map",
    )
    onto_map.add_argument("cameras", nargs="+", help="camera names, in projection order")
    onto_map.add_argument("--output", required=True, help="output filename")
    onto_map.add_argument(
        "--distance",
        type=positive_float,
        default=DEFAULT_DISTANCE,
        help=f"projection distance in meters (default: {DEFAULT_DISTANCE:g})",
    )
    onto_map.add_argument(
        "--margin",
        type=positive_float,
        default=DEFAULT_MARGIN,
        help=f"map crop margin in meters (default: {DEFAULT_MARGIN:g})",
    )
    onto_map.set_defaults(func=cam_onto_map)

    map_cam = subparsers.add_parser(
        "map-into-cam",
        help="project the map into a camera image",
    )
    map_cam.add_argument("camera", help="target camera name")
    map_cam.add_argument("--output", required=True, help="output filename")
    map_cam.add_argument(
        "--opacity",
        type=opacity_float,
        default=DEFAULT_OPACITY,
        help=f"overlay opacity from 0 to 1 (default: {DEFAULT_OPACITY:g})",
    )
    map_cam.set_defaults(func=map_into_cam)

    cam_cam = subparsers.add_parser(
        "cam-into-cam",
        help="project one camera image into another camera image",
    )
    cam_cam.add_argument("target_camera", help="camera to render into")
    cam_cam.add_argument("source_camera", help="camera image to project")
    cam_cam.add_argument("--output", required=True, help="output filename")
    cam_cam.add_argument(
        "--opacity",
        type=opacity_float,
        default=DEFAULT_OPACITY,
        help=f"overlay opacity from 0 to 1 (default: {DEFAULT_OPACITY:g})",
    )
    cam_cam.set_defaults(func=cam_into_cam)

    projected_map = subparsers.add_parser(
        "map",
        help="project the map from an arbitrary camera pose",
    )
    projected_map.add_argument("x", type=float, help="camera x coordinate")
    projected_map.add_argument("y", type=float, help="camera y coordinate")
    projected_map.add_argument("z", type=float, help="camera z coordinate")
    projected_map.add_argument("yaw", type=float, help="camera yaw in degrees")
    projected_map.add_argument("pitch", type=float, help="camera pitch in degrees")
    projected_map.add_argument("roll", type=float, help="camera roll in degrees")
    projected_map.add_argument("hfov", type=positive_float, help="horizontal FOV in degrees")
    projected_map.add_argument("--output", required=True, help="output filename")
    projected_map.add_argument(
        "--opacity",
        type=opacity_float,
        default=DEFAULT_MAP_OPACITY,
        help=f"overlay opacity from 0 to 1 (default: {DEFAULT_MAP_OPACITY:g})",
    )
    projected_map.add_argument(
        "--size",
        type=int,
        nargs=2,
        metavar=("WIDTH", "HEIGHT"),
        default=DEFAULT_SIZE,
        help=f"output camera size (default: {DEFAULT_SIZE[0]} {DEFAULT_SIZE[1]})",
    )
    projected_map.set_defaults(func=project_map)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        with using_optimizer_result():
            args.func(args)
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
