import { useState } from 'react';
import type React from 'react';

import { useApp } from '@/store';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import Toggle from '@/components/Toggle';

export default function Profile() {
  const {
    go,
    mode,
    setMode,
    user,
    logout,
  } = useApp();

  const [prefs, setPrefs] = useState({
    mostAccessible: true,
    avoidStairs: true,
    preferRamps: true,
    preferElevators: true,
    avoidSteepSlopes: true,

    highContrast: mode === 'lowvision',
    voiceNav: mode === 'lowvision',
    clearCrossings: mode === 'lowvision',
    avoidIntersections: mode === 'lowvision',

    largeText: false,
    appHighContrast: false,
    appVoice: false,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const changeMode = (
    newMode: 'wheelchair' | 'lowvision'
  ) => {
    setMode(newMode);

    if (newMode === 'lowvision') {
      setPrefs((previous) => ({
        ...previous,
        highContrast: true,
        voiceNav: true,
        clearCrossings: true,
        avoidIntersections: true,
      }));
    } else {
      setPrefs((previous) => ({
        ...previous,
        highContrast: false,
        voiceNav: false,
        clearCrossings: false,
        avoidIntersections: false,
      }));
    }
  };

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-slate-50">

      <TopBar
        title="My Profile"
        onBack={() => go('home')}
      />

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-16">

        {/* ==================================================
            PROFILE
        ================================================== */}

        <div className="flex flex-col items-center">

          {/* Profile avatar */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-2xl font-extrabold text-white shadow-card">
            {user?.name
              ? user.name.charAt(0).toUpperCase()
              : 'U'}
          </div>

          {/* User name */}
          <h2 className="mt-3 text-lg font-extrabold text-slate-900">
            {user?.name || 'User'}
          </h2>

          {/* User email */}
          <p className="text-sm text-slate-500">
            {user?.email || ''}
          </p>

        </div>


        {/* ==================================================
            ACCESSIBILITY
        ================================================== */}

        <Section title="Accessibility">

          <div className="flex gap-2">

            {(['wheelchair', 'lowvision'] as const).map(
              (currentMode) => (
                <button
                  key={currentMode}
                  onClick={() => changeMode(currentMode)}
                  className={`flex-1 rounded-xl border-2 p-3 text-center transition ${
                    mode === currentMode
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >

                  <span className="text-2xl">
                    {currentMode === 'wheelchair'
                      ? '♿'
                      : '👁'}
                  </span>

                  <p
                    className={`mt-1 text-xs font-bold ${
                      mode === currentMode
                        ? 'text-primary-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {currentMode === 'wheelchair'
                      ? 'Wheelchair'
                      : 'Low Vision'}
                  </p>

                </button>
              )
            )}

          </div>


          <button
            onClick={() => go('setup')}
            className="mt-3 w-full rounded-xl bg-primary-50 py-3 text-sm font-bold text-primary-700"
          >
            Edit Preferences
          </button>

        </Section>


        {/* ==================================================
            NAVIGATION
        ================================================== */}

        <Section title="Navigation">

          <Row
            label="Most accessible route"
            on={prefs.mostAccessible}
            onChange={() =>
              toggle('mostAccessible')
            }
          />

          <Row
            label="Avoid stairs"
            on={prefs.avoidStairs}
            onChange={() =>
              toggle('avoidStairs')
            }
          />

          <Row
            label="Prefer ramps"
            on={prefs.preferRamps}
            onChange={() =>
              toggle('preferRamps')
            }
          />

          <Row
            label="Prefer elevators"
            on={prefs.preferElevators}
            onChange={() =>
              toggle('preferElevators')
            }
          />

          <Row
            label="Avoid steep slopes"
            on={prefs.avoidSteepSlopes}
            onChange={() =>
              toggle('avoidSteepSlopes')
            }
          />

          <Row
            label="High contrast"
            on={prefs.highContrast}
            onChange={() =>
              toggle('highContrast')
            }
          />

          <Row
            label="Voice navigation"
            on={prefs.voiceNav}
            onChange={() =>
              toggle('voiceNav')
            }
          />

          <Row
            label="Clear crossings"
            on={prefs.clearCrossings}
            onChange={() =>
              toggle('clearCrossings')
            }
          />

          <Row
            label="Avoid complicated intersections"
            on={prefs.avoidIntersections}
            onChange={() =>
              toggle('avoidIntersections')
            }
          />

        </Section>


        {/* ==================================================
            APP
        ================================================== */}

        <Section title="App">

          <Row
            label="Large text"
            on={prefs.largeText}
            onChange={() =>
              toggle('largeText')
            }
          />

          <Row
            label="High contrast"
            on={prefs.appHighContrast}
            onChange={() =>
              toggle('appHighContrast')
            }
          />

          <Row
            label="Voice guidance"
            on={prefs.appVoice}
            onChange={() =>
              toggle('appVoice')
            }
          />

        </Section>


        {/* ==================================================
            LOGOUT
        ================================================== */}

        <div className="mt-6">

          <button
            onClick={logout}
            className="
              w-full
              rounded-xl
              border
              border-red-200
              bg-red-50
              py-3
              text-sm
              font-bold
              text-red-600
              transition
              hover:bg-red-100
            "
          >
            Logout
          </button>

        </div>

      </div>


      {/* ====================================================
          BOTTOM NAVIGATION
      ==================================================== */}

      <BottomNav />

    </div>
  );
}


// ============================================================
// SECTION
// ============================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">

      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>

      <div className="rounded-2xl bg-white p-4 shadow-card">
        {children}
      </div>

    </div>
  );
}


// ============================================================
// TOGGLE ROW
// ============================================================

function Row({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">

      <span className="pr-3 text-sm font-medium text-slate-700">
        {label}
      </span>

      <Toggle
        on={on}
        onChange={onChange}
        label={label}
      />

    </div>
  );
}