import { useEffect, useState } from 'react';

import { useApp } from '@/store';
import MumbaiMap from '@/components/MumbaiMap';
import Overlay from '@/components/Overlay';
import Button from '@/components/Button';
import SOSButton from '@/components/SOSButton';

import { getNavigation } from '@/api';

import {
  Pause,
  RefreshCw,
  FileText,
  AlertTriangle,
  Play,
  X,
  Check,
} from 'lucide-react';


// ============================================================
// NAVIGATION STEP TYPE
// ============================================================

interface NavigationStep {
  instruction: string;
  detail: string;
  accessInstruction: string;
  nextAccessPoint: string;
}


// ============================================================
// NAVIGATION SCREEN
// ============================================================

export default function Navigation() {

  const {
    destination,
    mode,
    navStep,
    setNavStep,
    paused,
    setPaused,
    selectedRoute,
    go,
  } = useApp();


  // ============================================================
  // STATE
  // ============================================================

  const [navigationSteps, setNavigationSteps] = useState<
    NavigationStep[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');


  // ============================================================
  // LOAD NAVIGATION FROM BACKEND
  // ============================================================

  useEffect(() => {

    async function loadNavigation() {

      try {

        setLoading(true);
        setError('');

        const data = await getNavigation();

        setNavigationSteps(data);

      } catch (err) {

        console.error(
          'Failed to load navigation:',
          err
        );

        setError(
          'Unable to load navigation.'
        );

      } finally {

        setLoading(false);

      }
    }

    loadNavigation();

  }, []);


  // ============================================================
  // NO DESTINATION
  // ============================================================

  if (!destination) {
    return null;
  }


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />

          <p className="text-sm font-semibold text-slate-600">
            Loading navigation...
          </p>

        </div>

      </div>
    );

  }


  // ============================================================
  // ERROR
  // ============================================================

  if (error || navigationSteps.length === 0) {

    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6">

        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-card">

          <div className="mb-4 flex justify-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">

              <AlertTriangle
                size={26}
                className="text-red-500"
              />

            </div>

          </div>

          <h2 className="text-xl font-extrabold text-slate-900">
            Navigation unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error || 'No navigation steps were found.'}
          </p>

          <div className="mt-5">

            <Button
              fullWidth
              onClick={() => go('home')}
            >
              Go Home
            </Button>

          </div>

        </div>

      </div>
    );

  }


  // ============================================================
  // SAFETY CHECK FOR NAVIGATION STEP
  // ============================================================

  const safeNavStep = Math.min(
    navStep,
    navigationSteps.length - 1
  );

  const state =
    navigationSteps[safeNavStep];

  const isLast =
    safeNavStep === navigationSteps.length - 1;

  const progress =
    navigationSteps.length > 1
      ? safeNavStep / (navigationSteps.length - 1)
      : 1;


  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="screen-enter relative h-full w-full overflow-hidden bg-slate-100">


      {/* ======================================================
          MAP
      ====================================================== */}

      <div className="absolute inset-0">

        <MumbaiMap
          mode={mode}
          destinationId={destination.id}
          route={selectedRoute}
          progress={progress}
          highContrast={mode === 'lowvision'}
        />

      </div>


      {/* ======================================================
          TOP DESTINATION CHIP
      ====================================================== */}

      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4">

        <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-card backdrop-blur">

          <span className="text-lg">
            {destination.emoji}
          </span>

          <div className="min-w-0 flex-1">

            <p className="text-xs text-slate-400">
              Navigating to
            </p>

            <p className="truncate text-sm font-bold text-slate-900">
              {destination.name}
            </p>

          </div>

          <button
            onClick={() => go('home')}
            aria-label="Exit navigation"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <X size={16} />
          </button>

        </div>

      </div>


      {/* ======================================================
          SOS
      ====================================================== */}

      <div className="absolute right-4 top-20 z-20">
        <SOSButton />
      </div>


      {/* ======================================================
          BOTTOM NAVIGATION CARD
      ====================================================== */}

      <div className="absolute inset-x-0 bottom-0 z-30 animate-slide-up rounded-t-3xl bg-white p-5 pb-6 shadow-sheet">

        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />


        {/* ==================================================
            PROGRESS BAR
        ================================================== */}

        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">

          <div
            className="h-full rounded-full bg-accessible-500 transition-all"
            style={{
              width: `${progress * 100}%`,
            }}
          />

        </div>


        {/* ==================================================
            CURRENT INSTRUCTION
        ================================================== */}

        <div className="flex items-start gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white">

            <span className="text-2xl font-extrabold">
              {isLast ? '🏁' : '↰'}
            </span>

          </div>

          <div className="min-w-0 flex-1">

            <p className="text-lg font-extrabold text-slate-900">
              {state.instruction}
            </p>

            <p className="text-sm text-slate-500">
              {state.detail}
            </p>

          </div>

        </div>


        {/* ==================================================
            ACCESSIBILITY INSTRUCTION
        ================================================== */}

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-accessible-50 p-3">

          <span className="text-xl">
            {mode === 'wheelchair' ? '♿' : '👁'}
          </span>

          <p className="flex-1 text-sm font-semibold text-accessible-800">
            {state.accessInstruction}
          </p>

        </div>


        {/* ==================================================
            NEXT ACCESSIBILITY POINT
        ================================================== */}

        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">

          <span className="h-1.5 w-1.5 rounded-full bg-accessible-500" />

          Next accessibility point:

          <span className="font-bold text-slate-700">
            {state.nextAccessPoint}
          </span>

        </div>


        {/* ==================================================
            ACTION BUTTONS
        ================================================== */}

        <div className="mt-4 grid grid-cols-4 gap-2">

          <NavAction
            icon={
              paused
                ? <Play size={18} />
                : <Pause size={18} />
            }
            label={
              paused
                ? 'Resume'
                : 'Pause'
            }
            onClick={() =>
              setPaused(!paused)
            }
          />

          <NavAction
            icon={<RefreshCw size={18} />}
            label="Recalc"
            onClick={() =>
              setNavStep(0)
            }
          />

          <NavAction
            icon={<FileText size={18} />}
            label="Details"
            onClick={() =>
              go('details')
            }
          />

          <NavAction
            icon={<AlertTriangle size={18} />}
            label="Report"
            onClick={() =>
              go('report')
            }
          />

        </div>


        {/* ==================================================
            NEXT STEP
        ================================================== */}

        {!isLast && !paused && (

          <button
            onClick={() =>
              setNavStep(safeNavStep + 1)
            }
            className="mt-3 w-full rounded-2xl bg-primary-50 py-3 text-sm font-bold text-primary-700 active:scale-[0.99]"
          >
            Advance to next step →
          </button>

        )}


        {/* ==================================================
            ARRIVED
        ================================================== */}

        {isLast && (

          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-accessible-50 py-3 text-sm font-bold text-accessible-700">

            <Check
              size={16}
              strokeWidth={3}
            />

            You have arrived

          </div>

        )}

      </div>


      {/* ======================================================
          PAUSE OVERLAY
      ====================================================== */}

      {paused && (

        <Overlay
          onClose={() =>
            setPaused(false)
          }
        >

          <div className="mb-4 flex justify-center">

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">

              <Pause
                size={28}
                className="text-primary-700"
              />

            </div>

          </div>


          <h2 className="text-center text-2xl font-extrabold text-slate-900">
            Navigation Paused
          </h2>


          <p className="mt-2 text-center text-sm text-slate-500">
            Your route is saved. Resume when you're ready to continue.
          </p>


          <div className="mt-6 space-y-3">

            <Button
              fullWidth
              onClick={() =>
                setPaused(false)
              }
            >
              <Play size={18} />
              Resume Navigation
            </Button>


            <Button
              fullWidth
              variant="secondary"
              onClick={() =>
                go('home')
              }
            >
              End Navigation
            </Button>

          </div>

        </Overlay>

      )}

    </div>
  );
}


// ============================================================
// NAVIGATION ACTION BUTTON
// ============================================================

function NavAction({
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
      className="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 py-2.5 text-slate-700 active:scale-95"
    >

      {icon}

      <span className="text-xs font-semibold">
        {label}
      </span>

    </button>

  );
}