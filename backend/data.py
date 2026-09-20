# ============================================================
# ACCESSMOB BACKEND DATA
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
            "Elevators available"
        ],
        "warnings": [
            "Construction near Platform 2"
        ],
        "x": 168,
        "y": 312,
        "emoji": "🚉"
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
            "Accessible restrooms"
        ],
        "warnings": [],
        "x": 232,
        "y": 392,
        "emoji": "🛍️"
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
            "Elevators available"
        ],
        "warnings": [
            "Limited parking near main gate"
        ],
        "x": 120,
        "y": 420,
        "emoji": "🏥"
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
            "Accessible shuttle"
        ],
        "warnings": [
            "Busy drop-off zone"
        ],
        "x": 318,
        "y": 150,
        "emoji": "✈️"
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
            "Smooth sidewalks"
        ],
        "warnings": [
            "Long pedestrian crossings"
        ],
        "x": 340,
        "y": 248,
        "emoji": "🏢"
    }
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
        "placeId": "apollo-hospital"
    },
    {
        "id": "college",
        "name": "College",
        "address": "Mahalaxmi, Mumbai",
        "emoji": "🎓",
        "placeId": "mumbai-central"
    },
    {
        "id": "hospital",
        "name": "Hospital",
        "address": "Tardeo, Mumbai",
        "emoji": "🏥",
        "placeId": "apollo-hospital"
    },
    {
        "id": "work",
        "name": "Work",
        "address": "BKC, Mumbai",
        "emoji": "💼",
        "placeId": "bkc"
    }
]


# ============================================================
# NAVIGATION STATES
# ============================================================

NAV_STATES = [
    {
        "instruction": "Turn left in 80 m",
        "detail": "Then continue straight for 200 m",
        "accessInstruction": "♿ Ramp available on your right",
        "nextAccessPoint": "30 m"
    },
    {
        "instruction": "Continue straight for 200 m",
        "detail": "Then turn right onto Tardeo Road",
        "accessInstruction": "♿ Use the ramp to cross the junction",
        "nextAccessPoint": "120 m"
    },
    {
        "instruction": "Turn right onto Tardeo Road",
        "detail": "Continue 450 m to your destination",
        "accessInstruction": "👁 Use the marked pedestrian crossing",
        "nextAccessPoint": "200 m"
    },
    {
        "instruction": "You have arrived",
        "detail": "Mumbai Central Railway Station",
        "accessInstruction": "♿ Step-free entrance ahead on your left",
        "nextAccessPoint": "Here"
    }
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
    "Other"
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
            "tag": "No stairs · Ramp available · Smooth sidewalk",
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "No stairs",
                    "ok": True
                },
                {
                    "text": "Ramp available",
                    "ok": True
                },
                {
                    "text": "Smooth sidewalk",
                    "ok": True
                }
            ]
        },
        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "9 min",
            "dist": "1.8 km",
            "tag": "Stairs · Uneven sidewalk",
            "features": [
                {
                    "text": "Stairs",
                    "ok": False
                },
                {
                    "text": "Uneven sidewalk",
                    "ok": False
                }
            ]
        },
        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "14 min",
            "dist": "2.4 km",
            "tag": "Fewer obstacles · Clear crossings · Better visibility",
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True
                },
                {
                    "text": "Clear crossings",
                    "ok": True
                },
                {
                    "text": "Better visibility",
                    "ok": True
                }
            ]
        }
    ],

    "phoenix-mall": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "15 min",
            "dist": "2.8 km",
            "tag": "No stairs · Elevator available · Smooth entrance",
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "No stairs",
                    "ok": True
                },
                {
                    "text": "Elevator available",
                    "ok": True
                },
                {
                    "text": "Smooth entrance",
                    "ok": True
                }
            ]
        },
        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "11 min",
            "dist": "2.3 km",
            "tag": "Busy road · Uneven crossing",
            "features": [
                {
                    "text": "Busy road",
                    "ok": False
                },
                {
                    "text": "Uneven crossing",
                    "ok": False
                }
            ]
        },
        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "17 min",
            "dist": "3.1 km",
            "tag": "Fewer obstacles · Clear crossings · Better visibility",
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True
                },
                {
                    "text": "Clear crossings",
                    "ok": True
                },
                {
                    "text": "Better visibility",
                    "ok": True
                }
            ]
        }
    ],

    "apollo-hospital": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "18 min",
            "dist": "3.4 km",
            "tag": "Ramp available · Elevator available · Step-free",
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Ramp available",
                    "ok": True
                },
                {
                    "text": "Elevator available",
                    "ok": True
                },
                {
                    "text": "Step-free",
                    "ok": True
                }
            ]
        },
        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "14 min",
            "dist": "3.0 km",
            "tag": "Uneven sidewalk · Busy crossing",
            "features": [
                {
                    "text": "Uneven sidewalk",
                    "ok": False
                },
                {
                    "text": "Busy crossing",
                    "ok": False
                }
            ]
        },
        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "20 min",
            "dist": "3.8 km",
            "tag": "Fewer obstacles · Clear crossings · Better visibility",
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True
                },
                {
                    "text": "Clear crossings",
                    "ok": True
                },
                {
                    "text": "Better visibility",
                    "ok": True
                }
            ]
        }
    ],

    "mumbai-airport": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "25 min",
            "dist": "6.2 km",
            "tag": "Step-free entrance · Ramps · Accessible shuttle",
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Step-free entrance",
                    "ok": True
                },
                {
                    "text": "Ramps",
                    "ok": True
                },
                {
                    "text": "Accessible shuttle",
                    "ok": True
                }
            ]
        },
        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "20 min",
            "dist": "5.7 km",
            "tag": "Busy drop-off zone · Crowded crossing",
            "features": [
                {
                    "text": "Busy drop-off",
                    "ok": False
                },
                {
                    "text": "Crowded crossing",
                    "ok": False
                }
            ]
        },
        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "28 min",
            "dist": "6.7 km",
            "tag": "Fewer obstacles · Clear crossings · Better visibility",
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True
                },
                {
                    "text": "Clear crossings",
                    "ok": True
                },
                {
                    "text": "Better visibility",
                    "ok": True
                }
            ]
        }
    ],

    "bkc": [
        {
            "id": "accessible",
            "title": "Most Accessible",
            "emoji": "⭐",
            "color": "accessible",
            "time": "30 min",
            "dist": "7.4 km",
            "tag": "Smooth sidewalks · Ramps · Step-free entrance",
            "badge": "Recommended for you",
            "features": [
                {
                    "text": "Smooth sidewalks",
                    "ok": True
                },
                {
                    "text": "Ramps",
                    "ok": True
                },
                {
                    "text": "Step-free entrance",
                    "ok": True
                }
            ]
        },
        {
            "id": "fastest",
            "title": "Fastest",
            "emoji": "⚡",
            "color": "primary",
            "time": "24 min",
            "dist": "6.8 km",
            "tag": "Long crossing · Uneven sidewalk",
            "features": [
                {
                    "text": "Long crossing",
                    "ok": False
                },
                {
                    "text": "Uneven sidewalk",
                    "ok": False
                }
            ]
        },
        {
            "id": "clear",
            "title": "Clear Route",
            "emoji": "👁",
            "color": "warning",
            "time": "33 min",
            "dist": "7.9 km",
            "tag": "Fewer obstacles · Clear crossings · Better visibility",
            "features": [
                {
                    "text": "Fewer obstacles",
                    "ok": True
                },
                {
                    "text": "Clear crossings",
                    "ok": True
                },
                {
                    "text": "Better visibility",
                    "ok": True
                }
            ]
        }
    ]
}