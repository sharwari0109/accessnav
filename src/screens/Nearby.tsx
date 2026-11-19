
import { useEffect, useState } from 'react';
import { useApp } from '@/store';
import { getAccessibilityPoints } from '@/api';
import type { Place } from '@/types';

import {
  MapPin,
  Navigation,
  RefreshCw,
  Loader2,
  AlertCircle,
  Accessibility,
  ArrowLeft,
  LocateFixed,
} from 'lucide-react';

interface NearbyPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tags: string[];
  warnings: string[];
  score: number;
  distanceKm: number;
}

export default function Nearby() {
  const { go, setDestination, mode } = useApp();

  const [points, setPoints] = useState<NearbyPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [locationName, setLocationName] = useState('');
  const [searchedRadius, setSearchedRadius] = useState(5);

  // --------------------------------------------------
  // GET LIVE LOCATION AND FIND NEARBY PLACES
  // --------------------------------------------------

  async function loadNearby() {
    if (!navigator.geolocation) {
      setError('Your browser does not support location services.');
      return;
    }

    setLoading(true);
    setError('');
    setPoints([]);
    setLocationName('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          setLocationName(
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          );

          // Search progressively wider radii.
          const radii = [5, 10, 25];

          let foundPoints: NearbyPoint[] = [];
          let finalRadius = 5;

          for (const radius of radii) {
            finalRadius = radius;

            const response = await getAccessibilityPoints(
              latitude,
              longitude,
              radius
            );

            foundPoints = [...response.results].sort(
              (a, b) => a.distanceKm - b.distanceKm
            );

            // Stop when at least three places are found.
            if (foundPoints.length >= 3) {
              break;
            }
          }

          setPoints(foundPoints);
          setSearchedRadius(finalRadius);

        } catch (err) {
          console.error('Nearby places error:', err);

          setError(
            'Unable to load nearby accessibility places. Please try again.'
          );
        } finally {
          setLoading(false);
        }
      },

      (geoError) => {
        console.error('Location error:', geoError);

        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(
            'Location permission denied. Please allow location access in your browser settings.'
          );
        } else if (geoError.code === geoError.TIMEOUT) {
          setError(
            'Location request timed out. Please try again.'
          );
        } else {
          setError(
            'Unable to get your current location.'
          );
        }

        setLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  // Load nearby places when screen opens.
  useEffect(() => {
    void loadNearby();
  }, []);

  // --------------------------------------------------
  // SELECT PLACE AND NAVIGATE
  // --------------------------------------------------

  function selectPlace(point: NearbyPoint) {
  const place: Place = {
    id: point.id,
    name: point.name,
    area: 'Nearby',
    distanceKm: point.distanceKm,
    score: point.score ?? 0,
    tags: point.tags ?? [],
    warnings: point.warnings ?? [],
    x: 0,
    y: 0,
    latitude: point.latitude,
    longitude: point.longitude,
    emoji: '📍',
  };

  setDestination({
    id: point.id,
    name: point.name,
    lat: point.latitude,
    lng: point.longitude,
    place,
  });

  go('destination');
}

  // --------------------------------------------------
  // SCREEN UI
  // --------------------------------------------------

  return (
    <div className="screen-enter relative flex h-full w-full flex-col overflow-hidden bg-slate-50">

      {/* HEADER */}

      <div className="flex items-center justify-between px-4 pb-3 pt-12">

        <div className="flex items-center gap-3">

          <button
            onClick={() => go('home')}
            aria-label="Go back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ArrowLeft size={23} className="text-slate-700" />
          </button>

          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Nearby Places
            </h1>

            <p className="text-xs text-slate-500">
              Accessible places around you
            </p>
          </div>

        </div>

        <button
          onClick={loadNearby}
          disabled={loading}
          aria-label="Refresh nearby places"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 disabled:opacity-50"
        >
          <RefreshCw
            size={21}
            className={loading ? 'animate-spin' : ''}
          />
        </button>

      </div>

      {/* SCROLLABLE CONTENT */}

      <div className="flex-1 overflow-y-auto px-4 pb-8">

        {/* CURRENT LOCATION */}

        {locationName && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">

            <MapPin
              size={21}
              className="shrink-0 text-primary-600"
            />

            <div className="min-w-0">
              <p className="text-xs text-slate-400">
                Your current location
              </p>

              <p className="truncate text-sm font-semibold text-slate-700">
                {locationName}
              </p>
            </div>

            <LocateFixed
              size={19}
              className="ml-auto shrink-0 text-primary-600"
            />

          </div>
        )}

        {/* ACCESSIBILITY MODE */}

        <div className="mb-5 rounded-2xl bg-primary-50 p-4">

          <div className="flex items-center gap-3">

            <Accessibility
              size={29}
              className="shrink-0 text-primary-700"
            />

            <div>
              <p className="font-bold text-primary-900">
                {mode === 'wheelchair'
                  ? 'Wheelchair accessibility'
                  : 'Low vision accessibility'}
              </p>

              <p className="mt-1 text-xs text-primary-700">
                Showing available accessibility information.
              </p>
            </div>

          </div>

        </div>

        {/* LOADING */}

        {loading && (
          <div className="py-16 text-center">

            <Loader2
              size={34}
              className="mx-auto animate-spin text-primary-600"
            />

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Finding accessible places near you...
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Searching within 5 km, 10 km and 25 km
            </p>

          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">

            <AlertCircle
              size={34}
              className="mx-auto text-red-500"
            />

            <p className="mt-3 text-sm font-semibold text-slate-800">
              {error}
            </p>

            <button
              onClick={loadNearby}
              className="mt-4 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Try Again
            </button>

          </div>
        )}

        {/* NO RESULTS */}

        {!loading && !error && points.length === 0 && (
          <div className="rounded-2xl bg-white p-7 text-center shadow-sm">

            <MapPin
              size={38}
              className="mx-auto text-slate-400"
            />

            <p className="mt-4 font-bold text-slate-800">
              No accessible places found
            </p>

            <p className="mt-2 text-sm text-slate-500">
              No stored accessibility places were found within {searchedRadius} km of your location.
            </p>

            <button
              onClick={loadNearby}
              className="mt-5 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Search Again
            </button>

          </div>
        )}

        {/* RESULTS */}

        {!loading && !error && points.length > 0 && (
          <>

            <div className="mb-4">

              <p className="font-bold text-slate-800">
                {points.length} accessible places found
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Searched up to {searchedRadius} km · Nearest first
              </p>

            </div>

            <div className="space-y-3">

              {points.map((point) => (

                <div
                  key={point.id}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >

                  {/* PLACE NAME AND DISTANCE */}

                  <div className="flex items-start gap-3">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">

                      <MapPin
                        size={23}
                        className="text-primary-600"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <h2 className="font-bold text-slate-900">
                        {point.name}
                      </h2>

                      <p className="mt-1 text-xs font-semibold text-primary-700">

                        {point.distanceKm < 1
                          ? `${Math.round(point.distanceKm * 1000)} m away`
                          : `${point.distanceKm.toFixed(2)} km away`}

                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Accessibility score: {point.score}/100
                      </p>

                    </div>

                  </div>

                  {/* ACCESSIBILITY TAGS */}

                  {point.tags?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">

                      {point.tags.map((tag, index) => (

                        <span
                          key={`${tag}-${index}`}
                          className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
                        >
                          {tag}
                        </span>

                      ))}

                    </div>
                  )}

                  {/* WARNINGS */}

                  {point.warnings?.length > 0 && (
                    <div className="mt-3 rounded-xl bg-amber-50 p-3">

                      <p className="text-xs font-bold text-amber-800">
                        Accessibility warnings
                      </p>

                      {point.warnings.map((warning, index) => (

                        <p
                          key={index}
                          className="mt-1 text-xs text-amber-700"
                        >
                          • {warning}
                        </p>

                      ))}

                    </div>
                  )}

                  {/* NAVIGATE BUTTON */}

                  <button
                    onClick={() => selectPlace(point)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
                  >

                    <Navigation size={17} />

                    Navigate

                  </button>

                </div>

              ))}

            </div>

          </>
        )}

      </div>

    </div>
  );
}
