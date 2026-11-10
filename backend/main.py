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
    """
    Accessibility preferences sent by the frontend.

    wheelchair:
        Used for wheelchair-friendly routing.

    lowvision:
        Used for low-vision-friendly routing.

    preferences:
        Optional list of preferences from the setup/profile screen.
    """

    mode: str = Field(
        default="wheelchair",
        description="wheelchair or lowvision",
    )

    preferences: List[str] = Field(
        default_factory=list,
        description="Accessibility preferences",
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
        accessibility_warnings.append(
            {
                "text": warning,
                "severity": "warning",
            }
        )

    # --------------------------------------------------------
    # Score
    # --------------------------------------------------------

    score = place.get("score", 0)

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
        "tags": tags,
        "warnings": warnings,
    }


# ============================================================
# ACCESSIBILITY ROUTE ANALYSIS
# ============================================================

def normalize_mode(mode: str) -> str:
    mode = mode.lower().strip()

    if mode not in ["wheelchair", "lowvision"]:
        raise HTTPException(
            status_code=400,
            detail="mode must be either 'wheelchair' or 'lowvision'",
        )

    return mode


# ============================================================
# NEW HELPER: BUILD ROUTES FOR ANY SEARCHED PLACE
# ============================================================

def build_accessibility_routes_for_place(
    place: Dict[str, Any],
    mode: str,
    preferences: List[str],
):
    """
    Build accessibility route choices for any place.

    For places that already have predefined ROUTES, those routes
    can still be used.

    For newly searched places that are not in ROUTES, create
    generic route choices from the place's accessibility metadata.
    """

    place_id = place.get("id")

    # Keep the existing predefined routes when available.
    existing_routes = ROUTES.get(place_id, [])

    if existing_routes:
        return [
            {
                **route,
                "accessibility": analyze_route_for_accessibility(
                    route=route,
                    place=place,
                    mode=mode,
                    preferences=preferences,
                ),
            }
            for route in existing_routes
        ]

    # --------------------------------------------------------
    # No predefined routes.
    # Build routes dynamically from the place metadata.
    # --------------------------------------------------------

    tags = place.get("tags", [])
    warnings = place.get("warnings", [])

    features = []

    for tag in tags:
        features.append({
            "text": tag,
            "ok": True,
        })

    for warning in warnings:
        features.append({
            "text": warning,
            "ok": False,
        })

    # Generic accessible route
    accessible_route = {
        "id": "accessible",
        "title": "Most Accessible",
        "emoji": "⭐",
        "color": "accessible",
        "time": None,
        "dist": None,
        "tag": "Based on available accessibility information",
        "badge": "Accessibility information available",
        "features": features,
    }

    # Generic clear route
    clear_route = {
        "id": "clear",
        "title": "Clear Route",
        "emoji": "👁",
        "color": "warning",
        "time": None,
        "dist": None,
        "tag": "Based on available accessibility information",
        "features": features,
    }

    routes = [
        accessible_route,
        clear_route,
    ]

    return [
        {
            **route,
            "accessibility": analyze_route_for_accessibility(
                route=route,
                place=place,
                mode=mode,
                preferences=preferences,
            ),
        }
        for route in routes
    ]


# ============================================================
# EXISTING ROUTE ANALYSIS
# ============================================================

