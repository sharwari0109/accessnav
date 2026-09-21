from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel
from jose import jwt, JWTError

from passlib.context import CryptContext

from data import (
    NAV_STATES,
    REPORT_OPTIONS,
    ROUTES,
)

from database import (
    places_collection,
    saved_collection,
    reports_collection,
    users_collection,
)


# ==================================================
# FASTAPI APP
# ==================================================

app = FastAPI(
    title="AccessMob API",
    description="Backend API for the AccessMob accessibility navigation app",
    version="1.0.0"
)


# ==================================================
# CORS
# ==================================================

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://majorr.netlify.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# AUTHENTICATION SETTINGS
# ==================================================

SECRET_KEY = "accessmob-development-secret-key"

ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

security = HTTPBearer()


# ==================================================
# PYDANTIC MODELS
# ==================================================

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


# ==================================================
# PASSWORD FUNCTIONS
# ==================================================

def hash_password(password: str):

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):

    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# ==================================================
# JWT FUNCTION
# ==================================================

def create_access_token(user_id: str):

    token_data = {
        "user_id": user_id
    }

    return jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# ==================================================
# GET CURRENT USER
# ==================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = users_collection.find_one(
        {
            "id": user_id
        },
        {
            "_id": 0,
            "password": 0
        }
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# ==================================================
# BASIC ROUTES
# ==================================================

@app.get("/")
def root():

    return {
        "message": "AccessMob Backend is running"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


# ==================================================
# REGISTER
# ==================================================

@app.post("/api/auth/register")
def register(
    user: RegisterRequest
):

    # Check if email already exists

    existing_user = users_collection.find_one(
        {
            "email": user.email.lower()
        }
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Create user ID

    import uuid

    user_id = str(uuid.uuid4())

    # Hash password

    hashed_password = hash_password(
        user.password
    )

    # User document

    new_user = {
        "id": user_id,
        "name": user.name,
        "email": user.email.lower(),
        "password": hashed_password
    }

    # Insert into MongoDB

    users_collection.insert_one(
        new_user
    )

    return {
        "message": "Registration successful",
        "user": {
            "id": user_id,
            "name": user.name,
            "email": user.email.lower()
        }
    }


# ==================================================
# LOGIN
# ==================================================

@app.post("/api/auth/login")
def login(
    user: LoginRequest
):

    existing_user = users_collection.find_one(
        {
            "email": user.email.lower()
        }
    )

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Verify password

    password_correct = verify_password(
        user.password,
        existing_user["password"]
    )

    if not password_correct:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Create JWT

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
            "email": existing_user["email"]
        }
    }


# ==================================================
# CURRENT USER
# ==================================================

@app.get("/api/auth/me")
def get_me(
    current_user = Depends(get_current_user)
):

    return current_user


# ==================================================
# PLACES
# ==================================================

@app.get("/api/places")
def get_places():

    places = list(
        places_collection.find(
            {},
            {"_id": 0}
        )
    )

    return places


@app.get("/api/places/{place_id}")
def get_place(
    place_id: str
):

    place = places_collection.find_one(
        {
            "id": place_id
        },
        {
            "_id": 0
        }
    )

    if not place:

        raise HTTPException(
            status_code=404,
            detail="Place not found"
        )

    return place


# ==================================================
# SAVED PLACES
# ==================================================

@app.get("/api/saved")
def get_saved_places(
    current_user = Depends(get_current_user)
):

    saved_places = list(
        saved_collection.find(
            {
                "userId": current_user["id"]
            },
            {
                "_id": 0
            }
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
            }
        )

        if place:

            result.append({
                **saved,
                "place": place
            })

    return result


# ==================================================
# ROUTES
# ==================================================

@app.get("/api/routes/{place_id}")
def get_routes(
    place_id: str
):

    return ROUTES.get(
        place_id,
        []
    )


# ==================================================
# NAVIGATION
# ==================================================

@app.get("/api/navigation")
def get_navigation():

    return NAV_STATES


@app.get("/api/navigation/{step}")
def get_navigation_step(
    step: int
):

    if step < 0 or step >= len(NAV_STATES):

        raise HTTPException(
            status_code=404,
            detail="Navigation step not found"
        )

    return NAV_STATES[step]


# ==================================================
# REPORT OPTIONS
# ==================================================

@app.get("/api/report-options")
def get_report_options():

    return REPORT_OPTIONS


# ==================================================
# REPORTS
# ==================================================

@app.post("/api/reports")
def create_report(
    report: ReportRequest,
    current_user = Depends(get_current_user)
):

    new_report = {
        "userId": current_user["id"],
        "placeId": report.placeId,
        "reportType": report.reportType,
        "description": report.description
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
            "description": report.description
        }
    }


@app.get("/api/reports")
def get_reports(
    current_user = Depends(get_current_user)
):

    reports = list(
        reports_collection.find(
            {
                "userId": current_user["id"]
            },
            {
                "_id": 0
            }
        )
    )

    return reports