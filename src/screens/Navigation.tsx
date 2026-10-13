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
  Pane,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

/* ------------------------------------------------------------------
 * TYPES
 * ------------------------------------------------------------------ */

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

type ModeKey = 'vehicle' | 'wheelchair';

interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  steps: OSRMStep[];
  source: 'ORS' | 'OSRM';
  /** True when OpenRouteService applied the slope/kerb/width limits. */
  avoidsObstacles?: boolean;
}

interface ORSStep {
  distance: number;
  duration: number;
  type: number;
  name?: string;
  way_points: [number, number];
}

/*
 * Optional: put VITE_ORS_API_KEY=your_key in accessnav/.env (free key from
 * openrouteservice.org). With a key, car and wheelchair routes/times come
 * from OpenRouteService (it has a real "wheelchair" profile). Without a key
 * the app falls back to the free OSRM servers.
 */
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY as string | undefined;

// Why the last OpenRouteService call failed (shown in the preview so you
// can see what is wrong without opening dev tools).
let lastOrsError = '';

console.info(
  '[AccessNav] OpenRouteService key loaded:',
  Boolean(ORS_API_KEY),
  ORS_API_KEY ? `(length ${ORS_API_KEY.length})` : '',
);

/*
 * Neither OSRM nor OpenRouteService knows live traffic, so car times are
 * "free-flow" times. This multiplier adds a typical city-traffic allowance.
 * Set it to 1 to see the raw routing time.
 */
const CAR_TRAFFIC_FACTOR = 1.3;

const EMPTY_COORDS: [number, number][] = [];
const EMPTY_STEPS: OSRMStep[] = [];

/*
 * Wheelchair assumptions (tweak to taste):
 * - ~1.1 m/s (about 4 km/h) is a realistic average for a manual chair
 *   once crossings, kerbs and slopes are included. Power chairs are
 *   faster but are limited by battery range.
 * - Up to 2 km is comfortable, up to 5 km is possible but tiring,
 *   beyond that a vehicle is the practical choice.
 */
const WHEELCHAIR_SPEED_MPS = 1.1;
const WHEELCHAIR_COMFORT_M = 2000;
const WHEELCHAIR_MAX_M = 5000;

// Sent to OpenRouteService's wheelchair profile (needs VITE_ORS_API_KEY).
// Tune these to the person's chair. Strict limits can make a route
// impossible, so the app retries without them if nothing is found.
const WHEELCHAIR_MAX_INCLINE_PCT = 6;
const WHEELCHAIR_MAX_KERB_M = 0.06;
const WHEELCHAIR_MIN_WIDTH_M = 1.0;

type Verdict = {
  label: string;
  className: string;
};

function wheelchairVerdict(distanceMeters: number): Verdict {
  if (distanceMeters <= WHEELCHAIR_COMFORT_M) {
    return { label: 'Comfortable', className: 'bg-green-50 text-green-700' };
  }
  if (distanceMeters <= WHEELCHAIR_MAX_M) {
    return { label: 'Possible, tiring', className: 'bg-amber-50 text-amber-700' };
  }
  return { label: 'Too far', className: 'bg-red-50 text-red-700' };
}

function recommendedMode(wheelchairDistance: number | null): ModeKey {
  if (wheelchairDistance === null) return 'vehicle';
  return wheelchairDistance <= WHEELCHAIR_COMFORT_M ? 'wheelchair' : 'vehicle';
}

/* ------------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------------ */

