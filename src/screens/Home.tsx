
import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import SearchBar from '@/components/SearchBar';
import BottomNav from '@/components/BottomNav';
import SOSButton from '@/components/SOSButton';

import {
  Search,
  User,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

export default function Home() {
  const { go, mode } = useApp();

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">

      {/* MAP BACKGROUND */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <MumbaiMap
          mode={mode}
          highContrast={mode === 'lowvision'}
        />
      </div>

      {/* TOP CONTENT */}
      <div
        className="absolute inset-x-0 top-0 px-4"
        style={{
          zIndex: 40,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)',
        }}
      >

        {/* PROFILE + SEARCH */}
        <div className="flex w-full items-center gap-3">

          <button
            onClick={() => go('profile')}
            aria-label="Profile"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-card active:scale-95"
          >
            <User
              size={22}
              className="text-primary-700"
            />
          </button>

          <div className="min-w-0 flex-1">
            <SearchBar
              icon={
                <Search
                  size={20}
                  className="shrink-0 text-slate-400"
                />
              }
              placeholder="Where do you want to go?"
              onClick={() => go('search')}
            />
          </div>

        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-3 flex flex-nowrap items-center gap-2">

         <QuickChip
  icon={<MapPin size={16} />}
  label="Nearby"
  onClick={() => go('nearby')}
/>

          <QuickChip
            icon={<span>❤️</span>}
            label="Saved"
            onClick={() => go('saved')}
          />

          <QuickChip
            icon={<AlertTriangle size={16} />}
            label="Report Issue"
            onClick={() => go('report')}
          />

        </div>

        {/* ROUTE PREFERENCE */}
        <div className="mt-3">

          <div className="rounded-2xl bg-white/95 p-4 shadow-card backdrop-blur">

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Your route preference
            </p>

            <div className="mt-2 flex items-center gap-3">

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-2xl">
                {mode === 'wheelchair' ? '♿' : '👁'}
              </span>

              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900">
                  {mode === 'wheelchair'
                    ? 'Wheelchair'
                    : 'Low Vision'}
                </p>

                <p className="text-sm text-slate-500">
                  {mode === 'wheelchair'
                    ? 'Avoid stairs • Prefer ramps'
                    : 'High contrast • Voice guidance'}
                </p>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* SOS */}
      <div
        className="absolute bottom-24 right-4"
        style={{ zIndex: 40 }}
      >
        <SOSButton />
      </div>

      {/* BOTTOM NAVIGATION */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ zIndex: 40 }}
      >
        <BottomNav />
      </div>

    </div>
  );
}

/* QUICK ACTION CHIP */

function QuickChip({
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
      className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-card backdrop-blur active:scale-95"
    >
      {icon}
      {label}
    </button>
  );
}
