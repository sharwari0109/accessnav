import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';

import 'leaflet/dist/leaflet.css';

import type { AccessibilityMode } from '@/types';

interface DestinationPoint {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  mode?: AccessibilityMode;
  route?: 'accessible' | 'fastest' | 'clear' | null;

  // Existing MongoDB destination support
  destinationId?: string | null;

  // New destination support for searched locations
  destinationPoint?: DestinationPoint | null;

  progress?: number;
  dim?: boolean;
  highContrast?: boolean;
}

interface BackendPlace {
  id?: string;
  _id?: string;

  name?: string;
  area?: string;

  latitude?: number;
  longitude?: number;

  lat?: number;
  lng?: number;
  lon?: number;

  coordinates?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    lon?: number;
  };

  accessibility?: string[];
  accessibility_features?: string[];

  tags?: string[];
  warnings?: string[];

  wheelchair?: boolean;
  wheelchair_accessible?: boolean;

  ramp?: boolean;
  elevator?: boolean;
  accessible_entrance?: boolean;
  clear_crossing?: boolean;
  obstruction?: boolean;
}

interface MapPlace {
  id: string;
  name: string;
  area: string;
  position: [number, number];

  tags: string[];
  warnings: string[];

  wheelchair: boolean;
  ramp: boolean;
  elevator: boolean;
  accessibleEntrance: boolean;
  clearCrossing: boolean;
  obstruction: boolean;
}

const MUMBAI_CENTER: [number, number] = [
  19.076,
  72.8777,
];

/*
 * These are only fallback/demo points.
 *
 * Once the backend returns latitude/longitude for every
 * place/accessibility point, those backend coordinates
 * will automatically be used instead.
 */
const DEMO_PLACES: MapPlace[] = [
  {
    id: 'ramp-1',
    name: 'Accessible Ramp',
    area: 'Mumbai',
    position: [19.075, 72.879],
    tags: ['ramp', 'step-free'],
    warnings: [],
    wheelchair: true,
    ramp: true,
    elevator: false,
    accessibleEntrance: false,
    clearCrossing: false,
    obstruction: false,
  },
  {
    id: 'elevator-1',
    name: 'Accessible Elevator',
    area: 'Mumbai',
    position: [19.078, 72.875],
    tags: ['elevator', 'accessible'],
    warnings: [],
    wheelchair: true,
    ramp: false,
    elevator: true,
    accessibleEntrance: false,
    clearCrossing: false,
    obstruction: false,
  },
  {
    id: 'entrance-1',
    name: 'Step-free Entrance',
    area: 'Mumbai',
    position: [19.0735, 72.8765],
    tags: ['entrance', 'step-free'],
    warnings: [],
    wheelchair: true,
    ramp: false,
    elevator: false,
    accessibleEntrance: true,
    clearCrossing: false,
    obstruction: false,
  },
  {
    id: 'crossing-1',
    name: 'Clear Pedestrian Crossing',
    area: 'Mumbai',
    position: [19.0745, 72.8785],
    tags: ['crossing', 'clear'],
    warnings: [],
    wheelchair: false,
    ramp: false,
    elevator: false,
    accessibleEntrance: false,
    clearCrossing: true,
    obstruction: false,
  },
  {
    id: 'warning-1',
    name: 'Possible Obstruction',
    area: 'Mumbai',
    position: [19.077, 72.881],
    tags: ['warning'],
    warnings: ['Possible obstruction ahead'],
    wheelchair: false,
    ramp: false,
    elevator: false,
    accessibleEntrance: false,
    clearCrossing: false,
    obstruction: true,
  },
];

/*
 * Demo route geometry.
 *
 * These are frontend demonstration paths.
 * They are NOT real-world turn-by-turn navigation.
 */
const ACCESSIBLE_ROUTE: [number, number][] = [
  [19.0715, 72.8735],
  [19.073, 72.875],
  [19.075, 72.876],
  [19.076, 72.878],
  [19.0775, 72.8795],
  [19.079, 72.881],
];

