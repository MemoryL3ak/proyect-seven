import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getTokens } from "./api";

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
