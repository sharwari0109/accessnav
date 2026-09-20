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

  /** position on the map in viewBox coordinates (0..390 x, 0..644 y) */
  x: number;
  y: number;

  emoji: string;
}

export interface NavState {
  instruction: string;
  detail: string;
  accessInstruction: string;
  nextAccessPoint: string;
}