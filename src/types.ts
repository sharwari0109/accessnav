export type ScreenName =
  | 'splash'
  | 'welcome'
  | 'login'
  | 'register'
  | 'setup'
  | 'home'
  | 'search'
  | 'destination'
  | 'routes'
  | 'navigation'
  | 'details'
  | 'report'
  | 'saved'
  | 'profile'
  | 'sos';

export type AccessibilityMode = 'wheelchair' | 'lowvision';

export interface Place {
  id: string;
  name: string;
  area: string;
  distanceKm: number;
  score: number;
  tags: string[];
  warnings: string[];

  // Existing coordinates used by the original AccessMob UI
  x: number;
  y: number;

  // Real geographic coordinates used by Leaflet/OpenStreetMap
  latitude: number;
  longitude: number;

  emoji: string;
}

export interface NavState {
  instruction: string;
  detail: string;
  accessInstruction: string;
  nextAccessPoint: string;
}