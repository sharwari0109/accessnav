import os

import certifi
from pymongo import MongoClient
from dotenv import load_dotenv


# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

load_dotenv()


# --------------------------------------------------
# MongoDB connection string
# --------------------------------------------------

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in .env")


# --------------------------------------------------
# Connect to MongoDB
# --------------------------------------------------

client = MongoClient(
    MONGO_URI,
    tls=True,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=10000,
)


# --------------------------------------------------
# Select database
# --------------------------------------------------

db = client["accessmob"]


# --------------------------------------------------
# Collections
# --------------------------------------------------

places_collection = db["places"]
saved_collection = db["saved_places"]
reports_collection = db["reports"]
users_collection = db["users"]


# --------------------------------------------------
# Test MongoDB connection
# --------------------------------------------------

try:
    client.admin.command("ping")
    print("MongoDB connected successfully!")

except Exception as e:
    print("MongoDB connection failed:", e)