function getInstructionText(step: OSRMStep): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;

  if (type === 'depart') return 'Start route';
  if (type === 'arrive') return 'Arrive at destination';
  if (modifier === 'left') return 'Turn left';
  if (modifier === 'right') return 'Turn right';
  if (modifier === 'slight left') return 'Slight left';
  if (modifier === 'slight right') return 'Slight right';
  if (modifier === 'uturn') return 'Make a U-turn';
  if (modifier === 'straight') return 'Continue straight';

  return 'Continue on route';
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return '0 m';

  if (meters < 1000) {
    return `${Math.max(0, Math.round(meters))} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function calculateWheelchairDuration(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  return distanceMeters / WHEELCHAIR_SPEED_MPS;
}

async function fetchOsrmRoute(
  modeKey: ModeKey,
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RouteData[]> {
  const coords =
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  // Public OSRM = driving only. FOSSGIS foot server = footpaths/sidewalks.
  const baseUrl =
    modeKey === 'vehicle'
      ? 'https://router.project-osrm.org/route/v1/driving/'
      : 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';

  const response = await fetch(
    `${baseUrl}${coords}?overview=full&geometries=geojson&steps=true&alternatives=3`,
  );

  if (!response.ok) {
    throw new Error(`Routing service returned ${response.status}`);
  }

  const data = (await response.json()) as RouteResponse;

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route was returned.');
  }

  return data.routes.slice(0, 3).map((route) => ({
    coordinates: route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    ),
    distance: route.distance,
    // Car: OSRM driving time. Wheelchair: our own speed-based estimate.
    duration:
      modeKey === 'vehicle'
        ? route.duration
        : calculateWheelchairDuration(route.distance),
    steps: route.legs?.flatMap((leg) => leg.steps ?? []) ?? [],
    source: 'OSRM' as const,
  }));
}

function orsManeuver(type: number): { type: string; modifier?: string } {
  switch (type) {
    case 0: return { type: 'turn', modifier: 'left' };
    case 1: return { type: 'turn', modifier: 'right' };
    case 2: return { type: 'turn', modifier: 'sharp left' };
    case 3: return { type: 'turn', modifier: 'sharp right' };
    case 4: return { type: 'turn', modifier: 'slight left' };
    case 5: return { type: 'turn', modifier: 'slight right' };
    case 7:
    case 8: return { type: 'roundabout' };
    case 9: return { type: 'uturn', modifier: 'uturn' };
    case 10: return { type: 'arrive' };
    case 11: return { type: 'depart' };
    case 12: return { type: 'fork', modifier: 'left' };
    case 13: return { type: 'fork', modifier: 'right' };
    default: return { type: 'continue', modifier: 'straight' };
  }
}

interface ORSResponse {
  features?: Array<{
    geometry: { coordinates: [number, number][] };
    properties: {
      summary: { distance: number; duration: number };
      segments?: Array<{ steps?: ORSStep[] }>;
    };
  }>;
}

async function fetchOrsRoute(
  modeKey: ModeKey,
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RouteData[]> {
  const profile = modeKey === 'vehicle' ? 'driving-car' : 'wheelchair';

  const request = (withAlternatives: boolean, withRestrictions: boolean) =>
    fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY as string,
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        instructions: true,
        ...(withAlternatives
          ? {
              alternative_routes: {
                target_count: 3,
                share_factor: 0.6,
                weight_factor: 1.6,
              },
            }
          : {}),
        ...(withRestrictions
          ? {
              options: {
                profile_params: {
                  restrictions: {
                    maximum_incline: WHEELCHAIR_MAX_INCLINE_PCT,
                    maximum_sloped_kerb: WHEELCHAIR_MAX_KERB_M,
                    minimum_width: WHEELCHAIR_MIN_WIDTH_M,
                  },
                },
              },
            }
          : {}),
      }),
    });

  // Try the strictest request first, then relax: alternatives are only
  // supported on shorter trips, and tight wheelchair limits can leave no
  // route where map data is sparse.
  const attempts =
    modeKey === 'wheelchair'
      ? [
          { alt: true, restrict: true },
          { alt: false, restrict: true },
          { alt: true, restrict: false },
          { alt: false, restrict: false },
        ]
      : [
          { alt: true, restrict: false },
          { alt: false, restrict: false },
        ];

  let response: Response | null = null;
  let restricted = false;
  let lastFailure = '';

  for (const attempt of attempts) {
    try {
      const result = await request(attempt.alt, attempt.restrict);

      if (result.ok) {
        response = result;
        restricted = attempt.restrict;
        break;
      }

      const body = (await result.text()).slice(0, 200);
      lastFailure = `HTTP ${result.status} ${body}`;
      console.warn('[AccessNav] OpenRouteService attempt failed:', profile, attempt, lastFailure);
    } catch (err) {
      // Usually a network / CORS / blocked-request problem.
      lastFailure = `Request blocked or offline: ${String(err)}`;
      console.warn('[AccessNav] OpenRouteService request error:', err);
    }
  }

  if (!response) {
    lastOrsError = lastFailure;
    throw new Error(lastFailure || 'OpenRouteService could not return a route.');
  }

  lastOrsError = '';

  const data = (await response.json()) as ORSResponse;

  if (!data.features || data.features.length === 0) {
    throw new Error('No route was returned.');
  }

  return data.features.slice(0, 3).map((feature) => {
    const lngLat = feature.geometry.coordinates;

    const steps: OSRMStep[] = (feature.properties.segments ?? [])
      .flatMap((segment) => segment.steps ?? [])
      .map((step) => {
        const point = lngLat[step.way_points[0]];

        return {
          distance: step.distance,
          duration: step.duration,
          name: step.name && step.name !== '-' ? step.name : '',
          maneuver: {
            location: [point[0], point[1]] as [number, number],
            ...orsManeuver(step.type),
          },
        };
      });

    return {
      coordinates: lngLat.map(([lng, lat]) => [lat, lng] as [number, number]),
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration,
      steps,
      source: 'ORS' as const,
      avoidsObstacles: restricted,
    };
  });
}

async function fetchRouteForMode(
  modeKey: ModeKey,
  origin: RoutePoint,
  destination: RoutePoint,
): Promise<RouteData[]> {
  let list: RouteData[] | null = null;

  if (ORS_API_KEY) {
    try {
      list = await fetchOrsRoute(modeKey, origin, destination);
    } catch (err) {
      console.warn('OpenRouteService failed, falling back to OSRM:', err);
    }
  }

  if (!list) {
    list = await fetchOsrmRoute(modeKey, origin, destination);
  }

  const result = list.map((route) =>
    modeKey === 'vehicle'
      ? { ...route, duration: route.duration * CAR_TRAFFIC_FACTOR }
      : route,
  );

  // Fastest first, then drop near-identical alternatives (same distance
  // and time within a couple of percent) so the list is not repeated.
  const sorted = result.sort((x, y) => x.duration - y.duration);

  return sorted.filter(
    (route, i) =>
      !sorted
        .slice(0, i)
        .some(
          (kept) =>
            (Math.abs(kept.distance - route.distance) / route.distance < 0.02 &&
              Math.abs(kept.duration - route.duration) / route.duration < 0.03) ||
            (viaName(kept) !== '' &&
              viaName(kept) === viaName(route) &&
              Math.abs(kept.duration - route.duration) / route.duration < 0.05),
        ),
  );
}

function viaName(route: RouteData): string {
  let best = '';
  let bestDistance = 0;

  for (const step of route.steps) {
    if (step.name && step.name.trim() && step.distance > bestDistance) {
      best = step.name;
      bestDistance = step.distance;
    }
  }

  return best;
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

function haversineDistance(first: RoutePoint, second: RoutePoint) {
  const earthRadius = 6371000;

  const lat1 = (first.lat * Math.PI) / 180;
  const lat2 = (second.lat * Math.PI) / 180;
  const deltaLat = ((second.lat - first.lat) * Math.PI) / 180;
  const deltaLng = ((second.lng - first.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

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
    const distance = haversineDistance(location, { lat, lng });

    if (distance < minimumDistance) {
      minimumDistance = distance;
    }
  }

  return minimumDistance;
}

function createCurrentLocationIcon(heading: number | null) {
  const arrow =
    heading !== null
      ? `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(${heading}deg);">
           <div style="position:absolute;left:-9px;top:-34px;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid #1a73e8;"></div>
         </div>`
      : '';

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:30px;">
        <div style="position:absolute;inset:-10px;border-radius:9999px;background:rgba(26,115,232,0.18);"></div>
        ${arrow}
        <div
          style="
            position: relative;
            width: 30px;
            height: 30px;
            border-radius: 9999px;
            background: #1a73e8;
            border: 4px solid white;
            box-shadow: 0 3px 12px rgba(0,0,0,0.35);
          "
        ></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Red map pin for the destination; the tip of the pin is the anchor.
function createDestinationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <svg width="36" height="46" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"
           style="filter: drop-shadow(0 3px 4px rgba(0,0,0,0.35));">
        <path d="M12 1C5.9 1 1 5.9 1 12c0 8.3 11 19 11 19s11-10.7 11-19C23 5.9 18.1 1 12 1z"
              fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
      </svg>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 45],
  });
}

function FollowRoute({
  currentLocation,
  enabled,
  onUserMove,
}: {
  currentLocation: RoutePoint | null;
  enabled: boolean;
  onUserMove: () => void;
}) {
  const map = useMap();

  // Dragging the map stops auto-follow until "Recenter" is tapped.
  useMapEvents({
    dragstart: () => onUserMove(),
  });

  useEffect(() => {
    if (!enabled || !currentLocation) {
      return;
    }

    map.setView([currentLocation.lat, currentLocation.lng], 18, {
      animate: true,
      duration: 0.5,
    });
  }, [currentLocation, enabled, map]);

  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, {
      paddingTopLeft: [30, 110],
      paddingBottomRight: [30, 380],
      animate: true,
    });
  }, [bounds, map]);

  return null;
}

function RouteLabel({
  position,
  text,
  selected,
  color,
  onClick,
}: {
  position: [number, number];
  text: string;
  selected: boolean;
  color: string;
  onClick: () => void;
}) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<div style="padding:4px 10px;border-radius:9999px;font:800 13px system-ui,sans-serif;white-space:nowrap;text-align:center;background:${
          selected ? color : '#ffffff'
        };color:${selected ? '#ffffff' : '#0f172a'};border:2px solid ${
          selected ? '#ffffff' : '#94a3b8'
        };box-shadow:0 2px 8px rgba(0,0,0,0.3);">${text}</div>`,
        iconSize: [76, 30],
        iconAnchor: [38, 15],
      }),
    [text, selected, color],
  );

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: onClick }}
    />
  );
}

