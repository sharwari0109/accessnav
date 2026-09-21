import { useEffect, useState } from 'react';

import { useApp } from '@/store';

import MumbaiMap from '@/components/MumbaiMap';
import TopBar from '@/components/TopBar';
import ScoreBadge from '@/components/ScoreBadge';

import { getPlaces } from '@/api';

import {
  Search as SearchIcon,
  X,
  MapPin,
  Loader2,
} from 'lucide-react';

import type { Place } from '@/types';


// ============================================================
// OPENSTREETMAP RESULT
// ============================================================

interface SearchResult {
  id: string;

  name: string;

  displayName: string;

  lat: number;

  lng: number;

  area: string;

  emoji: string;
}


interface NominatimResult {
  place_id: number;

  display_name: string;

  lat: string;

  lon: string;

  name?: string;

  type?: string;

  address?: {
    city?: string;

    town?: string;

    village?: string;

    suburb?: string;

    neighbourhood?: string;

    state?: string;

    country?: string;
  };
}


// ============================================================
// SCREEN
// ============================================================

export default function Search() {
  const {
    go,
    setDestination,
    mode,
  } = useApp();


  // ==========================================================
  // STATE
  // ==========================================================

  const [q, setQ] =
    useState('');

  const [places, setPlaces] =
    useState<Place[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [mapResults, setMapResults] =
    useState<SearchResult[]>([]);

  const [searchingMap, setSearchingMap] =
    useState(false);

  const [mapSearchError, setMapSearchError] =
    useState('');

  /*
   * This is only used while the Search screen is visible.
   *
   * The actual destination is now stored globally in the
   * AppProvider, so it survives when Search unmounts.
   */
  const [
    mapSelectedDestination,
    setMapSelectedDestination,
  ] = useState<SearchResult | null>(null);


  // ==========================================================
  // LOAD ACCESSIBILITY PLACES
  // ==========================================================

  useEffect(() => {
    async function loadPlaces() {
      try {
        setLoading(true);

        setError('');

        const data = await getPlaces();

        setPlaces(data);
      } catch (err) {
        console.error(
          'Failed to load places:',
          err,
        );

        setError(
          'Unable to load places.',
        );
      } finally {
        setLoading(false);
      }
    }

    loadPlaces();
  }, []);


  // ==========================================================
  // LOCAL ACCESSIBILITY DATABASE SEARCH
  // ==========================================================

  const localResults = places.filter(
    (p) =>
      p.name
        .toLowerCase()
        .includes(q.toLowerCase()) ||
      p.area
        .toLowerCase()
        .includes(q.toLowerCase()),
  );


  // ==========================================================
  // SEARCH ANY LOCATION
  //
  // OpenStreetMap Nominatim allows the user to search for
  // locations that aren't in our accessibility database.
  // ==========================================================

  useEffect(() => {
    const trimmedQuery =
      q.trim();


    if (trimmedQuery.length < 3) {
      setMapResults([]);

      setMapSearchError('');

      setSearchingMap(false);

      return;
    }


    const controller =
      new AbortController();


    const timeout =
      window.setTimeout(
        async () => {
          try {
            setSearchingMap(true);

            setMapSearchError('');


            const url =
              `https://nominatim.openstreetmap.org/search` +
              `?format=jsonv2` +
              `&q=${encodeURIComponent(
                trimmedQuery,
              )}` +
              `&limit=5` +
              `&addressdetails=1`;


            const response =
              await fetch(
                url,
                {
                  signal:
                    controller.signal,

                  headers: {
                    Accept:
                      'application/json',
                  },
                },
              );


            if (!response.ok) {
              throw new Error(
                `Location search failed: ${response.status}`,
              );
            }


            const data =
              (await response.json()) as NominatimResult[];


            const results:
              SearchResult[] =
              data
                .map((item) => {
                  const lat =
                    Number(item.lat);

                  const lng =
                    Number(item.lon);


                  if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lng)
                  ) {
                    return null;
                  }


                  const area =
                    item.address
                      ?.suburb ??
                    item.address
                      ?.neighbourhood ??
                    item.address
                      ?.city ??
                    item.address
                      ?.town ??
                    item.address
                      ?.village ??
                    item.address
                      ?.state ??
                    'Location';


                  return {
                    id:
                      `osm-${item.place_id}`,

                    name:
                      item.name ??
                      item.display_name.split(
                        ',',
                      )[0],

                    displayName:
                      item.display_name,

                    lat,

                    lng,

                    area,

                    emoji: '📍',
                  };
                })
                .filter(
                  (
                    item,
                  ): item is SearchResult =>
                    item !== null,
                );


            setMapResults(results);
          } catch (err) {
            if (
              err instanceof DOMException &&
              err.name === 'AbortError'
            ) {
              return;
            }


            console.error(
              'Location search failed:',
              err,
            );


            setMapResults([]);

            setMapSearchError(
              'Unable to search map locations.',
            );
          } finally {
            setSearchingMap(false);
          }
        },
        500,
      );


    return () => {
      window.clearTimeout(timeout);

      controller.abort();
    };
  }, [q]);


  // ==========================================================
  // SELECT ACCESSIBILITY DATABASE PLACE
  // ==========================================================

  function selectLocalPlace(
    place: Place,
  ) {
    /*
     * Store both the simple destination information and
     * the complete accessibility database record.
     */
    setDestination({
      name: place.name,

      lat: place.latitude,

      lng: place.longitude,

      place,
    });


    go('destination');
  }


  // ==========================================================
  // SELECT ARBITRARY MAP LOCATION
  // ==========================================================

  function selectMapPlace(
    place: SearchResult,
  ) {
    /*
     * Keep the marker visible while this screen is open.
     */
    setMapSelectedDestination(place);


    /*
     * IMPORTANT:
     *
     * Do NOT create a fake Place anymore.
     *
     * This destination may not exist in our MongoDB
     * accessibility database.
     *
     * We store its real coordinates directly.
     */
    setDestination({
      name: place.name,

      lat: place.lat,

      lng: place.lng,
    });


    go('destination');
  }


  // ==========================================================
  // CLEAR SEARCH
  // ==========================================================

  function clearSearch() {
    setQ('');

    setMapResults([]);

    setMapSearchError('');

    setMapSelectedDestination(null);
  }


  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">


      {/* ======================================================
          MAP
          ====================================================== */}

      <div className="absolute inset-0">

        <MumbaiMap
          mode={mode}

          highContrast={
            mode === 'lowvision'
          }

          dim

          destinationPoint={
            mapSelectedDestination
              ? {
                  name:
                    mapSelectedDestination.name,

                  lat:
                    mapSelectedDestination.lat,

                  lng:
                    mapSelectedDestination.lng,
                }
              : null
          }
        />

      </div>


      {/* ======================================================
          TOP BAR
          ====================================================== */}

      <TopBar
        onBack={() => go('home')}
        transparent
      />


      {/* ======================================================
          SEARCH HEADER
          ====================================================== */}

      <div className="absolute inset-x-0 top-16 z-20 px-4">

        <h1 className="mb-3 text-xl font-extrabold text-slate-900">
          Where would you like to go?
        </h1>


        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3.5 shadow-card">

          {searchingMap ? (
            <Loader2
              size={18}
              className="animate-spin text-primary-500"
            />
          ) : (
            <SearchIcon
              size={18}
              className="text-slate-400"
            />
          )}


          <input
            autoFocus
            value={q}
            onChange={(e) =>
              setQ(e.target.value)
            }
            placeholder="Search any destination"
            className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />


          {q && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="rounded-full p-1"
            >
              <X
                size={18}
                className="text-slate-400"
              />
            </button>
          )}

        </div>

      </div>


      {/* ======================================================
          RESULTS
          ====================================================== */}

      <div className="absolute inset-x-0 bottom-0 top-44 z-20 overflow-y-auto no-scrollbar rounded-t-3xl bg-white/95 px-4 pb-24 pt-3 shadow-sheet backdrop-blur">

        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />


        {/* ====================================================
            SECTION TITLE
            ==================================================== */}

        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
          {q
            ? 'Search results'
            : 'Nearby places'}
        </p>


        {/* ====================================================
            MAP SEARCH RESULTS
            ==================================================== */}

        {q.trim().length >= 3 &&
          mapResults.length > 0 && (

            <div className="mb-5 space-y-2">

              <p className="px-1 text-xs font-bold text-primary-600">
                Places from map search
              </p>


              {mapResults.map(
                (place) => (
                  <button
                    key={place.id}
                    onClick={() =>
                      selectMapPlace(
                        place,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
                  >

                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">

                      <MapPin
                        size={22}
                        className="text-primary-600"
                      />

                    </span>


                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-bold text-slate-900">
                        {place.name}
                      </p>


                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        {place.displayName}
                      </p>

                    </div>

                  </button>
                ),
              )}

            </div>
          )}


        {/* ====================================================
            MAP SEARCH ERROR
            ==================================================== */}

        {q.trim().length >= 3 &&
          mapSearchError && (

            <p className="mb-3 px-1 text-xs text-danger-500">
              {mapSearchError}
            </p>

          )}


        {/* ====================================================
            LOCAL ACCESSIBILITY DATABASE
            ==================================================== */}

        {!q &&
          !loading &&
          !error &&
          localResults.length > 0 && (

            <div className="space-y-2">

              <p className="px-1 text-xs font-bold text-slate-500">
                Accessibility places
              </p>


              {localResults.map(
                (p) => (

                  <button
                    key={p.id}
                    onClick={() =>
                      selectLocalPlace(
                        p,
                      )
                    }
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
                        {p.distanceKm} km ·{' '}
                        {p.area}
                      </p>

                    </div>


                    <ScoreBadge
                      score={p.score}
                      size="sm"
                    />

                  </button>

                ),
              )}

            </div>
          )}


        {/* ====================================================
            LOADING BACKEND PLACES
            ==================================================== */}

        {!q &&
          loading && (

            <p className="py-10 text-center text-sm text-slate-400">
              Loading places...
            </p>

          )}


        {/* ====================================================
            BACKEND ERROR
            ==================================================== */}

        {!q &&
          !loading &&
          error && (

            <div className="py-10 text-center">

              <p className="text-sm text-danger-500">
                {error}
              </p>


              <p className="mt-1 text-xs text-slate-400">
                Make sure the FastAPI
                backend is running.
              </p>

            </div>

          )}


        {/* ====================================================
            SEARCHING
            ==================================================== */}

        {q.trim().length >= 3 &&
          searchingMap &&
          mapResults.length === 0 && (

            <div className="py-10 text-center">

              <Loader2
                size={24}
                className="mx-auto animate-spin text-primary-500"
              />


              <p className="mt-3 text-sm text-slate-500">
                Searching locations...
              </p>

            </div>

          )}


        {/* ====================================================
            NO RESULTS
            ==================================================== */}

        {q.trim().length >= 3 &&
          !searchingMap &&
          mapResults.length === 0 &&
          localResults.length === 0 && (

            <div className="py-10 text-center">

              <MapPin
                size={28}
                className="mx-auto text-slate-300"
              />


              <p className="mt-3 text-sm font-semibold text-slate-500">
                No location found
              </p>


              <p className="mt-1 text-xs text-slate-400">
                Try a place name, landmark,
                station, hospital, or address.
              </p>

            </div>

          )}


        {/* ====================================================
            SEARCH TIP
            ==================================================== */}

        {!q &&
          !loading && (

            <div className="mt-5 rounded-2xl bg-primary-50 p-4">

              <p className="text-sm font-bold text-primary-900">
                🔎 Search anywhere
              </p>


              <p className="mt-1 text-xs leading-5 text-primary-700">
                You can search for landmarks,
                stations, hospitals, shops,
                addresses, or other locations.
              </p>

            </div>

          )}

      </div>

    </div>
  );
}