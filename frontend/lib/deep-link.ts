/**
 * Deep links de las notificaciones (02-10-2026): a dónde lleva una
 * notificación y cómo se entrega ese destino a la pantalla.
 *
 * Había tres caminos y ninguno llegaba siempre:
 *  - El toque de una push con la app abierta en el portal hacía router.push
 *    a la misma página con ?tripId=; el portal leía el parámetro sólo una
 *    vez, al cargar el perfil, así que no pasaba nada.
 *  - Con la app cerrada, el shell emite el toque 1,5 s después de arrancar,
 *    cuando el WebView todavía está en /m/login: nadie escuchaba y se perdía.
 *  - La campana recargaba la página entera.
 *
 * Ahora el destino se guarda como pendiente (sobrevive a la redirección de
 * /m/login al portal) y, si ya se está en la página, se emite como evento
 * que la pantalla atiende en el acto (use-deep-link.ts).
 */
export type DestinoNotificacion = {
  url: string | null;
  tripId: string | null;
  premiacionId: string | null;
};

export const EVENTO_DEEP_LINK = "seven:deep-link";
export const CLAVE_PENDIENTE = "seven_deep_link_pendiente";
/** Un destino guardado hace más de esto ya no se aplica. */
export const VIGENCIA_PENDIENTE_MS = 10 * 60 * 1000;

type Almacen = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Destino a partir del `data` de una notificación (push o bandeja). Sólo rutas internas. */
export function destinoDeNotificacion(data: unknown): DestinoNotificacion {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const url = texto(d.url);
  return {
    url: url && url.startsWith("/") && !url.startsWith("//") ? url : null,
    tripId: texto(d.tripId),
    premiacionId: texto(d.premiacionId),
  };
}

/** Ruta sin query ni hash, sin barra final. */
export function rutaDe(url: string | null | undefined): string {
  const sin = String(url ?? "").split(/[?#]/)[0];
  return sin.length > 1 ? sin.replace(/\/+$/, "") : sin;
}

export function esMismaPagina(url: string | null | undefined, pathname: string): boolean {
  const r = rutaDe(url);
  return !!r && r === rutaDe(pathname);
}

export function hayDestino(d: DestinoNotificacion): boolean {
  return !!(d.tripId || d.premiacionId || d.url);
}

/** URL para navegar: la ruta con el contexto como query (el portal la limpia al leerla). */
export function urlDeDestino(d: DestinoNotificacion): string | null {
  if (!d.url) return null;
  const partes: string[] = [];
  if (d.tripId) partes.push(`tripId=${encodeURIComponent(d.tripId)}`);
  if (d.premiacionId) partes.push(`premiacionId=${encodeURIComponent(d.premiacionId)}`);
  if (partes.length === 0) return d.url;
  return `${d.url}${d.url.includes("?") ? "&" : "?"}${partes.join("&")}`;
}

const almacen = (): Almacen | null => {
  try {
    return typeof window !== "undefined" && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function guardarDeepLinkPendiente(d: DestinoNotificacion, storage: Almacen | null = almacen(), ahora = Date.now()): void {
  if (!storage || !hayDestino(d)) return;
  try {
    storage.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...d, en: ahora }));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Destino pendiente para esta página, si lo hay: se devuelve y se borra. Un
 * destino de otra página se deja para ella; uno vencido se descarta.
 */
export function tomarDeepLinkPendiente(pathname: string, storage: Almacen | null = almacen(), ahora = Date.now()): DestinoNotificacion | null {
  if (!storage) return null;
  let crudo: string | null = null;
  try {
    crudo = storage.getItem(CLAVE_PENDIENTE);
  } catch {
    return null;
  }
  if (!crudo) return null;
  let guardado: (DestinoNotificacion & { en?: number }) | null = null;
  try {
    guardado = JSON.parse(crudo);
  } catch {
    storage.removeItem(CLAVE_PENDIENTE);
    return null;
  }
  if (!guardado) return null;
  if (typeof guardado.en === "number" && ahora - guardado.en > VIGENCIA_PENDIENTE_MS) {
    storage.removeItem(CLAVE_PENDIENTE);
    return null;
  }
  if (guardado.url && !esMismaPagina(guardado.url, pathname)) return null;
  storage.removeItem(CLAVE_PENDIENTE);
  return destinoDeNotificacion(guardado);
}

/** Destino que viene en la URL (?tripId=&premiacionId=), o null. */
export function deepLinkDeLaUrl(search: string): DestinoNotificacion | null {
  const params = new URLSearchParams(search || "");
  const d = { url: null, tripId: texto(params.get("tripId")), premiacionId: texto(params.get("premiacionId")) };
  return d.tripId || d.premiacionId ? d : null;
}

/** Quita tripId y premiacionId de la barra de direcciones sin recargar. */
export function limpiarUrlDeDeepLink(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("tripId");
    url.searchParams.delete("premiacionId");
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* nada */
  }
}

export function emitirDeepLink(d: DestinoNotificacion): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_DEEP_LINK, { detail: d }));
}

/**
 * Lleva al destino: si ya se está en su página, lo emite y la pantalla lo
 * atiende sin recargar; si no, lo deja pendiente y navega. Devuelve qué hizo.
 */
export function abrirDeepLink(
  d: DestinoNotificacion,
  navegar: (url: string) => void,
  pathname: string,
  storage: Almacen | null = almacen(),
): "emitido" | "navegado" | "nada" {
  if (!hayDestino(d)) return "nada";
  if (!d.url || esMismaPagina(d.url, pathname)) {
    if (!d.tripId && !d.premiacionId) return "nada";
    emitirDeepLink(d);
    return "emitido";
  }
  guardarDeepLinkPendiente(d, storage);
  navegar(urlDeDestino(d) ?? d.url);
  return "navegado";
}
