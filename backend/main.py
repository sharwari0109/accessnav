from typing import Any, Dict, List, Optional

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
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AccessMob API",
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

SECRET_KEY = "accessmob-development-secret-key"
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
    placeId: str
    reportType: str
    description: str = ""


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
    Returns the existing route definitions together with
    accessibility analysis.

    This endpoint is intended for the Routes screen.
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

    place_routes = ROUTES.get(
        place_id,
        [],
    )

    result = []

    for route in place_routes:

        analysis = analyze_route_for_accessibility(
            route=route,
            place=place,
            mode=mode,
            preferences=[],
        )

        result.append(
            {
                **route,
                "accessibility": analysis,
            }
        )

    return {
        "placeId": place_id,
        "mode": mode,
        "routes": result,
        "notice": (
            "Accessibility scoring is based on stored AccessMob "
            "accessibility metadata. The underlying road route "
            "is not yet generated by an accessibility-aware routing engine."
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
    latitude: float,
    longitude: float,
    radius: float = Query(
        default=1.0,
        ge=0.1,
        le=50.0,
    ),
):
    """
    Returns nearby accessibility information from the
    MongoDB places dataset.

    radius is currently used as a broad geographic filter
    based on latitude/longitude distance.

    This is intentionally simple for the current prototype.
    A future version can use MongoDB 2dsphere indexes.
    """

    places = list(
        places_collection.find(
            {},
            {
                "_id": 0,
            },
        )
    )

    nearby = []

    for place in places:

        place_lat = place.get("latitude")
        place_lng = place.get("longitude")

        if place_lat is None or place_lng is None:
            continue

        # Simple approximate geographic distance.
        # One degree latitude is approximately 111 km.
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

            nearby.append(
                {
                    "id": place.get("id"),
                    "name": place.get("name"),
                    "latitude": place_lat,
                    "longitude": place_lng,
                    "tags": place.get("tags", []),
                    "warnings": place.get("warnings", []),
                    "score": place.get("score", 0),
                    "distanceKm": round(
                        approximate_distance,
                        2,
                    ),
                }
            )

    nearby.sort(
        key=lambda item: item["distanceKm"]
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radiusKm": radius,
        "results": nearby,
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
            {
                "userId": current_user["id"]
            },
            {
                "_id": 0
            },
        )
    )

    result = []

    for saved in saved_places:

        place = places_collection.find_one(
            {
                "id": saved["placeId"]
            },
            {
                "_id": 0
            },
        )

        if place:
            result.append(
                {
                    **saved,
                    "place": place,
                }
            )

    return result


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

    new_report = {
        "userId": current_user["id"],
        "placeId": report.placeId,
        "reportType": report.reportType,
        "description": report.description,
    }

    result = reports_collection.insert_one(
        new_report
    )

    return {
        "message": "Report submitted successfully",
        "report": {
            "id": str(result.inserted_id),
            "userId": current_user["id"],
            "placeId": report.placeId,
            "reportType": report.reportType,
            "description": report.description,
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