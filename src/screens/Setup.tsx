
import { useApp } from '@/store';
import Button from '@/components/Button';
import type { AccessibilityMode } from '@/types';

const PREFS: Record<AccessibilityMode, string[]> = {
  wheelchair: [
    'Avoid stairs',
    'Prefer ramps',
    'Prefer elevators',
    'Avoid steep slopes',
  ],
  lowvision: [
    'Voice guidance',
    'Clear crossings',
    'Avoid complicated intersections',
  ],
};

export default function Setup() {
  const {
    mode,
    setMode,
    preferences,
    largeText,
    setLargeText,
    highContrast,
    go,
  } = useApp();

  const cards: {
    id: AccessibilityMode;
    emoji: string;
    title: string;
    desc: string;
  }[] = [
    {
      id: 'wheelchair',
      emoji: '♿',
      title: 'Wheelchair',
      desc: 'Step-free routes, ramps and accessible entrances.',
    },
    {
      id: 'lowvision',
      emoji: '👁',
      title: 'Low Vision',
      desc: 'High-contrast guidance, clear routes and voice instructions.',
    },
  ];

  const activePreferences = [
    ...(['Most accessible route'].filter((item) =>
      preferences.includes(item)
    )),
    ...PREFS[mode].filter((item) =>
      preferences.includes(item)
    ),
    ...(highContrast ? ['High contrast'] : []),
  ];

  return (
    <div className="screen-enter flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">

      {/* FIXED HEADER */}
      <div className="shrink-0 px-6 pb-4 pt-6">
        <h1 className="text-2xl font-extrabold text-slate-900">
          How should we personalize your route?
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Choose what fits you best. You can change this anytime.
        </p>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">

        {/* ACCESSIBILITY MODE CARDS */}
        <div className="flex gap-3">
          {cards.map((card) => {
            const selected = mode === card.id;

            return (
              <button
                key={card.id}
                onClick={() => setMode(card.id)}
                className={`min-w-0 flex-1 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                  selected
                    ? 'border-primary-600 bg-primary-50 shadow-card'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="text-3xl">
                  {card.emoji}
                </span>

                <h3
                  className={`mt-2 text-base font-bold ${
                    selected
                      ? 'text-primary-700'
                      : 'text-slate-900'
                  }`}
                >
                  {card.title}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* LARGE TEXT OPTION */}
        <div className="mt-6">
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900">
                Large Text
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Increase text size for better readability.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={largeText}
              aria-label="Large Text"
              onClick={() => setLargeText(!largeText)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                largeText
                  ? 'bg-primary-600'
                  : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  largeText ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>

          </div>

          <p className="mt-2 text-right text-sm font-medium text-slate-600">
            Large Text is {largeText ? 'ON' : 'OFF'}
          </p>
        </div>

        {/* ACTIVE USER PREFERENCES */}
        <div className="mt-6 pb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
            Your preferences
          </h2>

          <div className="mt-3 space-y-2">
            {activePreferences.length > 0 ? (
              activePreferences.map((preference) => (
                <div
                  key={preference}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accessible-500 text-white">
                    ✓
                  </span>

                  <span className="text-sm font-medium text-slate-700">
                    {preference}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No navigation preferences enabled yet.
                You can enable them in your Profile.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* FIXED CONTINUE BUTTON */}
      <div className="shrink-0 border-t border-slate-100 bg-white px-6 pb-6 pt-4">
        <Button
          fullWidth
          onClick={() => go('home')}
          className="text-lg"
        >
          Continue
        </Button>
      </div>

    </div>
  );
}
