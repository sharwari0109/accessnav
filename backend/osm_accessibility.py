
import os
import json
import hashlib
import threading
import requests

from datetime import datetime, timezone
from typing import Any, Dict, List


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "osm_cache")

os.makedirs(CACHE_DIR, exist_ok=True)

# Cache remains fresh for 24 hours.
CACHE_TTL_SECONDS = 24 * 60 * 60

# Prevent multiple simultaneous refreshes.
CACHE_LOCK = threading.Lock()


# --------------------------------------------------
# OPENSTREETMAP QUERY
# --------------------------------------------------

OVERPASS_QUERY = """
[out:json][timeout:20];
(
  node["ramp"="yes"](around:{radius},{latitude},{longitude});
  way["ramp"="yes"](around:{radius},{latitude},{longitude});

  node["ramp:wheelchair"="yes"](around:{radius},{latitude},{longitude});
  way["ramp:wheelchair"="yes"](around:{radius},{latitude},{longitude});

  node["highway"="steps"](around:{radius},{latitude},{longitude});
  way["highway"="steps"](around:{radius},{latitude},{longitude});

  node["elevator"="yes"](around:{radius},{latitude},{longitude});
  way["elevator"="yes"](around:{radius},{latitude},{longitude});

  way["incline"](around:{radius},{latitude},{longitude});

  node["wheelchair"="yes"](around:{radius},{latitude},{longitude});
  way["wheelchair"="yes"](around:{radius},{latitude},{longitude});
);
out center;
"""


# --------------------------------------------------
# CACHE FUNCTIONS
# --------------------------------------------------

def get_cache_path(
    latitude: float,
    longitude: float,
    radius: int,
) -> str:

    cache_key = (
        f"{round(latitude, 4)}_"
        f"{round(longitude, 4)}_"
        f"{radius}"
    )

    filename = hashlib.md5(
        cache_key.encode("utf-8")
    ).hexdigest() + ".json"

    return os.path.join(CACHE_DIR, filename)


def load_cached_points(cache_path: str):

    if not os.path.exists(cache_path):
        return None

    try:
        with open(cache_path, "r", encoding="utf-8") as file:
            cached_data = json.load(file)

        points = cached_data.get("points")

        if isinstance(points, list):
            print(
                "Using previously saved OpenStreetMap data. "
                f"Found {len(points)} points."
            )
            return points

    except (OSError, json.JSONDecodeError) as error:
        print(f"Could not read OSM cache: {error}")

    return None


def is_cache_fresh(cache_path: str) -> bool:

    if not os.path.exists(cache_path):
        return False

    try:
        with open(cache_path, "r", encoding="utf-8") as file:
            cached_data = json.load(file)

        saved_at = cached_data.get("saved_at")

        if not saved_at:
            return False

        saved_time = datetime.fromisoformat(saved_at)

        if saved_time.tzinfo is None:
            saved_time = saved_time.replace(tzinfo=timezone.utc)

        age_seconds = (
            datetime.now(timezone.utc) - saved_time
        ).total_seconds()

        return 0 <= age_seconds < CACHE_TTL_SECONDS

    except (OSError, json.JSONDecodeError, ValueError, TypeError):
        return False


def save_cached_points(
    cache_path: str,
    points: List[Dict[str, Any]],
):

    temporary_path = cache_path + ".tmp"

    try:
        cached_data = {
            "saved_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "source": "OpenStreetMap",
            "points": points,
        }

        with open(
            temporary_path,
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                cached_data,
                file,
                ensure_ascii=False,
                indent=2,
            )

        os.replace(temporary_path, cache_path)

        print("OpenStreetMap data saved to local cache.")

    except OSError as error:
        print(f"Could not save OSM cache: {error}")

        if os.path.exists(temporary_path):
            try:
                os.remove(temporary_path)
            except OSError:
                pass


# --------------------------------------------------
# ACCESSIBILITY CLASSIFICATION
# --------------------------------------------------

def classify_osm_element(tags: Dict[str, Any]):

    if tags.get("highway") == "steps":
        return (
            "stairs",
            tags.get("name", "Stairs"),
            "Mapped steps or stairs. Check before using this route.",
        )

    if (
        tags.get("elevator") == "yes"
        or tags.get("highway") == "elevator"
    ):
        return (
            "elevator",
            tags.get("name", "Elevator"),
            "Elevator mapped in OpenStreetMap. Verify that it is operational.",
        )

    if (
        tags.get("ramp") == "yes"
        or tags.get("ramp:wheelchair") == "yes"
    ):
        return (
            "ramp",
            tags.get("name", "Accessible ramp"),
            "Ramp mapped in OpenStreetMap.",
        )

    if tags.get("incline"):
        incline = str(tags.get("incline"))

        return (
            "slope",
            tags.get("name", "Mapped incline"),
            f"Incline information mapped in OpenStreetMap: {incline}.",
        )

    if tags.get("wheelchair") == "yes":
        return (
            "wheelchair_accessible",
            tags.get("name", "Wheelchair-accessible location"),
            "Location marked wheelchair accessible in OpenStreetMap. This does not confirm a specific ramp or elevator.",
        )

    return None


