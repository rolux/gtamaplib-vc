#!/usr/bin/env python3
import json
import re
import unicodedata
import urllib.request
from urllib.error import HTTPError, URLError
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VC_ROOT = ROOT.parent
RESULT_PATH = VC_ROOT / "optimizer" / "result.json"
BASE_DATA_PATH = VC_ROOT / "data" / "gtamapdata.json"
OUTPUT_PATH = ROOT / "landmarks" / "landmarks.json"
CANDIDATES_PATH = ROOT / "landmarks" / "candidates.json"
TEXTURE_DIR = ROOT / "landmarks" / "textures"
GTADB_LANDMARKS_URL = "https://map.gtadb.org/data/6/landmarks.json"
PHOTO_URL = "https://map.gtadb.org/photos/6/{id},ig.jpg"
PHOTO_URLS = {
    "ig": "https://map.gtadb.org/photos/6/{id},ig.jpg",
    "rl": "https://map.gtadb.org/photos/6/{id},rl.jpg",
}
MIN_CANDIDATE_HEIGHT = 100.0

BUILDINGS = [
    {"name": "WDNA FM", "width": 5.0, "exact": True},
    "Opera Tower",
    "Stephen P. Clark Government Center",
    "Southeast Financial Center",
    {"name": "Kaseya Center", "width": 50.0},
    "Trésor Tower",
    "The Ritz Carlton Bal Harbour",
    "Akoya Condominium",
    "Jade Ocean Condos",
    "Portofino Tower",
    "Miami Tower",
    "Marriott Miami Biscayne Bay",
    "The Grand",
    "Y Vice City",
    {"name": "Wells Fargo Center", "photo_kinds": ["ig", "rl"]},
    "The Floridian",
    "Wheelabrator South Broward",
    "Reworld Miami-Dade",
    "US Sugar Mill",
    "Loews Miami Beach",
    "The Gates Hotel South Beach",
    "Sunset Harbour South Condo",
    "Latitude on the River",
    "1800 Club",
    "Quantum on the Bay",
    {"name": "Water Tower near Prison", "photo_id": "L280"},
    *[
        {"name": f"Prison Tower ({index})", "id": f"prison-tower-{index}", "texture": "prison-tower.svg", "width": 8.0}
        for index in range(1, 7)
    ],
    "Bank of America Financial Center",
    "Blue Diamond",
    "Green Diamond",
    "1500 Ocean Dr",
    {"name": "Continuum on South Beach (S)", "photo_id": "L61", "photo_kinds": ["ig", "rl"]},
    "W South Beach",
    "Royal Palm South Beach",
    {"name": "VCIA FAA Miami ATCT (MIA)", "match_name": "FAA Miami ATCT (MIA)", "photo_id": "L345"},
    {"name": "Park Grove Condominium (S)", "photo_id": "L253"},
    {"name": "Park Grove Condominium (C)", "photo_id": "L442"},
    {"name": "Park Grove Condominium (N)", "photo_id": "L443"},
    "Venetian Isle Condominium",
    "1000 Venetian Way",
    {"name": "Easy Hill", "shape": "pyramid"},
    {"name": "99353 Overseas Hwy", "width": 5.0},
    "102180 Overseas Hwy",
    "22 Biscayne Bay",
    "Homestead Water Tower",
    "Sebring Water Tower",
    "112 NE 41st St",
    "MIA North Terminal Tower",
    "1500 Sonora Ave",
    "1111 Lincoln Rd",
    "Capri South Beach",
    "The Tides South Beach",
    {"name": "Port Gellhorn Smokestack", "photo_id": "L302", "width": 5.0},
    "Old City Hall",
    {"name": "Asia Brickell Key", "width": 5.0},
    "Three Tequesta Point",
    "One Miami Condominium West",
    "One Miami Condominium East",
    {"name": "Vizcayne North Condominium", "photo_kinds": ["ig", "rl"]},
    "Marina Blue",
    "Infinity at Brickell",
    "Two Tequesta Point",
    "Icon at South Beach",
    "Citigroup Center",
    "50 Biscayne Blvd",
    {"name": "Ten Museum Park", "photo_kinds": ["ig", "rl"]},
    "InterContinental Miami",
    "Murano Grande",
    {"name": "Loft Downtown II", "photo_kinds": ["ig", "rl"]},
    {"name": "Carbonell Brickell", "photo_kinds": ["ig", "rl"]},
    {"name": "The Crimson", "width": 5.0},
    "Nine at Mary Brickell Village",
    "New Wave Condominiums",
    "The Waverly South Beach",
    {"name": "Pelican Harbor Radio Tower", "width": 5.0, "photo_kinds": ["ig", "rl"]},
    {"name": "Palazzo del Sol", "photo_kinds": ["ig", "rl"]},
    "Sherry Frontenac Oceanfront Hotel",
    "St. Moritz Hotel",
    "Uptown Lofts",
    {"name": "Knight Concert Hall", "width": 50.0},
    "New World Center",
    "Office in the Grove",
    {"name": "Mount Waffles", "shape": "pyramid"},
    {"name": "Mount Mountain", "shape": "pyramid"},
]
DEFAULT_WIDTH = 25.0
CURATED_SKIP_REASONS = {
    "Mount Waffles": "special pyramid candidate",
    "Easy Hill": "special pyramid candidate",
    "Ambrosia Hill": "curated skip",
    "Radio Tower": "curated skip",
    "Flamingo South Beach": "curated skip",
    "Sunshine Skyway Bridge": "special object",
    "Four Seasons Hotel Miami": "special object",
}


