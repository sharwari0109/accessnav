
import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import type { Destination } from '@/store';

import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';
import ScoreBadge from '@/components/ScoreBadge';

import { getPlace } from '@/api';

import {
  Check,
  AlertTriangle,
  Eye,
  MapPin,
} from 'lucide-react';

import type { Place } from '@/types';

// ============================================================
// CONVERT DESTINATION INTO A PLACE
// ============================================================

function toPlace(destination: Destination): Place {
  if (destination.place) {
    return destination.place;
  }

  return {
    id: destination.id ?? '',
    name: destination.name,
    area: 'Nearby',
    distanceKm: 0,
    score: 0,
    tags: [],
    warnings: [],
    x: 0,
    y: 0,
    latitude: destination.lat,
    longitude: destination.lng,
    emoji: '📍',
  };
}

// ============================================================
// DETAILS SCREEN
// ============================================================

export default function Details() {
  const {
  destination,
  setDestination,
  go,
  mode,
  selectedRoute,
  startLocation,
  travelMode,
} = useApp();

  const [place, setPlace] = useState<Place | null>(
    destination ? toPlace(destination) : null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const placeId = destination?.place?.id ?? destination?.id;

  // ============================================================
  // LOAD PLACE DETAILS FROM BACKEND
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function loadPlaceDetails() {
      if (!destination) {
        setPlace(null);
        setLoading(false);
        return;
      }

      // Show existing place information immediately.
      setPlace(toPlace(destination));

      // No ID means there is nothing to fetch.
      if (!placeId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const data: Place = await getPlace(placeId);

        if (cancelled) return;

        setPlace(data);

        // Preserve the correct Destination structure.
        setDestination({
          id: data.id || placeId,
          name: data.name,
          lat: data.latitude,
          lng: data.longitude,
          place: data,
        });

      } catch (err) {
        if (cancelled) return;

        console.error('Failed to load place details:', err);

        // Keep the existing place information visible.
        setPlace(toPlace(destination));

        setError(
          'Unable to refresh accessibility information. Showing available saved information.'
        );

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPlaceDetails();

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  // ============================================================
  // NO DESTINATION SELECTED
  // ============================================================

  if (!destination || !place) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-white px-6 text-center">

        <MapPin
          size={40}
          className="mb-3 text-slate-400"
        />

        <h2 className="text-lg font-bold text-slate-900">
          No destination selected
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Select a nearby place to view its accessibility details.
        </p>

        <div className="mt-5 w-full max-w-xs">
          <Button
            fullWidth
            onClick={() => go('nearby')}
          >
            Back to Nearby
          </Button>
        </div>

      </div>
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading && !place) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

          <p className="text-sm font-semibold text-slate-600">
            Loading accessibility details...
          </p>

        </div>

      </div>
    );
  }

  // ============================================================
  // BACKEND DATA
  // ============================================================

  const conditions = place.tags ?? [];
  const warnings = place.warnings ?? [];

  const lowVision = [
    'High contrast route',
    'Voice guidance',
    'Clear crossings',
  ];

  const lowVisionWarn = [
    'Busy intersection ahead',
  ];

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-white">

      {/* MAP */}

      <div className="relative h-56 w-full shrink-0 overflow-hidden">

        <MumbaiMap
          mode={mode}
          destinationId={place.id}
          route={selectedRoute}
          highContrast={mode === 'lowvision'}
        />

        <TopBar
          onBack={() => go('destination')}
          transparent
        />

      </div>
      {/* TRIP SUMMARY */}

<div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">

  <h2 className="mb-3 text-sm font-extrabold text-slate-900">
    Trip Summary
  </h2>

  <div className="space-y-3">

    <div className="flex justify-between gap-3">
      <span className="text-sm text-slate-500">Source</span>
      <span className="text-right text-sm font-semibold text-slate-800">
        {startLocation?.name ?? 'Current Location'}
      </span>
    </div>

    <div className="flex justify-between gap-3">
      <span className="text-sm text-slate-500">Destination</span>
      <span className="text-right text-sm font-semibold text-slate-800">
        {destination.name}
      </span>
    </div>

    <div className="flex justify-between gap-3">
      <span className="text-sm text-slate-500">Travel Mode</span>
      <span className="text-right text-sm font-semibold text-slate-800">
        {travelMode === 'wheelchair' ? 'Wheelchair' : travelMode}
      </span>
    </div>

    <div className="flex justify-between gap-3">
      <span className="text-sm text-slate-500">Selected Route</span>
      <span className="text-right text-sm font-semibold capitalize text-slate-800">
        {selectedRoute}
      </span>
    </div>

  </div>

</div>

      {/* DETAILS */}

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-4">

        {/* DESTINATION NAME */}

        <div className="mb-4">

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {place.area || 'Nearby'} · {place.distanceKm ?? 0} km
          </p>

          <h1 className="mt-1 text-xl font-extrabold text-slate-900">
            {place.name}
          </h1>

        </div>

        {/* LOADING INDICATOR */}

        {loading && (
          <p className="mb-3 text-xs font-medium text-slate-500">
            Refreshing accessibility information...
          </p>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-4 rounded-2xl bg-warning-50 p-3">

            <p className="text-xs font-semibold text-warning-800">
              {error}
            </p>

          </div>
        )}

        

        {/* LOW VISION */}

        {mode === 'lowvision' && (
          <>

            <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-primary-600">

              <Eye
                size={14}
                className="mr-1 inline"
              />

              Low Vision

            </h2>

            <div className="mt-2 space-y-2">

              {lowVision.map((condition) => (
                <Row
                  key={condition}
                  ok
                  text={condition}
                />
              ))}

              {lowVisionWarn.map((warning) => (
                <Row
                  key={warning}
                  warn
                  text={warning}
                />
              ))}

            </div>

          </>
        )}

        {/* REPORT */}

        <div className="mt-7">

          <Button
            fullWidth
            variant="secondary"
            onClick={() => go('report')}
          >

            <AlertTriangle size={18} />

            Report outdated information

          </Button>

        </div>

      </div>

    </div>
  );
}

// ============================================================
// CONDITION ROW
// ============================================================

function Row({
  ok,
  warn,
  text,
}: {
  ok?: boolean;
  warn?: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">

      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${
          ok
            ? 'bg-accessible-500'
            : 'bg-warning-500'
        }`}
      >

        {ok ? (
          <Check
            size={14}
            strokeWidth={3}
          />
        ) : (
          <AlertTriangle
            size={13}
            strokeWidth={3}
          />
        )}

      </span>

      <span
        className={`text-sm font-medium ${
          warn
            ? 'text-warning-800'
            : 'text-slate-700'
        }`}
      >
        {text}
      </span>

    </div>
  );
}
