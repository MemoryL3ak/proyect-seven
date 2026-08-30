import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { apiFetch, getPortalIdentity, getTokens } from "./api";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });

  const tokens = getTokens();
  if (tokens?.accessToken) {
    client.realtime.setAuth(tokens.accessToken);
  }

  return client;
}

export function refreshRealtimeAuth() {
  if (!client) return;
  const tokens = getTokens();
  if (tokens?.accessToken) {
    client.realtime.setAuth(tokens.accessToken);
  }
}

/**
 * Autenticación de Realtime para usuarios de portal (SA-BACKEND-02): sin
 * cuenta Supabase, el backend les firma un JWT efímero con el claim `portal`
 * que la política RLS usa para acotar la lectura a sus viajes. Devuelve true
 * si el canal quedó autenticado; con false el portal sigue con el polling
 * REST (que autentica por sesión de portal).
 *
 * El token dura 1 h: para suscripciones largas conviene reinvocar esta
 * función en un intervalo (~40 min).
 */
export async function ensurePortalRealtimeAuth(): Promise<boolean> {
  const portal = getPortalIdentity();
  if (!portal) return false;
  try {
    const res = await apiFetch<{ token?: string }>("/m/auth/realtime-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(portal),
    });
    if (!res?.token) return false;
    getSupabase().realtime.setAuth(res.token);
    return true;
  } catch {
    return false;
  }
}
