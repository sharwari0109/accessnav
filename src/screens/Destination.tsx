import { useEffect, useState } from 'react';

import { useApp } from '@/store';

import MumbaiMap from '@/components/MumbaiMap';
import BottomSheet from '@/components/BottomSheet';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';
import ScoreBadge from '@/components/ScoreBadge';

import { getPlace } from '@/api';

import {
  Check,
  AlertTriangle,
  Navigation,
  Eye,
  MapPin,
} from 'lucide-react';

import type { Place } from '@/types';


// ============================================================
// SCREEN
// ============================================================

export default function Destination() {
  const {
    destination,
    setDestination,
    go,
    mode,
  } = useApp();


  // ==========================================================
  // STATE
  // ==========================================================

  const [place, setPlace] =
    useState<Place | null>(
      destination?.place ?? null,
    );

  const [loading, setLoading] =
    useState(
      Boolean(destination?.place),
    );

  const [error, setError] =
    useState('');


  // ==========================================================
  // LOAD ACCESSIBILITY INFORMATION
  // ==========================================================

  useEffect(() => {
    if (!destination) {
      return;
    }


    /*
     * Arbitrary map destinations do not have a MongoDB
     * accessibility record.
     *
     * Therefore we don't call getPlace().
     */
    if (!destination.place) {
      setPlace(null);

      setLoading(false);

      setError('');

      return;
    }


    async function loadPlace() {
      try {
        setLoading(true);

        setError('');


        const data =
          await getPlace(
            destination!.place!.id,
          );


        setPlace(data);


        /*
         * Keep the newest backend accessibility data
         * attached to the global destination.
         */
        setDestination({
          name: data.name,

          lat: data.latitude,

          lng: data.longitude,

          place: data,
        });

      } catch (err) {
        console.error(
          'Failed to load place:',
          err,
        );


        /*
         * We already have the original place, so
         * continue showing it.
         */
        setPlace(
          destination!.place ?? null,
        );


        setError(
          'Unable to refresh place information.',
        );

      } finally {
        setLoading(false);
      }
    }


    loadPlace();

  }, [destination, setDestination]);


  // ==========================================================
  // NO DESTINATION
  // ==========================================================

  if (!destination) {
    return null;
  }


  // ==========================================================
  // MAP DESTINATION
  // ==========================================================

  const destinationPoint = {
    name: destination.name,

    lat: destination.lat,

    lng: destination.lng,
  };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-100">

        <div className="absolute inset-0">

          <MumbaiMap
            mode={mode}
            destinationPoint={
              destinationPoint
            }
            highContrast={
              mode === 'lowvision'
            }
            dim
          />

        </div>


        <TopBar
          onBack={() => go('search')}
          transparent
        />


        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-white p-6">

          <div className="flex items-center justify-center gap-3">

            <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />


            <p className="text-sm font-semibold text-slate-600">
              Loading place information...
            </p>

          </div>

        </div>

      </div>
    );
  }


  // ==========================================================
  // ARBITRARY MAP DESTINATION
  // ==========================================================

  if (!place) {
    return (
      <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">

        {/* ====================================================
            MAP
            ==================================================== */}

        <div className="absolute inset-0">

          <MumbaiMap
            mode={mode}
            destinationPoint={
              destinationPoint
            }
            highContrast={
              mode === 'lowvision'
            }
            dim
          />

        </div>


        {/* ====================================================
            TOP BAR
            ==================================================== */}

        <TopBar
          onBack={() => go('search')}
          transparent
        />


        {/* ====================================================
            BOTTOM SHEET
            ==================================================== */}

        <BottomSheet
          open
          maxHeight="52%"
        >

          <div className="mb-5 flex items-start gap-3">

            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">

              <MapPin size={24} />

            </span>


            <div className="min-w-0">

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Destination
              </p>


              <h2 className="text-xl font-extrabold text-slate-900">
                {destination.name}
              </h2>


              <p className="mt-1 text-xs text-slate-500">
                {destination.lat.toFixed(5)},
                {' '}
                {destination.lng.toFixed(5)}
              </p>

            </div>

          </div>


          {/* ==================================================
              ACCESSIBILITY NOTICE
              ================================================== */}

          <div className="rounded-2xl bg-warning-50 p-4">

            <div className="flex items-start gap-3">

              <AlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-warning-600"
              />


              <div>

                <p className="text-sm font-bold text-warning-800">
                  Accessibility information unavailable
                </p>


                <p className="mt-1 text-xs leading-5 text-warning-800">
                  This destination was found on the map,
                  but AccessNav does not yet have verified
                  accessibility information for this location.
                </p>

              </div>

            </div>

          </div>


          {/* ==================================================
              LOW VISION
              ================================================== */}

          {mode === 'lowvision' && (

            <div className="mt-4 rounded-2xl bg-primary-50 p-4">

              <div className="flex items-center gap-2 text-primary-700">

                <Eye size={17} />

                <p className="text-sm font-semibold">
                  Low-vision navigation
                </p>

              </div>


              <p className="mt-1 text-xs text-primary-700">
                High-contrast map and voice guidance can be
                used when navigation starts.
              </p>

            </div>

          )}


          {/* ==================================================
              ACTION
              ================================================== */}

          <div className="mt-6">

            <Button
              fullWidth
              onClick={() => go('routes')}
              className="flex items-center justify-center gap-2"
            >

              <Navigation size={18} />

              Find Route

            </Button>

          </div>

        </BottomSheet>

      </div>
    );
  }


  // ==========================================================
  // ACCESSIBILITY DATABASE DESTINATION
  // ==========================================================

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">

      {/* ======================================================
          MAP
          ====================================================== */}

      <div className="absolute inset-0">

        <MumbaiMap
          mode={mode}

          destinationPoint={
            destinationPoint
          }

          destinationId={
            place.id
          }

          highContrast={
            mode === 'lowvision'
          }

          dim
        />

      </div>


      {/* ======================================================
          TOP BAR
          ====================================================== */}

      <TopBar
        onBack={() => go('search')}
        transparent
      />


      {/* ======================================================
          BOTTOM SHEET
          ====================================================== */}

      <BottomSheet
        open
        maxHeight="72%"
      >

        {/* ==================================================
            PLACE HEADER
            ================================================== */}

        <div className="mb-3 flex items-start justify-between gap-3">

          <div className="min-w-0">

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {place.area} · {place.distanceKm} km
            </p>


            <h2 className="text-xl font-extrabold text-slate-900">
              {place.name}
            </h2>

          </div>


          <span className="shrink-0 text-3xl">
            {place.emoji}
          </span>

        </div>


        {/* ==================================================
            BACKEND REFRESH WARNING
            ================================================== */}

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

        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accessible-50 p-4">

          <ScoreBadge
            score={place.score}
            size="lg"
          />


          <div>

            <p className="text-sm font-bold text-accessible-800">
              Accessibility Score
            </p>


            <p className="text-xs text-accessible-700">
              Based on available accessibility information
            </p>

          </div>

        </div>


        {/* ==================================================
            ACCESSIBILITY FEATURES
            ================================================== */}

        <div className="space-y-2">

          {place.tags.map(
            (tag) => (

              <div
                key={tag}
                className="flex items-center gap-3"
              >

                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accessible-500 text-white">

                  <Check
                    size={14}
                    strokeWidth={3}
                  />

                </span>


                <span className="text-sm font-medium text-slate-700">
                  {tag}
                </span>

              </div>

            ),
          )}


          {place.warnings.map(
            (warning) => (

              <div
                key={warning}
                className="flex items-center gap-3"
              >

                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-500 text-white">

                  <AlertTriangle
                    size={13}
                    strokeWidth={3}
                  />

                </span>


                <span className="text-sm font-medium text-warning-800">
                  {warning}
                </span>

              </div>

            ),
          )}

        </div>


        {/* ==================================================
            LOW VISION
            ================================================== */}

        {mode === 'lowvision' && (

          <div className="mt-4 rounded-2xl bg-primary-50 p-3">

            <div className="flex items-center gap-2 text-primary-700">

              <Eye size={16} />

              <p className="text-sm font-semibold">
                Low-vision route available
              </p>

            </div>


            <p className="mt-1 text-xs text-primary-700">
              High-contrast route · Voice navigation
            </p>

          </div>

        )}


        {/* ==================================================
            ACTION BUTTONS
            ================================================== */}

        <div className="mt-6 flex gap-3">

          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              go('details')
            }
          >
            View Accessibility
          </Button>


          <Button
            fullWidth
            onClick={() =>
              go('routes')
            }
            className="flex-1"
          >

            <Navigation size={18} />

            Find Route

          </Button>

        </div>

      </BottomSheet>

    </div>
  );
}