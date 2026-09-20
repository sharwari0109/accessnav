import { useEffect, useState } from 'react';

import { useApp } from '@/store';

import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import ScoreBadge from '@/components/ScoreBadge';
import BottomNav from '@/components/BottomNav';

import { getSavedPlaces } from '@/api';

import type { Place } from '@/types';


interface SavedPlace {
  id: string;
  name: string;
  address: string;
  emoji: string;
  placeId: string;
  place: Place;
}


export default function Saved() {

  const { go, setDestination, mode } = useApp();

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');


  // =====================================================
  // GET SAVED PLACES FROM BACKEND
  // =====================================================

  useEffect(() => {

    async function loadSavedPlaces() {

      try {

        setLoading(true);
        setError('');

        const data = await getSavedPlaces();

        setSavedPlaces(data);

      } catch (err) {

        console.error('Failed to load saved places:', err);

        setError('Unable to load saved places.');

      } finally {

        setLoading(false);

      }

    }

    loadSavedPlaces();

  }, []);


  return (

    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">

      {/* =================================================
          MAP
          ================================================= */}

      <div className="absolute inset-0">

        <MumbaiMap
          mode={mode}
          highContrast={mode === 'lowvision'}
          dim
        />

      </div>


      {/* =================================================
          TOP BAR
          ================================================= */}

      <div className="absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-slate-900/40 to-transparent">

        <TopBar
          onBack={() => go('home')}
          transparent
        />

      </div>


      {/* =================================================
          SAVED PLACES
          ================================================= */}

      <div className="absolute inset-x-0 bottom-0 top-32 z-20 overflow-y-auto rounded-t-3xl bg-white px-5 pb-24 pt-3 shadow-sheet no-scrollbar">

        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />


        <h1 className="text-xl font-extrabold text-slate-900">
          Saved Places
        </h1>


        <p className="mb-4 text-sm text-slate-500">
          Tap a place to navigate there.
        </p>


        {/* =================================================
            LOADING
            ================================================= */}

        {loading && (

          <p className="py-10 text-center text-sm text-slate-400">
            Loading saved places...
          </p>

        )}


        {/* =================================================
            ERROR
            ================================================= */}

        {!loading && error && (

          <div className="py-10 text-center">

            <p className="text-sm text-danger-500">
              {error}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Make sure the FastAPI backend is running.
            </p>

          </div>

        )}


        {/* =================================================
            SAVED PLACES
            ================================================= */}

        {!loading && !error && (

          <div className="space-y-2.5">

            {savedPlaces.map((s) => (

              <button
                key={s.id}
                onClick={() => {

                  setDestination(s.place);

                  go('destination');

                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
              >

                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-50 text-2xl">

                  {s.emoji}

                </span>


                <div className="min-w-0 flex-1">

                  <p className="text-sm font-bold text-slate-900">

                    {s.name}

                  </p>


                  <p className="truncate text-xs text-slate-500">

                    {s.address}

                  </p>

                </div>


                <ScoreBadge
                  score={s.place.score}
                  size="sm"
                />

              </button>

            ))}


            {savedPlaces.length === 0 && (

              <p className="py-10 text-center text-sm text-slate-400">

                No saved places found.

              </p>

            )}

          </div>

        )}

      </div>


      {/* =================================================
          BOTTOM NAVIGATION
          ================================================= */}

      <BottomNav />

    </div>

  );
}