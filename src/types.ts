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

export type TravelMode = 'vehicle' | 'walking' | 'wheelchair';

export interface Place {
  id: string;
  name: string;
  area: string;
  distanceKm: number;
  score: number;
  tags: string[];
  warnings: string[];
  x: number;
  y: number;
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