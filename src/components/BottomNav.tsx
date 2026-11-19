
import { Home, Compass, Heart, User } from 'lucide-react';
import { useApp } from '@/store';
import type { ScreenName } from '@/types';

const items: { id: ScreenName; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Navigate', icon: Compass },
  { id: 'saved', label: 'Saved', icon: Heart },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const { screen, go, highContrast } = useApp();

  const active = ['home', 'search', 'saved', 'profile'].includes(screen)
    ? screen
    : 'home';

  return (
    <nav
      className={`absolute inset-x-0 bottom-0 z-20 border-t px-2 pb-5 pt-2 backdrop-blur transition-colors ${
        highContrast
          ? 'border-white bg-black'
          : 'border-slate-100 bg-white/95'
      }`}
    >
      <div className="flex items-center justify-around">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;

          const activeColor = highContrast
            ? 'text-yellow-300'
            : 'text-primary-600';

          const inactiveColor = highContrast
            ? 'text-white'
            : 'text-slate-400';

          return (
            <button
              key={id}
              onClick={() => go(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-1.5"
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 2.4 : 2}
                className={isActive ? activeColor : inactiveColor}
              />

              <span
                className={`text-xs font-semibold ${
                  isActive ? activeColor : inactiveColor
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
