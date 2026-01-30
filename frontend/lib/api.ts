const TOKEN_KEY = "seven.auth";

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export function getTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000";

function withAuthHeaders(headers?: HeadersInit) {
  const tokens = getTokens();
  const nextHeaders = new Headers(headers || {});
  if (tokens?.accessToken) {
    nextHeaders.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  return nextHeaders;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: withAuthHeaders(options.headers),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo iniciar sesión");
  }

  const accessToken = response.headers.get("Authorization")?.replace("Bearer ", "");
  const refreshToken = response.headers.get("x-refresh-token") || undefined;

  if (accessToken) {
    setTokens({ accessToken, refreshToken });
  }

  return response.json();
}
