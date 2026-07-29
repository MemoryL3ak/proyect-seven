/**
 * Persistencia del tab/submódulo activo de los portales, SOLO para refresh.
 *
 * Regla de negocio: al iniciar sesión o abrir el portal normalmente, el home
 * es siempre el tab por defecto (Solicitud / Itinerario / Actividades). Pero
 * al ACTUALIZAR la página (F5 / pull-to-refresh), el usuario debe quedar en
 * el mismo submódulo donde estaba. La distinción se hace con el tipo de
 * navegación del browser: sólo se restaura cuando fue un "reload".
 */

export function isReloadNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

/** Devuelve el valor guardado sólo si la carga actual es un reload. */
export function restoreOnReload<T extends string>(
  key: string,
  valid: readonly T[],
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  if (!isReloadNavigation()) return fallback;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && (valid as readonly string[]).includes(saved)) return saved as T;
  } catch {}
  return fallback;
}

export function persistTab(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}
