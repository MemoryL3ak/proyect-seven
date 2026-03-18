const TOKEN_KEY = "seven.auth";

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

type StoredAuthUser = {
  id?: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
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
  // Also set cookie so middleware can read it (server-side redirect)
  document.cookie = `${TOKEN_KEY}=${tokens.accessToken}; path=/; SameSite=Lax`;
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function setStoredUser(user: StoredAuthUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(USER_KEY);
    return;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): StoredAuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    return null;
  }
}

const USER_KEY = "seven.user";
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
let preferredBase: string | null = null;

function normalizeBase(base: string) {
  return base.replace(/\/+$/, "");
}

function apiCandidates() {
  const candidates: string[] = [];
  if (API_BASE) candidates.push(normalizeBase(API_BASE));

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      candidates.push("http://localhost:3000");
      candidates.push("http://localhost:3001");
      candidates.push("http://localhost:3002");
    }
  }

  if (candidates.length === 0) candidates.push("http://localhost:3000");
  return Array.from(new Set(candidates));
}

async function fetchWithBaseFallback(path: string, options: RequestInit) {
  const ordered = [
    ...(preferredBase ? [preferredBase] : []),
    ...apiCandidates().filter((base) => base !== preferredBase),
  ];

  const networkErrors: string[] = [];
  for (const base of ordered) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, options);
      preferredBase = base;
      return { response, base };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      networkErrors.push(`${base}: ${message}`);
    }
  }

  throw new Error(
    `No se pudo conectar con la API. Intentos: ${networkErrors.join(" | ")}`
  );
}

function withAuthHeaders(headers?: HeadersInit) {
  const tokens = getTokens();
  const nextHeaders = new Headers(headers || {});
  if (tokens?.accessToken) {
    nextHeaders.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  return nextHeaders;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { response, base } = await fetchWithBaseFallback(path, {
      ...options,
      headers: withAuthHeaders(options.headers),
      cache: "no-store"
    });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error(`Endpoint no encontrado en API (${base}${path})`);
    }
    const text = await response.text();
    throw new Error(text || `Request failed (${base}${path})`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const { response, base } = await fetchWithBaseFallback("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error(`Endpoint de login no encontrado en API (${base}/auth/login)`);
    }
    const text = await response.text();
    throw new Error(text || `No se pudo iniciar sesión (${base}/auth/login)`);
  }

  const accessToken = response.headers.get("Authorization")?.replace("Bearer ", "");
  const refreshToken = response.headers.get("x-refresh-token") || undefined;

  if (accessToken) {
    setTokens({ accessToken, refreshToken });
  }

  const payload = (await response.json()) as { user?: StoredAuthUser };
  setStoredUser(payload.user ?? null);
  return payload;
}

export async function changeTemporaryPassword(
  email: string,
  temporaryPassword: string,
  newPassword: string,
) {
  return apiFetch<{ message: string }>("/auth/change-temporary-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, temporaryPassword, newPassword }),
  });
}
