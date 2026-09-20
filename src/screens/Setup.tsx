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
    'High contrast',
    'Voice guidance',
    'Clear crossings',
    'Avoid complicated intersections',
  ],
};

export default function Setup() {
  const {
    mode,
    setMode,
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

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-white">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="px-6 pb-4 pt-6">

        <h1 className="text-2xl font-extrabold text-slate-900">
          How should we personalize your route?
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Choose what fits you best. You can change this anytime.
        </p>

      </div>


      {/* ==================================================
          ACCESSIBILITY MODES
      ================================================== */}

      <div className="flex gap-3 px-6">

        {cards.map((card) => {

          const selected = mode === card.id;

          return (
            <button
              key={card.id}
              onClick={() => setMode(card.id)}
              className={`flex-1 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
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


      {/* ==================================================
          PREFERENCES
      ================================================== */}

      <div className="mt-6 px-6">

        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
          Your preferences
        </h2>

        <div className="mt-3 space-y-2">

          {PREFS[mode].map((preference) => (
            <div
              key={preference}
              className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
            >

              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accessible-500 text-white">
                ✓
              </span>

              <span className="text-sm font-medium text-slate-700">
                {preference}
              </span>

            </div>
          ))}

        </div>

      </div>


      {/* ==================================================
          CONTINUE
      ================================================== */}

      <div className="mt-auto px-6 pb-8">

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