const FASTEST_ROUTE: [number, number][] = [
  [19.0715, 72.8735],
  [19.0735, 72.8745],
  [19.0755, 72.8765],
  [19.077, 72.878],
  [19.079, 72.881],
];

const CLEAR_ROUTE: [number, number][] = [
  [19.0715, 72.8735],
  [19.073, 72.875],
  [19.0745, 72.877],
  [19.076, 72.879],
  [19.078, 72.88],
  [19.079, 72.881],
];

/* ---------------------------------------------------------
   Destination marker
--------------------------------------------------------- */

const destinationIcon = L.divIcon({
  className: 'accessnav-destination-marker',

  html: `
    <div
      style="
        width:42px;
        height:42px;
        border-radius:50%;
        background:#4f46e5;
        border:4px solid white;
        box-shadow:0 4px 16px rgba(0,0,0,.4);
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:20px;
        font-weight:700;
      "
      aria-label="Destination"
    >
      📍
    </div>
  `,

  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizePlace(
  place: BackendPlace,
  index: number,
): MapPlace | null {
  const latitude =
    toNumber(place.latitude) ??
    toNumber(place.lat) ??
    toNumber(place.coordinates?.latitude) ??
    toNumber(place.coordinates?.lat);

  const longitude =
    toNumber(place.longitude) ??
    toNumber(place.lng) ??
    toNumber(place.lon) ??
    toNumber(place.coordinates?.longitude) ??
    toNumber(place.coordinates?.lng) ??
    toNumber(place.coordinates?.lon);

  if (latitude === null || longitude === null) {
    return null;
  }

  const tags = [
    ...(place.tags ?? []),
    ...(place.accessibility ?? []),
    ...(place.accessibility_features ?? []),
  ].map((item) => String(item).toLowerCase());

  const warnings = (place.warnings ?? []).map((item) =>
    String(item),
  );

  const hasTag = (...names: string[]) =>
    names.some((name) =>
      tags.some((tag) =>
        tag.includes(name.toLowerCase()),
      ),
    );

  return {
    id: String(
      place.id ??
        place._id ??
        `backend-${index}`,
    ),

    name:
      place.name ??
      `Accessible Place ${index + 1}`,

    area:
      place.area ??
      'Mumbai',

    position: [
      latitude,
      longitude,
    ],

    tags,

    warnings,

    wheelchair:
      Boolean(
        place.wheelchair ??
          place.wheelchair_accessible,
      ) ||
      hasTag(
        'wheelchair',
        'accessible',
      ),

    ramp:
      Boolean(place.ramp) ||
      hasTag(
        'ramp',
        'step-free',
      ),

    elevator:
      Boolean(place.elevator) ||
      hasTag(
        'elevator',
        'lift',
      ),

    accessibleEntrance:
      Boolean(
        place.accessible_entrance,
      ) ||
      hasTag(
        'entrance',
        'step-free',
      ),

    clearCrossing:
      Boolean(place.clear_crossing) ||
      hasTag(
        'crossing',
        'clear crossing',
      ),

    obstruction:
      Boolean(place.obstruction) ||
      warnings.length > 0 ||
      hasTag(
        'warning',
        'obstruction',
        'blocked',
      ),
  };
}

/* ---------------------------------------------------------
   Backend loader
--------------------------------------------------------- */

async function loadPlaces(): Promise<MapPlace[]> {
  try {
    const response = await fetch('/api/places');

    if (!response.ok) {
      throw new Error(
        `Places request failed: ${response.status}`,
      );
    }

    const data = await response.json();

    const rawPlaces: BackendPlace[] =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.places)
          ? data.places
          : Array.isArray(data?.items)
            ? data.items
            : [];

    const normalized = rawPlaces
      .map(normalizePlace)
      .filter(
        (place): place is MapPlace =>
          place !== null,
      );

    return normalized;
  } catch (error) {
    console.error(
      'AccessNav map: unable to load backend places',
      error,
    );

    return [];
  }
}

/* ---------------------------------------------------------
   Map controller
--------------------------------------------------------- */

function MapController({
  destination,
  highContrast,
}: {
  destination: [number, number] | null;
  highContrast: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!destination) {
      return;
    }

    map.flyTo(destination, 16, {
      duration: 1,
    });
  }, [destination, map]);

  useEffect(() => {
    if (!highContrast) {
      return;
    }

    map.setZoom(
      Math.max(map.getZoom(), 14),
    );
  }, [highContrast, map]);

  return null;
}