# --------------------------------------------------
# FETCH OPENSTREETMAP DATA
# --------------------------------------------------

def fetch_osm_points(
    latitude: float,
    longitude: float,
    radius: int,
    query: str,
) -> List[Dict[str, Any]]:

    errors = []

    session = requests.Session()

    session.headers.update({
        "User-Agent": (
            "ACCESSNAV/1.0 "
            "(accessibility navigation project)"
        ),
        "Accept": "application/json",
    })

    try:
        for server in OVERPASS_SERVERS:

            try:
                print(
                    f"Trying OpenStreetMap server: {server}"
                )

                response = session.post(
                    server,
                    data={"data": query},
                    timeout=(4, 20),
                )

                response.raise_for_status()

                data = response.json()

                points = []

                for element in data.get("elements", []):

                    tags = element.get("tags", {})

                    lat = element.get("lat")
                    lon = element.get("lon")

                    if lat is None or lon is None:
                        center = element.get("center", {})
                        lat = center.get("lat")
                        lon = center.get("lon")

                    if lat is None or lon is None:
                        continue

                    classification = classify_osm_element(tags)

                    if classification is None:
                        continue

                    point_type, name, description = classification

                    points.append({
                        "id": (
                            f"osm-{element.get('type')}-"
                            f"{element.get('id')}"
                        ),
                        "osmId": element.get("id"),
                        "osmType": element.get("type"),
                        "type": point_type,
                        "name": name,
                        "latitude": lat,
                        "longitude": lon,
                        "description": description,
                        "source": "OpenStreetMap",
                        "tags": tags,
                    })

                print(
                    "OpenStreetMap data retrieved successfully. "
                    f"Found {len(points)} points."
                )

                return points

            except (
                requests.exceptions.RequestException,
                ValueError,
            ) as error:

                error_message = f"{server}: {str(error)}"
                errors.append(error_message)

                print(f"Server failed: {error_message}")

    finally:
        session.close()

    raise requests.exceptions.RequestException(
        "All OpenStreetMap servers failed. "
        + " | ".join(errors)
    )


# --------------------------------------------------
# MAIN ACCESSIBILITY DATA FUNCTION
# --------------------------------------------------

def get_osm_accessibility_points(
    latitude: float,
    longitude: float,
    radius: int = 1000,
) -> List[Dict[str, Any]]:

    if not -90 <= latitude <= 90:
        raise ValueError("Invalid latitude")

    if not -180 <= longitude <= 180:
        raise ValueError("Invalid longitude")

    radius = max(100, min(radius, 5000))

    cache_path = get_cache_path(
        latitude,
        longitude,
        radius,
    )

    # STEP 1: Return fresh cache immediately.
    if is_cache_fresh(cache_path):

        cached_points = load_cached_points(cache_path)

        if cached_points is not None:
            print("OSM cache is fresh. Skipping Overpass request.")
            return cached_points

    # STEP 2: Lock refresh to avoid duplicate requests.
    with CACHE_LOCK:

        # Another request may have refreshed the cache
        # while this request was waiting for the lock.
        if is_cache_fresh(cache_path):

            cached_points = load_cached_points(cache_path)

            if cached_points is not None:
                print("OSM cache was refreshed by another request.")
                return cached_points

        # STEP 3: Prepare Overpass query.
        query = OVERPASS_QUERY.format(
            radius=radius,
            latitude=latitude,
            longitude=longitude,
        )

        # STEP 4: Fetch new data.
        try:

            points = fetch_osm_points(
                latitude,
                longitude,
                radius,
                query,
            )

            # Save successful results.
            save_cached_points(
                cache_path,
                points,
            )

            return points

        except requests.exceptions.RequestException as error:

            print(f"All Overpass servers failed: {error}")

            # STEP 5: Use old cache if available.
            cached_points = load_cached_points(cache_path)

            if cached_points is not None:
                print(
                    "Using older cached OSM data as fallback."
                )
                return cached_points

            raise
