import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';
import ScoreBadge from '@/components/ScoreBadge';

import { getPlace } from '@/api';

import {
  Check,
  AlertTriangle,
  Eye,
} from 'lucide-react';

import type { Place } from '@/types';

export default function Details() {
  const {
    destination,
    setDestination,
    go,
    mode,
    selectedRoute,
  } = useApp();

  const [place, setPlace] = useState<Place | null>(
    destination
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');


  // ============================================================
  // LOAD PLACE DETAILS FROM BACKEND
  // ============================================================

  useEffect(() => {
    if (!destination) return;

    const placeId = destination.id;

    async function loadPlaceDetails() {
      try {
        setLoading(true);
        setError('');

        const data = await getPlace(placeId);

        setPlace(data);
        setDestination(data);

      } catch (err) {
        console.error(
          'Failed to load place details:',
          err
        );

        setPlace(destination);

        setError(
          'Unable to refresh accessibility information.'
        );

      } finally {
        setLoading(false);
      }
    }

    loadPlaceDetails();

  }, [destination?.id]);


  // ============================================================
  // NO DESTINATION
  // ============================================================

  if (!destination || !place) {
    return null;
  }


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
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

  const conditions = place.tags;

  const warnings = place.warnings;

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

      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="relative h-56 w-full shrink-0 overflow-hidden">

        <MumbaiMap
          mode={mode}
          destinationId={place.id}
          route={selectedRoute}
          highContrast={mode === 'lowvision'}
        />

        <TopBar
          onBack={() => go('routes')}
          transparent
        />

      </div>


      {/* ======================================================
          DETAILS
      ====================================================== */}

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-4">

        {/* Destination name */}

        <div className="mb-4">

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {place.area} · {place.distanceKm} km
          </p>

          <h1 className="mt-1 text-xl font-extrabold text-slate-900">
            {place.name}
          </h1>

        </div>


        {/* Error */}

        {error && (
          <div className="mb-4 rounded-2xl bg-warning-50 p-3">

            <p className="text-xs font-semibold text-warning-800">
              {error}
            </p>

          </div>
        )}


        {/* ==================================================
            ACCESSIBILITY SCORE
        ================================================== */}

        <h2 className="text-lg font-extrabold text-slate-900">
          Accessibility Score
        </h2>

        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-accessible-50 p-4">

          <ScoreBadge
            score={place.score}
            size="lg"
          />

          <div>

            <p className="text-sm font-bold text-accessible-800">
              {place.score >= 90
                ? 'Highly Accessible'
                : place.score >= 75
                  ? 'Good Accessibility'
                  : 'Moderate Accessibility'}
            </p>

            <p className="text-xs text-accessible-700">
              Based on route & destination
            </p>

          </div>

        </div>


        {/* ==================================================
            ROUTE CONDITIONS
        ================================================== */}

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">
          Route Conditions
        </h2>

        <div className="mt-2 space-y-2">

          {conditions.map((condition) => (
            <Row
              key={condition}
              ok
              text={condition}
            />
          ))}

          {warnings.map((warning) => (
            <Row
              key={warning}
              warn
              text={warning}
            />
          ))}

        </div>


        {/* ==================================================
            LOW VISION
        ================================================== */}

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


        {/* ==================================================
            REPORT
        ================================================== */}

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