/* ---------------------------------------------------------
   Marker styling
--------------------------------------------------------- */

function getMarkerStyle(
  type:
    | 'ramp'
    | 'elevator'
    | 'entrance'
    | 'crossing'
    | 'warning'
    | 'place',
  mode: AccessibilityMode,
) {
  const radius =
    mode === 'lowvision'
      ? 15
      : 10;

  switch (type) {
    case 'ramp':
      return {
        color: '#047857',
        fillColor: '#10b981',
        radius,
      };

    case 'elevator':
      return {
        color: '#3730a3',
        fillColor: '#6366f1',
        radius,
      };

    case 'entrance':
      return {
        color: '#166534',
        fillColor: '#22c55e',
        radius,
      };

    case 'crossing':
      return {
        color: '#075985',
        fillColor: '#38bdf8',
        radius,
      };

    case 'warning':
      return {
        color: '#92400e',
        fillColor: '#f59e0b',
        radius,
      };

    default:
      return {
        color: '#1e293b',
        fillColor: '#94a3b8',
        radius,
      };
  }
}

/* ---------------------------------------------------------
   Route
--------------------------------------------------------- */

function getRouteCoordinates(
  route: Props['route'],
): [number, number][] {
  if (route === 'accessible') {
    return ACCESSIBLE_ROUTE;
  }

  if (route === 'fastest') {
    return FASTEST_ROUTE;
  }

  if (route === 'clear') {
    return CLEAR_ROUTE;
  }

  return [];
}

/* ---------------------------------------------------------
   Main map
--------------------------------------------------------- */

