import { apiFetch } from "@/lib/api";

/**
 * Sesión única por usuario: sólo un dispositivo puede tener la sesión activa,
 * y LA SESIÓN EXISTENTE MANDA.
 *
 * - Al iniciar sesión, el dispositivo intenta "reclamar" la sesión (claim).
 *   Si otro dispositivo ya tiene una sesión viva, el claim se rechaza y el
 *   login NO procede: se muestra un mensaje pidiendo cerrar la otra sesión.
 * - La sesión activa "late" en cada validación periódica; si deja de latir
 *   (app cerrada sin logout), a los pocos minutos otro dispositivo puede
 *   reclamar.
 * - El logout libera la sesión de inmediato (release).
 * - Ante errores de red o backend sin la función, se degrada sin bloquear.
 */
export type PortalSessionKind = "athlete" | "driver";

export const SESSION_ACTIVE_ELSEWHERE_MSG =
  "No se pudo iniciar sesión: esta cuenta ya tiene una sesión activa en otro dispositivo. " +
  "Cierra la sesión en el otro dispositivo (o espera unos minutos si la app se cerró sin salir) e inténtalo nuevamente.";

const storageKey = (kind: PortalSessionKind, userId: string) =>
  `portal_session_${kind}_${userId}`;

export type ClaimResult = {
  /** true si este dispositivo quedó como la sesión activa (o el backend degradó). */
  ok: boolean;
  /** true cuando el claim fue rechazado porque otro dispositivo tiene la sesión. */
  activeElsewhere: boolean;
};

export async function claimPortalSession(
  kind: PortalSessionKind,
  userId: string,
): Promise<ClaimResult> {
  let current: string | null = null;
  try { current = localStorage.getItem(storageKey(kind, userId)); } catch {}
  try {
    const res = await apiFetch<{ claimed?: boolean; sessionId: string | null }>(
      "/m/auth/session/claim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, userId, currentSessionId: current || undefined }),
      },
    );
    if (res?.claimed === false) {
      return { ok: false, activeElsewhere: true };
    }
    if (res?.sessionId) {
      try { localStorage.setItem(storageKey(kind, userId), res.sessionId); } catch {}
    }
    return { ok: true, activeElsewhere: false };
  } catch {
    // Backend sin sesión única todavía: seguir sin bloquear el login.
    return { ok: true, activeElsewhere: false };
  }
}

/**
 * Valida la sesión de este dispositivo (y la mantiene viva). Si el dispositivo
 * no tiene sessionId local (primera vez), intenta reclamar. Devuelve false
 * sólo cuando este dispositivo perdió la sesión frente a otro.
 */
export async function ensurePortalSession(kind: PortalSessionKind, userId: string): Promise<boolean> {
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey(kind, userId)); } catch {}
  if (!stored) {
    const claim = await claimPortalSession(kind, userId);
    return !claim.activeElsewhere;
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

/** Libera la sesión en el backend y borra el token local (usar al cerrar sesión). */
export function clearPortalSession(kind: PortalSessionKind, userId: string): void {
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey(kind, userId)); } catch {}
  try { localStorage.removeItem(storageKey(kind, userId)); } catch {}
  if (!stored) return;
  void apiFetch("/m/auth/session/release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, userId, sessionId: stored }),
  }).catch(() => {});
}
