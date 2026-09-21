import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';

import { useApp } from '@/store';

import BottomSheet from '@/components/BottomSheet';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';

import {
  Check,
  AlertTriangle,
  Navigation,
  LocateFixed,
  MapPin,
} from 'lucide-react';

import {
  getPlaceAccessibility,
  type AccessibilityPoint,
} from '@/api';

import 'leaflet/dist/leaflet.css';


// ============================================================
// TYPES
// ============================================================

type RouteId =
  | 'accessible'
  | 'fastest'
  | 'clear';

interface RouteFeature {
  text: string;
  ok: boolean;
}

interface RouteData {
  id: RouteId;
  title: string;
  emoji: string;
  color: string;
  time: string;
  dist: string;
  tag: string;
  badge?: string;
  features: RouteFeature[];
  coordinates: [number, number][];
}

interface OsrmRoute {
  distance: number;
  duration: number;

  geometry: {
    coordinates: [
      number,
      number,
    ][];
  };
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}


// ============================================================
// HELPERS
// ============================================================

function formatDistance(
  meters: number,
) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}


function formatDuration(
  seconds: number,
) {
  const minutes =
    Math.max(
      1,
      Math.round(
        seconds / 60,
      ),
    );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  const remainingMinutes =
    minutes % 60;

  if (
    remainingMinutes === 0
  ) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}


// ============================================================
// DESTINATION ICON
// ============================================================

