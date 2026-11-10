
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type {
  AccessibilityMode,
  TravelMode,
  ScreenName,
  Place,
} from './types';

import {
  getCurrentUser,
  getToken,
  removeToken,
} from './api';

export interface Destination {
  name: string;
  lat: number;
  lng: number;
  place?: Place;
}

export interface StartLocation {
  name: string;
  lat: number;
  lng: number;
}
export interface Destination {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  place?: Place;
}

export interface User {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface AppState {
  screen: ScreenName;
  go: (s: ScreenName) => void;

  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  logout: () => void;

  mode: AccessibilityMode;
  setMode: (m: AccessibilityMode) => void;

  largeText: boolean;
  setLargeText: (enabled: boolean) => void;

  voiceGuidance: boolean;
  setVoiceGuidance: (enabled: boolean) => void;

  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;

  destination: Destination | null;
  setDestination: (destination: Destination) => void;

  startLocation: StartLocation | null;
  setStartLocation: (location: StartLocation | null) => void;

  selectedRoute: 'accessible' | 'fastest' | 'clear';
  setSelectedRoute: (
    route: 'accessible' | 'fastest' | 'clear'
  ) => void;

  navStep: number;
  setNavStep: (n: number) => void;

  paused: boolean;
  setPaused: (p: boolean) => void;

  sosActive: boolean;
  setSosActive: (a: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [screen, setScreen] = useState<ScreenName>('splash');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mode, setMode] =
    useState<AccessibilityMode>('wheelchair');

  // Load saved Large Text preference.
  const [largeText, setLargeText] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessnav-large-text') === 'true';
    } catch {
      return false;
    }
  });

  // Load saved Voice Guidance preference.
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessnav-voice-guidance') === 'true';
    } catch {
      return false;
    }
  });

  const [travelMode, setTravelMode] =
    useState<TravelMode>('wheelchair');

  const [destination, setDestination] =
    useState<Destination | null>(null);

  const [startLocation, setStartLocation] =
    useState<StartLocation | null>(null);

  const [selectedRoute, setSelectedRoute] =
    useState<'accessible' | 'fastest' | 'clear'>('accessible');

  const [navStep, setNavStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  // Apply Large Text throughout the application and save the preference.
  useEffect(() => {
    document.documentElement.classList.toggle(
      'large-text',
      largeText
    );

    try {
      localStorage.setItem(
        'accessnav-large-text',
        String(largeText)
      );
    } catch (error) {
      console.error(
        'Could not save Large Text preference:',
        error
      );
    }
  }, [largeText]);

  // Save Voice Guidance preference.
  useEffect(() => {
    try {
      localStorage.setItem(
        'accessnav-voice-guidance',
        String(voiceGuidance)
      );
    } catch (error) {
      console.error(
        'Could not save Voice Guidance preference:',
        error
      );
    }
  }, [voiceGuidance]);

  // Restore login session.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getToken();

      if (!token) {
        if (!cancelled) setAuthLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (cancelled) return;

        setUser(currentUser);
        setScreen('home');
      } catch (error) {
        if (cancelled) return;

        console.error('Saved session is invalid:', error);
        removeToken();
        setUser(null);
        setScreen('splash');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = () => {
    removeToken();
    setUser(null);
    setDestination(null);
    setNavStep(0);
    setPaused(false);
    setSosActive(false);
    setScreen('login');
  };

  const go = (nextScreen: ScreenName) => {
    setScreen(nextScreen);

    if (nextScreen === 'navigation') {
      setNavStep(0);
    }
  };

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
        largeText,
        setLargeText,
        voiceGuidance,
        setVoiceGuidance,
        travelMode,
        setTravelMode,
        destination,
        setDestination,
        startLocation,
        setStartLocation,
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

export function useApp() {
  const context = useContext(Ctx);

  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
}
