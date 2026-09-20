import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import ScoreBadge from '@/components/ScoreBadge';

import { getPlaces } from '@/api';

import { Search as SearchIcon, X } from 'lucide-react';

import type { Place } from '@/types';


export default function Search() {

  const { go, setDestination, mode } = useApp();

  const [q, setQ] = useState('');

  const [places, setPlaces] = useState<Place[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');


  // =====================================================
  // GET PLACES FROM BACKEND
  // =====================================================

  useEffect(() => {

    async function loadPlaces() {

      try {

        setLoading(true);
        setError('');

        const data = await getPlaces();

        setPlaces(data);

      } catch (err) {

        console.error('Failed to load places:', err);

        setError('Unable to load places.');

      } finally {

        setLoading(false);

      }
    }

    loadPlaces();

  }, []);


  // =====================================================
  // SEARCH
  // =====================================================

  const results = places.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.area.toLowerCase().includes(q.toLowerCase()),
  );


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

      <TopBar
        onBack={() => go('home')}
        transparent
      />


      {/* =================================================
          SEARCH HEADER
          ================================================= */}

      <div className="absolute inset-x-0 top-16 z-20 px-4">

        <h1 className="mb-3 text-xl font-extrabold text-slate-900">
          Where would you like to go?
        </h1>


        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3.5 shadow-card">

          <SearchIcon
            size={18}
            className="text-slate-400"
          />


          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search destination"
            className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />


          {q && (

            <button
              onClick={() => setQ('')}
              aria-label="Clear"
            >

              <X
                size={18}
                className="text-slate-400"
              />

            </button>

          )}

        </div>

      </div>


      {/* =================================================
          RESULTS
          ================================================= */}

      <div className="absolute inset-x-0 bottom-0 top-44 z-20 overflow-y-auto no-scrollbar rounded-t-3xl bg-white/95 px-4 pb-24 pt-3 shadow-sheet backdrop-blur">

        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />


        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">

          {q ? 'Results' : 'Nearby places'}

        </p>


        {/* =================================================
            LOADING
            ================================================= */}

        {loading && (

          <p className="py-10 text-center text-sm text-slate-400">

            Loading places...

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
            PLACES
            ================================================= */}

        {!loading && !error && (

          <div className="space-y-2">

            {results.map((p) => (

              <button
                key={p.id}
                onClick={() => {

                  setDestination(p);

                  go('destination');

                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
              >

                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-2xl">

                  {p.emoji}

                </span>


                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-bold text-slate-900">

                    {p.name}

                  </p>


                  <p className="text-xs text-slate-500">

                    {p.distanceKm} km · {p.area}

                  </p>

                </div>


                <ScoreBadge
                  score={p.score}
                  size="sm"
                />

              </button>

            ))}


            {/* =================================================
                NO RESULTS
                ================================================= */}

            {results.length === 0 && (

              <p className="py-10 text-center text-sm text-slate-400">

                No places found.

              </p>

            )}

          </div>

        )}

      </div>

    </div>

  );
}