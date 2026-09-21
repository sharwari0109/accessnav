# ============================================================
# ACCESSMOB BACKEND DATA
# ============================================================


# ============================================================
# PLACES
# ============================================================

PLACES = [
    {
        "id": "mumbai-central",
        "name": "Mumbai Central Railway Station",
        "area": "Mumbai Central",
        "distanceKm": 2.4,
        "score": 92,
        "tags": [
            "Step-free entrance",
            "Ramps available",
            "Elevators available",
        ],
        "warnings": [
            "Construction near Platform 2",
        ],
        "x": 168,
        "y": 312,
        "latitude": 18.9696,
        "longitude": 72.8194,
        "emoji": "🚉",

        # Accessibility summary
        "wheelchairAccessible": True,
        "lowVisionAccessible": True,

        # Structured accessibility information
        "accessibility": [
            {
                "id": "mumbai-central-ramp",
                "type": "ramp",
                "name": "Main entrance ramp",
                "description": (
                    "Step-free ramp available "
                    "at the main entrance."
                ),
                "latitude": 18.9697,
                "longitude": 72.8193,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "mumbai-central-elevator",
                "type": "elevator",
                "name": "Station elevator",
                "description": (
                    "Elevator available "
                    "for platform access."
                ),
                "latitude": 18.9695,
                "longitude": 72.8195,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "mumbai-central-entrance",
                "type": "accessible_entrance",
                "name": "Step-free entrance",
                "description": (
                    "Accessible step-free "
                    "entrance."
                ),
                "latitude": 18.9696,
                "longitude": 72.8194,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "mumbai-central-construction",
                "type": "blocked_path",
                "name": "Construction near Platform 2",
                "description": (
                    "Construction may partially "
                    "obstruct pedestrian movement."
                ),
                "latitude": 18.9694,
                "longitude": 72.8196,
                "accessible": False,
                "wheelchair": False,
                "lowvision": False,
                "severity": "medium",
            },
        ],
    },

    {
        "id": "phoenix-mall",
        "name": "Phoenix Mall",
        "area": "Lower Parel",
        "distanceKm": 4.1,
        "score": 95,
        "tags": [
            "Step-free entrance",
            "Ramps available",
            "Elevators available",
            "Accessible restrooms",
        ],
        "warnings": [],
        "x": 232,
        "y": 392,
        "latitude": 18.9947,
        "longitude": 72.8258,
        "emoji": "🛍️",

        # Accessibility summary
        "wheelchairAccessible": True,
        "lowVisionAccessible": True,

        "accessibility": [
            {
                "id": "phoenix-ramp",
                "type": "ramp",
                "name": "Mall entrance ramp",
                "description": (
                    "Step-free ramp at "
                    "the main mall entrance."
                ),
                "latitude": 18.9948,
                "longitude": 72.8257,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "phoenix-elevator",
                "type": "elevator",
                "name": "Mall elevator",
                "description": (
                    "Elevator provides access "
                    "between floors."
                ),
                "latitude": 18.9946,
                "longitude": 72.8259,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "phoenix-entrance",
                "type": "accessible_entrance",
                "name": "Step-free entrance",
                "description": (
                    "Accessible step-free entrance."
                ),
                "latitude": 18.9947,
                "longitude": 72.8258,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "phoenix-restroom",
                "type": "accessible_restroom",
                "name": "Accessible restroom",
                "description": (
                    "Accessible restroom "
                    "facilities available."
                ),
                "latitude": 18.9945,
                "longitude": 72.8258,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
        ],
    },

    {
        "id": "apollo-hospital",
        "name": "Apollo Hospital",
        "area": "Tardeo",
        "distanceKm": 5.2,
        "score": 90,
        "tags": [
            "Step-free entrance",
            "Ramps available",
            "Elevators available",
        ],
        "warnings": [
            "Limited parking near main gate",
        ],
        "x": 120,
        "y": 420,
        "latitude": 18.9720,
        "longitude": 72.8095,
        "emoji": "🏥",

        # Accessibility summary
        "wheelchairAccessible": True,
        "lowVisionAccessible": True,

        "accessibility": [
            {
                "id": "apollo-ramp",
                "type": "ramp",
                "name": "Hospital entrance ramp",
                "description": (
                    "Ramp available at "
                    "the main hospital entrance."
                ),
                "latitude": 18.9721,
                "longitude": 72.8094,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "apollo-elevator",
                "type": "elevator",
                "name": "Hospital elevator",
                "description": (
                    "Elevator available for "
                    "access between floors."
                ),
                "latitude": 18.9719,
                "longitude": 72.8096,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "apollo-entrance",
                "type": "accessible_entrance",
                "name": "Step-free hospital entrance",
                "description": (
                    "Step-free entrance available."
                ),
                "latitude": 18.9720,
                "longitude": 72.8095,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "apollo-parking",
                "type": "warning",
                "name": "Limited parking near main gate",
                "description": (
                    "Parking availability near "
                    "the main gate is limited."
                ),
                "latitude": 18.9721,
                "longitude": 72.8096,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "medium",
            },
        ],
    },

    {
        "id": "mumbai-airport",
        "name": "Mumbai Airport (BOM)",
        "area": "Vile Parle",
        "distanceKm": 8.5,
        "score": 88,
        "tags": [
            "Step-free entrance",
            "Ramps available",
            "Elevators available",
            "Accessible shuttle",
        ],
        "warnings": [
            "Busy drop-off zone",
        ],
        "x": 318,
        "y": 150,
        "latitude": 19.0896,
        "longitude": 72.8656,
        "emoji": "✈️",

        # Accessibility summary
        "wheelchairAccessible": True,
        "lowVisionAccessible": True,

        "accessibility": [
            {
                "id": "airport-ramp",
                "type": "ramp",
                "name": "Terminal entrance ramp",
                "description": (
                    "Accessible ramp at "
                    "the terminal entrance."
                ),
                "latitude": 19.0897,
                "longitude": 72.8655,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "airport-elevator",
                "type": "elevator",
                "name": "Terminal elevator",
                "description": (
                    "Elevator available "
                    "inside the terminal."
                ),
                "latitude": 19.0895,
                "longitude": 72.8657,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "airport-entrance",
                "type": "accessible_entrance",
                "name": "Step-free terminal entrance",
                "description": (
                    "Step-free terminal "
                    "entrance available."
                ),
                "latitude": 19.0896,
                "longitude": 72.8656,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "airport-shuttle",
                "type": "accessible_shuttle",
                "name": "Accessible shuttle",
                "description": (
                    "Accessible shuttle "
                    "service available."
                ),
                "latitude": 19.0894,
                "longitude": 72.8655,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "airport-dropoff",
                "type": "warning",
                "name": "Busy drop-off zone",
                "description": (
                    "The terminal drop-off "
                    "area can be busy."
                ),
                "latitude": 19.0898,
                "longitude": 72.8657,
                "accessible": True,
                "wheelchair": True,
                "lowvision": False,
                "severity": "medium",
            },
        ],
    },

    {
        "id": "bkc",
        "name": "Bandra Kurla Complex",
        "area": "Bandra East",
        "distanceKm": 9.6,
        "score": 86,
        "tags": [
            "Step-free entrance",
            "Ramps available",
            "Smooth sidewalks",
        ],
        "warnings": [
            "Long pedestrian crossings",
        ],
        "x": 340,
        "y": 248,
        "latitude": 19.0650,
        "longitude": 72.8697,
        "emoji": "🏢",

        # Accessibility summary
        "wheelchairAccessible": True,
        "lowVisionAccessible": True,

        "accessibility": [
            {
                "id": "bkc-ramp",
                "type": "ramp",
                "name": "Accessible building ramp",
                "description": (
                    "Ramp available at "
                    "the accessible building entrance."
                ),
                "latitude": 19.0651,
                "longitude": 72.8696,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "bkc-sidewalk",
                "type": "accessible_sidewalk",
                "name": "Smooth sidewalk",
                "description": (
                    "Smooth sidewalk section "
                    "suitable for wheelchair movement."
                ),
                "latitude": 19.0650,
                "longitude": 72.8698,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "bkc-entrance",
                "type": "accessible_entrance",
                "name": "Step-free entrance",
                "description": (
                    "Step-free accessible entrance."
                ),
                "latitude": 19.0650,
                "longitude": 72.8697,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "low",
            },
            {
                "id": "bkc-crossing",
                "type": "accessible_crossing",
                "name": "Pedestrian crossing",
                "description": (
                    "Long pedestrian crossing. "
                    "Extra care may be required."
                ),
                "latitude": 19.0652,
                "longitude": 72.8699,
                "accessible": True,
                "wheelchair": True,
                "lowvision": True,
                "severity": "medium",
            },
        ],
    },
]


# ============================================================
# SAVED PLACES
# ============================================================

SAVED_PLACES = [
    {
        "id": "home",
        "name": "Home",
        "address": "Tardeo Road, Mumbai",
        "emoji": "🏠",
        "placeId": "apollo-hospital",
    },

    {
        "id": "college",
        "name": "College",
        "address": "Mahalaxmi, Mumbai",
        "emoji": "🎓",
        "placeId": "mumbai-central",
    },

    {
        "id": "hospital",
        "name": "Hospital",
        "address": "Tardeo, Mumbai",
        "emoji": "🏥",
        "placeId": "apollo-hospital",
    },

    {
        "id": "work",
        "name": "Work",
        "address": "BKC, Mumbai",
        "emoji": "💼",
        "placeId": "bkc",
    },
]


# ============================================================
# NAVIGATION STATES
# ============================================================

NAV_STATES = [
    {
        "instruction": "Turn left in 80 m",
        "detail": "Then continue straight for 200 m",
        "accessInstruction": (
            "♿ Ramp available on your right"
        ),
        "nextAccessPoint": "30 m",
    },

    {
        "instruction": "Continue straight for 200 m",
        "detail": "Then turn right onto Tardeo Road",
        "accessInstruction": (
            "♿ Use the ramp to cross the junction"
        ),
        "nextAccessPoint": "120 m",
    },

    {
        "instruction": "Turn right onto Tardeo Road",
        "detail": (
            "Continue 450 m to your destination"
        ),
        "accessInstruction": (
            "👁 Use the marked pedestrian crossing"
        ),
        "nextAccessPoint": "200 m",
    },

    {
        "instruction": "You have arrived",
        "detail": (
            "Mumbai Central Railway Station"
        ),
        "accessInstruction": (
            "♿ Step-free entrance ahead on your left"
        ),
        "nextAccessPoint": "Here",
    },
]


# ============================================================
# REPORT OPTIONS
# ============================================================

REPORT_OPTIONS = [
    "Blocked sidewalk",
    "Broken ramp",
    "Broken elevator",
    "Construction",
    "Obstacle",
    "Other",
]


# ============================================================
# ROUTES
# ============================================================

ROUTES = {
    "mumbai-central": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "12 min",
            "dist": "2.1 km",
            "tag": (
                "No stairs · Ramp available · "
                "Smooth sidewalk"
            ),
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "No stairs",
                    "ok": True,
                },
                {
                    "text": "Ramp available",
                    "ok": True,
                },
                {
                    "text": "Smooth sidewalk",
                    "ok": True,
                },
            ],
        },

        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "9 min",
            "dist": "1.8 km",
            "tag": (
                "Stairs · Uneven sidewalk"
            ),
            "features": [
                {
                    "text": "Stairs",
                    "ok": False,
                },
                {
                    "text": "Uneven sidewalk",
                    "ok": False,
                },
            ],
        },

        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "14 min",
            "dist": "2.4 km",
            "tag": (
                "Fewer obstacles · Clear crossings · "
                "Better visibility"
            ),
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True,
                },
                {
                    "text": "Clear crossings",
                    "ok": True,
                },
                {
                    "text": "Better visibility",
                    "ok": True,
                },
            ],
        },
    ],

    "phoenix-mall": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "15 min",
            "dist": "2.8 km",
            "tag": (
                "No stairs · Elevator available · "
                "Smooth entrance"
            ),
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "No stairs",
                    "ok": True,
                },
                {
                    "text": "Elevator available",
                    "ok": True,
                },
                {
                    "text": "Smooth entrance",
                    "ok": True,
                },
            ],
        },

        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "11 min",
            "dist": "2.3 km",
            "tag": (
                "Busy road · Uneven crossing"
            ),
            "features": [
                {
                    "text": "Busy road",
                    "ok": False,
                },
                {
                    "text": "Uneven crossing",
                    "ok": False,
                },
            ],
        },

        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "17 min",
            "dist": "3.1 km",
            "tag": (
                "Fewer obstacles · Clear crossings · "
                "Better visibility"
            ),
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True,
                },
                {
                    "text": "Clear crossings",
                    "ok": True,
                },
                {
                    "text": "Better visibility",
                    "ok": True,
                },
            ],
        },
    ],

    "apollo-hospital": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "18 min",
            "dist": "3.4 km",
            "tag": (
                "Ramp available · Elevator available · "
                "Step-free"
            ),
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Ramp available",
                    "ok": True,
                },
                {
                    "text": "Elevator available",
                    "ok": True,
                },
                {
                    "text": "Step-free",
                    "ok": True,
                },
            ],
        },

        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "14 min",
            "dist": "3.0 km",
            "tag": (
                "Uneven sidewalk · Busy crossing"
            ),
            "features": [
                {
                    "text": "Uneven sidewalk",
                    "ok": False,
                },
                {
                    "text": "Busy crossing",
                    "ok": False,
                },
            ],
        },

        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "20 min",
            "dist": "3.8 km",
            "tag": (
                "Fewer obstacles · Clear crossings · "
                "Better visibility"
            ),
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True,
                },
                {
                    "text": "Clear crossings",
                    "ok": True,
                },
                {
                    "text": "Better visibility",
                    "ok": True,
                },
            ],
        },
    ],

    "mumbai-airport": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "25 min",
            "dist": "6.2 km",
            "tag": (
                "Step-free entrance · Ramps · "
                "Accessible shuttle"
            ),
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Step-free entrance",
                    "ok": True,
                },
                {
                    "text": "Ramps",
                    "ok": True,
                },
                {
                    "text": "Accessible shuttle",
                    "ok": True,
                },
            ],
        },

        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "20 min",
            "dist": "5.7 km",
            "tag": (
                "Busy drop-off zone · Crowded crossing"
            ),
            "features": [
                {
                    "text": "Busy drop-off",
                    "ok": False,
                },
                {
                    "text": "Crowded crossing",
                    "ok": False,
                },
            ],
        },

        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "28 min",
            "dist": "6.7 km",
            "tag": (
                "Fewer obstacles · Clear crossings · "
                "Better visibility"
            ),
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True,
                },
                {
                    "text": "Clear crossings",
                    "ok": True,
                },
                {
                    "text": "Better visibility",
                    "ok": True,
                },
            ],
        },
    ],

    "bkc": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "30 min",
            "dist": "7.4 km",
            "tag": (
                "Smooth sidewalks · Ramps · "
                "Step-free entrance"
            ),
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Smooth sidewalks",
                    "ok": True,
                },
                {
                    "text": "Ramps",
                    "ok": True,
                },
                {
                    "text": "Step-free entrance",
                    "ok": True,
                },
            ],
        },

        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "24 min",
            "dist": "6.8 km",
            "tag": (
                "Long crossing · Uneven sidewalk"
            ),
            "features": [
                {
                    "text": "Long crossing",
                    "ok": False,
                },
                {
                    "text": "Uneven sidewalk",
                    "ok": False,
                },
            ],
        },

        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "33 min",
            "dist": "7.9 km",
            "tag": (
                "Fewer obstacles · Clear crossings · "
                "Better visibility"
            ),
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True,
                },
                {
                    "text": "Clear crossings",
                    "ok": True,
                },
                {
                    "text": "Better visibility",
                    "ok": True,
                },
            ],
        },
    ],
}