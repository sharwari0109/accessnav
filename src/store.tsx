import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import type {
  AccessibilityMode,
  ScreenName,
  Place,
} from './types';


// ============================================================
// DESTINATION
// ============================================================

export interface Destination {
  /*
   * Name displayed to the user.
   */
  name: string;

  /*
   * Real geographic coordinates.
   */
  lat: number;
  lng: number;

  /*
   * If this destination exists in our accessibility database,
   * this contains the full Place record.
   *
   * For an arbitrary OpenStreetMap/Nominatim result,
   * this is undefined.
   */
  place?: Place;
}


// ============================================================
// APP STATE
// ============================================================

interface AppState {
  screen: ScreenName;

  go: (s: ScreenName) => void;

  mode: AccessibilityMode;

  setMode: (m: AccessibilityMode) => void;

  destination: Destination | null;

  setDestination: (destination: Destination) => void;

  selectedRoute:
    | 'accessible'
    | 'fastest'
    | 'clear';

  setSelectedRoute: (
    r: 'accessible' | 'fastest' | 'clear',
  ) => void;

  navStep: number;

  setNavStep: (n: number) => void;

  paused: boolean;

  setPaused: (p: boolean) => void;

  sosActive: boolean;

  setSosActive: (a: boolean) => void;
}


// ============================================================
// CONTEXT
// ============================================================

const Ctx = createContext<AppState | null>(null);


// ============================================================
// PROVIDER
// ============================================================

export function AppProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [screen, setScreen] =
    useState<ScreenName>('splash');

  const [mode, setMode] =
    useState<AccessibilityMode>('wheelchair');

  const [destination, setDestination] =
    useState<Destination | null>(null);

  const [selectedRoute, setSelectedRoute] =
    useState<
      'accessible'
      | 'fastest'
      | 'clear'
    >('accessible');

  const [navStep, setNavStep] =
    useState(0);

  const [paused, setPaused] =
    useState(false);

  const [sosActive, setSosActive] =
    useState(false);


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const go = (s: ScreenName) => {
    setScreen(s);

    /*
     * Whenever navigation starts, begin from the first
     * navigation instruction.
     */
    if (s === 'navigation') {
      setNavStep(0);
    }
  };


  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <Ctx.Provider
      value={{
        screen,
        go,

        mode,
        setMode,

        destination,
        setDestination,

        selectedRoute,
        setSelectedRoute,

        navStep,
        setNavStep,

        paused,
        setPaused,

        sosActive,
        setSosActive,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}


// ============================================================
// HOOK
// ============================================================

export function useApp() {
  const context = useContext(Ctx);

  if (!context) {
    throw new Error(
      'useApp must be used within AppProvider',
    );
  }

  return context;
}