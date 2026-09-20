from database import places_collection
from data import PLACES


# Remove existing places

places_collection.delete_many({})


# Insert places

if PLACES:

    places_collection.insert_many(
        PLACES
    )


print(
    f"{len(PLACES)} places inserted into MongoDB."
)

print(
    "Place seeding completed successfully!"
)