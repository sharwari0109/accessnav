import { useEffect, useMemo, useState } from 'react';

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

interface RouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
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

function FollowRoute({
  currentLocation,
  routeCoordinates,
}: {
  currentLocation: RoutePoint | null;
  routeCoordinates: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (!currentLocation || routeCoordinates.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(
      routeCoordinates.map(([lat, lng]) => [
        lat,
        lng,
      ]),
    );

    map.fitBounds(bounds, {
      padding: [40, 300],
      maxZoom: 17,
    });
  }, [
    map,
    currentLocation,
    routeCoordinates,
  ]);

  return null;
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

  const [loadingLocation, setLoadingLocation] =
    useState(true);

  const [loadingRoute, setLoadingRoute] =
    useState(true);

  const [error, setError] = useState('');

  const [arrived, setArrived] =
    useState(false);

  /*
   * Destination comes from the new global destination
   * structure:
   *
   * {
   *   name,
   *   lat,
   *   lng,
   *   place?
   * }
   */
  const destinationPoint = useMemo<RoutePoint | null>(() => {
    if (!destination) {
      return null;
    }

    return {
      lat: destination.lat,
      lng: destination.lng,
    };
  }, [destination]);

  /*
   * Get the user's real GPS location.
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
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

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
   * Calculate the real road route.
   */
  useEffect(() => {
    if (
      !currentLocation ||
      !destinationPoint
    ) {
      return;
    }

    let cancelled = false;

    async function calculateRoute() {
      try {
        setLoadingRoute(true);
        setError('');

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${currentLocation!.lng},${currentLocation!.lat};` +
          `${destinationPoint!.lng},${destinationPoint!.lat}` +
          `?overview=full&geometries=geojson`;

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

        if (cancelled) {
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

        setRouteCoordinates(
          coordinates,
        );

        setRouteDistance(
          route.distance,
        );

        setRouteDuration(
          route.duration,
        );

        /*
         * Check approximate arrival distance.
         */
        if (
          route.distance < 30
        ) {
          setArrived(true);
        } else {
          setArrived(false);
        }
      } catch (err) {
        console.error(
          'Navigation route error:',
          err,
        );

        if (!cancelled) {
          setError(
            'Unable to calculate the navigation route.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRoute(false);
        }
      }
    }

    calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [
    currentLocation,
    destinationPoint,
  ]);

  /*
   * Recalculate route manually.
   */
  const recalculate = () => {
    if (!currentLocation || !destinationPoint) {
      return;
    }

    setLoadingRoute(true);
    setError('');

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${currentLocation.lng},${currentLocation.lat};` +
      `${destinationPoint.lng},${destinationPoint.lat}` +
      `?overview=full&geometries=geojson`;

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Routing failed: ${response.status}`,
          );
        }

        return (await response.json()) as RouteResponse;
      })
      .then((data) => {
        if (
          data.code !== 'Ok' ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error(
            'No route available.',
          );
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

        setRouteCoordinates(
          coordinates,
        );

        setRouteDistance(
          route.distance,
        );

        setRouteDuration(
          route.duration,
        );

        setArrived(
          route.distance < 30,
        );
      })
      .catch((err) => {
        console.error(
          'Manual recalculation failed:',
          err,
        );

        setError(
          'Unable to recalculate the route.',
        );
      })
      .finally(() => {
        setLoadingRoute(false);
      });
  };

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
              onClick={() =>
                go('home')
              }
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Overall loading screen.
   */
  if (
    loadingLocation ||
    loadingRoute
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
              onClick={
                recalculate
              }
            >
              <RefreshCw
                size={18}
              />
              Try Again
            </Button>

            <Button
              fullWidth
              variant="secondary"
              onClick={() =>
                go('routes')
              }
            >
              Back to Routes
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          zoom={15}
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

          <FollowRoute
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
          DESTINATION CHIP
      ====================================================== */}

      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur">
          <span className="text-lg">
            {destination.place
              ? destination.place
                  .emoji
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
            onClick={() =>
              go('home')
            }
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
              {arrived
                ? 'You have arrived'
                : `Follow the route to ${destination.name}`}
            </p>

            <p className="text-sm text-slate-500">
              {arrived
                ? 'You are at or very close to your destination.'
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
                <Play
                  size={18}
                />
              ) : (
                <Pause
                  size={18}
                />
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
              <RefreshCw
                size={18}
              />
            }
            label="Recalc"
            onClick={
              recalculate
            }
          />

          <NavAction
            icon={
              <FileText
                size={18}
              />
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
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
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