def analyze_route_for_accessibility(
    route: Dict[str, Any],
    place: Optional[Dict[str, Any]],
    mode: str,
    preferences: List[str],
):
    """
    Analyze the application's route metadata.

    This does NOT claim that OSRM itself is accessibility-aware.

    Instead, this endpoint combines:
        1. Route metadata
        2. MongoDB accessibility information
        3. User accessibility preferences

    Later, this can be replaced/extended with a true
    accessibility-aware pedestrian routing engine.
    """

    mode = normalize_mode(mode)

    features = route.get("features", [])

    positive_features = []
    negative_features = []

    for feature in features:
        text = feature.get("text", "")
        ok = feature.get("ok", False)

        if ok:
            positive_features.append(text)
        else:
            negative_features.append(text)

    place_tags = []
    place_warnings = []

    if place:
        place_tags = place.get("tags", [])
        place_warnings = place.get("warnings", [])

    # --------------------------------------------------------
    # Wheelchair analysis
    # --------------------------------------------------------

    wheelchair_positive = [
        "No stairs",
        "Ramp available",
        "Ramps",
        "Ramps available",
        "Elevator available",
        "Elevators available",
        "Step-free",
        "Step-free entrance",
        "Smooth sidewalk",
        "Smooth sidewalks",
        "Accessible shuttle",
        "Accessible restrooms",
    ]

    wheelchair_negative = [
        "Stairs",
        "Uneven sidewalk",
        "Uneven sidewalks",
        "Broken ramp",
        "Steep slope",
    ]

    # --------------------------------------------------------
    # Low vision analysis
    # --------------------------------------------------------

    lowvision_positive = [
        "Fewer obstacles",
        "Clear crossings",
        "Better visibility",
        "Smooth sidewalk",
        "Smooth sidewalks",
    ]

    lowvision_negative = [
        "Busy crossing",
        "Busy road",
        "Crowded crossing",
        "Long crossing",
        "Complicated intersection",
        "Obstacles",
    ]

    if mode == "wheelchair":

        positive_count = 0
        negative_count = 0

        for feature in positive_features:
            if feature in wheelchair_positive:
                positive_count += 1

        for feature in negative_features:
            if feature in wheelchair_negative:
                negative_count += 1

        for tag in place_tags:
            if tag in wheelchair_positive:
                positive_count += 1

        accessibility_score = max(
            0,
            min(
                100,
                70
                + (positive_count * 10)
                - (negative_count * 20),
            ),
        )

        summary = (
            "Wheelchair-friendly features detected."
            if positive_count > 0 and negative_count == 0
            else "Potential wheelchair accessibility obstacles detected."
            if negative_count > 0
            else "Accessibility information is limited."
        )

    else:

        positive_count = 0
        negative_count = 0

        for feature in positive_features:
            if feature in lowvision_positive:
                positive_count += 1

        for feature in negative_features:
            if feature in lowvision_negative:
                negative_count += 1

        for tag in place_tags:
            if tag in lowvision_positive:
                positive_count += 1

        accessibility_score = max(
            0,
            min(
                100,
                70
                + (positive_count * 10)
                - (negative_count * 15),
            ),
        )

        summary = (
            "Clear-route features detected."
            if positive_count > 0 and negative_count == 0
            else "Potential visibility or crossing obstacles detected."
            if negative_count > 0
            else "Accessibility information is limited."
        )

    # --------------------------------------------------------
    # Preferences
    # --------------------------------------------------------

    preference_matches = []

    for preference in preferences:

        preference_lower = preference.lower()

        combined_text = " ".join(
            positive_features
            + negative_features
            + place_tags
            + place_warnings
        ).lower()

        if (
            "stair" in preference_lower
            and "stair" not in combined_text
        ):
            preference_matches.append(
                {
                    "preference": preference,
                    "status": "supported",
                }
            )

        elif (
            "ramp" in preference_lower
            and "ramp" in combined_text
        ):
            preference_matches.append(
                {
                    "preference": preference,
                    "status": "supported",
                }
            )

        elif (
            "elevator" in preference_lower
            and "elevator" in combined_text
        ):
            preference_matches.append(
                {
                    "preference": preference,
                    "status": "supported",
                }
            )

        elif (
            "crossing" in preference_lower
            and (
                "crossing" in combined_text
                or "visibility" in combined_text
            )
        ):
            preference_matches.append(
                {
                    "preference": preference,
                    "status": "supported",
                }
            )

        else:
            preference_matches.append(
                {
                    "preference": preference,
                    "status": "unknown",
                }
            )

    return {
        "score": accessibility_score,
        "summary": summary,
        "positiveFeatures": positive_features,
        "negativeFeatures": negative_features,
        "placeFeatures": place_tags,
        "warnings": place_warnings,
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
    Analyze all available route choices for a destination
    using the user's accessibility mode and preferences.
    """

    mode = normalize_mode(request.mode)

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

    place_routes = ROUTES.get(
        place_id,
        [],
    )

    analyzed_routes = []

    for route in place_routes:

        analysis = analyze_route_for_accessibility(
            route=route,
            place=place,
            mode=mode,
            preferences=request.preferences,
        )

        analyzed_routes.append(
            {
                **route,
                "accessibility": analysis,
            }
        )

    return {
        "placeId": place_id,
        "mode": mode,
        "preferences": request.preferences,
        "routes": analyzed_routes,
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
                "score": place.get("score", 0),
                "distanceKm": round(distance, 2),
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

[
  {
    "id": "place1",
    "name": "Some Hospital",
    "latitude": 19.0500,
    "longitude": 73.0300,
    "tags": [
      "Step-free entrance",
      "Ramps available"
    ],
    "warnings": []
  }
]


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
    new_report = {
        "userId": current_user["id"],
        "placeId": report.placeId,
        "placeName": report.placeName,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "reportType": report.reportType,
        "description": report.description,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    result = reports_collection.insert_one(new_report)

    return {
        "message": "Report submitted successfully",
        "report": {
            "id": str(result.inserted_id),
            "userId": str(new_report["userId"]),
            "placeId": new_report["placeId"],
            "placeName": new_report["placeName"],
            "latitude": new_report["latitude"],
            "longitude": new_report["longitude"],
            "reportType": new_report["reportType"],
            "description": new_report["description"],
            "status": new_report["status"],
            "createdAt": new_report["createdAt"],
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
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: float = Query(0.5),
    current_user=Depends(get_current_user),
):
    lat_delta = radius_km / 111

    import math
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
            "id": str(report["_id"]),
            "placeName": report.get("placeName", ""),
            "latitude": report["latitude"],
            "longitude": report["longitude"],
            "reportType": report.get("reportType", ""),
            "description": report.get("description", ""),
            "status": report.get("status", "pending"),
            "createdAt": report.get("createdAt", ""),
        }
        for report in reports
    ]