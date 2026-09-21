import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useApp } from '@/store';
import Overlay from '@/components/Overlay';
import Button from '@/components/Button';
import SOSButton from '@/components/SOSButton';

import {
  Pause,
  RefreshCw,
  FileText,
  AlertTriangle,
  Play,
  X,
  Check,
  Navigation as NavigationIcon,
  LocateFixed,
} from 'lucide-react';

import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

interface RoutePoint {
  lat: number;
  lng: number;
}

interface OSRMManeuver {
  location: [number, number];
  bearing_before?: number;
  bearing_after?: number;
  type: string;
  modifier?: string;
  exit?: number;
}

interface OSRMStep {
  distance: number;
  duration: number;
  name?: string;
  mode?: string;
  maneuver: OSRMManeuver;
}

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
  legs?: Array<{
    steps?: OSRMStep[];
  }>;
}

interface RouteResponse {
  code: string;
  routes?: OSRMRoute[];
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) {
    return '0 m';
  }

  if (meters < 1000) {
    return `${Math.max(0, Math.round(meters))} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function haversineDistance(
  first: RoutePoint,
  second: RoutePoint,
) {
  const earthRadius = 6371000;

  const lat1 = (first.lat * Math.PI) / 180;
  const lat2 = (second.lat * Math.PI) / 180;

  const deltaLat =
    ((second.lat - first.lat) * Math.PI) / 180;

  const deltaLng =
    ((second.lng - first.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) *
      Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadius * c;
}

function distanceToPolyline(
  location: RoutePoint,
  coordinates: [number, number][],
) {
  if (coordinates.length === 0) {
    return Infinity;
  }

  let minimumDistance = Infinity;

  for (const [lat, lng] of coordinates) {
    const distance = haversineDistance(
      location,
      {
        lat,
        lng,
      },
    );

    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  return minimumDistance;
}

function createCurrentLocationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div
        style="
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: #0f766e;
          border: 4px solid white;
          box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        "
      ></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

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
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
          font-weight: 800;
        "
      >
        ●
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

function FollowCurrentLocation({
  currentLocation,
}: {
  currentLocation: RoutePoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!currentLocation) {
      return;
    }

    map.setView(
      [
        currentLocation.lat,
        currentLocation.lng,
      ],
      Math.max(map.getZoom(), 17),
      {
        animate: true,
      },
    );
  }, [currentLocation, map]);

  return null;
}

function FitRoute({
  currentLocation,
  routeCoordinates,
}: {
  currentLocation: RoutePoint | null;
  routeCoordinates: [number, number][];
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (
      hasFittedRef.current ||
      !currentLocation ||
      routeCoordinates.length < 2
    ) {
      return;
    }

    const bounds = L.latLngBounds(
      routeCoordinates.map(
        ([lat, lng]) => [lat, lng],
      ),
    );

    map.fitBounds(bounds, {
      padding: [40, 300],
      maxZoom: 17,
    });

    hasFittedRef.current = true;
  }, [
    map,
    currentLocation,
    routeCoordinates,
  ]);

  return null;
}

function maneuverSymbol(step: OSRMStep) {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;

  if (type === 'arrive') {
    return '✓';
  }

  if (
    type === 'roundabout' ||
    type === 'rotary'
  ) {
    return '↻';
  }

  if (type === 'uturn') {
    return '↶';
  }

  if (modifier === 'left') {
    return '←';
  }

  if (modifier === 'right') {
    return '→';
  }

  if (modifier === 'slight left') {
    return '↖';
  }

  if (modifier === 'slight right') {
    return '↗';
  }

  if (modifier === 'sharp left') {
    return '↙';
  }

  if (modifier === 'sharp right') {
    return '↘';
  }

  return '↑';
}

function maneuverTitle(step: OSRMStep) {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;

  if (type === 'arrive') {
    return 'You have arrived';
  }

  if (type === 'depart') {
    if (modifier === 'left') {
      return 'Start by turning left';
    }

    if (modifier === 'right') {
      return 'Start by turning right';
    }

    return 'Start navigation';
  }

  if (
    type === 'roundabout' ||
    type === 'rotary'
  ) {
    if (step.maneuver.exit) {
      return `Take exit ${step.maneuver.exit}`;
    }

    return 'Continue through the roundabout';
  }

  if (type === 'uturn') {
    return 'Make a U-turn';
  }

  if (type === 'merge') {
    if (modifier === 'left') {
      return 'Merge left';
    }

    if (modifier === 'right') {
      return 'Merge right';
    }

    return 'Merge';
  }

  if (type === 'fork') {
    if (modifier === 'left') {
      return 'Keep left';
    }

    if (modifier === 'right') {
      return 'Keep right';
    }

    return 'Continue at the fork';
  }

  if (type === 'on ramp') {
    if (modifier === 'left') {
      return 'Take the left ramp';
    }

    if (modifier === 'right') {
      return 'Take the right ramp';
    }

    return 'Take the ramp';
  }

  if (type === 'off ramp') {
    if (modifier === 'left') {
      return 'Take the left exit ramp';
    }

    if (modifier === 'right') {
      return 'Take the right exit ramp';
    }

    return 'Take the exit ramp';
  }

  if (type === 'end of road') {
    if (modifier === 'left') {
      return 'Turn left at the end of the road';
    }

    if (modifier === 'right') {
      return 'Turn right at the end of the road';
    }

    return 'Continue at the end of the road';
  }

  if (modifier === 'left') {
    return 'Turn left';
  }

  if (modifier === 'right') {
    return 'Turn right';
  }

  if (modifier === 'slight left') {
    return 'Bear left';
  }

  if (modifier === 'slight right') {
    return 'Bear right';
  }

  if (modifier === 'sharp left') {
    return 'Turn sharply left';
  }

  if (modifier === 'sharp right') {
    return 'Turn sharply right';
  }

  if (type === 'continue') {
    return 'Continue straight';
  }

  if (type === 'new name') {
    return 'Continue straight';
  }

  return 'Continue straight';
}

function getStreetName(step: OSRMStep) {
  if (
    step.name &&
    step.name.trim().length > 0
  ) {
    return step.name;
  }

  return 'Unnamed road';
}

function findInitialStep(
  steps: OSRMStep[],
) {
  if (steps.length === 0) {
    return -1;
  }

  const firstUsefulStep = steps.findIndex(
    (step) =>
      step.maneuver.type !== 'depart',
  );

  if (firstUsefulStep !== -1) {
    return firstUsefulStep;
  }

  return 0;
}

export default function Navigation() {
  const {
    destination,
    mode,
    paused,
    setPaused,
    selectedRoute,
    go,
  } = useApp();

  const [currentLocation, setCurrentLocation] =
    useState<RoutePoint | null>(null);

  const [routeCoordinates, setRouteCoordinates] =
    useState<[number, number][]>([]);

  const [routeDistance, setRouteDistance] =
    useState(0);

  const [routeDuration, setRouteDuration] =
    useState(0);

  const [routeSteps, setRouteSteps] =
    useState<OSRMStep[]>([]);

  const [currentStepIndex, setCurrentStepIndex] =
    useState(-1);

  const [nextStepDistance, setNextStepDistance] =
    useState(0);

  const [loadingLocation, setLoadingLocation] =
    useState(true);

  const [loadingRoute, setLoadingRoute] =
    useState(true);

  const [error, setError] = useState('');

  const [arrived, setArrived] =
    useState(false);

  const latestLocationRef =
    useRef<RoutePoint | null>(null);

  const hasRouteRef = useRef(false);

  const lastRerouteAtRef =
    useRef(0);

  const requestIdRef =
    useRef(0);

  const destinationPoint =
    useMemo<RoutePoint | null>(() => {
      if (!destination) {
        return null;
      }

      return {
        lat: destination.lat,
        lng: destination.lng,
      };
    }, [destination]);

  /*
   * ------------------------------------------------------------
   * LIVE GPS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoadingLocation(false);
      setError(
        'Your browser does not support location services.',
      );
      return;
    }

    setLoadingLocation(true);
    setError('');

    const watchId =
      navigator.geolocation.watchPosition(
        (position) => {
          const location: RoutePoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          latestLocationRef.current =
            location;

          setCurrentLocation(location);
          setLoadingLocation(false);
        },
        (locationError) => {
          console.error(
            'Navigation location error:',
            locationError,
          );

          setLoadingLocation(false);

          if (
            locationError.code ===
            locationError.PERMISSION_DENIED
          ) {
            setError(
              'Location permission was denied. Please allow location access in your browser.',
            );
          } else if (
            locationError.code ===
            locationError.POSITION_UNAVAILABLE
          ) {
            setError(
              'Your current location could not be determined.',
            );
          } else if (
            locationError.code ===
            locationError.TIMEOUT
          ) {
            setError(
              'Getting your current location timed out.',
            );
          } else {
            setError(
              'Unable to get your current location.',
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        },
      );

    return () => {
      navigator.geolocation.clearWatch(
        watchId,
      );
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * RESET ROUTE WHEN DESTINATION CHANGES
   * ------------------------------------------------------------
   */

  useEffect(() => {
    hasRouteRef.current = false;

    setRouteCoordinates([]);
    setRouteSteps([]);
    setCurrentStepIndex(-1);
    setNextStepDistance(0);
    setArrived(false);
    setError('');
  }, [destinationPoint]);

  /*
   * ------------------------------------------------------------
   * OSRM TURN-BY-TURN ROUTE
   * ------------------------------------------------------------
   *
   * Important:
   * `steps=true` makes OSRM return actual maneuvers.
   * This gives us left/right/straight/roundabout data.
   */

  const fetchRoute = useCallback(
    async (
      origin: RoutePoint,
      showError = true,
    ) => {
      if (!destinationPoint) {
        return;
      }

      const requestId =
        ++requestIdRef.current;

      try {
        setLoadingRoute(true);

        if (showError) {
          setError('');
        }

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${origin.lng},${origin.lat};` +
          `${destinationPoint.lng},${destinationPoint.lat}` +
          `?overview=full&geometries=geojson&steps=true`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `Routing service returned ${response.status}`,
          );
        }

        const data =
          (await response.json()) as RouteResponse;

        if (
          data.code !== 'Ok' ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error(
            'No route was returned.',
          );
        }

        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const route = data.routes[0];

        const coordinates =
          route.geometry.coordinates.map(
            ([lng, lat]) =>
              [lat, lng] as [
                number,
                number,
              ],
          );

        const steps =
          route.legs?.flatMap(
            (leg) => leg.steps ?? [],
          ) ?? [];

        setRouteCoordinates(coordinates);
        setRouteDistance(route.distance);
        setRouteDuration(route.duration);
        setRouteSteps(steps);

        const initialStepIndex =
          findInitialStep(steps);

        setCurrentStepIndex(
          initialStepIndex,
        );

        if (
          initialStepIndex >= 0 &&
          origin
        ) {
          const maneuver =
            steps[initialStepIndex]
              ?.maneuver?.location;

          if (maneuver) {
            setNextStepDistance(
              haversineDistance(
                origin,
                {
                  lat: maneuver[1],
                  lng: maneuver[0],
                },
              ),
            );
          }
        }

        const directDistance =
          haversineDistance(
            origin,
            destinationPoint,
          );

        setArrived(
          directDistance <= 30 ||
            route.distance <= 30,
        );

        hasRouteRef.current = true;
        lastRerouteAtRef.current =
          Date.now();
      } catch (err) {
        console.error(
          'Navigation route error:',
          err,
        );

        if (showError) {
          setError(
            'Unable to calculate the navigation route.',
          );
        }
      } finally {
        if (
          requestId === requestIdRef.current
        ) {
          setLoadingRoute(false);
        }
      }
    },
    [destinationPoint],
  );

  /*
   * ------------------------------------------------------------
   * INITIAL ROUTE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !currentLocation ||
      !destinationPoint ||
      hasRouteRef.current
    ) {
      return;
    }

    fetchRoute(
      currentLocation,
      true,
    );
  }, [
    currentLocation,
    destinationPoint,
    fetchRoute,
  ]);

  /*
   * ------------------------------------------------------------
   * UPDATE CURRENT TURN INSTRUCTION
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !currentLocation ||
      routeSteps.length === 0 ||
      currentStepIndex < 0 ||
      paused ||
      arrived
    ) {
      return;
    }

    let stepIndex = currentStepIndex;

    /*
     * If the current maneuver is close enough,
     * advance to the next maneuver.
     */
    while (
      stepIndex >= 0 &&
      stepIndex < routeSteps.length
    ) {
      const step =
        routeSteps[stepIndex];

      const maneuverLocation =
        step.maneuver?.location;

      if (!maneuverLocation) {
        break;
      }

      const distance =
        haversineDistance(
          currentLocation,
          {
            lat: maneuverLocation[1],
            lng: maneuverLocation[0],
          },
        );

      setNextStepDistance(distance);

      if (distance > 35) {
        break;
      }

      if (
        step.maneuver.type === 'arrive'
      ) {
        setArrived(true);
        break;
      }

      const nextIndex =
        stepIndex + 1;

      if (
        nextIndex >= routeSteps.length
      ) {
        setArrived(true);
        break;
      }

      stepIndex = nextIndex;
      setCurrentStepIndex(stepIndex);
    }

    const destinationDistance =
      haversineDistance(
        currentLocation,
        destinationPoint!,
      );

    if (destinationDistance <= 30) {
      setArrived(true);
    }
  }, [
    currentLocation,
    currentStepIndex,
    routeSteps,
    paused,
    arrived,
    destinationPoint,
  ]);

  /*
   * ------------------------------------------------------------
   * OFF-ROUTE DETECTION
   * ------------------------------------------------------------
   *
   * If GPS gets more than about 75m from the route,
   * request a fresh route.
   */

  useEffect(() => {
    if (
      paused ||
      arrived ||
      !currentLocation ||
      routeCoordinates.length < 2 ||
      !destinationPoint
    ) {
      return;
    }

    const distanceFromRoute =
      distanceToPolyline(
        currentLocation,
        routeCoordinates,
      );

    if (distanceFromRoute <= 75) {
      return;
    }

    const now = Date.now();

    if (
      now - lastRerouteAtRef.current <
      15000
    ) {
      return;
    }

    lastRerouteAtRef.current = now;
    hasRouteRef.current = false;

    fetchRoute(
      currentLocation,
      false,
    );
  }, [
    currentLocation,
    routeCoordinates,
    paused,
    arrived,
    destinationPoint,
    fetchRoute,
  ]);

  /*
   * ------------------------------------------------------------
   * MANUAL RECALCULATION
   * ------------------------------------------------------------
   */

  const recalculate = () => {
    const location =
      latestLocationRef.current;

    if (
      !location ||
      !destinationPoint
    ) {
      return;
    }

    hasRouteRef.current = false;
    setError('');

    fetchRoute(
      location,
      true,
    );
  };

  /*
   * ------------------------------------------------------------
   * DESTINATION VALIDATION
   * ------------------------------------------------------------
   */

  if (!destination) {
    return null;
  }

  if (!destinationPoint) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6">
        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-card">
          <AlertTriangle
            size={30}
            className="mx-auto text-danger-500"
          />

          <h2 className="mt-3 text-xl font-extrabold text-slate-900">
            Destination unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            The selected destination does not
            contain valid coordinates.
          </p>

          <div className="mt-5">
            <Button
              fullWidth
              onClick={() => go('home')}
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ------------------------------------------------------------
   * INITIAL LOADING SCREEN
   * ------------------------------------------------------------
   */

  if (
    loadingLocation ||
    (loadingRoute &&
      routeCoordinates.length === 0)
  ) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <div className="absolute inset-0">
          <MapContainer
            center={[
              destinationPoint.lat,
              destinationPoint.lng,
            ]}
            zoom={14}
            zoomControl={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker
              position={[
                destinationPoint.lat,
                destinationPoint.lng,
              ]}
              icon={createDestinationIcon()}
            />
          </MapContainer>
        </div>

        <div className="absolute inset-x-4 bottom-6 z-30 rounded-3xl bg-white p-6 shadow-sheet">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

            <h2 className="mt-4 text-lg font-extrabold text-slate-900">
              {loadingLocation
                ? 'Finding your location...'
                : 'Preparing navigation...'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {loadingLocation
                ? 'Please allow GPS access.'
                : `Calculating a route to ${destination.name}.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ------------------------------------------------------------
   * ERROR SCREEN
   * ------------------------------------------------------------
   */

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6">
        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-card">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle
                size={26}
                className="text-red-500"
              />
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-slate-900">
            Navigation unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>

          <div className="mt-5 space-y-2">
            <Button
              fullWidth
              onClick={recalculate}
            >
              <RefreshCw size={18} />
              Try Again
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={() => go('routes')}
            >
              Back to Routes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentStep =
    currentStepIndex >= 0
      ? routeSteps[currentStepIndex]
      : null;

  const instructionTitle =
    arrived
      ? 'You have arrived'
      : currentStep
        ? maneuverTitle(currentStep)
        : 'Continue straight';

  const instructionStreet =
    arrived
      ? destination.name
      : currentStep
        ? getStreetName(currentStep)
        : destination.name;

  const instructionDistance =
    arrived
      ? 0
      : nextStepDistance;

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">
      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="absolute inset-0">
        <MapContainer
          center={[
            currentLocation?.lat ??
              destinationPoint.lat,
            currentLocation?.lng ??
              destinationPoint.lng,
          ]}
          zoom={17}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {currentLocation && (
            <Marker
              position={[
                currentLocation.lat,
                currentLocation.lng,
              ]}
              icon={createCurrentLocationIcon()}
            />
          )}

          <Marker
            position={[
              destinationPoint.lat,
              destinationPoint.lng,
            ]}
            icon={createDestinationIcon()}
          />

          {routeCoordinates.length > 1 && (
            <>
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: '#ffffff',
                  weight: 10,
                  opacity: 0.9,
                }}
              />

              <Polyline
                positions={routeCoordinates}
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

          <FollowCurrentLocation
            currentLocation={
              currentLocation
            }
          />

          <FitRoute
            currentLocation={
              currentLocation
            }
            routeCoordinates={
              routeCoordinates
            }
          />
        </MapContainer>
      </div>

      {/* ======================================================
          TOP DESTINATION CHIP
      ====================================================== */}

      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <span className="text-lg">
            {destination.place
              ? destination.place.emoji
              : '📍'}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">
              Navigating to
            </p>

            <p className="truncate text-sm font-bold text-slate-900">
              {destination.name}
            </p>
          </div>

          <button
            type="button"
            onClick={() => go('home')}
            aria-label="Exit navigation"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ======================================================
          GPS STATUS
      ====================================================== */}

      <div className="absolute left-4 top-20 z-20 rounded-2xl bg-white/95 px-3 py-2 shadow-card backdrop-blur">
        <div className="flex items-center gap-2">
          <LocateFixed
            size={16}
            className="text-accessible-600"
          />

          <div>
            <p className="text-xs font-bold text-slate-800">
              GPS active
            </p>

            <p className="text-[10px] text-slate-500">
              Live location
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
          SOS
      ====================================================== */}

      <div className="absolute right-4 top-20 z-20">
        <SOSButton />
      </div>

      {/* ======================================================
          NEXT TURN CARD
      ====================================================== */}

      <div className="absolute inset-x-4 top-36 z-20">
        <div className="rounded-3xl bg-white p-4 shadow-sheet">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-4xl font-black text-white">
              {arrived
                ? '✓'
                : currentStep
                  ? maneuverSymbol(
                      currentStep,
                    )
                  : '↑'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-600">
                {arrived
                  ? 'Destination'
                  : 'Next instruction'}
              </p>

              <p className="mt-0.5 text-xl font-extrabold leading-tight text-slate-900">
                {instructionTitle}
              </p>

              {!arrived && (
                <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                  {instructionStreet}
                </p>
              )}
            </div>

            {!arrived && (
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black text-slate-900">
                  {formatDistance(
                    instructionDistance,
                  )}
                </p>

                <p className="text-[10px] font-bold uppercase text-slate-400">
                  from turn
                </p>
              </div>
            )}
          </div>

          {loadingRoute &&
            routeCoordinates.length > 0 && (
              <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700">
                Recalculating route...
              </div>
            )}
        </div>
      </div>

      {/* ======================================================
          BOTTOM NAVIGATION CARD
      ====================================================== */}

      <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white p-5 pb-6 shadow-sheet">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />

        {/* ROUTE SUMMARY */}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              Distance
            </p>

            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {formatDistance(
                routeDistance,
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              ETA
            </p>

            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {formatDuration(
                routeDuration,
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-accessible-50 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-accessible-600">
              Mode
            </p>

            <p className="mt-1 text-sm font-extrabold text-accessible-700">
              {mode === 'wheelchair'
                ? '♿'
                : '👁'}{' '}
              {mode === 'wheelchair'
                ? 'Wheelchair'
                : 'Low Vision'}
            </p>
          </div>
        </div>

        {/* CURRENT NAVIGATION */}

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <NavigationIcon
              size={24}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-slate-900">
              {instructionTitle}
            </p>

            <p className="text-sm text-slate-500">
              {arrived
                ? `You are at or very close to ${destination.name}.`
                : currentStep
                  ? `${formatDistance(
                      instructionDistance,
                    )} until the next maneuver.`
                  : 'Your position is being updated using GPS.'}
            </p>
          </div>
        </div>

        {/* ACCESSIBILITY STATUS */}

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-accessible-50 p-3">
          <span className="text-xl">
            {mode === 'wheelchair'
              ? '♿'
              : '👁'}
          </span>

          <p className="flex-1 text-sm font-semibold text-accessible-800">
            {mode === 'wheelchair'
              ? 'Wheelchair mode is active. Accessibility obstacles will be checked when accessibility routing data is connected.'
              : 'Low-vision mode is active. Use the high-contrast map and voice guidance features where available.'}
          </p>
        </div>

        {/* ACTION BUTTONS */}

        <div className="mt-4 grid grid-cols-4 gap-2">
          <NavAction
            icon={
              paused ? (
                <Play size={18} />
              ) : (
                <Pause size={18} />
              )
            }
            label={
              paused
                ? 'Resume'
                : 'Pause'
            }
            onClick={() =>
              setPaused(!paused)
            }
          />

          <NavAction
            icon={
              <RefreshCw size={18} />
            }
            label="Recalc"
            onClick={
              recalculate
            }
          />

          <NavAction
            icon={
              <FileText size={18} />
            }
            label="Details"
            onClick={() =>
              go('details')
            }
          />

          <NavAction
            icon={
              <AlertTriangle
                size={18}
              />
            }
            label="Report"
            onClick={() =>
              go('report')
            }
          />
        </div>

        {/* PAUSED */}

        {paused && (
          <div className="mt-3 rounded-2xl bg-primary-50 px-4 py-3 text-center">
            <p className="text-sm font-bold text-primary-700">
              Navigation paused
            </p>

            <p className="mt-1 text-xs text-primary-600">
              GPS tracking remains active.
            </p>
          </div>
        )}

        {/* ARRIVED */}

        {arrived && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-accessible-50 py-3 text-sm font-bold text-accessible-700">
            <Check
              size={16}
              strokeWidth={3}
            />

            You have arrived
          </div>
        )}
      </div>

      {/* ======================================================
          PAUSE OVERLAY
      ====================================================== */}

      {paused && (
        <Overlay
          onClose={() =>
            setPaused(false)
          }
        >
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <Pause
                size={28}
                className="text-primary-700"
              />
            </div>
          </div>

          <h2 className="text-center text-2xl font-extrabold text-slate-900">
            Navigation Paused
          </h2>

          <p className="mt-2 text-center text-sm text-slate-500">
            Your live location is still available.
            Resume when you are ready.
          </p>

          <div className="mt-6 space-y-3">
            <Button
              fullWidth
              onClick={() =>
                setPaused(false)
              }
            >
              <Play size={18} />
              Resume Navigation
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={() =>
                go('home')
              }
            >
              End Navigation
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function NavAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 py-2.5 text-slate-700 active:scale-95"
    >
      {icon}

      <span className="text-xs font-semibold">
        {label}
      </span>
    </button>
  );
}