import os
import uuid
import math
import requests
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load backend/.env before reading environment variables such as SECRET_KEY.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, Field
from jose import jwt, JWTError
from passlib.context import CryptContext

from data import NAV_STATES, REPORT_OPTIONS, ROUTES
from osm_accessibility import get_osm_accessibility_points
from database import (
    places_collection,
    saved_collection,
    reports_collection,
    users_collection,
    emergency_contacts_collection,
    sos_alerts_collection,
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AccessNav API",
    description="Backend API for the AccessMob accessibility navigation app",
    version="1.1.0",
)


# ============================================================
# CORS
# ============================================================

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://majorr.netlify.app",
    "https://sweet-elf-444cda.netlify.app",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AUTHENTICATION CONFIGURATION
# ============================================================

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set")

ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

security = HTTPBearer()


# ============================================================
# REQUEST MODELS
# ============================================================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ReportRequest(BaseModel):
    placeId: Optional[str] = None
    placeName: str = Field(..., min_length=1)
    latitude: float
    longitude: float
    reportType: str
    description: str = ""


class EmergencyContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=7, max_length=20)
    relationship: str = Field(default="", max_length=40)


class SOSAlertRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)

# ============================================================
# ACCESSIBILITY MODELS
# ============================================================


class AccessibilityRequest(BaseModel):
    mode: str = Field(
        default="wheelchair",
        description="wheelchair or lowvision"
    )

    preferences: List[str] = Field(
        default_factory=list,
        description="Accessibility preferences"
    )

    routeCoordinates: List[List[float]] = Field(
        default_factory=list,
        description="OSRM route coordinates in longitude, latitude format"
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180
    )



class AccessibilityPoint(BaseModel):
    """
    Represents an accessibility feature around a location.
    """

    type: str
    name: str
    latitude: float
    longitude: float
    description: str = ""
    available: bool = True


# ============================================================
# AUTHENTICATION HELPERS
# ============================================================

def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
):
    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(user_id: str):
    token_data = {
        "user_id": user_id,
    }

    return jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user = users_collection.find_one(
        {"id": user_id},
        {
            "_id": 0,
            "password": 0,
        },
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "message": "AccessMob Backend is running",
        "version": "1.1.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }

# ============================================================
# EMERGENCY CONTACTS
# ============================================================

@app.get("/api/emergency-contacts")
def get_emergency_contacts(
    current_user: dict = Depends(get_current_user),
):
    contacts = list(
        emergency_contacts_collection.find(
            {"user_id": current_user["id"]},
            {
                "_id": 0,
                "user_id": 0,
            },
        )
    )

    return {"contacts": contacts}


@app.post("/api/emergency-contacts")
def add_emergency_contact(
    contact: EmergencyContactRequest,
    current_user: dict = Depends(get_current_user),
):
    name = contact.name.strip()
    phone = contact.phone.strip()

    if not name or not phone:
        raise HTTPException(
            status_code=400,
            detail="Name and phone number are required",
        )

    existing = emergency_contacts_collection.find_one(
        {
            "user_id": current_user["id"],
            "phone": phone,
        }
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="This emergency contact already exists",
        )

    new_contact = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "name": name,
        "phone": phone,
        "relationship": contact.relationship.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    emergency_contacts_collection.insert_one(new_contact)

    return {
        "message": "Emergency contact added successfully",
        "contact": {
    key: value
    for key, value in new_contact.items()
    if key not in ("user_id", "_id")
},
    }


@app.delete("/api/emergency-contacts/{contact_id}")
def delete_emergency_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user),
):
    result = emergency_contacts_collection.delete_one(
        {
            "id": contact_id,
            "user_id": current_user["id"],
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Emergency contact not found",
        )

    return {
        "message": "Emergency contact deleted successfully"
    }

# ============================================================
# SOS ACTIVATION
# ============================================================

@app.post("/api/sos/activate")
def activate_sos(
    alert: SOSAlertRequest,
    current_user: dict = Depends(get_current_user),
):
    contacts = list(
        emergency_contacts_collection.find(
            {"user_id": current_user["id"]},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "phone": 1,
            },
        )
    )

    alert_id = str(uuid.uuid4())

    maps_url = (
        f"https://www.google.com/maps?q="
        f"{alert.latitude},{alert.longitude}"
    )

    new_alert = {
        "id": alert_id,
        "user_id": current_user["id"],
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "accuracy": alert.accuracy,
        "maps_url": maps_url,
        "contacts": contacts,
        "notification_status": "not_configured",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    sos_alerts_collection.insert_one(new_alert)

    return {
        "message": "SOS alert recorded successfully",
        "alert_id": alert_id,
        "location": {
            "latitude": alert.latitude,
            "longitude": alert.longitude,
            "maps_url": maps_url,
        },
        "contacts_count": len(contacts),
        "notification_status": "not_configured",
        "notifications_sent": False,
    }

# ============================================================
# AUTHENTICATION
# ============================================================

@app.post("/api/auth/register")
def register(user: RegisterRequest):

    existing_user = users_collection.find_one(
        {
            "email": user.email.lower()
        }
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    import uuid

    user_id = str(uuid.uuid4())

    hashed_password = hash_password(
        user.password
    )

    new_user = {
        "id": user_id,
        "name": user.name,
        "email": user.email.lower(),
        "password": hashed_password,
    }

    users_collection.insert_one(
        new_user
    )

    return {
        "message": "Registration successful",
        "user": {
            "id": user_id,
            "name": user.name,
            "email": user.email.lower(),
        },
    }


@app.post("/api/auth/login")
def login(user: LoginRequest):

    existing_user = users_collection.find_one(
        {
            "email": user.email.lower()
        }
    )

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    password_correct = verify_password(
        user.password,
        existing_user["password"],
    )

    if not password_correct:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        existing_user["id"]
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": existing_user["id"],
            "name": existing_user["name"],
            "email": existing_user["email"],
        },
    }


