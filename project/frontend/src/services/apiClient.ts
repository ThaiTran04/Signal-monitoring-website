/**
 * Low-level HTTP client used by all services/*Api modules.
 *
 * Base URL is configurable via VITE_API_BASE_URL (see .env.example) so the
 * same build can point at a local backend during development or a deployed
 * one in production.
 *
 * If VITE_API_BASE_URL is not set, we do NOT fall back to a hardcoded
 * "http://localhost:8000". That used to be the default, and it silently
 * breaks the app for every device that isn't the dev machine itself: when
 * this page is opened from a phone/laptop as http://192.168.1.66:5173,
 * "localhost" inside that browser means the phone, not the PC running the
 * backend — so every request would try (and fail) to reach a backend on
 * the phone itself.
 *
 * Instead we derive the backend host from the page's own address
 * (window.location.hostname). Opened as http://192.168.1.66:5173 → backend
 * assumed at http://192.168.1.66:8000. Opened as http://localhost:5173 (PC
 * dev flow) → backend assumed at http://localhost:8000. This makes the
 * default "just work" on LAN without requiring a .env file, while
 * VITE_API_BASE_URL still lets you override it explicitly (e.g. a backend
 * on a different host/port, or HTTPS behind a reverse proxy).
 */
function computeDefaultApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  // No window (e.g. SSR/build-time evaluation) — last-resort fallback.
  return "http://localhost:8000";
}

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL || computeDefaultApiBaseUrl();

const TOKEN_KEY = "hmi_access_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip attaching the Authorization header (only auth/login needs this). */
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), API_BASE_URL + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, skipAuth } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!skipAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(res.status, typeof message === "string" ? message : JSON.stringify(message));
  }

  return data as T;
}
