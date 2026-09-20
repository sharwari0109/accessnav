import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import BottomSheet from '@/components/BottomSheet';
import TopBar from '@/components/TopBar';
import Button from '@/components/Button';

import { getRoutes } from '@/api';

import {
  Check,
  AlertTriangle,
  Navigation,
} from 'lucide-react';

type RouteId = 'accessible' | 'fastest' | 'clear';

interface RouteFeature {
  text: string;
  ok: boolean;
}

interface RouteData {
  id: RouteId;
  title: string;
  emoji: string;
  color: string;
  time: string;
  dist: string;
  tag: string;
  badge?: string;
  features: RouteFeature[];
}

export default function Routes() {
  const {
    destination,
    selectedRoute,
    setSelectedRoute,
    go,
    mode,
  } = useApp();

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!destination) return;

    async function loadRoutes() {
      try {
        setLoading(true);
        setError('');

        const data = await getRoutes(destination.id);

        setRoutes(data);
      } catch (err) {
        console.error('Failed to load routes:', err);
        setError('Unable to load routes.');
      } finally {
        setLoading(false);
      }
    }

    loadRoutes();
  }, [destination]);

  if (!destination) return null;

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">
      <div className="absolute inset-0">
        <MumbaiMap
          mode={mode}
          destinationId={destination.id}
          route={selectedRoute}
          highContrast={mode === 'lowvision'}
        />
      </div>

      <TopBar
        onBack={() => go('destination')}
        transparent
      />

      {/* Route legend */}
      <div className="absolute right-4 top-16 z-10 space-y-1.5 rounded-2xl bg-white/95 p-3 shadow-card backdrop-blur">
        {routes.map((route) => (
          <div
            key={route.id}
            className="flex items-center gap-2 text-xs font-semibold"
          >
            <span
              className={`h-1 w-5 rounded-full ${
                route.id === 'accessible'
                  ? 'bg-accessible-500'
                  : route.id === 'fastest'
                    ? 'bg-primary-600'
                    : 'bg-warning-500'
              }`}
            />

            <span className="text-slate-600">
              {route.title}
            </span>
          </div>
        ))}
      </div>

      <BottomSheet open maxHeight="68%">
        <h2 className="mb-1 text-xl font-extrabold text-slate-900">
          Choose your route
        </h2>

        <p className="mb-3 text-xs text-slate-500">
          to {destination.name}
        </p>

        {loading && (
          <div className="py-10 text-center">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

            <p className="mt-3 text-sm text-slate-500">
              Loading routes...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-danger-500">
              {error}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Make sure the FastAPI backend is running.
            </p>
          </div>
        )}

        {!loading && !error && routes.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500">
              No routes available for this destination.
            </p>
          </div>
        )}

        {!loading && !error && routes.length > 0 && (
          <div className="space-y-2.5">
            {routes.map((route) => {
              const selected = selectedRoute === route.id;

              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRoute(route.id)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${
                    selected
                      ? 'border-primary-600 bg-primary-50 shadow-card'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {route.emoji}
                      </span>

                      <span className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                        {route.title}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {route.time}
                      </p>

                      <p className="text-xs text-slate-500">
                        {route.dist}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {route.features.map((feature) => (
                      <Pill
                        key={feature.text}
                        ok={feature.ok}
                      >
                        {feature.text}
                      </Pill>
                    ))}
                  </div>

                  {route.badge && (
                    <p className="mt-2 text-xs font-bold text-accessible-700">
                      ✓ {route.badge}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Button
            fullWidth
            disabled={loading || !!error || routes.length === 0}
            onClick={() => go('navigation')}
            className="text-lg"
          >
            <Navigation size={18} />
            Start Route
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Pill({
  children,
  ok,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok
          ? 'bg-accessible-100 text-accessible-700'
          : 'bg-danger-100 text-danger-700'
      }`}
    >
      {ok ? (
        <Check
          size={11}
          strokeWidth={3}
        />
      ) : (
        <AlertTriangle
          size={11}
          strokeWidth={3}
        />
      )}

      {children}
    </span>
  );
}