def read_json(path):
    return json.loads(path.read_text())


def base_landmarks():
    data = read_json(BASE_DATA_PATH)
    return {item["name"]: item["xyz"] for item in data.get("landmarks", []) if item.get("xyz")}


def result_landmarks():
    if not RESULT_PATH.exists():
        return {}
    return read_json(RESULT_PATH).get("landmarks", {})


def normalize(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def building_spec(item):
    if isinstance(item, str):
        return {"name": item}
    return dict(item)


def building_matches(name, landmarks, exact=False):
    target = normalize(name)
    matches = []
    for landmark_name, xyz in landmarks.items():
        current = normalize(landmark_name)
        if current == target or (not exact and current.startswith(f"{target} ")):
            matches.append((landmark_name, xyz))
    return sorted(matches)


def base_name(name):
    previous = None
    current = name
    while previous != current:
        previous = current
        current = re.sub(r"\s+\([^)]*\)$", "", current)
    return current


def midpoint(points):
    return [
        sum(float(point[index]) for point in points) / len(points)
        for index in range(3)
    ]


def download_json(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def gtadb_photo_ids():
    data = download_json(GTADB_LANDMARKS_URL)
    items = data.items() if isinstance(data, dict) else ((item.get("id"), item) for item in data)
    result = {}
    for landmark_id, item in items:
        if not landmark_id:
            continue
        if isinstance(item, dict):
            name = item.get("name")
        elif isinstance(item, list):
            address = item[3] if len(item) > 3 and isinstance(item[3], str) else ""
            name = address.split(",", 1)[0] if address else item[0]
        else:
            name = None
        if name:
            result.setdefault(normalize(name), []).append(str(landmark_id))
    return result


def candidate_photo_ids_for(name, photo_ids):
    target = normalize(name)
    if target in photo_ids:
        return photo_ids[target]
    return [
        landmark_id
        for key, landmark_ids in photo_ids.items()
        if key == target or key.startswith(f"{target} ")
        for landmark_id in landmark_ids
    ]


def photo_ids_for(name, photo_ids):
    target = normalize(name)
    if target in photo_ids:
        return photo_ids[target]
    candidates = [(key, landmark_ids) for key, landmark_ids in photo_ids.items() if key == target or key.startswith(f"{target} ")]
    if candidates:
        result = []
        for _, landmark_ids in candidates:
            result.extend(landmark_ids)
        return result
    print(f"Skipping {name}: no GTADB photo ID")
    return []


def download(url, path):
    if path.exists() and path.stat().st_size:
        print(f"Found {path}")
        return True
    print(f"Downloading {url} -> {path}")
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            path.write_bytes(response.read())
    except HTTPError as error:
        print(f"Missing {url}: HTTP {error.code}")
        return False
    except URLError as error:
        print(f"Missing {url}: {error.reason}")
        return False
    return True


def build_candidates(known, photo_ids, generated_names):
    groups = {}
    for landmark_name, xyz in known.items():
        if not xyz or float(xyz[2]) < MIN_CANDIDATE_HEIGHT:
            continue
        group_name = base_name(landmark_name)
        groups.setdefault(group_name, []).append((landmark_name, xyz))
    candidates = []
    for group_name, matches in groups.items():
        points = [xyz for _, xyz in matches]
        center = midpoint(points)
        max_height = max(float(point[2]) for point in points)
        candidates.append({
            "name": group_name,
            "max_height": round(max_height, 6),
            "xyz": [round(float(value), 6) for value in center],
            "source_points": [landmark_name for landmark_name, _ in matches],
            "gtadb_photo_ids": candidate_photo_ids_for(group_name, photo_ids),
            "generated": group_name in generated_names,
            "skip_reason": CURATED_SKIP_REASONS.get(group_name),
        })
    candidates.sort(key=lambda item: (-item["max_height"], item["name"]))
    return {
        "schema": "gtamaplib-vvc-landmark-candidates-v1",
        "min_height": MIN_CANDIDATE_HEIGHT,
        "candidates": candidates,
    }


def main():
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    known = base_landmarks()
    known.update(result_landmarks())
    photo_ids = gtadb_photo_ids()
    output = {
        "schema": "gtamaplib-vvc-landmarks-v1",
        "landmarks": [],
        "skipped": [],
        "fallbacks": [],
    }
    for item in BUILDINGS:
        spec = building_spec(item)
        name = spec["name"]
        matches = building_matches(spec.get("match_name", name), known, spec.get("exact", False))
        if not matches:
            print(f"Skipping {name}: no GTA MapLib XYZ")
            output["skipped"].append({"name": name, "reason": "no GTA MapLib XYZ", "match_name": spec.get("match_name", name)})
            continue
        xyz = midpoint([xyz for _, xyz in matches])
        photo_id = None
        texture_name = None
        photo_kind = None
        if spec.get("texture"):
            photo_id = spec.get("id", normalize(name).replace(" ", "-"))
            texture_name = spec["texture"]
            photo_kind = "procedural"
        else:
            candidate_photo_ids = [spec["photo_id"]] if spec.get("photo_id") else photo_ids_for(name, photo_ids)
            if not candidate_photo_ids:
                output["skipped"].append({"name": name, "reason": "no GTADB photo ID"})
                continue
            photo_kinds = spec.get("photo_kinds", ["ig"])
            for candidate_photo_id in candidate_photo_ids:
                for candidate_photo_kind in photo_kinds:
                    candidate_texture_name = f"{candidate_photo_id},{candidate_photo_kind}.jpg"
                    texture_path = TEXTURE_DIR / candidate_texture_name
                    if download(PHOTO_URLS[candidate_photo_kind].format(id=candidate_photo_id), texture_path):
                        photo_id = candidate_photo_id
                        texture_name = candidate_texture_name
                        photo_kind = candidate_photo_kind
                        break
                if photo_id:
                    break
            if not photo_id:
                print(f"Skipping {name}: no downloadable in-game photo")
                output["skipped"].append({
                    "name": name,
                    "reason": "no downloadable photo",
                    "gtadb_photo_ids": candidate_photo_ids,
                    "photo_kinds": photo_kinds,
                    "source_points": [landmark_name for landmark_name, _ in matches],
                })
                continue
        if photo_kind not in ("ig", "procedural"):
            output["fallbacks"].append({
                "name": name,
                "id": photo_id,
                "photo_kind": photo_kind,
                "reason": "in-game photo unavailable",
            })
        output["landmarks"].append({
            "name": name,
            "id": photo_id,
            "photo_kind": photo_kind,
            "xyz": [round(float(value), 6) for value in xyz],
            "shape": spec.get("shape", "box"),
            "width": spec.get("width", round(float(xyz[2]) * 2, 6) if spec.get("shape") == "pyramid" else DEFAULT_WIDTH),
            "height": round(float(xyz[2]), 6),
            "texture": f"landmarks/textures/{texture_name}",
            "faces": ["north", "east", "south", "west"],
            "source_points": [landmark_name for landmark_name, _ in matches],
        })
    OUTPUT_PATH.write_text(json.dumps(output, indent=2) + "\n")
    generated_names = {item["name"] for item in output["landmarks"]}
    CANDIDATES_PATH.write_text(json.dumps(build_candidates(known, photo_ids, generated_names), indent=2) + "\n")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Wrote {CANDIDATES_PATH}")


if __name__ == "__main__":
    main()