@app.get("/api/auth/me")
def get_me(
    current_user=Depends(get_current_user),
):
    return current_user


# ============================================================
# PLACES
# ============================================================

@app.get("/api/places")
def get_places():

    places = list(
        places_collection.find(
            {},
            {"_id": 0},
        )
    )

    return places


@app.get("/api/places/{place_id}")
def get_place(place_id: str):

    place = places_collection.find_one(
        {
            "id": place_id
        },
        {
            "_id": 0
        },
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    return place


# ============================================================
# PLACE ACCESSIBILITY INFORMATION
# ============================================================

@app.get("/api/places/{place_id}/accessibility")
def get_place_accessibility(place_id: str):

    place = places_collection.find_one(
        {
            "id": place_id
        },
        {
            "_id": 0,
        },
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    tags = place.get("tags", [])
    warnings = place.get("warnings", [])

    wheelchair_features = []

    lowvision_features = []

    # --------------------------------------------------------
    # Wheelchair features
    # --------------------------------------------------------

    wheelchair_keywords = [
        "Step-free entrance",
        "Ramps available",
        "Ramps",
        "Elevators available",
        "Elevator available",
        "Accessible shuttle",
        "Smooth sidewalks",
        "Smooth sidewalk",
        "Accessible restrooms",
    ]

    for tag in tags:
        if tag in wheelchair_keywords:
            wheelchair_features.append(tag)

    # --------------------------------------------------------
    # Low vision features
    # --------------------------------------------------------

    lowvision_keywords = [
        "Smooth sidewalks",
        "Smooth sidewalk",
        "Clear crossings",
        "Better visibility",
    ]

    for tag in tags:
        if tag in lowvision_keywords:
            lowvision_features.append(tag)

    # --------------------------------------------------------
    # Warning classification
    # --------------------------------------------------------

    accessibility_warnings = []

    for warning in warnings:
        accessibility_warnings.append({
            "text": warning,
            "severity": "warning",
        })

    # --------------------------------------------------------
    # Score
    # --------------------------------------------------------

    has_accessibility_data = bool(
        wheelchair_features
        or lowvision_features
        or accessibility_warnings
    )

    score = place.get("score") if has_accessibility_data else None

    return {
        "placeId": place_id,
        "name": place.get("name"),
        "modeSupport": {
            "wheelchair": {
                "score": score,
                "features": wheelchair_features,
                "warnings": accessibility_warnings,
            },
            "lowvision": {
                "score": score,
                "features": lowvision_features,
                "warnings": accessibility_warnings,
            },
        },
    }

    # No stored evidence means no generated accessibility routes.
    if not tags and not warnings:
        return []

    features = (
        [{"text": tag, "ok": True} for tag in tags]
        + [{"text": warning, "ok": False} for warning in warnings]
    )

    route = {
        "id": "stored-accessibility",
        "title": "Accessibility information",
        "features": features,
    }

    analysis = analyze_route_for_accessibility(
        route=route,
        place=place,
        mode=mode,
        preferences=preferences,
    )

    # Do not show a route if none of its information applies
    # to the selected accessibility mode.
    if not (
        analysis["positiveFeatures"]
        or analysis["negativeFeatures"]
    ):
        return []

    return [{
        **route,
        "accessibility": analysis,
    }]


def analyze_route_for_accessibility(
    route: Dict[str, Any],
    place: Optional[Dict[str, Any]],
    mode: str,
    preferences: List[str],
):
    """
    Report only explicitly recorded accessibility features
    and obstacles. Absence of information is not proof of access.
    """

    mode = normalize_mode(mode)

    route_features = route.get("features") or []

    positive_features = []
    negative_features = []

    for feature in route_features:
        if not isinstance(feature, dict):
            continue

        text = str(feature.get("text", "")).strip()

        if not text:
            continue

        if feature.get("ok") is True:
            positive_features.append(text)
        elif feature.get("ok") is False:
            negative_features.append(text)

    place_tags = place.get("tags") or [] if place else []
    place_warnings = place.get("warnings") or [] if place else []

    if mode == "wheelchair":
        positive_keywords = (
            "ramp", "elevator", "step-free", "wheelchair",
            "smooth sidewalk", "accessible restroom",
            "accessible entrance", "accessible shuttle",
        )
        negative_keywords = (
            "stairs", "uneven sidewalk", "broken ramp",
            "steep slope", "inaccessible",
        )
    else:
        positive_keywords = (
            "clear crossing", "better visibility",
            "smooth sidewalk", "tactile paving",
            "audio signal", "audible signal",
        )
        negative_keywords = (
            "busy crossing", "busy road", "crowded crossing",
            "long crossing", "complicated intersection",
            "obstacles", "poor visibility",
        )

    # Add only place tags relevant to the selected mode.
    for tag in place_tags:
        text = str(tag).strip()
        lowered = text.lower()

        if any(word in lowered for word in positive_keywords):
            if text not in positive_features:
                positive_features.append(text)

        elif any(word in lowered for word in negative_keywords):
            if text not in negative_features:
                negative_features.append(text)

    # Add only relevant recorded warnings.
    relevant_warnings = []

    for warning in place_warnings:
        text = str(warning).strip()
        lowered = text.lower()

        if any(word in lowered for word in negative_keywords):
            if text not in negative_features:
                negative_features.append(text)

            relevant_warnings.append(text)

    # Preferences are included only when matching evidence exists.
    preference_matches = []

    combined_positive = " ".join(positive_features).lower()
    combined_negative = " ".join(negative_features).lower()

    for preference in preferences:
        normalized = preference.lower().strip()
        status = None

        if "ramp" in normalized and "ramp" in combined_positive:
            status = "supported"

        elif "elevator" in normalized and "elevator" in combined_positive:
            status = "supported"

        elif "stair" in normalized and "stair" in combined_negative:
            status = "warning"

        elif (
            ("crossing" in normalized or "visibility" in normalized)
            and any(
                word in combined_positive
                for word in ("crossing", "visibility")
            )
        ):
            status = "supported"

        elif (
            ("crossing" in normalized or "visibility" in normalized)
            and any(
                word in combined_negative
                for word in ("crossing", "visibility")
            )
        ):
            status = "warning"

        # Do not append unknown or unsupported guesses.
        if status:
            preference_matches.append({
                "preference": preference,
                "status": status,
            })

    has_positive = bool(positive_features)
    has_negative = bool(negative_features)

    if has_positive and has_negative:
        summary = "Recorded accessibility features and potential obstacles were found."
    elif has_positive:
        summary = "Recorded accessibility features were found."
    elif has_negative:
        summary = "Recorded potential accessibility obstacles were found."
    else:
        summary = ""

    return {
        "score": None,
        "summary": summary,
        "positiveFeatures": positive_features,
        "negativeFeatures": negative_features,
        "placeFeatures": [
            tag for tag in place_tags
            if any(
                word in str(tag).lower()
                for word in positive_keywords
            )
        ],
        "warnings": relevant_warnings,
        "preferences": preference_matches,
    }


# ============================================================
# ACCESSIBILITY ROUTES
# ============================================================

@app.get("/api/accessibility/routes/{place_id}")
def get_accessibility_routes(
    place_id: str,
    mode: str = Query(
        default="wheelchair",
        description="wheelchair or lowvision",
    ),
):
    """
    Returns accessibility-aware route choices.

    Existing places use their predefined route definitions.

    Places without predefined routes use their stored
    accessibility metadata to build route choices dynamically.
    """

    mode = normalize_mode(mode)

    place = places_collection.find_one(
        {
            "id": place_id
        },
        {
            "_id": 0,
        },
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    # ========================================================
    # BUILD ROUTES
    # ========================================================

    result = build_accessibility_routes_for_place(
        place=place,
        mode=mode,
        preferences=[],
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "placeId": place_id,
        "mode": mode,
        "routes": result,
        "notice": (
            "Accessibility scoring is based on stored "
            "accessibility metadata. Existing predefined "
            "routes are used when available; otherwise "
            "routes are generated from the place's "
            "accessibility information."
        ),
    }

# ============================================================
# ACCESSIBILITY ROUTE ANALYSIS WITH USER PREFERENCES
# ============================================================


@app.post("/api/accessibility/analyze/{place_id}")
def analyze_accessibility_route(
    place_id: str,
    request: AccessibilityRequest,
):
    """
    Analyze a route using existing accessibility information
    and nearby OpenStreetMap ramps and stairs.
    """

    mode = normalize_mode(request.mode)

    place = places_collection.find_one(
        {"id": place_id},
        {"_id": 0},
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    place_routes = ROUTES.get(place_id, [])
    analyzed_routes = []

    coordinates = request.routeCoordinates or []

    # Validate submitted route coordinates.
    if len(coordinates) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Too many route coordinates",
        )

    for coordinate in coordinates:
        if (
            not isinstance(coordinate, list)
            or len(coordinate) != 2
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid route coordinate format",
            )

        longitude, latitude = coordinate

        if (
            not -180 <= longitude <= 180
            or not -90 <= latitude <= 90
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid latitude or longitude",
            )

    # Calculate distance from an OSM point to the route.
    def point_to_route_distance(point_lat, point_lon, route_coords):

        if len(route_coords) < 2:
            return float("inf")

        cos_lat = math.cos(math.radians(point_lat))

        px = 0.0
        py = 0.0

        min_distance = float("inf")

        # Downsample very large routes for performance.
        step = max(1, len(route_coords) // 400)
        sampled = route_coords[::step]

        if sampled[-1] != route_coords[-1]:
            sampled.append(route_coords[-1])

        for i in range(len(sampled) - 1):

            lon1, lat1 = sampled[i]
            lon2, lat2 = sampled[i + 1]

            x1 = math.radians(lon1 - point_lon) * 6371000 * cos_lat
            y1 = math.radians(lat1 - point_lat) * 6371000

            x2 = math.radians(lon2 - point_lon) * 6371000 * cos_lat
            y2 = math.radians(lat2 - point_lat) * 6371000

            dx = x2 - x1
            dy = y2 - y1

            denominator = dx * dx + dy * dy

            if denominator == 0:
                t = 0
            else:
                t = -(
                    x1 * dx + y1 * dy
                ) / denominator

                t = max(0, min(1, t))

            closest_x = x1 + t * dx
            closest_y = y1 + t * dy

            distance = math.sqrt(
                closest_x * closest_x
                + closest_y * closest_y
            )

            min_distance = min(
                min_distance,
                distance,
            )

        return min_distance

    # Load nearby OSM information when route coordinates exist.
    nearby_ramps = []
    nearby_stairs = []
    osm_available = False

    if len(coordinates) >= 2:

        try:
            center_lon = sum(
                point[0] for point in coordinates
            ) / len(coordinates)

            center_lat = sum(
                point[1] for point in coordinates
            ) / len(coordinates)

            osm_points = get_osm_accessibility_points(
                latitude=center_lat,
                longitude=center_lon,
                radius=5000,
            )

            osm_available = True

            for point in osm_points:

                point_lat = point.get("latitude")
                point_lon = point.get("longitude")

                if point_lat is None or point_lon is None:
                    continue

                distance = point_to_route_distance(
                    point_lat,
                    point_lon,
                    coordinates,
                )

                # Consider OSM features within 30 metres
                # of the submitted route.
                if distance > 30:
                    continue

                point_type = str(
                    point.get("type", "")
                ).lower()

                if point_type == "ramp":
                    nearby_ramps.append(point)

                elif point_type == "stairs":
                    nearby_stairs.append(point)

        except Exception as error:
            print(
                "OSM route analysis unavailable:",
                str(error),
            )

    for route in place_routes:

        analysis = analyze_route_for_accessibility(
            route=route,
            place=place,
            mode=mode,
            preferences=request.preferences,
        )

        # Add OSM evidence to the existing analysis.
        positive_features = list(
            analysis.get("positiveFeatures", [])
        )

        negative_features = list(
            analysis.get("negativeFeatures", [])
        )

        warnings = list(
            analysis.get("warnings", [])
        )

        score = analysis.get(score = none)

        if osm_available and coordinates:

            if nearby_ramps:
                positive_features.append(
                    f"{len(nearby_ramps)} mapped ramp(s) found near this route"
                )

            if nearby_stairs:
                negative_features.append(
                    f"{len(nearby_stairs)} mapped stair location(s) found near this route"
                )

            if mode == "wheelchair":

                score += min(
                    len(nearby_ramps) * 3,
                    15,
                )

                score -= min(
                    len(nearby_stairs) * 7,
                    25,
                )

            score = max(0, min(100, score))

        # Update the user's preference statuses.
                # Include only preferences supported by actual evidence.
        preference_results = []

        for preference in request.preferences:
            normalized = preference.lower().strip()
            status = None

            if "ramp" in normalized and nearby_ramps:
                status = "supported"
            elif "stair" in normalized and nearby_stairs:
                status = "warning"
            elif "elevator" in normalized and nearby_elevators:
                status = "supported"

            if status:
                preference_results.append({
                    "preference": preference,
                    "status": status,
                })

# ============================================================
# ACCESSIBILITY ANALYSIS FOR SEARCHED LOCATIONS
# ============================================================
def normalize_mode(mode: str) -> str:
    value = (mode or "").strip().lower()

    if value in ["wheelchair", "wheel chair"]:
        return "wheelchair"

    if value in ["lowvision", "low vision", "low_vision"]:
        return "lowvision"

    return "wheelchair"

@app.post("/api/accessibility/analyze-location")
def analyze_accessibility_by_location(
    request: AccessibilityRequest,
):
    mode = normalize_mode(request.mode)
    coordinates = request.routeCoordinates or []

    if len(coordinates) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least two route coordinates are required",
        )

    if len(coordinates) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Too many route coordinates",
        )

    for coordinate in coordinates:
        if not isinstance(coordinate, list) or len(coordinate) != 2:
            raise HTTPException(
                status_code=400,
                detail="Invalid route coordinate format",
            )

        longitude, latitude = coordinate

        if not (
            -180 <= longitude <= 180
            and -90 <= latitude <= 90
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid latitude or longitude",
            )

    def point_to_route_distance(point_lat, point_lon):
        cos_lat = math.cos(math.radians(point_lat))
        min_distance = float("inf")

        step = max(1, len(coordinates) // 400)
        sampled = coordinates[::step]

        if sampled[-1] != coordinates[-1]:
            sampled.append(coordinates[-1])

        for i in range(len(sampled) - 1):
            lon1, lat1 = sampled[i]
            lon2, lat2 = sampled[i + 1]

            x1 = math.radians(lon1 - point_lon) * 6371000 * cos_lat
            y1 = math.radians(lat1 - point_lat) * 6371000

            x2 = math.radians(lon2 - point_lon) * 6371000 * cos_lat
            y2 = math.radians(lat2 - point_lat) * 6371000

            dx = x2 - x1
            dy = y2 - y1
            denominator = dx * dx + dy * dy

            if denominator == 0:
                t = 0
            else:
                t = max(
                    0,
                    min(1, -(x1 * dx + y1 * dy) / denominator),
                )

            closest_x = x1 + t * dx
            closest_y = y1 + t * dy

            distance = math.sqrt(closest_x ** 2 + closest_y ** 2)
            min_distance = min(min_distance, distance)

        return min_distance

    nearby_ramps = []
    nearby_stairs = []
    nearby_elevators = []
    nearby_slopes = []
    nearby_accessible_locations = []

    try:
        center_lon = sum(point[0] for point in coordinates) / len(coordinates)
        center_lat = sum(point[1] for point in coordinates) / len(coordinates)

        osm_points = get_osm_accessibility_points(
            latitude=center_lat,
            longitude=center_lon,
            radius=5000,
        )

        for point in osm_points:
            point_lat = point.get("latitude")
            point_lon = point.get("longitude")

            if point_lat is None or point_lon is None:
                continue

            distance = point_to_route_distance(
                float(point_lat),
                float(point_lon),
            )

            if distance > 30:
                continue

            point_type = str(point.get("type", "")).lower().strip()

            if point_type == "ramp":
                nearby_ramps.append(point)
            elif point_type == "stairs":
                nearby_stairs.append(point)
            elif point_type == "elevator":
                nearby_elevators.append(point)
            elif point_type in ("slope", "incline"):
                nearby_slopes.append(point)
            elif point_type == "wheelchair_accessible":
                nearby_accessible_locations.append(point)

    except Exception as error:
        print("OSM location analysis unavailable:", str(error))

    positive_features = []
    negative_features = []
    warnings = []

    if nearby_ramps:
        positive_features.append(
            f"{len(nearby_ramps)} mapped ramp(s) found near this route"
        )

    if nearby_elevators:
        positive_features.append(
            f"{len(nearby_elevators)} mapped elevator(s) found near this route"
        )

    if nearby_accessible_locations:
        positive_features.append(
            f"{len(nearby_accessible_locations)} wheelchair-accessible location(s) mapped near this route"
        )

    if nearby_stairs:
        message = (
            f"{len(nearby_stairs)} mapped stair location(s) found near this route"
        )
        negative_features.append(message)
        warnings.append(message)

    if nearby_slopes:
        message = (
            f"{len(nearby_slopes)} mapped incline(s) found near this route. "
            "Their steepness has not been verified."
        )
        negative_features.append(message)
        warnings.append(message)

    # Only report preferences for which actual matching evidence exists.
    preference_results = []

    for preference in request.preferences:
        normalized = preference.lower().strip()
        status = None

        if "elevator" in normalized and nearby_elevators:
            status = "supported"
        elif "ramp" in normalized and nearby_ramps:
            status = "supported"
        elif "stair" in normalized and nearby_stairs:
            status = "warning"
        elif (
            ("slope" in normalized or "incline" in normalized)
            and nearby_slopes
        ):
            status = "warning"

        if status:
            preference_results.append({
                "preference": preference,
                "status": status,
            })

    # No evidence means no accessibility result.
    has_evidence = bool(
        positive_features
        or negative_features
        or preference_results
    )

    if not has_evidence:
        return {
            "mode": mode,
            "preferences": [],
            "routes": [],
            "osmEvidence": {
                "available": False,
                "nearbyRamps": 0,
                "nearbyStairs": 0,
                "nearbyElevators": 0,
                "nearbySlopes": 0,
                "nearbyWheelchairAccessibleLocations": 0,
            },
        }

    if positive_features and negative_features:
        summary = (
            "Recorded accessibility features and potential obstacles "
            "were found near this route."
        )
    elif positive_features:
        summary = "Recorded accessibility features were found near this route."
    else:
        summary = "Potential accessibility obstacles were found near this route."

    osm_evidence = {
        "available": True,
        "nearbyRamps": len(nearby_ramps),
        "nearbyStairs": len(nearby_stairs),
        "nearbyElevators": len(nearby_elevators),
        "nearbySlopes": len(nearby_slopes),
        "nearbyWheelchairAccessibleLocations": len(nearby_accessible_locations),
        "searchRadiusMetres": 5000,
        "routeProximityMetres": 30,
    }

    return {
        "mode": mode,
        "preferences": [item["preference"] for item in preference_results],
        "routes": [
            {
                "id": "location-route",
                "title": "Selected Route",
                "accessibility": {
                    "score": None,
                    "summary": summary,
                    "positiveFeatures": positive_features,
                    "negativeFeatures": negative_features,
                    "placeFeatures": [],
                    "warnings": warnings,
                    "preferences": preference_results,
                    "osmEvidence": osm_evidence,
                },
            }
        ],
        "osmEvidence": osm_evidence,
    }




# ============================================================
# ACCESSIBILITY POINTS
# ============================================================



@app.get("/api/accessibility/points")
def get_accessibility_points(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius: float = Query(default=5.0, ge=0.1, le=50.0),
):
    """
    Find accessibility places around the user's live location.
    Uses the Haversine formula for accurate distances.
    """

    places = list(
        places_collection.find(
            {},
            {"_id": 0},
        )
    )

    nearby = []
    earth_radius = 6371.0

    for place in places:
        place_lat = place.get("latitude")
        place_lng = place.get("longitude")

        if place_lat is None or place_lng is None:
            continue

        try:
            place_lat = float(place_lat)
            place_lng = float(place_lng)
        except (TypeError, ValueError):
            continue

        if not (-90 <= place_lat <= 90):
            continue

        if not (-180 <= place_lng <= 180):
            continue

        lat1 = math.radians(latitude)
        lat2 = math.radians(place_lat)

        delta_lat = math.radians(place_lat - latitude)
        delta_lng = math.radians(place_lng - longitude)

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1)
            * math.cos(lat2)
            * math.sin(delta_lng / 2) ** 2
        )

        distance = 2 * earth_radius * math.asin(
            min(1.0, math.sqrt(a))
        )

        if distance <= radius:
            nearby.append({
                "id": place.get("id"),
                "name": place.get("name", "Unnamed place"),
                "latitude": place_lat,
                "longitude": place_lng,
                "tags": place.get("tags", []),
                "warnings": place.get("warnings", []),
"score": place.get("score") if (
    place.get("tags") or place.get("warnings")
) else None,                "distanceKm": round(distance, 2),
            })

    nearby.sort(
        key=lambda item: item["distanceKm"]
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radiusKm": radius,
        "total": len(nearby),
        "results": nearby,
    }


  


@app.get("/api/accessibility/routes-by-location")
def get_accessibility_routes_by_location(
    latitude: float,
    longitude: float,
    mode: str = Query(
        default="wheelchair",
        description="wheelchair or lowvision",
    ),
    radius: float = Query(
        default=1.0,
        ge=0.1,
        le=50.0,
    ),
):

    mode = normalize_mode(mode)

    places = list(
        places_collection.find(
            {},
            {
                "_id": 0,
            },
        )
    )

    nearby_places = []

    for place in places:
        place_lat = place.get("latitude")
        place_lng = place.get("longitude")

        if place_lat is None or place_lng is None:
            continue

        lat_distance = abs(
            place_lat - latitude
        ) * 111

        lng_distance = abs(
            place_lng - longitude
        ) * 111

        approximate_distance = (
            lat_distance ** 2
            + lng_distance ** 2
        ) ** 0.5

        if approximate_distance <= radius:
            nearby_places.append(
                (
                    approximate_distance,
                    place,
                )
            )

    nearby_places.sort(
        key=lambda item: item[0]
    )

    if not nearby_places:
        return {
            "latitude": latitude,
            "longitude": longitude,
            "mode": mode,
            "routes": [],
            "notice": (
                "No stored accessibility information "
                "was found near this location."
            ),
        }

    # --------------------------------------------------------
    # Found a nearby accessibility place
    # --------------------------------------------------------

    distance_km, closest_place = nearby_places[0]

    print(
        "DEBUG closest place:",
        closest_place
    )

    print(
        "DEBUG distance:",
        distance_km
    )

    routes = build_accessibility_routes_for_place(
        place=closest_place,
        mode=mode,
        preferences=[],
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "mode": mode,
        "routes": routes,
        "sourcePlaceId": closest_place.get("id"),
        "sourcePlaceName": closest_place.get("name"),
        "sourceDistanceKm": round(
            distance_km,
            2,
        ),
        "notice": (
            "Accessibility information is based on "
            "the nearest stored accessibility location."
        ),
    }


# ============================================================
# DEBUG PLACES
# ============================================================

@app.get("/api/debug/places")
def debug_places():

    places = list(
        places_collection.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "latitude": 1,
                "longitude": 1,
                "tags": 1,
                "warnings": 1,
            },
        )
    )

    return places

    distance_km, closest_place = nearby_places[0]

    routes = build_accessibility_routes_for_place(
        place=closest_place,
        mode=mode,
        preferences=[],
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "mode": mode,
        "routes": routes,
        "sourcePlaceId": closest_place.get("id"),
        "sourcePlaceName": closest_place.get("name"),
        "sourceDistanceKm": round(
            distance_km,
            2,
        ),
        "notice": (
            "Accessibility information is based on "
            "the nearest stored accessibility location."
        ),
    }


