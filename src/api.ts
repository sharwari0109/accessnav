const API_URL = "http://127.0.0.1:8000";

// ============================================================
// TOKEN HELPERS
// ============================================================

export function getToken() {
  return localStorage.getItem("access_token");
}

export function saveToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function removeToken() {
  localStorage.removeItem("access_token");
}


// ============================================================
// COMMON REQUEST HELPER
// ============================================================

async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  if (!response.ok) {
    let message = "API request failed";

    try {
      const errorData = await response.json();

      message =
        errorData.detail ||
        errorData.message ||
        message;
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(message);
  }

  return response.json();
}


// ============================================================
// BACKEND HEALTH
// ============================================================

export async function checkBackend() {
  return apiFetch("/health");
}


// ============================================================
// AUTHENTICATION
// ============================================================

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export async function registerUser(
  data: RegisterRequest
) {
  return apiFetch(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function loginUser(
  data: LoginRequest
) {
  const result = await apiFetch(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  if (result.access_token) {
    saveToken(result.access_token);
  }

  return result;
}

export async function getCurrentUser() {
  return apiFetch("/api/auth/me");
}

export function logoutUser() {
  removeToken();
}

export function isLoggedIn() {
  return !!getToken();
}


// ============================================================
// PLACES
// ============================================================

export async function getPlaces() {
  return apiFetch("/api/places");
}

export async function getPlace(
  placeId: string
) {
  return apiFetch(
    `/api/places/${encodeURIComponent(placeId)}`
  );
}


// ============================================================
// PLACE ACCESSIBILITY
// ============================================================

export type AccessibilityMode =
  | "wheelchair"
  | "lowvision";


export interface AccessibilityWarning {
  text: string;
  severity: string;
}


export interface AccessibilityModeData {
  score: number;
  features: string[];
  warnings: AccessibilityWarning[];
}


export interface PlaceAccessibility {
  placeId: string;
  name: string;

  modeSupport: {
    wheelchair: AccessibilityModeData;
    lowvision: AccessibilityModeData;
  };

  tags: string[];
  warnings: string[];
}


export async function getPlaceAccessibility(
  placeId: string
): Promise<PlaceAccessibility> {
  return apiFetch(
    `/api/places/${encodeURIComponent(
      placeId
    )}/accessibility`
  );
}


// ============================================================
// SAVED PLACES
// ============================================================

export async function getSavedPlaces() {
  return apiFetch("/api/saved");
}


// ============================================================
// ROUTES
// ============================================================

export interface RouteFeature {
  text: string;
  ok: boolean;
}


export interface BackendRoute {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
  time?: string;
  dist?: string;
  tag?: string;
  badge?: string;
  features?: RouteFeature[];

  accessibility?: {
    score: number;
    summary: string;
    positiveFeatures: string[];
    negativeFeatures: string[];
    placeFeatures: string[];
    warnings: string[];
    preferences: {
      preference: string;
      status: string;
    }[];
  };
}


export async function getRoutes(
  placeId: string
): Promise<BackendRoute[]> {
  return apiFetch(
    `/api/routes/${encodeURIComponent(placeId)}`
  );
}


// ============================================================
// ACCESSIBILITY ROUTES
// ============================================================

export interface AccessibilityRouteResponse {
  placeId: string;
  mode: AccessibilityMode;
  routes: BackendRoute[];
  notice: string;
}


export async function getAccessibilityRoutes(
  placeId: string,
  mode: AccessibilityMode
): Promise<AccessibilityRouteResponse> {

  const params = new URLSearchParams({
    mode,
  });

  return apiFetch(
    `/api/accessibility/routes/${encodeURIComponent(
      placeId
    )}?${params.toString()}`
  );
}


// ============================================================
// ACCESSIBILITY ROUTE ANALYSIS
// ============================================================

export interface AccessibilityAnalyzeRequest {
  mode: AccessibilityMode;
  preferences?: string[];
}


export interface AccessibilityAnalysis {
  score: number;
  summary: string;

  positiveFeatures: string[];
  negativeFeatures: string[];

  placeFeatures: string[];
  warnings: string[];

  preferences: {
    preference: string;
    status: string;
  }[];
}


export interface AnalyzedRoute
  extends BackendRoute {
  accessibility?: AccessibilityAnalysis;
}


export interface AccessibilityAnalyzeResponse {
  placeId: string;
  mode: AccessibilityMode;
  preferences: string[];
  routes: AnalyzedRoute[];
}


export async function analyzeAccessibilityRoute(
  placeId: string,
  data: AccessibilityAnalyzeRequest
): Promise<AccessibilityAnalyzeResponse> {

  return apiFetch(
    `/api/accessibility/analyze/${encodeURIComponent(
      placeId
    )}`,
    {
      method: "POST",
      body: JSON.stringify({
        mode: data.mode,
        preferences: data.preferences || [],
      }),
    }
  );
}


// ============================================================
// ACCESSIBILITY POINTS
// ============================================================

export interface AccessibilityPoint {
  id: string;
  name: string;

  latitude: number;
  longitude: number;

  tags: string[];
  warnings: string[];

  score: number;
  distanceKm: number;
}


export interface AccessibilityPointsResponse {
  latitude: number;
  longitude: number;
  radiusKm: number;
  results: AccessibilityPoint[];
}


export async function getAccessibilityPoints(
  latitude: number,
  longitude: number,
  radiusKm = 1
): Promise<AccessibilityPointsResponse> {

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius: String(radiusKm),
  });

  return apiFetch(
    `/api/accessibility/points?${params.toString()}`
  );
}


// ============================================================
// NAVIGATION
// ============================================================

export async function getNavigation() {
  return apiFetch("/api/navigation");
}

export async function getNavigationStep(
  step: number
) {
  return apiFetch(
    `/api/navigation/${step}`
  );
}


// ============================================================
// NAVIGATION ACCESSIBILITY
// ============================================================

export interface AccessibilityNavigationResponse {
  placeId: string;

  mode: AccessibilityMode;

  destination: {
    name: string;
    latitude: number;
    longitude: number;
  };

  accessInstructions: string[];

  warnings: string[];

  tags: string[];

  navigationSteps: unknown[];
}


export async function getNavigationAccessibility(
  placeId: string,
  mode: AccessibilityMode
): Promise<AccessibilityNavigationResponse> {

  const params = new URLSearchParams({
    mode,
  });

  return apiFetch(
    `/api/navigation/accessibility/${encodeURIComponent(
      placeId
    )}?${params.toString()}`
  );
}


// ============================================================
// REPORTS
// ============================================================

export async function getReportOptions() {
  return apiFetch("/api/report-options");
}


export interface ReportRequest {
  placeId: string;
  reportType: string;
  description?: string;
}


export async function submitReport(
  report: ReportRequest
) {
  return apiFetch(
    "/api/reports",
    {
      method: "POST",
      body: JSON.stringify(report),
    }
  );
}


export async function getReports() {
  return apiFetch("/api/reports");
}