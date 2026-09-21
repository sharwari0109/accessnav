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

import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Footprints,
  Loader2,
  MapPin,
  Navigation,
  Route as RouteIcon,
  ShieldCheck,
  Eye,
} from 'lucide-react';

import {
  getAccessibilityRoutes,
  getPlaceAccessibility,
  type AccessibilityMode,
  type BackendRoute,
  type PlaceAccessibility,
} from '../api';

import { useApp } from '../store';

import 'leaflet/dist/leaflet.css';

type RouteId =
  | 'accessible'
  | 'fastest'
  | 'clear';

interface RouteMetadata {
  title: string;
  emoji: string;
  tag: string;
  features: string[];
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
}

interface OsrmResponse {
  routes?: OsrmRoute[];
}

interface RouteCard {
  id: RouteId;
  title: string;
  emoji: string;
  tag: string;
  features: string[];
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
}

const DEFAULT_ROUTE_METADATA: Record<
  RouteId,
  RouteMetadata
> = {
  accessible: {
    title: 'Standard Route',
    emoji: '🧭',
    tag: 'Road route • accessibility not verified',
    features: [
      'Route calculated from the road network',
      'Accessibility conditions are not verified',
    ],
  },

  fastest: {
    title: 'Fastest Route',
    emoji: '⚡',
    tag: 'Shortest estimated travel time',
    features: [
      'Route calculated from the road network',
      'Accessibility conditions are not verified',
    ],
  },

  clear: {
    title: 'Alternative Route',
    emoji: '🛣️',
    tag: 'Alternative road route',
    features: [
      'Alternative route from the road network',
      'Accessibility conditions are not verified',
    ],
  },
};

const destinationIcon =
  L.divIcon({
    className:
      'accessnav-route-destination',
    html: `
      <div
        style="
          width:48px;
          height:48px;
          border-radius:50%;
          background:#ef4444;
          border:5px solid white;
          box-shadow:0 4px 18px rgba(0,0,0,.35);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-size:24px;
          font-weight:700;
        "
        aria-label="Destination"
      >
        📍
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

const currentLocationIcon =
  L.divIcon({
    className:
      'accessnav-current-location',
    html: `
      <div
        style="
          width:24px;
          height:24px;
          border-radius:50%;
          background:#2563eb;
          border:4px solid white;
          box-shadow:0 2px 10px rgba(0,0,0,.35);
        "
        aria-label="Current location"
      ></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function MapController({
  currentLocation,
  destination,
}: {
  currentLocation: [number, number] | null;
  destination: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (!currentLocation) {
      map.flyTo(
        destination,
        15,
        {
          duration: 0.8,
        },
      );

      return;
    }

    const bounds =
      L.latLngBounds([
        currentLocation,
        destination,
      ]);

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
      animate: true,
    });
  }, [
    currentLocation,
    destination,
    map,
  ]);

  return null;
}

function formatDistance(
  meters: number,
): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}

