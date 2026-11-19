
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
    preferences,
    setPreferences,
    largeText,
    setLargeText,
    highContrast,
    setHighContrast,
    voiceGuidance,
    setVoiceGuidance,
  } = useApp();

  const togglePreference = (label: string) => {
    setPreferences((previous) =>
      previous.includes(label)
        ? previous.filter((item) => item !== label)
        : [...previous, label]
    );
  };

  const changeMode = (newMode: 'wheelchair' | 'lowvision') => {
    setMode(newMode);

    if (newMode === 'lowvision') {
      setPreferences((previous) => [
        ...previous.filter((item) =>
          [
            'Most accessible route',
            'Avoid stairs',
            'Prefer ramps',
            'Prefer elevators',
            'Avoid steep slopes',
          ].includes(item)
        ),
        'High contrast',
        'Voice guidance',
        'Clear crossings',
        'Avoid complicated intersections',
      ]);
    } else {
      setPreferences((previous) => [
        ...previous.filter((item) =>
          [
            'Most accessible route',
            'Avoid stairs',
            'Prefer ramps',
            'Prefer elevators',
            'Avoid steep slopes',
          ].includes(item)
        ),
      ]);
    }
  };

  const hasPreference = (label: string) =>
    preferences.includes(label);

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-slate-50">

      <TopBar
        title="My Profile"
        onBack={() => go('home')}
      />

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-16">

        <div className="flex flex-col items-center">

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 text-2xl font-extrabold text-white shadow-card">
            {user?.name
              ? user.name.charAt(0).toUpperCase()
              : 'U'}
          </div>

          <h2 className="mt-3 text-lg font-extrabold text-slate-900">
            {user?.name || 'User'}
          </h2>

          <p className="text-sm text-slate-500">
            {user?.email || ''}
          </p>

        </div>

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
                    {currentMode === 'wheelchair' ? '♿' : '👁'}
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

        <Section title="Navigation">

          <Row
            label="Most accessible route"
            on={hasPreference('Most accessible route')}
            onChange={() => togglePreference('Most accessible route')}
          />

          {mode === 'wheelchair' ? (
            <>
              <Row
                label="Avoid stairs"
                on={hasPreference('Avoid stairs')}
                onChange={() => togglePreference('Avoid stairs')}
              />

              <Row
                label="Prefer ramps"
                on={hasPreference('Prefer ramps')}
                onChange={() => togglePreference('Prefer ramps')}
              />

              <Row
                label="Prefer elevators"
                on={hasPreference('Prefer elevators')}
                onChange={() => togglePreference('Prefer elevators')}
              />

              <Row
                label="Avoid steep slopes"
                on={hasPreference('Avoid steep slopes')}
                onChange={() => togglePreference('Avoid steep slopes')}
              />
            </>
          ) : (
            <>
              <Row
                label="Voice navigation"
                on={hasPreference('Voice guidance')}
                onChange={() => togglePreference('Voice guidance')}
              />

              <Row
                label="Clear crossings"
                on={hasPreference('Clear crossings')}
                onChange={() => togglePreference('Clear crossings')}
              />

              <Row
                label="Avoid complicated intersections"
                on={hasPreference('Avoid complicated intersections')}
                onChange={() => togglePreference('Avoid complicated intersections')}
              />
            </>
          )}

        </Section>

        <Section title="App">

          <Row
            label="Large text"
            on={largeText}
            onChange={() => setLargeText(!largeText)}
          />

          <Row
            label="High contrast"
            on={highContrast}
            onChange={() => setHighContrast(!highContrast)}
          />

          <Row
            label="Voice guidance"
            on={voiceGuidance}
            onChange={() => setVoiceGuidance(!voiceGuidance)}
          />

        </Section>

        <div className="mt-6">
          <button
            onClick={logout}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100"
          >
            Logout
          </button>
        </div>

      </div>

      <BottomNav />

    </div>
  );
}

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