function createDestinationIcon() {
  return L.divIcon({
    className: '',

    html: `
      <div
        style="
          width: 42px;
          height: 42px;
          border-radius: 9999px;
          background: #2563eb;
          border: 4px solid white;
          box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          font-weight: 800;
        "
      >
        <span>●</span>
      </div>
    `,

    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}


// ============================================================
// CURRENT LOCATION ICON
// ============================================================

function createCurrentLocationIcon() {
  return L.divIcon({
    className: '',

    html: `
      <div
        style="
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          background: #0f766e;
          border: 4px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        "
      ></div>
    `,

    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}


// ============================================================
// ACCESSIBILITY ICON
// ============================================================

function getAccessibilityIcon(
  point: AccessibilityPoint,
) {
  switch (point.type) {
    case 'ramp':
      return '♿';

    case 'elevator':
      return '🛗';

    case 'accessible_entrance':
      return '🚪';

    case 'accessible_crossing':
      return '🚸';

    case 'accessible_sidewalk':
      return '🚶';

    case 'accessible_shuttle':
      return '🚌';

    case 'accessible_restroom':
      return '🚻';

    case 'blocked_path':
      return '⛔';

    case 'warning':
      return '⚠️';

    default:
      return '♿';
  }
}


// ============================================================
// FIT ROUTE
// ============================================================

function FitRoute({
  currentLocation,
  destination,
  coordinates,
}: {
  currentLocation:
    | [number, number]
    | null;

  destination:
    [number, number];

  coordinates:
    [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (
      coordinates.length < 2
    ) {
      if (currentLocation) {
        map.setView(
          currentLocation,
          14,
        );
      } else {
        map.setView(
          destination,
          14,
        );
      }

      return;
    }

    const bounds =
      L.latLngBounds(
        coordinates.map(
          ([lat, lng]) => [
            lat,
            lng,
          ],
        ),
      );

    map.fitBounds(
      bounds,
      {
        padding: [
          40,
          220,
        ],
        maxZoom: 17,
      },
    );
  }, [
    map,
    currentLocation,
    destination,
    coordinates,
  ]);

  return null;
}


// ============================================================
// MAIN ROUTES SCREEN
// ============================================================

export default function Routes() {
  const {
    destination,
    selectedRoute,
    setSelectedRoute,
    go,
    mode,
  } = useApp();

  // ----------------------------------------------------------
  // Location
  // ----------------------------------------------------------

  const [
    currentLocation,
    setCurrentLocation,
  ] = useState<
    [number, number] | null
  >(null);

  // ----------------------------------------------------------
  // Routes
  // ----------------------------------------------------------

  const [
    routes,
    setRoutes,
  ] = useState<RouteData[]>(
    [],
  );

  // ----------------------------------------------------------
  // Accessibility
  // ----------------------------------------------------------

  const [
    accessibilityPoints,
    setAccessibilityPoints,
  ] = useState<
    AccessibilityPoint[]
  >([]);

  const [
    accessibilityAvailable,
    setAccessibilityAvailable,
  ] = useState(false);

  const [
    loadingAccessibility,
    setLoadingAccessibility,
  ] = useState(false);

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------

  const [
    loadingLocation,
    setLoadingLocation,
  ] = useState(true);

  const [
    loadingRoute,
    setLoadingRoute,
  ] = useState(false);

  // ----------------------------------------------------------
  // Error
  // ----------------------------------------------------------

  const [
    error,
    setError,
  ] = useState('');

  // ----------------------------------------------------------
  // Destination
  // ----------------------------------------------------------

  const destinationPoint =
    useMemo<
      [number, number] | null
    >(() => {
      if (!destination) {
        return null;
      }

      return [
        destination.lat,
        destination.lng,
      ];
    }, [destination]);

  // ==========================================================
  // GET CURRENT LOCATION
  // ==========================================================

  useEffect(() => {
    if (
      !navigator.geolocation
    ) {
      setLoadingLocation(false);

      setError(
        'Your browser does not support location services.',
      );

      return;
    }

    setLoadingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);

        setLoadingLocation(false);
      },

      (locationError) => {
        console.error(
          'Location error:',
          locationError,
        );

        setLoadingLocation(false);

        switch (
          locationError.code
        ) {
          case locationError.PERMISSION_DENIED:
            setError(
              'Location permission was denied. Please allow location access in your browser.',
            );
            break;

          case locationError.POSITION_UNAVAILABLE:
            setError(
              'Your current location could not be determined.',
            );
            break;

          case locationError.TIMEOUT:
            setError(
              'Getting your current location timed out.',
            );
            break;

          default:
            setError(
              'Unable to get your current location.',
            );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }, []);


  // ==========================================================
  // LOAD ACCESSIBILITY DATA
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadAccessibility() {
      /*
       * Arbitrary searched destinations do not necessarily
       * exist in our MongoDB accessibility database.
       *
       * In that situation we keep the normal OSRM route,
       * but clearly indicate that accessibility data is
       * unavailable.
       */

      if (
        !destination?.place?.id
      ) {
        setAccessibilityPoints([]);
        setAccessibilityAvailable(false);
        setLoadingAccessibility(false);

        return;
      }

      try {
        setLoadingAccessibility(
          true,
        );

        const data =
          await getPlaceAccessibility(
            destination.place.id,
          );

        if (cancelled) {
          return;
        }

        const points =
          mode === 'wheelchair'
            ? data.wheelchair.points
            : data.lowvision.points;

        setAccessibilityPoints(
          points,
        );

        setAccessibilityAvailable(
          data.dataAvailable,
        );
      } catch (err) {
        console.error(
          'Accessibility data error:',
          err,
        );

        if (!cancelled) {
          setAccessibilityPoints(
            [],
          );

          setAccessibilityAvailable(
            false,
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAccessibility(
            false,
          );
        }
      }
    }

    loadAccessibility();

    return () => {
      cancelled = true;
    };
  }, [
    destination?.place?.id,
    mode,
  ]);


  // ==========================================================
  // CALCULATE REAL ROUTE
  // ==========================================================

  useEffect(() => {
    if (
      !currentLocation ||
      !destinationPoint
    ) {
      return;
    }

    async function calculateRoute() {
      try {
        setLoadingRoute(true);
        setError('');

        const [
          currentLat,
          currentLng,
        ] = currentLocation!;

        const [
          destinationLat,
          destinationLng,
        ] = destinationPoint!;

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${currentLng},${currentLat};` +
          `${destinationLng},${destinationLat}` +
          `?overview=full&geometries=geojson&alternatives=true`;

        const response =
          await fetch(url);

        if (!response.ok) {
          throw new Error(
            `Routing request failed: ${response.status}`,
          );
        }

        const data =
          (await response.json()) as OsrmResponse;

        if (
          data.code !== 'Ok' ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error(
            'No route was returned by the routing service.',
          );
        }

        const firstRoute =
          data.routes[0];

        const coordinates =
          firstRoute.geometry.coordinates.map(
            ([lng, lat]) =>
              [
                lat,
                lng,
              ] as [
                number,
                number,
              ],
          );

        const calculatedRoutes:
          RouteData[] = [];


        // ======================================================
        // ACCESSIBILITY INFORMATION
        // ======================================================

        const ramps =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
              'ramp',
          );

        const elevators =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
              'elevator',
          );

        const entrances =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
              'accessible_entrance',
          );

        const crossings =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
              'accessible_crossing',
          );

        const sidewalks =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
              'accessible_sidewalk',
          );

        const warnings =
          accessibilityPoints.filter(
            (point) =>
              point.type ===
                'warning' ||
              point.type ===
                'blocked_path',
          );


        // ======================================================
        // ACCESSIBLE / CLEAR ROUTE
        // ======================================================

        const accessibilityFeatures:
          RouteFeature[] = [];

        if (
          mode === 'wheelchair'
        ) {
          accessibilityFeatures.push(
            {
              text:
                ramps.length > 0
                  ? 'Ramp available'
                  : 'Ramp data unavailable',
              ok:
                ramps.length > 0,
            },
          );

          accessibilityFeatures.push(
            {
              text:
                elevators.length > 0
                  ? 'Elevator available'
                  : 'No elevator data',
              ok:
                elevators.length > 0,
            },
          );

          accessibilityFeatures.push(
            {
              text:
                entrances.length > 0
                  ? 'Step-free entrance'
                  : 'Entrance data unavailable',
              ok:
                entrances.length > 0,
            },
          );
        } else {
          accessibilityFeatures.push(
            {
              text:
                crossings.length > 0
                  ? 'Accessible crossings'
                  : 'Crossing data unavailable',
              ok:
                crossings.length > 0,
            },
          );

          accessibilityFeatures.push(
            {
              text:
                sidewalks.length > 0
                  ? 'Clear sidewalk information'
                  : 'Sidewalk data unavailable',
              ok:
                sidewalks.length > 0,
            },
          );
        }


        // ======================================================
        // WARNINGS
        // ======================================================

        if (
          warnings.length > 0
        ) {
          accessibilityFeatures.push(
            {
              text:
                `${warnings.length} accessibility warning${
                  warnings.length === 1
                    ? ''
                    : 's'
                }`,
              ok: false,
            },
          );
        }


        // ======================================================
        // ACCESSIBLE ROUTE
        // ======================================================

        calculatedRoutes.push({
          id: 'accessible',

          title:
            mode === 'wheelchair'
              ? 'ACCESSIBLE'
              : 'CLEAR',

          emoji:
            mode === 'wheelchair'
              ? '♿'
              : '👁️',

          color: '#16a34a',

          time:
            formatDuration(
              firstRoute.duration,
            ),

          dist:
            formatDistance(
              firstRoute.distance,
            ),

          tag:
            accessibilityAvailable
              ? mode === 'wheelchair'
                ? 'Accessibility information available'
                : 'Low-vision information available'
              : 'Standard road route',

          badge:
            accessibilityAvailable
              ? mode === 'wheelchair'
                ? 'Accessibility data loaded'
                : 'Low-vision data loaded'
              : 'Accessibility data unavailable',

          features: [
            {
              text: 'Real route',
              ok: true,
            },

            ...accessibilityFeatures,
          ],

          coordinates,
        });


        // ======================================================
        // FASTEST ROUTE
        // ======================================================

        calculatedRoutes.push({
          id: 'fastest',

          title: 'FASTEST',

          emoji: '⚡',

          color: '#2563eb',

          time:
            formatDuration(
              firstRoute.duration,
            ),

          dist:
            formatDistance(
              firstRoute.distance,
            ),

          tag:
            'Fastest road route returned by OSRM',

          features: [
            {
              text: 'Real route',
              ok: true,
            },

            {
              text: 'Road routing',
              ok: true,
            },

            ...(mode === 'wheelchair'
              ? [
                  {
                    text:
                      'Accessibility not guaranteed',
                    ok: false,
                  },
                ]
              : [
                  {
                    text:
                      'Low-vision accessibility not guaranteed',
                    ok: false,
                  },
                ]),
          ],

          coordinates,
        });


        // ======================================================
        // CLEAR / ALTERNATIVE ROUTE
        // ======================================================

        const alternativeRoute =
          data.routes[1];

        if (
          alternativeRoute
        ) {
          const alternativeCoordinates =
            alternativeRoute.geometry.coordinates.map(
              ([lng, lat]) =>
                [
                  lat,
                  lng,
                ] as [
                  number,
                  number,
                ],
            );

          calculatedRoutes.push({
            id: 'clear',

            title: 'CLEAR',

            emoji: '🟡',

            color: '#f59e0b',

            time:
              formatDuration(
                alternativeRoute.duration,
              ),

            dist:
              formatDistance(
                alternativeRoute.distance,
              ),

            tag:
              'Alternative road route',

            features: [
              {
                text:
                  'Real alternative',
                ok: true,
              },

              {
                text:
                  accessibilityAvailable
                    ? 'Accessibility data loaded'
                    : 'Accessibility data unavailable',
                ok:
                  accessibilityAvailable,
              },

              ...(warnings.length > 0
                ? [
                    {
                      text:
                        'Accessibility warnings nearby',
                      ok: false,
                    },
                  ]
                : []),
            ],

            coordinates:
              alternativeCoordinates,
          });
        } else {
          calculatedRoutes.push({
            id: 'clear',

            title: 'CLEAR',

            emoji: '🟡',

            color: '#f59e0b',

            time:
              formatDuration(
                firstRoute.duration,
              ),

            dist:
              formatDistance(
                firstRoute.distance,
              ),

            tag:
              'Alternative route unavailable',

            features: [
              {
                text: 'Real route',
                ok: true,
              },

              {
                text:
                  'Alternative unavailable',
                ok: false,
              },
            ],

            coordinates,
          });
        }


        // ======================================================
        // SAVE ROUTES
        // ======================================================

        setRoutes(
          calculatedRoutes,
        );


        // ======================================================
        // KEEP CURRENT SELECTION
        // ======================================================

        const selectedStillExists =
          calculatedRoutes.some(
            (route) =>
              route.id ===
              selectedRoute,
          );

        if (
          !selectedStillExists
        ) {
          setSelectedRoute(
            'accessible',
          );
        }
      } catch (err) {
        console.error(
          'Failed to calculate route:',
          err,
        );

        setRoutes([]);

        setError(
          'Unable to calculate a route to this destination.',
        );
      } finally {
        setLoadingRoute(
          false,
        );
      }
    }

    calculateRoute();
  }, [
    currentLocation,
    destinationPoint,
    mode,
    accessibilityPoints,
    accessibilityAvailable,
  ]);


  // ==========================================================
  // NO DESTINATION
  // ==========================================================

  if (
    !destination ||
    !destinationPoint
  ) {
    return null;
  }


  // ==========================================================
  // SELECTED ROUTE
  // ==========================================================

  const selectedRouteData =
    routes.find(
      (route) =>
        route.id ===
        selectedRoute,
    ) ??
    routes[0];

  const routeCoordinates =
    selectedRouteData?.coordinates ??
    [];


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">

      {/* ================================================== */}
      {/* MAP */}
      {/* ================================================== */}

      <div className="absolute inset-0">
        <MapContainer
          center={
            destinationPoint
          }
          zoom={14}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* CURRENT LOCATION */}

          {currentLocation && (
            <Marker
              position={
                currentLocation
              }
              icon={createCurrentLocationIcon()}
            />
          )}

          {/* DESTINATION */}

          <Marker
            position={
              destinationPoint
            }
            icon={createDestinationIcon()}
          />

          {/* ACCESSIBILITY POINTS */}

          {accessibilityPoints.map(
            (point) => (
              <Marker
                key={point.id}
                position={[
                  point.latitude,
                  point.longitude,
                ]}
                icon={L.divIcon({
                  className: '',
                  html: `
                    <div
                      style="
                        width: 30px;
                        height: 30px;
                        border-radius: 9999px;
                        background: white;
                        border: 2px solid #16a34a;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 15px;
                      "
                    >
                      ${getAccessibilityIcon(point)}
                    </div>
                  `,
                  iconSize: [
                    30,
                    30,
                  ],
                  iconAnchor: [
                    15,
                    15,
                  ],
                })}
              />
            ),
          )}

          {/* ROUTE */}

          {routeCoordinates.length >
            1 && (
            <>
              <Polyline
                positions={
                  routeCoordinates
                }
                pathOptions={{
                  color:
                    '#ffffff',
                  weight: 9,
                  opacity: 0.9,
                }}
              />

              <Polyline
                positions={
                  routeCoordinates
                }
                pathOptions={{
                  color:
                    selectedRoute ===
                    'accessible'
                      ? '#16a34a'
                      : selectedRoute ===
                          'fastest'
                        ? '#2563eb'
                        : '#f59e0b',

                  weight: 6,

                  opacity: 0.95,
                }}
              />
            </>
          )}

          <FitRoute
            currentLocation={
              currentLocation
            }
            destination={
              destinationPoint
            }
            coordinates={
              routeCoordinates
            }
          />
        </MapContainer>
      </div>


      {/* ================================================== */}
      {/* TOP BAR */}
      {/* ================================================== */}

      <TopBar
        onBack={() =>
          go('destination')
        }
        transparent
      />


      {/* ================================================== */}
      {/* LOCATION STATUS */}
      {/* ================================================== */}

      <div className="absolute left-4 top-16 z-10 rounded-2xl bg-white/95 px-3 py-2 shadow-card backdrop-blur">
        <div className="flex items-center gap-2">

          <LocateFixed
            size={16}
            className={
              currentLocation
                ? 'text-accessible-600'
                : 'text-slate-400'
            }
          />

          <div>
            <p className="text-xs font-bold text-slate-800">
              {loadingLocation
                ? 'Finding you...'
                : currentLocation
                  ? 'Current location'
                  : 'Location unavailable'}
            </p>

            {currentLocation && (
              <p className="text-[10px] text-slate-500">
                GPS location active
              </p>
            )}
          </div>
        </div>
      </div>


      {/* ================================================== */}
      {/* ACCESSIBILITY STATUS */}
      {/* ================================================== */}

      <div className="absolute left-4 top-28 z-10 rounded-2xl bg-white/95 px-3 py-2 shadow-card backdrop-blur">

        <div className="flex items-center gap-2">

          <span className="text-lg">
            {mode === 'wheelchair'
              ? '♿'
              : '👁️'}
          </span>

          <div>
            <p className="text-xs font-bold text-slate-800">
              {mode === 'wheelchair'
                ? 'Wheelchair mode'
                : 'Low-vision mode'}
            </p>

            <p className="text-[10px] text-slate-500">
              {loadingAccessibility
                ? 'Loading accessibility data...'
                : accessibilityAvailable
                  ? `${accessibilityPoints.length} accessibility points`
                  : 'No accessibility data'}
            </p>
          </div>
        </div>
      </div>


      {/* ================================================== */}
      {/* ROUTE LEGEND */}
      {/* ================================================== */}

      {routes.length > 0 && (
        <div className="absolute right-4 top-16 z-10 space-y-1.5 rounded-2xl bg-white/95 p-3 shadow-card backdrop-blur">

          {routes.map(
            (route) => (
              <div
                key={route.id}
                className="flex items-center gap-2 text-xs font-semibold"
              >
                <span
                  className={`h-1 w-5 rounded-full ${
                    route.id ===
                    'accessible'
                      ? 'bg-accessible-500'
                      : route.id ===
                          'fastest'
                        ? 'bg-primary-600'
                        : 'bg-warning-500'
                  }`}
                />

                <span className="text-slate-600">
                  {route.title}
                </span>
              </div>
            ),
          )}

        </div>
      )}


      {/* ================================================== */}
      {/* BOTTOM SHEET */}
      {/* ================================================== */}

      <BottomSheet
        open
        maxHeight="78%"
      >

        <h2 className="mb-1 text-xl font-extrabold text-slate-900">
          Choose your route
        </h2>

        <p className="mb-3 text-xs text-slate-500">
          to {destination.name}
        </p>


        {/* ================================================= */}
        {/* LOCATION LOADING */}
        {/* ================================================= */}

        {loadingLocation && (
          <div className="py-8 text-center">

            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

            <p className="mt-3 text-sm text-slate-500">
              Getting your current location...
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Please allow location access when your browser asks.
            </p>

          </div>
        )}


        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {!loadingLocation &&
          error && (
            <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4">

              <div className="flex items-start gap-3">

                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-danger-500"
                />

                <div>

                  <p className="text-sm font-bold text-danger-700">
                    {error}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-danger-600">
                    Check your browser's location permission and make sure you are using the app from a secure local environment.
                  </p>

                </div>

              </div>

            </div>
          )}


        {/* ================================================= */}
        {/* ROUTE LOADING */}
        {/* ================================================= */}

        {!loadingLocation &&
          !error &&
          loadingRoute && (
            <div className="py-8 text-center">

              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

              <p className="mt-3 text-sm text-slate-500">
                Calculating your route...
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Finding a road route to{' '}
                {destination.name}
              </p>

            </div>
          )}


        {/* ================================================= */}
        {/* NO ROUTE */}
        {/* ================================================= */}

        {!loadingLocation &&
          !error &&
          !loadingRoute &&
          routes.length === 0 && (
            <div className="py-8 text-center">

              <MapPin
                size={28}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                No route available
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try selecting the destination again.
              </p>

            </div>
          )}


        {/* ================================================= */}
        {/* ACCESSIBILITY SUMMARY */}
        {/* ================================================= */}

        {!loadingLocation &&
          !error &&
          !loadingRoute &&
          accessibilityAvailable && (
            <div className="mb-3 rounded-2xl border border-accessible-200 bg-accessible-50 p-3">

              <div className="flex items-start gap-3">

                <span className="text-xl">
                  {mode === 'wheelchair'
                    ? '♿'
                    : '👁️'}
                </span>

                <div className="min-w-0">

                  <p className="text-sm font-bold text-accessible-800">
                    {mode === 'wheelchair'
                      ? 'Wheelchair accessibility information'
                      : 'Low-vision accessibility information'}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-accessible-700">
                    {accessibilityPoints.length}{' '}
                    accessibility point
                    {accessibilityPoints.length ===
                    1
                      ? ''
                      : 's'}{' '}
                    found for this destination.
                  </p>

                </div>

              </div>

            </div>
          )}


        {/* ================================================= */}
        {/* NO ACCESSIBILITY DATA */}
        {/* ================================================= */}

        {!loadingLocation &&
          !error &&
          !loadingRoute &&
          !loadingAccessibility &&
          !accessibilityAvailable && (
            <div className="mb-3 rounded-2xl border border-warning-200 bg-warning-50 p-3">

              <div className="flex items-start gap-3">

                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-warning-600"
                />

                <div>

                  <p className="text-sm font-bold text-warning-800">
                    Accessibility data unavailable
                  </p>

                  <p className="mt-1 text-xs leading-5 text-warning-700">
                    The road route can still be calculated, but this destination does not currently have structured accessibility information in AccessMob.
                  </p>

                </div>

              </div>

            </div>
          )}


        {/* ================================================= */}
        {/* ROUTES */}
        {/* ================================================= */}

        {!loadingLocation &&
          !error &&
          !loadingRoute &&
          routes.length > 0 && (

            <div className="space-y-2.5">

              {routes.map(
                (route) => {

                  const selected =
                    selectedRoute ===
                    route.id;

                  return (
                    <button
                      key={route.id}
                      onClick={() =>
                        setSelectedRoute(
                          route.id,
                        )
                      }
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${
                        selected
                          ? 'border-primary-600 bg-primary-50 shadow-card'
                          : 'border-slate-200 bg-white'
                      }`}
                    >

                      <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2">

                          <span className="text-xl">
                            {route.emoji}
                          </span>

                          <div>

                            <span className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                              {route.title}
                            </span>

                            <p className="text-[10px] font-semibold text-slate-400">
                              {route.tag}
                            </p>

                          </div>

                        </div>


                        <div className="text-right">

                          <p className="text-sm font-bold text-slate-900">
                            {route.time}
                          </p>

                          <p className="text-xs text-slate-500">
                            {route.dist}
                          </p>

                        </div>

                      </div>


                      <div className="mt-2 flex flex-wrap gap-1.5">

                        {route.features.map(
                          (feature) => (
                            <Pill
                              key={
                                feature.text
                              }
                              ok={
                                feature.ok
                              }
                            >
                              {
                                feature.text
                              }
                            </Pill>
                          ),
                        )}

                      </div>


                      {route.badge && (
                        <p className="mt-2 text-xs font-bold text-accessible-700">
                          ✓ {route.badge}
                        </p>
                      )}

                    </button>
                  );
                },
              )}

            </div>
          )}


        {/* ================================================= */}
        {/* START ROUTE */}
        {/* ================================================= */}

        <div className="mt-4 pb-2">

          <Button
            fullWidth
            disabled={
              loadingLocation ||
              loadingRoute ||
              !!error ||
              routes.length === 0
            }
            onClick={() =>
              go('navigation')
            }
            className="text-lg"
          >

            <Navigation
              size={18}
            />

            Start Route

          </Button>

        </div>

      </BottomSheet>

    </div>
  );
}


// ============================================================
// PILL
// ============================================================

function Pill({
  children,
  ok,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok
          ? 'bg-accessible-100 text-accessible-700'
          : 'bg-danger-100 text-danger-700'
      }`}
    >

      {ok ? (
        <Check
          size={11}
          strokeWidth={3}
        />
      ) : (
        <AlertTriangle
          size={11}
          strokeWidth={3}
        />
      )}

      {children}

    </span>
  );
}