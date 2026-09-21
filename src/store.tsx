import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type {
  AccessibilityMode,
  ScreenName,
  Place,
} from './types';

import {
  getCurrentUser,
  getToken,
  removeToken,
} from './api';


// ============================================================
// DESTINATION
// ============================================================

export interface Destination {
  name: string;
  lat: number;
  lng: number;
  place?: Place;
}


// ============================================================
// USER
// ============================================================

export interface User {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;

  [key: string]: unknown;
}


// ============================================================
// APP STATE
// ============================================================

interface AppState {
  screen: ScreenName;
  go: (s: ScreenName) => void;

  // Authentication
  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  logout: () => void;

  // Accessibility
  mode: AccessibilityMode;
  setMode: (m: AccessibilityMode) => void;

  // Destination
  destination: Destination | null;
  setDestination: (destination: Destination) => void;

  // Route
  selectedRoute:
    | 'accessible'
    | 'fastest'
    | 'clear';

  setSelectedRoute: (
    r:
      | 'accessible'
      | 'fastest'
      | 'clear'
  ) => void;

  // Navigation
  navStep: number;
  setNavStep: (n: number) => void;

  // Pause
  paused: boolean;
  setPaused: (p: boolean) => void;

  // SOS
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

  const [user, setUser] =
    useState<User | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

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
  // RESTORE LOGIN SESSION
  // ==========================================================

  useEffect(() => {

    async function restoreSession() {

      const token = getToken();


      // ------------------------------------------------------
      // No token
      //
      // This means the user has NOT logged in.
      //
      // IMPORTANT:
      // Keep screen as "splash".
      //
      // Splash will show:
      // Splash → Welcome → Login
      // ------------------------------------------------------

      if (!token) {

        setAuthLoading(false);

        return;
      }


      // ------------------------------------------------------
      // Token exists
      //
      // Verify token with backend.
      // ------------------------------------------------------

      try {

        console.log(
          'Restoring saved login session...'
        );


        const currentUser =
          await getCurrentUser();


        console.log(
          'User session restored:',
          currentUser
        );


        setUser(currentUser);


        // ----------------------------------------------------
        // User was already logged in.
        //
        // Skip Login/Welcome and go to Home.
        // ----------------------------------------------------

        setScreen('home');

      } catch (error) {

        console.error(
          'Saved session is invalid:',
          error
        );


        // Token is invalid/expired.
        removeToken();

        setUser(null);


        // Go through normal logged-out flow.
        setScreen('splash');

      } finally {

        setAuthLoading(false);

      }
    }


    restoreSession();

  }, []);


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = () => {

    console.log('User logged out');


    // Remove JWT
    removeToken();


    // Remove current user
    setUser(null);


    // Reset application state
    setDestination(null);
    setNavStep(0);
    setPaused(false);
    setSosActive(false);


    // IMPORTANT:
    // Go to Login directly after logout.
    setScreen('login');
  };


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const go = (s: ScreenName) => {

    setScreen(s);

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

        user,
        setUser,
        authLoading,
        logout,

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
      'useApp must be used within AppProvider'
    );
  }

  return context;
}