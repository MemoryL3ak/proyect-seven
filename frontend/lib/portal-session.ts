import { apiFetch, clearPortalIdentity, getPortalIdentity, setPortalIdentity } from "@/lib/api";

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
export type PortalSessionKind = "athlete" | "driver" | "staff";

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
      // Identidad activa para los headers x-portal-* de apiFetch.
      setPortalIdentity({ kind, userId, sessionId: res.sessionId });
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
    if (res?.valid !== false) {
      // Refresca el puntero de identidad (cubre el auto-login de la app,
      // que trae la sesión reclamada desde /m/login).
      setPortalIdentity({ kind, userId, sessionId: stored });
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Libera la sesión en el backend y borra el token local (usar al cerrar
 * sesión). IMPORTANTE: si el logout navega después (mobileAwareLogout),
 * hay que AWAITEAR esta función antes de navegar — si no, la navegación
 * aborta el request y la sesión queda "viva" en el backend hasta expirar,
 * bloqueando el login en cualquier dispositivo. `keepalive` hace que el
 * request sobreviva a la navegación como segunda línea de defensa, y el
 * timeout de 1.5 s garantiza que el logout nunca se quede colgado.
 */
export async function releasePortalSession(kind: PortalSessionKind, userId: string): Promise<void> {
  let stored: string | null = null;
  try { stored = localStorage.getItem(storageKey(kind, userId)); } catch {}
  try { localStorage.removeItem(storageKey(kind, userId)); } catch {}
  clearPortalIdentity(userId);
  if (!stored) return;
  try {
    await Promise.race([
      apiFetch("/m/auth/session/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, userId, sessionId: stored }),
        keepalive: true,
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Sin red / backend antiguo: la sesión expira sola por falta de latido.
  }
}

/** Variante fire-and-forget para flujos que NO navegan después. */
export function clearPortalSession(kind: PortalSessionKind, userId: string): void {
  void releasePortalSession(kind, userId);
}

/** SessionId local de la sesión de portal, si este dispositivo la tiene. */
export function getStoredPortalSessionId(kind: PortalSessionKind, userId: string): string | null {
  try { return localStorage.getItem(storageKey(kind, userId)); } catch { return null; }
}

/**
 * Login de portal server-side (SA-BACKEND-03): el backend resuelve el código
 * de acceso y devuelve la identidad. Reemplaza el patrón anterior de
 * descargar el listado completo de usuarios para matchear el código en el
 * cliente — que exponía todos los datos personales sin autenticación.
 */
export type PortalLoginResult =
  | { kind: "athlete"; athleteId: string; profile: { id: string; fullName: string; email: string | null } }
  | { kind: "driver"; driverId: string; profile: { id: string; fullName: string; email: string | null } }
  | {
      kind: "staff";
      staffId: string;
      profile: { id: string; fullName: string; email: string | null; providerId: string; providerName: string };
    };

export async function portalLogin(code: string): Promise<PortalLoginResult> {
  return apiFetch<PortalLoginResult>("/m/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim() }),
  });
}

/**
 * Garantiza que este dispositivo tenga identidad de portal antes de pedir
 * datos protegidos (auto-login por id: deep links, sesión de la app). Si ya
 * hay identidad para ese usuario no hace nada.
 */
export async function ensurePortalIdentity(kind: PortalSessionKind, userId: string): Promise<boolean> {
  const current = getPortalIdentity();
  if (current && current.userId === userId) return true;
  const claim = await claimPortalSession(kind, userId);
  return !claim.activeElsewhere;
}