function formatDuration(
  seconds: number,
): string {
  const minutes = Math.max(
    1,
    Math.round(seconds / 60),
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remaining =
    minutes % 60;

  if (remaining === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function getBackendRoute(
  routes: BackendRoute[] | null,
  id: RouteId,
): BackendRoute | null {
  if (!routes) {
    return null;
  }

  return (
    routes.find(
      (route) =>
        route.id === id ||
        route.name
          ?.toLowerCase()
          .includes(id),
    ) ?? null
  );
}

function getRouteMetadata(
  routes: BackendRoute[] | null,
  id: RouteId,
  hasAccessibilityData: boolean,
): RouteMetadata {
  const backendRoute =
    getBackendRoute(
      routes,
      id,
    );

  if (backendRoute) {
    return {
      title:
        backendRoute.name ||
        DEFAULT_ROUTE_METADATA[id]
          .title,

      emoji:
        DEFAULT_ROUTE_METADATA[id]
          .emoji,

      tag:
        hasAccessibilityData
          ? 'Accessibility data available'
          : DEFAULT_ROUTE_METADATA[id]
              .tag,

      features:
        backendRoute.features &&
        backendRoute.features.length > 0
          ? backendRoute.features
          : DEFAULT_ROUTE_METADATA[id]
              .features,
    };
  }

  if (
    hasAccessibilityData &&
    id === 'accessible'
  ) {
    return {
      title:
        'Accessibility Route',
      emoji: '♿',
      tag:
        'Accessibility data available',
      features: [
        'Accessibility information available',
        'Route geometry from road routing',
      ],
    };
  }

  return DEFAULT_ROUTE_METADATA[id];
}

function getAccessibilityFeatureList(
  accessibility: PlaceAccessibility | null,
): string[] {
  if (!accessibility) {
    return [];
  }

  const features: string[] = [];

  const data =
    accessibility as unknown as Record<
      string,
      unknown
    >;

  const possibleFeatures = [
    'features',
    'accessibility',
    'accessibility_features',
    'tags',
  ];

  for (const key of possibleFeatures) {
    const value = data[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          typeof item === 'string' &&
          item.trim()
        ) {
          features.push(item);
        }
      }
    }
  }

  return Array.from(
    new Set(features),
  );
}

function RouteMap({
  currentLocation,
  destinationPoint,
  selectedRoute,
  routeCoordinates,
}: {
  currentLocation: [number, number] | null;
  destinationPoint: [number, number];
  selectedRoute: RouteId;
  routeCoordinates: [number, number][];
}) {
  const center =
    currentLocation ??
    destinationPoint;

  return (
    <div className="relative h-[400px] w-full overflow-hidden bg-slate-200">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          currentLocation={
            currentLocation
          }
          destination={
            destinationPoint
          }
        />

        {currentLocation && (
          <Marker
            position={
              currentLocation
            }
            icon={
              currentLocationIcon
            }
          />
        )}

        <Marker
          position={
            destinationPoint
          }
          icon={
            destinationIcon
          }
        />

        {routeCoordinates.length >
          1 && (
          <Polyline
            positions={
              routeCoordinates
            }
            pathOptions={{
              color:
                selectedRoute ===
                'accessible'
                  ? '#2563eb'
                  : selectedRoute ===
                      'fastest'
                    ? '#7c3aed'
                    : '#f59e0b',

              weight: 7,

              opacity: 0.9,

              lineCap: 'round',

              lineJoin: 'round',

              dashArray:
                selectedRoute ===
                'clear'
                  ? '12 8'
                  : undefined,
            }}
          />
        )}
      </MapContainer>

      <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg">
        <RouteIcon
          size={17}
          className="text-primary-600"
        />

        {routeCoordinates.length >
        1
          ? 'Route calculated'
          : 'Calculating route...'}
      </div>

      <div className="absolute bottom-2 right-2 z-[500] rounded bg-white/90 px-2 py-1 text-[10px] text-slate-500 shadow">
        Leaflet | © OpenStreetMap
        contributors
      </div>
    </div>
  );
}

export default function Routes() {
  const {
    destination,
    mode,
    selectedRoute,
    setSelectedRoute,
    go,
  } = useApp();

  const [
    currentLocation,
    setCurrentLocation,
  ] = useState<
    [number, number] | null
  >(null);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(true);

  const [
    locationError,
    setLocationError,
  ] = useState('');

  const [
    backendRoutes,
    setBackendRoutes,
  ] = useState<
    BackendRoute[] | null
  >(null);

  const [
    placeAccessibility,
    setPlaceAccessibility,
  ] =
    useState<PlaceAccessibility | null>(
      null,
    );

  const [
    accessibilityLoading,
    setAccessibilityLoading,
  ] = useState(false);

  const [
    accessibilityError,
    setAccessibilityError,
  ] = useState('');

  const [
    osrmRoutes,
    setOsrmRoutes,
  ] = useState<OsrmRoute[]>([]);

  const [
    routeLoading,
    setRouteLoading,
  ] = useState(false);

  const [
    routeError,
    setRouteError,
  ] = useState('');

  if (!destination) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6">
        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-card">
          <MapPin
            size={36}
            className="mx-auto text-primary-600"
          />

          <h2 className="mt-4 text-xl font-extrabold text-slate-900">
            No destination selected
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Please select a destination
            before choosing a route.
          </p>

          <button
            type="button"
            onClick={() =>
              go('search')
            }
            className="mt-5 w-full rounded-2xl bg-primary-600 px-5 py-3.5 font-bold text-white"
          >
            Search for a destination
          </button>
        </div>
      </div>
    );
  }

  const destinationPoint:
    | [number, number]
    | null =
    Number.isFinite(destination.lat) &&
    Number.isFinite(destination.lng)
      ? [
          destination.lat,
          destination.lng,
        ]
      : null;

  const destinationPlaceId =
    destination.place?.id ??
    null;

  const hasAccessibilityData =
    destinationPlaceId !== null &&
    placeAccessibility !== null;

  /*
   * -------------------------------------------------------
   * CURRENT LOCATION
   * -------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      setLocationLoading(false);

      setLocationError(
        'Location services are not available in this browser.',
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setCurrentLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);

        setLocationLoading(false);
        setLocationError('');
      },
      (error) => {
        if (cancelled) {
          return;
        }

        console.error(
          'Unable to get current location:',
          error,
        );

        setLocationLoading(false);

        setLocationError(
          'Your current location could not be detected. You can still view the destination route.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * -------------------------------------------------------
   * ACCESSIBILITY DATA
   *
   * Only known AccessMob places have accessibility
   * information. Arbitrary map-search destinations
   * intentionally skip these calls.
   * -------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function loadAccessibilityData() {
      if (!destinationPlaceId) {
        setBackendRoutes(null);
        setPlaceAccessibility(null);
        setAccessibilityError('');
        setAccessibilityLoading(false);
        return;
      }

      try {
        setAccessibilityLoading(true);
        setAccessibilityError('');

        const [
          accessibility,
          routes,
        ] = await Promise.all([
          getPlaceAccessibility(
            destinationPlaceId,
          ),
          getAccessibilityRoutes(
            destinationPlaceId,
            mode as AccessibilityMode,
          ),
        ]);

        if (cancelled) {
          return;
        }

        setPlaceAccessibility(
          accessibility,
        );

        setBackendRoutes(
          routes,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'Failed to load accessibility data:',
          error,
        );

        setAccessibilityError(
          'Accessibility information could not be loaded. Standard road routing is still available.',
        );

        setBackendRoutes(null);
        setPlaceAccessibility(null);
      } finally {
        if (!cancelled) {
          setAccessibilityLoading(
            false,
          );
        }
      }
    }

    loadAccessibilityData();

    return () => {
      cancelled = true;
    };
  }, [
    destinationPlaceId,
    mode,
  ]);

  /*
   * -------------------------------------------------------
   * STANDARD ROAD ROUTING
   *
   * This is intentionally independent of accessibility
   * data so ANY destination can be routed.
   * -------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function calculateRoute() {
      if (!currentLocation) {
        return;
      }

      if (!destinationPoint) {
        setRouteError(
          'This destination does not have valid coordinates.',
        );

        return;
      }

      try {
        setRouteLoading(true);
        setRouteError('');
        setOsrmRoutes([]);

        const [
          currentLat,
          currentLng,
        ] = currentLocation;

        const [
          destinationLat,
          destinationLng,
        ] = destinationPoint;

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
          !Array.isArray(
            data.routes,
          ) ||
          data.routes.length === 0
        ) {
          throw new Error(
            'No road route was found.',
          );
        }

        if (cancelled) {
          return;
        }

        setOsrmRoutes(
          data.routes.slice(0, 3),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          'OSRM routing failed:',
          error,
        );

        setRouteError(
          'Unable to calculate a road route right now.',
        );
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    }

    calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [
    currentLocation,
    destinationPoint?.[0],
    destinationPoint?.[1],
  ]);

  /*
   * -------------------------------------------------------
   * BUILD ROUTE CARDS
   * -------------------------------------------------------
   */

  const routeCards =
    useMemo<RouteCard[]>(() => {
      const cards: RouteCard[] =
        [];

      const firstRoute =
        osrmRoutes[0] ?? null;

      const secondRoute =
        osrmRoutes[1] ?? null;

      if (firstRoute) {
        const metadata =
          getRouteMetadata(
            backendRoutes,
            'accessible',
            hasAccessibilityData,
          );

        cards.push({
          id: 'accessible',
          title: metadata.title,
          emoji: metadata.emoji,
          tag: metadata.tag,
          features: metadata.features,
          distanceKm:
            firstRoute.distance / 1000,
          durationMin:
            firstRoute.duration / 60,
          coordinates:
            firstRoute.geometry.coordinates.map(
              ([lng, lat]) => [
                lat,
                lng,
              ],
            ),
        });
      }

      if (firstRoute) {
        const metadata =
          getRouteMetadata(
            backendRoutes,
            'fastest',
            hasAccessibilityData,
          );

        cards.push({
          id: 'fastest',
          title: metadata.title,
          emoji: metadata.emoji,
          tag: metadata.tag,
          features: metadata.features,
          distanceKm:
            firstRoute.distance / 1000,
          durationMin:
            firstRoute.duration / 60,
          coordinates:
            firstRoute.geometry.coordinates.map(
              ([lng, lat]) => [
                lat,
                lng,
              ],
            ),
        });
      }

      if (secondRoute) {
        const metadata =
          getRouteMetadata(
            backendRoutes,
            'clear',
            hasAccessibilityData,
          );

        cards.push({
          id: 'clear',
          title: metadata.title,
          emoji: metadata.emoji,
          tag: metadata.tag,
          features: metadata.features,
          distanceKm:
            secondRoute.distance / 1000,
          durationMin:
            secondRoute.duration / 60,
          coordinates:
            secondRoute.geometry.coordinates.map(
              ([lng, lat]) => [
                lat,
                lng,
              ],
            ),
        });
      }

      return cards;
    }, [
      osrmRoutes,
      backendRoutes,
      hasAccessibilityData,
    ]);

  /*
   * -------------------------------------------------------
   * KEEP SELECTED ROUTE VALID
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (
      routeCards.length === 0
    ) {
      return;
    }

    const exists =
      routeCards.some(
        (route) =>
          route.id === selectedRoute,
      );

    if (!exists) {
      setSelectedRoute(
        routeCards[0].id,
      );
    }
  }, [
    routeCards,
    selectedRoute,
    setSelectedRoute,
  ]);

  const selectedRouteCard =
    routeCards.find(
      (route) =>
        route.id === selectedRoute,
    ) ??
    routeCards[0] ??
    null;

  const accessibilityFeatures =
    useMemo(
      () =>
        getAccessibilityFeatureList(
          placeAccessibility,
        ),
      [placeAccessibility],
    );

  const visibleAccessibilityFeatures =
    accessibilityFeatures.slice(
      0,
      6,
    );

  const selectedCoordinates =
    selectedRouteCard
      ?.coordinates ?? [];

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="shrink-0 bg-white px-5 pb-4 pt-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-100">
            {mode ===
            'wheelchair' ? (
              <Accessibility
                size={25}
                className="text-primary-700"
              />
            ) : (
              <Eye
                size={25}
                className="text-primary-700"
              />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900">
              Choose a Route
            </h1>

            <p className="truncate text-base text-slate-500">
              {destination.name}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          SCROLLABLE CONTENT
      ===================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ---------------------------------------------------
            MAP
        --------------------------------------------------- */}

        {destinationPoint ? (
          <RouteMap
            currentLocation={
              currentLocation
            }
            destinationPoint={
              destinationPoint
            }
            selectedRoute={
              selectedRoute
            }
            routeCoordinates={
              selectedCoordinates
            }
          />
        ) : (
          <div className="flex h-[400px] items-center justify-center bg-slate-200 px-6 text-center">
            <div>
              <AlertTriangle
                size={34}
                className="mx-auto text-amber-500"
              />

              <p className="mt-3 font-bold text-slate-800">
                Destination coordinates
                unavailable
              </p>

              <p className="mt-1 text-sm text-slate-500">
                We cannot calculate a
                route for this location.
              </p>
            </div>
          </div>
        )}

        <div className="px-5 pb-6 pt-5">
          {/* -------------------------------------------------
              LOCATION STATUS
          ------------------------------------------------- */}

          {locationLoading && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <Loader2
                size={18}
                className="animate-spin"
              />

              Detecting your current
              location...
            </div>
          )}

          {!locationLoading &&
            locationError && (
              <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={19}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    {locationError}
                  </span>
                </div>
              </div>
            )}

          {/* -------------------------------------------------
              ACCESSIBILITY STATUS
          ------------------------------------------------- */}

          {!destinationPlaceId && (
            <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={22}
                  className="mt-0.5 shrink-0 text-amber-600"
                />

                <div>
                  <h2 className="font-bold text-amber-900">
                    Accessibility data not
                    verified
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-amber-800">
                    This destination came
                    from map search. We can
                    calculate a standard road
                    route, but AccessMob does
                    not currently have verified
                    accessibility data for this
                    location.
                  </p>
                </div>
              </div>
            </div>
          )}

          {destinationPlaceId &&
            accessibilityLoading && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                Loading accessibility
                information...
              </div>
            )}

          {destinationPlaceId &&
            !accessibilityLoading &&
            accessibilityError && (
              <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={21}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div>
                    <h2 className="font-bold text-amber-900">
                      Accessibility information
                      unavailable
                    </h2>

                    <p className="mt-1 text-sm leading-5 text-amber-800">
                      {accessibilityError}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {destinationPlaceId &&
            !accessibilityLoading &&
            !accessibilityError &&
            placeAccessibility && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={22}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />

                  <div className="min-w-0">
                    <h2 className="font-bold text-emerald-900">
                      Accessibility data
                      available
                    </h2>

                    {visibleAccessibilityFeatures.length >
                      0 && (
                      <div className="mt-2 space-y-1">
                        {visibleAccessibilityFeatures.map(
                          (
                            feature,
                          ) => (
                            <div
                              key={
                                feature
                              }
                              className="flex items-center gap-2 text-sm text-emerald-800"
                            >
                              <CheckCircle2
                                size={
                                  15
                                }
                              />

                              <span>
                                {
                                  feature
                                }
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {placeAccessibility.warnings &&
                      placeAccessibility
                        .warnings.length >
                        0 && (
                        <div className="mt-3 border-t border-emerald-200 pt-3">
                          {placeAccessibility.warnings.map(
                            (
                              warning,
                            ) => (
                              <div
                                key={
                                  warning
                                }
                                className="flex items-start gap-2 text-sm text-amber-800"
                              >
                                <AlertTriangle
                                  size={
                                    15
                                  }
                                  className="mt-0.5 shrink-0"
                                />

                                <span>
                                  {
                                    warning
                                  }
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

          {/* -------------------------------------------------
              ROUTES HEADER
          ------------------------------------------------- */}

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Navigation
                size={22}
                className="text-primary-600"
              />

              <h2 className="text-xl font-extrabold text-slate-900">
                Available routes
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {hasAccessibilityData
                ? 'Choose a route based on your accessibility needs and the available data.'
                : 'Choose a road route. Accessibility conditions are not verified for this destination.'}
            </p>
          </div>

          {/* -------------------------------------------------
              ROUTE LOADING
          ------------------------------------------------- */}

          {routeLoading && (
            <div className="mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white px-5 py-6 shadow-sm">
              <Loader2
                size={22}
                className="animate-spin text-primary-600"
              />

              <span className="font-semibold text-slate-700">
                Calculating road routes...
              </span>
            </div>
          )}

          {/* -------------------------------------------------
              ROUTE ERROR
          ------------------------------------------------- */}

          {!routeLoading &&
            routeError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={21}
                    className="mt-0.5 shrink-0 text-red-600"
                  />

                  <div>
                    <h3 className="font-bold text-red-900">
                      Route unavailable
                    </h3>

                    <p className="mt-1 text-sm text-red-800">
                      {routeError}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* -------------------------------------------------
              ROUTE CARDS
          ------------------------------------------------- */}

          {!routeLoading &&
            routeCards.length >
              0 && (
              <div className="space-y-3">
                {routeCards.map(
                  (route) => {
                    const selected =
                      route.id ===
                      selectedRoute;

                    return (
                      <button
                        key={
                          route.id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedRoute(
                            route.id,
                          )
                        }
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-primary-500 bg-primary-50 shadow-md'
                            : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                            {
                              route.emoji
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-extrabold text-slate-900">
                                  {
                                    route.title
                                  }
                                </h3>

                                <p className="mt-0.5 text-xs font-semibold text-primary-700">
                                  {
                                    route.tag
                                  }
                                </p>
                              </div>

                              {selected && (
                                <CheckCircle2
                                  size={
                                    23
                                  }
                                  className="shrink-0 text-primary-600"
                                />
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <MapPin
                                  size={
                                    16
                                  }
                                />

                                {route.distanceKm.toFixed(
                                  1,
                                )}{' '}
                                km
                              </span>

                              <span className="flex items-center gap-1.5">
                                <Clock3
                                  size={
                                    16
                                  }
                                />

                                {Math.max(
                                  1,
                                  Math.round(
                                    route.durationMin,
                                  ),
                                )}{' '}
                                min
                              </span>
                            </div>

                            <div className="mt-3 space-y-1.5">
                              {route.features
                                .slice(
                                  0,
                                  3,
                                )
                                .map(
                                  (
                                    feature,
                                    index,
                                  ) => (
                                    <div
                                      key={`${route.id}-${index}`}
                                      className="flex items-start gap-2 text-xs text-slate-600"
                                    >
                                      {hasAccessibilityData &&
                                      route.id ===
                                        'accessible' ? (
                                        <Accessibility
                                          size={
                                            14
                                          }
                                          className="mt-0.5 shrink-0 text-emerald-600"
                                        />
                                      ) : (
                                        <Footprints
                                          size={
                                            14
                                          }
                                          className="mt-0.5 shrink-0 text-slate-500"
                                        />
                                      )}

                                      <span>
                                        {
                                          feature
                                        }
                                      </span>
                                    </div>
                                  ),
                                )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}

          {/* -------------------------------------------------
              NO ROUTES
          ------------------------------------------------- */}

          {!routeLoading &&
            !routeError &&
            routeCards.length ===
              0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <RouteIcon
                  size={30}
                  className="mx-auto text-slate-400"
                />

                <h3 className="mt-3 font-bold text-slate-800">
                  No route options yet
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  We are still trying to
                  calculate a road route.
                </p>
              </div>
            )}

          {/* -------------------------------------------------
              IMPORTANT ROUTING NOTICE
          ------------------------------------------------- */}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <RouteIcon
                size={20}
                className="mt-0.5 shrink-0 text-slate-500"
              />

              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  About this route
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {hasAccessibilityData
                    ? 'Road routing is used for the route geometry. AccessMob accessibility information is shown separately and should be treated as location data, not as a guarantee that every route segment is accessible.'
                    : 'This destination can still be navigated using the road route. Because it came from map search and has no AccessMob accessibility record, accessibility conditions have not been verified.'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* =====================================================
          STICKY START ROUTE BUTTON
      ===================================================== */}

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          type="button"
          disabled={
            !selectedRouteCard ||
            routeLoading ||
            !!routeError
          }
          onClick={() =>
            go('navigation')
          }
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-extrabold shadow-lg transition ${
            selectedRouteCard &&
            !routeLoading &&
            !routeError
              ? 'bg-primary-600 text-white active:scale-[0.99]'
              : 'cursor-not-allowed bg-slate-200 text-slate-400'
          }`}
        >
          <Navigation
            size={20}
          />

          Start Route
        </button>
      </div>
    </div>
  );
}