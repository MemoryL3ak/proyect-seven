/**
 * Persistencia del tab/submódulo activo de los portales, SOLO para refresh.
 *
 * Regla de negocio: al iniciar sesión o abrir el portal normalmente, el home
 * es siempre el tab por defecto (Solicitud / Itinerario / Actividades). Pero
 * al ACTUALIZAR la página (F5 / pull-to-refresh / botón recargar de la app),
 * el usuario debe quedar en el mismo submódulo donde estaba.
 *
 * No se puede confiar en performance.navigation.type === "reload": el WebView
 * de la app nativa recarga la URL como una navegación normal y ese flag nunca
 * se cumple. En su lugar, mientras el portal está abierto se emite un
 * "heartbeat" (timestamp en localStorage cada pocos segundos). Al cargar la
 * página, si el portal estaba vivo hace menos de FRESH_MS, la carga es un
 * refresh y se restaura el tab guardado; si no (login, apertura fría de la
 * app), se usa el tab por defecto.
 */

const ALIVE_KEY = "portal_tab_alive_at";
const HEARTBEAT_MS = 10_000;
const FRESH_MS = 60_000;

const TAB_KEYS = [
  "portal_vr_tab",
  "portal_vr_subtab",
  "portal_user_tab",
  "portal_conductor_tab",
];

function beat(): void {
  try {
    localStorage.setItem(ALIVE_KEY, String(Date.now()));
  } catch {}
}

/** true si el portal estaba abierto hace menos de FRESH_MS ⇒ esta carga es un refresh. */
export function isPortalRefresh(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(localStorage.getItem(ALIVE_KEY) || 0);
    return at > 0 && Date.now() - at < FRESH_MS;
  } catch {
    return false;
  }
}

/** Devuelve el valor guardado sólo si la carga actual es un refresh del portal. */
export function restoreOnReload<T extends string>(
  key: string,
  valid: readonly T[],
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  if (!isPortalRefresh()) return fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved && (valid as readonly string[]).includes(saved)) return saved as T;
  } catch {}
  return fallback;
}

export function persistTab(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
  beat();
}

/**
 * Mantiene vivo el heartbeat mientras el portal está montado. Llamar dentro
 * de un useEffect y devolver el cleanup. También late al volver a primer
 * plano (los timers del WebView se pausan en background).
 */
export function startTabHeartbeat(): () => void {
  if (typeof window === "undefined") return () => {};
  beat();
  const interval = setInterval(beat, HEARTBEAT_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") beat();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pagehide", beat);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("pagehide", beat);
  };
}

/** Borra el estado persistido; usar al iniciar o cerrar sesión (home limpio). */
export function clearPersistedTabs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ALIVE_KEY);
    for (const key of TAB_KEYS) localStorage.removeItem(key);
  } catch {}
}