export default function MumbaiMap({
  mode = 'wheelchair',
  route = null,
  destinationId = null,
  destinationPoint = null,
  progress = 0,
  dim = false,
  highContrast = false,
}: Props) {
  const [backendPlaces, setBackendPlaces] =
    useState<MapPlace[]>([]);

  const [loadingPlaces, setLoadingPlaces] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlaces() {
      setLoadingPlaces(true);

      const places = await loadPlaces();

      if (!cancelled) {
        setBackendPlaces(places);
        setLoadingPlaces(false);
      }
    }

    fetchPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Use backend data whenever coordinates exist.
   * Demo points remain as a fallback.
   */
  const places = useMemo(() => {
    if (backendPlaces.length > 0) {
      return backendPlaces;
    }

    return DEMO_PLACES;
  }, [backendPlaces]);

  const routeCoordinates =
    getRouteCoordinates(route);

  /*
   * Destination.
   *
   * Priority:
   *
   * 1. destinationPoint
   *    -> searched location
   *
   * 2. destinationId
   *    -> existing MongoDB destination
   *
   * 3. null
   */
  const destination = useMemo(() => {
    /*
     * New search destination.
     */
    if (destinationPoint) {
      return [
        destinationPoint.lat,
        destinationPoint.lng,
      ] as [number, number];
    }

    /*
     * Existing MongoDB destination support.
     */
    if (!destinationId) {
      return null;
    }

    const selected = places.find(
      (place) =>
        place.id === destinationId,
    );

    if (selected) {
      return selected.position;
    }

    /*
     * IMPORTANT:
     * No hardcoded destination anymore.
     */
    return null;
  }, [
    destinationPoint,
    destinationId,
    places,
  ]);

  /*
   * Accessibility filtering.
   */
  const visiblePlaces = useMemo(() => {
    return places.filter((place) => {
      if (mode === 'wheelchair') {
        return (
          place.wheelchair ||
          place.ramp ||
          place.elevator ||
          place.accessibleEntrance ||
          place.obstruction
        );
      }

      return (
        place.clearCrossing ||
        place.accessibleEntrance ||
        place.obstruction
      );
    });
  }, [places, mode]);

  /*
   * Calculate current position along route.
   */
  const currentPosition = useMemo(() => {
    if (
      progress <= 0 ||
      routeCoordinates.length === 0
    ) {
      return null;
    }

    const percentage =
      Math.min(
        Math.max(progress, 0),
        100,
      ) / 100;

    const index = Math.min(
      routeCoordinates.length - 1,
      Math.floor(
        percentage *
          routeCoordinates.length,
      ),
    );

    return routeCoordinates[index];
  }, [
    progress,
    routeCoordinates,
  ]);

  return (
    <div
      className={`absolute inset-0 ${
        dim
          ? 'brightness-95'
          : ''
      }`}
      style={{
        zIndex: 0,
      }}
    >
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={14}
        scrollWheelZoom
        dragging
        doubleClickZoom
        touchZoom
        zoomControl
        className={`h-full w-full ${
          highContrast
            ? 'contrast-125 saturate-150'
            : ''
        }`}
        style={{
          zIndex: 0,
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          destination={destination}
          highContrast={highContrast}
        />

        {/* -------------------------------------------------
            Accessibility points
        ------------------------------------------------- */}

        {visiblePlaces.map((place) => {
          let markerType:
            | 'ramp'
            | 'elevator'
            | 'entrance'
            | 'crossing'
            | 'warning'
            | 'place' = 'place';

          if (place.obstruction) {
            markerType = 'warning';
          } else if (place.ramp) {
            markerType = 'ramp';
          } else if (place.elevator) {
            markerType = 'elevator';
          } else if (
            place.accessibleEntrance
          ) {
            markerType = 'entrance';
          } else if (
            place.clearCrossing
          ) {
            markerType = 'crossing';
          }

          const style =
            getMarkerStyle(
              markerType,
              mode,
            );

          return (
            <CircleMarker
              key={place.id}
              center={place.position}
              radius={style.radius}
              pathOptions={{
                color: style.color,
                fillColor:
                  style.fillColor,
                fillOpacity: 0.95,
                weight:
                  mode ===
                  'lowvision'
                    ? 5
                    : 3,
              }}
            >
              <Popup>
                <div
                  style={{
                    minWidth:
                      mode ===
                      'lowvision'
                        ? 230
                        : 180,

                    fontSize:
                      mode ===
                      'lowvision'
                        ? 17
                        : 14,

                    lineHeight: 1.55,
                  }}
                >
                  <strong>
                    {place.name}
                  </strong>

                  <br />

                  <span>
                    {place.area}
                  </span>

                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 700,
                    }}
                  >
                    {place.ramp &&
                      '♿ Ramp available'}

                    {place.elevator &&
                      ' 🛗 Elevator available'}

                    {place.accessibleEntrance &&
                      ' 🚪 Step-free entrance'}

                    {place.clearCrossing &&
                      ' 🚸 Clear crossing'}

                    {place.obstruction &&
                      ' ⚠️ Accessibility warning'}
                  </div>

                  {place.warnings.length >
                    0 && (
                    <div
                      style={{
                        marginTop: 6,
                      }}
                    >
                      {place.warnings.map(
                        (warning) => (
                          <div
                            key={warning}
                          >
                            ⚠️ {warning}
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {place.tags.length >
                    0 && (
                    <div
                      style={{
                        marginTop: 8,
                        color:
                          '#475569',
                      }}
                    >
                      {place.tags
                        .slice(0, 5)
                        .join(
                          ' • ',
                        )}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* -------------------------------------------------
            Route
        ------------------------------------------------- */}

        {routeCoordinates.length >
          0 && (
          <Polyline
            positions={
              routeCoordinates
            }
            pathOptions={{
              color:
                route ===
                'accessible'
                  ? '#059669'
                  : route ===
                      'fastest'
                    ? '#4f46e5'
                    : '#d97706',

              weight:
                mode ===
                'lowvision'
                  ? 10
                  : 7,

              opacity: 0.95,

              lineCap: 'round',

              lineJoin: 'round',

              dashArray:
                route ===
                'clear'
                  ? '12 8'
                  : undefined,
            }}
          />
        )}

        {/* -------------------------------------------------
            Destination
        ------------------------------------------------- */}

        {destination && (
          <Marker
            position={destination}
            icon={destinationIcon}
          >
            <Popup>
              <div
                style={{
                  minWidth:
                    mode ===
                    'lowvision'
                      ? 220
                      : 170,

                  fontSize:
                    mode ===
                    'lowvision'
                      ? 18
                      : 14,

                  lineHeight: 1.5,
                }}
              >
                <strong>
                  📍{' '}
                  {destinationPoint?.name ??
                    'Destination'}
                </strong>

                <br />

                <span>
                  {mode ===
                  'wheelchair'
                    ? 'Wheelchair navigation mode'
                    : 'Low-vision navigation mode'}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* -------------------------------------------------
            Current location / progress
        ------------------------------------------------- */}

        {currentPosition && (
          <CircleMarker
            center={
              currentPosition
            }
            radius={
              mode ===
              'lowvision'
                ? 13
                : 9
            }
            pathOptions={{
              color: '#ffffff',
              fillColor: '#dc2626',
              fillOpacity: 1,
              weight: 5,
            }}
          >
            <Popup>
              <div
                style={{
                  fontSize:
                    mode ===
                    'lowvision'
                      ? 18
                      : 14,
                }}
              >
                <strong>
                  📍 Your current
                  position
                </strong>

                <br />

                <span>
                  {Math.round(
                    progress,
                  )}
                  % of route
                </span>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* ---------------------------------------------------
          Mode indicator
      --------------------------------------------------- */}

      <div
        className="pointer-events-none absolute left-3 top-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl"
        style={{
          zIndex: 30,

          border:
            mode ===
            'lowvision'
              ? '3px solid #111827'
              : '2px solid #e2e8f0',
        }}
      >
        <div
          className={
            mode ===
            'lowvision'
              ? 'text-lg font-extrabold text-slate-950'
              : 'text-sm font-bold text-slate-900'
          }
        >
          {mode ===
          'wheelchair'
            ? '♿ Wheelchair Mode'
            : '👁 Low Vision Mode'}
        </div>

        <div
          className={
            mode ===
            'lowvision'
              ? 'mt-1 text-sm font-semibold text-slate-700'
              : 'mt-1 text-xs text-slate-500'
          }
        >
          {mode ===
          'wheelchair'
            ? 'Ramps • Elevators • Step-free'
            : 'High contrast • Clear crossings'}
        </div>
      </div>

      {/* ---------------------------------------------------
          Backend loading indicator
      --------------------------------------------------- */}

      {loadingPlaces && (
        <div
          className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg"
          style={{
            zIndex: 30,
          }}
        >
          Loading accessibility data…
        </div>
      )}

      {/* ---------------------------------------------------
          Data source indicator
      --------------------------------------------------- */}

      {!loadingPlaces && (
        <div
          className="pointer-events-none absolute bottom-4 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow"
          style={{
            zIndex: 30,
          }}
        >
          {backendPlaces.length > 0
            ? `● Live accessibility data • ${backendPlaces.length} places`
            : '● Demo accessibility data'}
        </div>
      )}

      {/* ---------------------------------------------------
          High contrast border
      --------------------------------------------------- */}

      {highContrast && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 20,
            border:
              '5px solid #facc15',
          }}
        />
      )}
    </div>
  );
}