function maneuverSymbol(step: OSRMStep) {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;

  if (type === 'arrive') return '✓';
  if (type === 'roundabout' || type === 'rotary') return '↻';
  if (type === 'uturn') return '↶';
  if (modifier === 'left') return '←';
  if (modifier === 'right') return '→';
  if (modifier === 'slight left') return '↖';
  if (modifier === 'slight right') return '↗';
  if (modifier === 'sharp left') return '↙';
  if (modifier === 'sharp right') return '↘';

  return '↑';
}

function maneuverTitle(step: OSRMStep) {
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;

  if (type === 'arrive') {
    return 'You have arrived';
  }

  if (type === 'depart') {
    if (modifier === 'left') return 'Start by turning left';
    if (modifier === 'right') return 'Start by turning right';
    return 'Start navigation';
  }

  if (type === 'roundabout' || type === 'rotary') {
    if (step.maneuver.exit) {
      return `Take exit ${step.maneuver.exit}`;
    }
    return 'Continue through the roundabout';
  }

  if (type === 'uturn') {
    return 'Make a U-turn';
  }

  if (type === 'merge') {
    if (modifier === 'left') return 'Merge left';
    if (modifier === 'right') return 'Merge right';
    return 'Merge';
  }

  if (type === 'fork') {
    if (modifier === 'left') return 'Keep left';
    if (modifier === 'right') return 'Keep right';
    return 'Continue at the fork';
  }

  if (type === 'on ramp') {
    if (modifier === 'left') return 'Take the left ramp';
    if (modifier === 'right') return 'Take the right ramp';
    return 'Take the ramp';
  }

  if (type === 'off ramp') {
    if (modifier === 'left') return 'Take the left exit ramp';
    if (modifier === 'right') return 'Take the right exit ramp';
    return 'Take the exit ramp';
  }

  if (type === 'end of road') {
    if (modifier === 'left') return 'Turn left at the end of the road';
    if (modifier === 'right') return 'Turn right at the end of the road';
    return 'Continue at the end of the road';
  }

  if (modifier === 'left') return 'Turn left';
  if (modifier === 'right') return 'Turn right';
  if (modifier === 'slight left') return 'Bear left';
  if (modifier === 'slight right') return 'Bear right';
  if (modifier === 'sharp left') return 'Turn sharply left';
  if (modifier === 'sharp right') return 'Turn sharply right';

  return 'Continue straight';
}

