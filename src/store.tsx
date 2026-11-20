
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
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
  id?: string;
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
  goBack: () => void;

  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  logout: () => void;

  mode: AccessibilityMode;
  setMode: (m: AccessibilityMode) => void;

  preferences: string[];
  setPreferences: Dispatch<SetStateAction<string[]>>;

  largeText: boolean;
  setLargeText: (enabled: boolean) => void;

  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;

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

  // Navigation history for the Android Back button.
  const historyRef = useRef<ScreenName[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [mode, setMode] =
    useState<AccessibilityMode>('wheelchair');

  // Load saved navigation preferences.
  const [preferences, setPreferences] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('accessnav-preferences');

      return saved
        ? JSON.parse(saved)
        : ['Most accessible route'];
    } catch {
      return ['Most accessible route'];
    }
  });

  // Save navigation preferences.
  useEffect(() => {
    try {
      localStorage.setItem(
        'accessnav-preferences',
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('Could not save preferences:', error);
    }
  }, [preferences]);

  // Load saved Large Text preference.
  const [largeText, setLargeText] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessnav-large-text') === 'true';
    } catch {
      return false;
    }
  });

  // Load saved High Contrast preference.
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessnav-high-contrast') === 'true';
    } catch {
      return false;
    }
  });

  // Apply High Contrast throughout the application and save preference.
  useEffect(() => {
    document.documentElement.classList.toggle(
      'high-contrast',
      highContrast
    );

    try {
      localStorage.setItem(
        'accessnav-high-contrast',
        String(highContrast)
      );
    } catch (error) {
      console.error('Could not save High Contrast preference:', error);
    }
  }, [highContrast]);

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

  // Apply Large Text throughout the application and save preference.
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
      console.error('Could not save Large Text preference:', error);
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
      console.error('Could not save Voice Guidance preference:', error);
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
        historyRef.current = [];
        setScreen('home');
      } catch (error) {
        if (cancelled) return;

        console.error('Saved session is invalid:', error);
        removeToken();
        setUser(null);
        historyRef.current = [];
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

  // Navigate to another screen and remember the current screen.
  const go = (nextScreen: ScreenName) => {
    if (nextScreen === screen) return;

    historyRef.current.push(screen);

    setScreen(nextScreen);

    if (nextScreen === 'navigation') {
      setNavStep(0);
    }
  };

  // Navigate back to the previous screen.
  const goBack = () => {
    const previousScreen = historyRef.current.pop();

    if (previousScreen) {
      setScreen(previousScreen);
    }

    // If there is no previous screen, stay where you are.
    // In particular, pressing Back on Home won't close the app.
  };

  // Logout and clear navigation history.
  const logout = () => {
    removeToken();
    setUser(null);
    setDestination(null);
    setNavStep(0);
    setPaused(false);
    setSosActive(false);

    historyRef.current = [];
    setScreen('login');
  };

  return (
    <Ctx.Provider
      value={{
        screen,
        go,
        goBack,

        user,
        setUser,
        authLoading,
        logout,

        mode,
        setMode,

        preferences,
        setPreferences,

        largeText,
        setLargeText,

        highContrast,
        setHighContrast,

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
