import { apiFetch } from "@/lib/api";

/**
 * Sesión única por usuario: sólo un dispositivo puede tener la sesión activa.
 *
 * - Al iniciar sesión, el dispositivo "reclama" la sesión (claim): el backend
 *   emite un sessionId nuevo que invalida al resto de los dispositivos.
 * - Cada portal valida periódicamente su sessionId; si otro dispositivo
 *   reclamó después, la validación falla y el portal cierra sesión.
 * - Ante errores de red o backend sin la función, se degrada sin expulsar.
 */
export type PortalSessionKind = "athlete" | "driver";

const storageKey = (kind: PortalSessionKind, userId: string) =>
  `portal_session_${kind}_${userId}`;

export async function claimPortalSession(kind: PortalSessionKind, userId: string): Promise<void> {
  try {
    const res = await apiFetch<{ sessionId: string | null }>("/m/auth/session/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, userId }),
    });
    if (res?.sessionId) {
      try { localStorage.setItem(storageKey(kind, userId), res.sessionId); } catch {}
    }
  } catch {
    // Backend sin sesión única todavía: seguir sin bloquear el login.
  }
}

/**
 * Valida la sesión de este dispositivo. Si el dispositivo no tiene sessionId
 * local (primera vez), reclama la sesión. Devuelve false sólo cuando OTRO
 * dispositivo inició sesión después.
 */
export async function ensurePortalSession(kind: PortalSessionKind, userId: string): Promise<boolean> {
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey(kind, userId)); } catch {}
  if (!stored) {
    await claimPortalSession(kind, userId);
    return true;
  }
  try {
    const res = await apiFetch<{ valid: boolean }>("/m/auth/session/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, userId, sessionId: stored }),
    });
    return res?.valid !== false;
  } catch {
    return true;
  }
}

export function clearPortalSession(kind: PortalSessionKind, userId: string): void {
  try { localStorage.removeItem(storageKey(kind, userId)); } catch {}
}