function getStreetName(step: OSRMStep) {
  if (step.name && step.name.trim().length > 0) {
    return step.name;
  }

  return 'Unnamed road';
}

function findInitialStep(steps: OSRMStep[]) {
  if (steps.length === 0) {
    return -1;
  }

  const firstUsefulStep = steps.findIndex(
    (step) => step.maneuver.type !== 'depart',
  );

  if (firstUsefulStep !== -1) {
    return firstUsefulStep;
  }

  return 0;
}

function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/* ------------------------------------------------------------------
 * MAIN SCREEN
 * ------------------------------------------------------------------ */

export default function Navigation() {
  const {
    destination,
    mode,
    travelMode,
    setTravelMode,
    paused,
    setPaused,
    go,
  } = useApp();

  const [currentLocation, setCurrentLocation] =
    useState<RoutePoint | null>(null);

  // Both routes are fetched up front so they can be compared.
  const [routes, setRoutes] = useState<Record<ModeKey, RouteData[]>>({
    vehicle: [],
    wheelchair: [],
  });

  // 'preview' = pick a route (like Google Maps), 'navigating' = turn by turn.
  const [phase, setPhase] = useState<'preview' | 'navigating'>('preview');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [following, setFollowing] = useState(true);
  const [heading, setHeading] = useState<number | null>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [measuredSpeed, setMeasuredSpeed] = useState<number | null>(null);
  const speedEmaRef = useRef<number | null>(null);
  const [nextStepDistance, setNextStepDistance] = useState(0);

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [error, setError] = useState('');
  const [arrived, setArrived] = useState(false);

  const latestLocationRef = useRef<RoutePoint | null>(null);
  const hasRouteRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const requestIdRef = useRef(0);

  const destinationPoint = useMemo<RoutePoint | null>(() => {
    if (!destination) {
      return null;
    }

    return {
      lat: destination.lat,
      lng: destination.lng,
    };
  }, [destination]);

  // The old 'walking' option is gone: anything that isn't vehicle is wheelchair.
  const activeMode: ModeKey = travelMode === 'vehicle' ? 'vehicle' : 'wheelchair';
  const activeList = routes[activeMode];
  const safeIdx = selectedIdx < activeList.length ? selectedIdx : 0;
  const activeRoute: RouteData | null = activeList[safeIdx] ?? null;
  const routeCoordinates = activeRoute?.coordinates ?? EMPTY_COORDS;
  const routeSteps = activeRoute?.steps ?? EMPTY_STEPS;

  // Fit the whole trip on screen in preview. Deliberately not tied to the
  // live GPS position, so it does not re-fit (and fight panning) every fix.
  const previewBounds = useMemo(() => {
    const points: [number, number][] = [];

    for (const route of activeList) {
      for (const point of route.coordinates) {
        points.push(point);
      }
    }

    if (destinationPoint) {
      points.push([destinationPoint.lat, destinationPoint.lng]);
    }

    return points.length > 1 ? L.latLngBounds(points) : null;
  }, [activeList, destinationPoint]);

  // Distance remaining along the route, from the nearest point to the end.
  const remainingMeters = useMemo(() => {
    if (!activeRoute || activeRoute.coordinates.length < 2) {
      return null;
    }

    if (!currentLocation) {
      return activeRoute.distance;
    }

    const c = activeRoute.coordinates;
    const cumulative: number[] = [0];

    for (let i = 1; i < c.length; i++) {
      cumulative.push(
        cumulative[i - 1] +
          getDistanceMeters(c[i - 1][0], c[i - 1][1], c[i][0], c[i][1]),
      );
    }

    let nearest = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < c.length; i++) {
      const d = getDistanceMeters(
        currentLocation.lat,
        currentLocation.lng,
        c[i][0],
        c[i][1],
      );

      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = i;
      }
    }

    return cumulative[cumulative.length - 1] - cumulative[nearest] + nearestDistance;
  }, [activeRoute, currentLocation]);

  // Live ETA: route average speed, blended with real GPS speed when it
  // is plausible for the chosen mode (so walking while "Car" is selected
  // does not wreck the estimate).
  const routeAverageSpeed =
    activeRoute && activeRoute.duration > 0
      ? activeRoute.distance / activeRoute.duration
      : null;

  const measuredSpeedIsUsable =
    measuredSpeed !== null &&
    (activeMode === 'vehicle' ? measuredSpeed >= 3 : measuredSpeed <= 3);

  const effectiveSpeed =
    routeAverageSpeed === null
      ? null
      : measuredSpeedIsUsable && measuredSpeed !== null
        ? 0.6 * measuredSpeed + 0.4 * routeAverageSpeed
        : routeAverageSpeed;

  const remainingSeconds =
    remainingMeters !== null && effectiveSpeed
      ? remainingMeters / effectiveSpeed
      : null;

  const arrivalClock =
    remainingSeconds !== null
      ? new Date(Date.now() + remainingSeconds * 1000).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

  /*
   * ------------------------------------------------------------
   * LIVE GPS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoadingLocation(false);
      setError('Your browser does not support location services.');
      return;
    }

    setLoadingLocation(true);
    setError('');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: RoutePoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        latestLocationRef.current = location;

        // Smoothed real speed from GPS (m/s), used to refine the ETA.
        const rawSpeed = position.coords.speed;

        if (rawSpeed !== null && Number.isFinite(rawSpeed) && rawSpeed > 0.3) {
          speedEmaRef.current =
            speedEmaRef.current === null
              ? rawSpeed
              : 0.8 * speedEmaRef.current + 0.2 * rawSpeed;
          setMeasuredSpeed(speedEmaRef.current);
        }

        const rawHeading = position.coords.heading;

        if (rawHeading !== null && Number.isFinite(rawHeading)) {
          setHeading(rawHeading);
        }

        setCurrentLocation(location);
        setLoadingLocation(false);
      },
      (locationError) => {
        console.error('Navigation location error:', locationError);

        setLoadingLocation(false);

        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError(
            'Location permission was denied. Please allow location access in your browser.',
          );
        } else if (
          locationError.code === locationError.POSITION_UNAVAILABLE
        ) {
          setError('Your current location could not be determined.');
        } else if (locationError.code === locationError.TIMEOUT) {
          setError('Getting your current location timed out.');
        } else {
          setError('Unable to get your current location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  /*
   * ------------------------------------------------------------
   * AUTO-ADVANCE STEP (runs every second with fresh state)
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (routeSteps.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      const location = latestLocationRef.current;

      if (!location) {
        return;
      }

      let closestStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

      for (let i = closestStepIndex; i < routeSteps.length; i++) {
        const [stepLng, stepLat] = routeSteps[i].maneuver.location;

        const distance = getDistanceMeters(
          location.lat,
          location.lng,
          stepLat,
          stepLng,
        );

        if (distance < 50) {
          closestStepIndex = i;
          break;
        }
      }

      if (closestStepIndex !== currentStepIndex) {
        setCurrentStepIndex(closestStepIndex);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [routeSteps, currentStepIndex]);

  /*
   * ------------------------------------------------------------
   * RESET ROUTE WHEN DESTINATION CHANGES
   * ------------------------------------------------------------
   */

  useEffect(() => {
    hasRouteRef.current = false;

    setRoutes({ vehicle: [], wheelchair: [] });
    setPhase('preview');
    setSelectedIdx(0);
    setFollowing(true);
    setCurrentStepIndex(-1);
    setNextStepDistance(0);
    setArrived(false);
    setError('');
  }, [destinationPoint]);

  /*
   * ------------------------------------------------------------
   * FETCH CAR + WHEELCHAIR ROUTES
   * ------------------------------------------------------------
   *
   * Neither OSRM server has real wheelchair data (kerbs, slopes,
   * surfaces), so the wheelchair route is a footpath route plus
   * a feasibility check based on distance.
   */

  const fetchRoutes = useCallback(
    async (
      origin: RoutePoint,
      showError = true,
      modes: ModeKey[] = ['vehicle', 'wheelchair'],
    ) => {
      if (!destinationPoint) {
        return;
      }

      const requestId = ++requestIdRef.current;

      try {
        setLoadingRoute(true);

        if (showError) {
          setError('');
        }

        const results = await Promise.allSettled(
          modes.map((m) => fetchRouteForMode(m, origin, destinationPoint)),
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        const anySucceeded = results.some((r) => r.status === 'fulfilled');

        if (!anySucceeded) {
          throw new Error('No route was returned.');
        }

        setRoutes((prev) => {
          const next = { ...prev };

          modes.forEach((m, i) => {
            const result = results[i];

            // Keep the previous route if a refresh fails.
            if (result.status === 'fulfilled' && result.value.length > 0) {
              next[m] = result.value;
            }
          });

          return next;
        });

        setSelectedIdx(0);
        setArrived(haversineDistance(origin, destinationPoint) <= 30);

        hasRouteRef.current = true;
        lastRerouteAtRef.current = Date.now();
      } catch (err) {
        console.error('Navigation route error:', err);

        if (showError) {
          setError('Unable to calculate the navigation route.');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingRoute(false);
        }
      }
    },
    [destinationPoint],
  );

  /*
   * ------------------------------------------------------------
   * WHEN THE ACTIVE ROUTE CHANGES (new route or mode switch),
   * RESTART THE STEP LIST
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!activeRoute) {
      setCurrentStepIndex(-1);
      return;
    }

    const initialIndex = findInitialStep(activeRoute.steps);
    setCurrentStepIndex(initialIndex);

    const maneuver = activeRoute.steps[initialIndex]?.maneuver?.location;
    const origin = latestLocationRef.current;

    if (maneuver && origin) {
      setNextStepDistance(
        haversineDistance(origin, { lat: maneuver[1], lng: maneuver[0] }),
      );
    }
  }, [activeRoute]);

  /*
   * ------------------------------------------------------------
   * INITIAL ROUTE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!currentLocation || !destinationPoint || hasRouteRef.current) {
      return;
    }

    fetchRoutes(currentLocation, true);
  }, [currentLocation, destinationPoint, fetchRoutes]);

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
    while (stepIndex >= 0 && stepIndex < routeSteps.length) {
      const step = routeSteps[stepIndex];
      const maneuverLocation = step.maneuver?.location;

      if (!maneuverLocation) {
        break;
      }

      const distance = haversineDistance(currentLocation, {
        lat: maneuverLocation[1],
        lng: maneuverLocation[0],
      });

      setNextStepDistance(distance);

      if (distance > 35) {
        break;
      }

      if (step.maneuver.type === 'arrive') {
        setArrived(true);
        break;
      }

      const nextIndex = stepIndex + 1;

      if (nextIndex >= routeSteps.length) {
        setArrived(true);
        break;
      }

      stepIndex = nextIndex;
      setCurrentStepIndex(stepIndex);
    }

    if (destinationPoint) {
      const destinationDistance = haversineDistance(
        currentLocation,
        destinationPoint,
      );

      if (destinationDistance <= 30) {
        setArrived(true);
      }
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
      phase !== 'navigating' ||
      paused ||
      arrived ||
      !currentLocation ||
      routeCoordinates.length < 2 ||
      !destinationPoint
    ) {
      return;
    }

    const distanceFromRoute = distanceToPolyline(
      currentLocation,
      routeCoordinates,
    );

    if (distanceFromRoute <= 75) {
      return;
    }

    const now = Date.now();

    if (now - lastRerouteAtRef.current < 15000) {
      return;
    }

    lastRerouteAtRef.current = now;
    hasRouteRef.current = false;

    fetchRoutes(currentLocation, false, [activeMode]);
  }, [
    currentLocation,
    routeCoordinates,
    paused,
    arrived,
    destinationPoint,
    fetchRoutes,
    activeMode,
    phase,
  ]);

  /*
   * ------------------------------------------------------------
   * MANUAL RECALCULATION
   * ------------------------------------------------------------
   */

  const recalculate = () => {
    const location = latestLocationRef.current;

    if (!location || !destinationPoint) {
      return;
    }

    hasRouteRef.current = false;
    setError('');

    fetchRoutes(location, true);
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
          <AlertTriangle size={30} className="mx-auto text-danger-500" />

          <h2 className="mt-3 text-xl font-extrabold text-slate-900">
            Destination unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            The selected destination does not contain valid coordinates.
          </p>

          <div className="mt-5">
            <Button fullWidth onClick={() => go('home')}>
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

  if (loadingLocation || (loadingRoute && routes.vehicle.length === 0 && routes.wheelchair.length === 0)) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <div className="absolute inset-0">
          <MapContainer
            center={[destinationPoint.lat, destinationPoint.lng]}
            zoom={14}
            zoomControl={false}
            className="h-full w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker
              position={[destinationPoint.lat, destinationPoint.lng]}
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
              <AlertTriangle size={26} className="text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-slate-900">
            Navigation unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-500">{error}</p>

          <div className="mt-5 space-y-2">
            <Button fullWidth onClick={recalculate}>
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

  /*
   * ------------------------------------------------------------
   * DERIVED DISPLAY VALUES
   * ------------------------------------------------------------
   */

  const currentStep = currentStepIndex >= 0 ? routeSteps[currentStepIndex] : null;

  const instructionTitle = arrived
    ? 'You have arrived'
    : currentStep
      ? maneuverTitle(currentStep)
      : 'Continue straight';

  const instructionStreet = arrived
    ? destination.name
    : currentStep
      ? getStreetName(currentStep)
      : destination.name;

  const instructionDistance = arrived ? 0 : nextStepDistance;

  const isPreview = phase === 'preview';
  const routeColor = activeMode === 'vehicle' ? '#2563eb' : '#16a34a';

  const wheelchairDistance = routes.wheelchair[0]?.distance ?? null;
  const recommended = recommendedMode(wheelchairDistance);

  const fastestIdx = activeList.reduce(
    (best, route, i, all) => (route.duration < all[best].duration ? i : best),
    0,
  );
  const shortestIdx = activeList.reduce(
    (best, route, i, all) => (route.distance < all[best].distance ? i : best),
    0,
  );

  // Place each time label at a point on its own line that is far enough
  // from the labels already placed. The selected route is placed first so
  // it gets the best spot.
  const labelPositions: Record<number, [number, number]> = {};

  if (isPreview && activeList.length > 0) {
    const minGap = previewBounds
      ? previewBounds.getNorthEast().distanceTo(previewBounds.getSouthWest()) *
        0.12
      : 0;

    const order = [
      safeIdx,
      ...activeList.map((_, i) => i).filter((i) => i !== safeIdx),
    ];

    const placed: [number, number][] = [];

    for (const i of order) {
      const line = activeList[i].coordinates;

      if (line.length < 2) continue;

      let chosen = line[Math.floor(line.length * 0.5)];

      for (const fraction of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85]) {
        const point = line[Math.min(line.length - 1, Math.floor(line.length * fraction))];

        const farEnough = placed.every(
          (other) => L.latLng(point).distanceTo(L.latLng(other)) >= minGap,
        );

        if (farEnough) {
          chosen = point;
          break;
        }
      }

      placed.push(chosen);
      labelPositions[i] = chosen;
    }
  }

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">
      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="absolute inset-0">
        <MapContainer
          center={[
            currentLocation?.lat ?? destinationPoint.lat,
            currentLocation?.lng ?? destinationPoint.lng,
          ]}
          zoom={17}
          zoomControl={false}
          className="h-full w-full"
        >
          <FollowRoute
            currentLocation={currentLocation}
            enabled={!isPreview && following}
            onUserMove={() => setFollowing(false)}
          />

          {isPreview && previewBounds && <FitBounds bounds={previewBounds} />}

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {currentLocation && (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={createCurrentLocationIcon(heading)}
            />
          )}

          <Marker
            position={[destinationPoint.lat, destinationPoint.lng]}
            icon={createDestinationIcon()}
          />

          {/* Alternative routes: grey, tap to select (preview only) */}
          {/* Own pane: always drawn UNDER the selected route */}
          <Pane name="alt-routes" style={{ zIndex: 410 }}>
          {isPreview &&
            activeList.map((route, i) =>
              i === safeIdx || route.coordinates.length < 2 ? null : (
                <Polyline
                  key={`alt-${activeMode}-${i}`}
                  positions={route.coordinates}
                  pathOptions={{ color: '#94a3b8', weight: 7, opacity: 0.95 }}
                  eventHandlers={{ click: () => setSelectedIdx(i) }}
                />
              ),
            )}

          </Pane>

          {/* Selected route */}
          <Pane name="selected-route" style={{ zIndex: 420 }}>
          {routeCoordinates.length > 1 && (
            <>
              <Polyline
                positions={routeCoordinates}
                pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95 }}
              />

              <Polyline
                positions={routeCoordinates}
                pathOptions={{ color: routeColor, weight: 7, opacity: 1 }}
              />
            </>
          )}

          </Pane>

          {/* Time labels on each route line (preview only) */}
          {isPreview &&
            activeList.map((route, i) => {
              if (route.coordinates.length < 2) return null;

              // Only the selected route shows its time on the map.
              if (i !== safeIdx) return null;

              const at = labelPositions[i];

              if (!at) return null;

              return (
                <RouteLabel
                  key={`label-${activeMode}-${i}`}
                  position={at}
                  text={formatDuration(route.duration)}
                  selected={i === safeIdx}
                  color={routeColor}
                  onClick={() => setSelectedIdx(i)}
                />
              );
            })}
        </MapContainer>
      </div>

      {/* ======================================================
          TOP DESTINATION CHIP
      ====================================================== */}

      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <span className="text-lg">
            {destination.place ? destination.place.emoji : '📍'}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">
              {isPreview ? 'Route to' : 'Navigating to'}
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
          <LocateFixed size={16} className="text-accessible-600" />

          <div>
            <p className="text-xs font-bold text-slate-800">GPS active</p>
            <p className="text-[10px] text-slate-500">Live location</p>
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
          NEXT TURN CARD (navigating only)
      ====================================================== */}

      {!isPreview && (
        <div className="absolute inset-x-4 top-36 z-20">
          <div className="rounded-3xl bg-white p-4 shadow-sheet">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-4xl font-black text-white">
                {arrived ? '✓' : currentStep ? maneuverSymbol(currentStep) : '↑'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-primary-600">
                  {arrived ? 'Destination' : 'Next instruction'}
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
                    {formatDistance(instructionDistance)}
                  </p>

                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    from turn
                  </p>
                </div>
              )}
            </div>

            {!arrived && remainingSeconds !== null && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm font-extrabold text-slate-900">
                  {formatDuration(remainingSeconds)} left ·{' '}
                  {formatDistance(remainingMeters ?? 0)}
                </span>

                <span className="text-sm font-semibold text-slate-500">
                  Arrive {arrivalClock}
                </span>
              </div>
            )}

            {loadingRoute && routeCoordinates.length > 0 && (
              <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700">
                Recalculating route...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          BOTTOM SHEET
      ====================================================== */}

      <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[60%] flex-col">
        {/* Recenter (after the user drags the map while navigating) */}
        {!isPreview && !following && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="absolute -top-14 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-extrabold text-primary-700 shadow-sheet"
          >
            <LocateFixed size={18} />
            Recenter
          </button>
        )}

        <div className="overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-sheet">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />

          {isPreview ? (
            <>
              {/* MODE: CAR vs WHEELCHAIR */}

              <p className="mb-2 text-sm font-bold text-slate-800">
                Choose how to travel
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'vehicle', label: 'Car / taxi', icon: '🚗' },
                    { value: 'wheelchair', label: 'Wheelchair', icon: '♿' },
                  ] as const
                ).map((option) => {
                  const selected = activeMode === option.value;
                  const route =
                    routes[option.value][selected ? safeIdx : 0] ?? null;
                  const verdict =
                    option.value === 'wheelchair' && route
                      ? wheelchairVerdict(route.distance)
                      : null;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTravelMode(option.value);
                        setSelectedIdx(0);
                      }}
                      aria-pressed={selected}
                      className={`rounded-2xl border-2 p-3 text-left ${
                        selected
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900">
                          {option.icon} {option.label}
                        </span>

                        {recommended === option.value && route && (
                          <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Best
                          </span>
                        )}
                      </div>

                      {route ? (
                        <>
                          <p className="mt-2 text-lg font-black text-slate-900">
                            {formatDuration(route.duration)}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            {formatDistance(route.distance)}
                          </p>

                          {verdict ? (
                            <span
                              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${verdict.className}`}
                            >
                              {verdict.label}
                            </span>
                          ) : (
                            <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              Door to door
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {loadingRoute ? 'Calculating...' : 'Route unavailable'}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {wheelchairDistance !== null &&
                wheelchairDistance > WHEELCHAIR_MAX_M && (
                  <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    This is {formatDistance(wheelchairDistance)} away. That is
                    too far to travel by wheelchair alone, so a car or an
                    accessible taxi is the practical choice.
                  </p>
                )}

              {wheelchairDistance !== null &&
                wheelchairDistance > WHEELCHAIR_COMFORT_M &&
                wheelchairDistance <= WHEELCHAIR_MAX_M && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Doable by wheelchair, but long. Check the battery or your
                    energy, and consider a car for part of the way.
                  </p>
                )}

              {/* ROUTE OPTIONS */}

              {activeList.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold text-slate-800">
                    Routes
                  </p>

                  <div className="space-y-2">
                    {activeList.map((route, i) => {
                      const via = viaName(route);

                      return (
                        <button
                          key={`opt-${i}`}
                          type="button"
                          onClick={() => setSelectedIdx(i)}
                          aria-pressed={i === safeIdx}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left ${
                            i === safeIdx
                              ? 'border-primary-600 bg-primary-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-slate-900">
                              {via ? `via ${via}` : `Route ${i + 1}`}
                            </p>

                            <p className="text-xs font-semibold text-slate-500">
                              {formatDistance(route.distance)}
                              {i === fastestIdx ? ' · Fastest' : ''}
                              {i === shortestIdx && i !== fastestIdx
                                ? ' · Shortest'
                                : ''}
                            </p>
                          </div>

                          <p className="shrink-0 text-lg font-black text-slate-900">
                            {formatDuration(route.duration)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-400">
                {activeMode === 'vehicle'
                  ? `Car time includes a x${CAR_TRAFFIC_FACTOR} city-traffic allowance; live traffic is not available.`
                  : activeRoute?.source === 'ORS'
                    ? activeRoute.avoidsObstacles
                      ? `Wheelchair route avoids slopes over ${WHEELCHAIR_MAX_INCLINE_PCT}% and kerbs over ${Math.round(WHEELCHAIR_MAX_KERB_M * 100)} cm where map data exists. Time is from the OpenRouteService wheelchair profile.`
                      : 'Wheelchair time comes from the OpenRouteService wheelchair profile. No route met the slope/kerb limits, so they were relaxed.'
                    : ORS_API_KEY
                      ? `OpenRouteService key found but the request failed: ${lastOrsError || 'unknown error'}. Using the free server (4 km/h estimate).`
                      : 'No OpenRouteService key found, so the wheelchair time assumes about 4 km/h. Check that .env is in the accessnav folder and restart npm run dev.'}
              </p>

              <button
                type="button"
                disabled={!activeRoute}
                onClick={() => {
                  setFollowing(true);
                  setPhase('navigating');
                }}
                className="mt-4 w-full rounded-2xl bg-primary-600 px-4 py-4 text-base font-extrabold text-white shadow-sm disabled:opacity-50"
              >
                {activeRoute
                  ? `Start navigation · ${formatDuration(activeRoute.duration)}`
                  : 'Route unavailable for this mode'}
              </button>
            </>
          ) : (
            <>
              {/* CURRENT NAVIGATION */}

              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white">
                  <NavigationIcon size={24} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900">
                    {currentStep
                      ? getInstructionText(currentStep)
                      : instructionTitle}
                  </p>

                  <p className="text-sm text-slate-500">
                    {arrived
                      ? `You are at or very close to ${destination.name}.`
                      : currentStep
                        ? `${formatDistance(instructionDistance)} until the next maneuver.`
                        : 'Your position is being updated using GPS.'}
                  </p>
                </div>
              </div>

              {currentStep && (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStepIndex < routeSteps.length - 1) {
                      setCurrentStepIndex(currentStepIndex + 1);
                    }
                  }}
                  disabled={currentStepIndex >= routeSteps.length - 1}
                  className="mt-4 w-full rounded-2xl bg-primary-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-sm disabled:opacity-50"
                >
                  {currentStepIndex < routeSteps.length - 1
                    ? 'Next step →'
                    : 'Final step'}
                </button>
              )}

              {/* ACCESSIBILITY STATUS */}

              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-accessible-50 p-3">
                <span className="text-xl">
                  {mode === 'wheelchair' ? '♿' : '👁'}
                </span>

                <p className="flex-1 text-sm font-semibold text-accessible-800">
                  {mode === 'wheelchair'
                    ? 'Wheelchair mode is active. Accessibility information will be used to identify potential obstacles and accessible features for this destination.'
                    : 'Low-vision mode is active. Use the high-contrast map and voice guidance features where available.'}
                </p>
              </div>

              {/* ACTION BUTTONS */}

              <div className="mt-4 grid grid-cols-4 gap-2">
                <NavAction
                  icon={paused ? <Play size={18} /> : <Pause size={18} />}
                  label={paused ? 'Resume' : 'Pause'}
                  onClick={() => setPaused(!paused)}
                />

                <NavAction
                  icon={<RefreshCw size={18} />}
                  label="Recalc"
                  onClick={recalculate}
                />

                <NavAction
                  icon={<FileText size={18} />}
                  label="Details"
                  onClick={() => go('details')}
                />

                <NavAction
                  icon={<AlertTriangle size={18} />}
                  label="Report"
                  onClick={() => go('report')}
                />
              </div>

              <button
                type="button"
                onClick={() => setPhase('preview')}
                className="mt-3 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
              >
                Change route or travel mode
              </button>

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

              {arrived && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-accessible-50 py-3 text-sm font-bold text-accessible-700">
                  <Check size={16} strokeWidth={3} />
                  You have arrived
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ======================================================
          PAUSE OVERLAY
      ====================================================== */}

      {paused && !isPreview && (
        <Overlay onClose={() => setPaused(false)}>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <Pause size={28} className="text-primary-700" />
            </div>
          </div>

          <h2 className="text-center text-2xl font-extrabold text-slate-900">
            Navigation Paused
          </h2>

          <p className="mt-2 text-center text-sm text-slate-500">
            Your live location is still available. Resume when you are ready.
          </p>

          <div className="mt-6 space-y-3">
            <Button fullWidth onClick={() => setPaused(false)}>
              <Play size={18} />
              Resume Navigation
            </Button>

            <Button fullWidth variant="secondary" onClick={() => go('home')}>
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

      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
