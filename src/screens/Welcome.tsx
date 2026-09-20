import { useApp } from '@/store';
import Button from '@/components/Button';
import { MapPin, Accessibility } from 'lucide-react';

export default function Welcome() {
  const { go } = useApp();

  return (
    <div className="screen-enter flex h-full w-full flex-col bg-white px-7 pb-10 pt-16">

      {/* Logo */}
      <div className="mb-10 flex items-center justify-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 shadow-card">
          <MapPin size={32} className="text-white" />

          <Accessibility
            size={22}
            className="absolute bottom-3 right-3 text-accessible-300"
          />
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-extrabold text-slate-900">
        Welcome to AccessNav
      </h1>

      <p className="mt-3 text-lg text-slate-500">
        Your route. Your accessibility needs. Your choice.
      </p>

      {/* Features */}
      <div className="mt-8 space-y-3">

        <div className="flex items-center gap-3 rounded-2xl bg-accessible-50 p-4">
          <span className="text-2xl">♿</span>

          <p className="text-sm font-medium text-accessible-800">
            Step-free routes with ramps and elevators
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-primary-50 p-4">
          <span className="text-2xl">👁</span>

          <p className="text-sm font-medium text-primary-800">
            High-contrast guidance with voice instructions
          </p>
        </div>

      </div>

      {/* Authentication buttons */}
      <div className="mt-auto space-y-3">

        {/* Register */}
        <Button
          fullWidth
          onClick={() => go('register')}
          className="text-lg"
        >
          Get Started
        </Button>

        {/* Login */}
        <Button
          fullWidth
          variant="secondary"
          onClick={() => go('login')}
        >
          Sign In
        </Button>

        {/* Guest */}
        <Button
          fullWidth
          variant="ghost"
          onClick={() => go('setup')}
        >
          Continue as Guest
        </Button>

      </div>

    </div>
  );
}