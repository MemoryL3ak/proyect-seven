import { apiFetch } from "./api";

const TOKEN_KEY = "seven.partnerToken";
const PARTNER_KEY = "seven.partner";

export type Partner = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  logoUrl?: string | null;
  allowedCouponIds?: string[] | null;
};

export function getPartnerToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredPartner(): Partner | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PARTNER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partner;
  } catch {
    return null;
  }
}

export function clearPartner() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PARTNER_KEY);
}

export async function loginPartner(code: string, pin: string): Promise<Partner> {
  const r = await apiFetch<{ token: string; partner: Partner }>(
    "/coupon-partners/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, pin }),
    },
  );
  window.localStorage.setItem(TOKEN_KEY, r.token);
  window.localStorage.setItem(PARTNER_KEY, JSON.stringify(r.partner));
  return r.partner;
}

export async function logoutPartner() {
  const token = getPartnerToken();
  if (token) {
    try {
      await partnerFetch("/coupon-partners/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
  }
  clearPartner();
}

/** apiFetch variant that adds X-Partner-Token. */
export async function partnerFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getPartnerToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("X-Partner-Token", token);
  return apiFetch<T>(path, { ...init, headers });
}