# ============================================================
# SAVED PLACES
# ============================================================

@app.get("/api/saved")
def get_saved_places(
    current_user=Depends(get_current_user),
):
    saved_places = list(
        saved_collection.find(
            {"userId": current_user["id"]},
            {"_id": 0},
        )
    )

    result = []

    for saved in saved_places:
        place = None

        if saved.get("placeId"):
            place = places_collection.find_one(
                {"id": saved["placeId"]},
                {"_id": 0},
            )

        result.append({
            **saved,
            "place": place,
        })

    return result
# ============================================================
# SAVE A PLACE
# ============================================================

class SavePlaceRequest(BaseModel):
    placeId: Optional[str] = None
    name: str = Field(..., min_length=1)
    address: str = ""
    latitude: float
    longitude: float
    emoji: str = "📍"

@app.post("/api/saved")
def save_place(
    request: SavePlaceRequest,
    current_user=Depends(get_current_user),
):
    saved = {
        "id": str(uuid.uuid4()),
        "userId": current_user["id"],
        "placeId": request.placeId,
        "name": request.name,
        "address": request.address,
        "latitude": request.latitude,
        "longitude": request.longitude,
        "emoji": request.emoji,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    existing_query = {
        "userId": current_user["id"],
        "latitude": request.latitude,
        "longitude": request.longitude,
    }

    existing = saved_collection.find_one(existing_query)

    if existing:
        return {
            "message": "Place already saved",
            "id": existing["id"],
        }

    saved_collection.insert_one(saved)

    return {
        "message": "Place saved successfully",
        "id": saved["id"],
        "placeId": saved["placeId"],
    }

# ============================================================
# REMOVE A SAVED PLACE
# ============================================================

@app.delete("/api/saved/{saved_id}")
def delete_saved_place(
    saved_id: str,
    current_user=Depends(get_current_user),
):
    result = saved_collection.delete_one({
        "id": saved_id,
        "userId": current_user["id"],
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Saved place not found",
        )

    return {
        "message": "Place removed successfully"
    }




# ============================================================
# ROUTES
# ============================================================

@app.get("/api/routes/{place_id}")
def get_routes(place_id: str):

    return ROUTES.get(
        place_id,
        [],
    )


# ============================================================
# NAVIGATION
# ============================================================

@app.get("/api/navigation")
def get_navigation():

    return NAV_STATES


@app.get("/api/navigation/{step}")
def get_navigation_step(step: int):

    if step < 0 or step >= len(NAV_STATES):
        raise HTTPException(
            status_code=404,
            detail="Navigation step not found",
        )

    return NAV_STATES[step]


# ============================================================
# ACCESSIBILITY NAVIGATION INFORMATION
# ============================================================

@app.get("/api/navigation/accessibility/{place_id}")
def get_accessibility_navigation(
    place_id: str,
    mode: str = Query(
        default="wheelchair",
        description="wheelchair or lowvision",
    ),
):
    """
    Returns destination-specific accessibility guidance
    for the Navigation screen.
    """

    mode = normalize_mode(mode)

    place = places_collection.find_one(
        {
            "id": place_id
        },
        {
            "_id": 0,
        },
    )

    if not place:
        raise HTTPException(
            status_code=404,
            detail="Place not found",
        )

    tags = place.get("tags", [])
    warnings = place.get("warnings", [])

    if mode == "wheelchair":

        access_instructions = []

        for tag in tags:

            tag_lower = tag.lower()

            if "ramp" in tag_lower:
                access_instructions.append(
                    f"♿ {tag}"
                )

            elif "elevator" in tag_lower:
                access_instructions.append(
                    f"♿ {tag}"
                )

            elif "step-free" in tag_lower:
                access_instructions.append(
                    f"♿ {tag}"
                )

            elif "smooth" in tag_lower:
                access_instructions.append(
                    f"♿ {tag}"
                )

        if not access_instructions:
            access_instructions.append(
                "♿ No specific wheelchair access point is recorded."
            )

    else:

        access_instructions = []

        for tag in tags:

            tag_lower = tag.lower()

            if "smooth" in tag_lower:
                access_instructions.append(
                    f"👁 {tag}"
                )

            elif "crossing" in tag_lower:
                access_instructions.append(
                    f"👁 {tag}"
                )

            elif "visibility" in tag_lower:
                access_instructions.append(
                    f"👁 {tag}"
                )

        if not access_instructions:
            access_instructions.append(
                "👁 No specific low-vision access feature is recorded."
            )

    return {
        "placeId": place_id,
        "mode": mode,
        "destination": {
            "name": place.get("name"),
            "latitude": place.get("latitude"),
            "longitude": place.get("longitude"),
        },
        "accessInstructions": access_instructions,
        "warnings": warnings,
        "tags": tags,
        "navigationSteps": NAV_STATES,
    }


# ============================================================
# REPORT OPTIONS
# ============================================================

@app.get("/api/report-options")
def get_report_options():

    return REPORT_OPTIONS


# ============================================================
# REPORTS
# ============================================================


@app.post("/api/reports")
def create_report(
    report: ReportRequest,
    current_user=Depends(get_current_user),
):
    report_id = str(uuid.uuid4())

    new_report = {
        "id": report_id,
        "userId": current_user["id"],
        "placeId": report.placeId,
        "placeName": report.placeName,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "reportType": report.reportType,
        "description": report.description,

        # Report origin and verification
        "source": "community",
        "status": "pending",
        "verificationStatus": "pending",

        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    reports_collection.insert_one(new_report)

    return {
        "message": "Report submitted successfully",
        "report": {
            "id": report_id,
            "placeName": report.placeName,
            "reportType": report.reportType,
            "source": "community",
            "status": "pending",
            "verificationStatus": "pending",
        },
    }

@app.get("/api/reports")
def get_reports(
    current_user=Depends(get_current_user),
):

    reports = list(
        reports_collection.find(
            {
                "userId": current_user["id"]
            },
            {
                "_id": 0
            },
        )
    )

    return reports


@app.get("/api/reports/nearby")
def get_nearby_reports(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(0.5, gt=0),
):
    lat_delta = radius_km / 111

    lng_delta = radius_km / (
        111 * max(math.cos(math.radians(latitude)), 0.01)
    )

    reports = list(
        reports_collection.find({
            "latitude": {
                "$gte": latitude - lat_delta,
                "$lte": latitude + lat_delta,
            },
            "longitude": {
                "$gte": longitude - lng_delta,
                "$lte": longitude + lng_delta,
            },
        })
    )

    return [
        {
            "id": report.get("id", str(report["_id"])),
            "placeName": report.get("placeName", ""),
            "latitude": report["latitude"],
            "longitude": report["longitude"],
            "reportType": report.get("reportType", ""),
            "description": report.get("description", ""),
            "source": report.get("source", "community"),
            "status": report.get("status", "pending"),
            "verificationStatus": report.get(
                "verificationStatus", "pending"
            ),
            "createdAt": report.get("createdAt", ""),
        }
        for report in reports
    ]


@app.get("/api/osm/accessibility")
def get_osm_accessibility(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius: int = Query(1000, ge=100, le=5000),
):
    try:
        points = get_osm_accessibility_points(
            latitude=latitude,
            longitude=longitude,
            radius=radius,
        )

        return {
            "success": True,
            "source": "OpenStreetMap",
            "count": len(points),
            "points": points,
        }

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="OpenStreetMap is taking too long to respond. Please try again."
        )

    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve OpenStreetMap data: {str(error)}"
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Accessibility data error: {str(error)}"
        )
