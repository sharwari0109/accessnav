const API_URL = "http://127.0.0.1:8000";

// -----------------------------
// Token helpers
// -----------------------------

export function getToken() {
  return localStorage.getItem("access_token");
}

export function saveToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function removeToken() {
  localStorage.removeItem("access_token");
}

// -----------------------------
// Common request helper
// -----------------------------

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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "API request failed";

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(message);
  }

  return response.json();
}

// -----------------------------
// Backend health
// -----------------------------

export async function checkBackend() {
  return apiFetch("/health");
}

// -----------------------------
// Authentication
// -----------------------------

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export async function registerUser(data: RegisterRequest) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: LoginRequest) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

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

// -----------------------------
// Places
// -----------------------------

export async function getPlaces() {
  return apiFetch("/api/places");
}

export async function getPlace(placeId: string) {
  return apiFetch(`/api/places/${placeId}`);
}

// -----------------------------
// Saved places
// -----------------------------

export async function getSavedPlaces() {
  return apiFetch("/api/saved");
}

// -----------------------------
// Routes
// -----------------------------

export async function getRoutes(placeId: string) {
  return apiFetch(`/api/routes/${placeId}`);
}

// -----------------------------
// Navigation
// -----------------------------

export async function getNavigation() {
  return apiFetch("/api/navigation");
}

export async function getNavigationStep(step: number) {
  return apiFetch(`/api/navigation/${step}`);
}

// -----------------------------
// Reports
// -----------------------------

export async function getReportOptions() {
  return apiFetch("/api/report-options");
}

export interface ReportRequest {
  placeId: string;
  reportType: string;
  description?: string;
}

export async function submitReport(report: ReportRequest) {
  return apiFetch("/api/reports", {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export async function getReports() {
  return apiFetch("/api/reports");
}