/**
 * Ruta realizada de un viaje cerrado, ajustada a calles.
 *
 * El detalle unía con una recta cada par de fijos GPS guardados. Cuando el
 * teléfono manda un fijo cada pocos segundos eso se ve como una calle; cuando
 * deja de mandar por minutos (pantalla apagada, app en segundo plano, sin
 * señal) el siguiente fijo cae a kilómetros y la recta cruza cerros y mar.
 * Los fijos siguen siendo los mismos: acá se dibuja, entre uno y otro, el
 * camino por calles que los une.
 */
import {
  haversineMeters,
  loadGoogleMaps,
  snapToRoads,
  type LatLng,
} from "./google-maps";

/** Con fijos más separados que esto, Snap to Roads ya no rellena bien: se pide una ruta por calles. */
export const SALTO_DISPERSO_M = 200;
/** Directions acepta 25 puntos por ruta (origen, destino y 23 intermedios). */
export const MAX_PUNTOS_DIRECTIONS = 25;
/** Snap to Roads acepta 100 puntos por llamada. */
export const MAX_PUNTOS_SNAP = 100;

const CACHE_KEY = "seven.ruta-realizada.v1";

export type TramoTrazado = {
  path: LatLng[];
  metros: number;
  /** false cuando ninguna API respondió y se dibujan los fijos tal cual. */
  ajustado: boolean;
};

/** Mayor distancia entre dos fijos consecutivos, en metros. */
export function saltoMaximo(pts: LatLng[]): number {
  let max = 0;
  for (let i = 1; i < pts.length; i++) max = Math.max(max, haversineMeters(pts[i - 1], pts[i]));
  return max;
}

export function esTramoDisperso(pts: LatLng[]): boolean {
  return saltoMaximo(pts) > SALTO_DISPERSO_M;
}

/** Largo de un trazado sumando sus tramos rectos, en metros. */
export function metrosDeTrazado(path: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += haversineMeters(path[i - 1], path[i]);
  return m;
}

/**
 * Hasta `max` puntos repartidos parejo a lo largo del tramo, conservando el
 * primero y el último. Con menos puntos que `max` devuelve el tramo entero.
 */
export function puntosDeReferencia<T>(pts: T[], max: number): T[] {
  if (max < 2) throw new Error("max debe ser al menos 2");
  if (pts.length <= max) return pts;
  const out: T[] = [];
  const paso = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * paso)]);
  return out;
}

/** Ventanas de a `tamano` puntos que comparten el punto de unión, para pedir Snap to Roads por partes. */
export function ventanas<T>(pts: T[], tamano: number): T[][] {
  if (tamano < 2) throw new Error("tamano debe ser al menos 2");
  if (pts.length <= tamano) return [pts];
  const out: T[][] = [];
  for (let i = 0; i < pts.length - 1; i += tamano - 1) out.push(pts.slice(i, i + tamano));
  return out;
}

function leerCache(): Record<string, TramoTrazado> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TramoTrazado>) : {};
  } catch {
    return {};
  }
}

function guardarCache(cache: Record<string, TramoTrazado>) {
  try {
    // Sin límite crecería sin fin: se guardan los últimos 60 tramos.
    const claves = Object.keys(cache);
    if (claves.length > 60) claves.slice(0, claves.length - 60).forEach((k) => delete cache[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sin almacenamiento se vuelve a pedir la próxima vez
  }
}

async function rutaDirections(pts: LatLng[]): Promise<TramoTrazado | null> {
  await loadGoogleMaps();
  const google = (window as any).google;
  if (!google?.maps?.DirectionsService) return null;
  const ref = puntosDeReferencia(pts, MAX_PUNTOS_DIRECTIONS);
  const service = new google.maps.DirectionsService();
  return new Promise((resolve) => {
    service.route(
      {
        origin: ref[0],
        destination: ref[ref.length - 1],
        waypoints: ref.slice(1, -1).map((p) => ({ location: p, stopover: false })),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response: any, status: string) => {
        const route = status === "OK" ? response?.routes?.[0] : null;
        if (!route?.overview_path?.length) {
          resolve(null);
          return;
        }
        const path: LatLng[] = route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
        const metros = (route.legs || []).reduce((s: number, l: any) => s + (l.distance?.value ?? 0), 0);
        resolve({ path, metros: metros || metrosDeTrazado(path), ajustado: true });
      },
    );
  });
}

async function rutaSnap(pts: LatLng[]): Promise<TramoTrazado | null> {
  const path: LatLng[] = [];
  for (const ventana of ventanas(pts, MAX_PUNTOS_SNAP)) {
    const snapped = await snapToRoads(ventana);
    if (!snapped || snapped.length < 2) return null;
    path.push(...(path.length ? snapped.slice(1) : snapped));
  }
  return { path, metros: metrosDeTrazado(path), ajustado: true };
}

/**
 * Trazado por calles de un tramo de fijos consecutivos. Fijos seguidos van a
 * Snap to Roads (respeta la calle exacta); fijos dispersos, a Directions con
 * los fijos como puntos de paso. Si nada responde, quedan los fijos tal cual.
 * `clave` identifica el tramo para no volver a pagar la llamada al reabrir.
 */
export async function trazarPorCalles(pts: LatLng[], clave?: string): Promise<TramoTrazado> {
  const crudo: TramoTrazado = { path: pts, metros: metrosDeTrazado(pts), ajustado: false };
  if (pts.length < 2) return crudo;
  const cache = clave ? leerCache() : {};
  if (clave && cache[clave]?.path?.length >= 2) return cache[clave];
  let trazado: TramoTrazado | null = null;
  try {
    trazado = esTramoDisperso(pts) ? await rutaDirections(pts) : await rutaSnap(pts);
    if (!trazado && !esTramoDisperso(pts)) trazado = await rutaDirections(pts);
  } catch {
    trazado = null;
  }
  if (!trazado) return crudo;
  if (clave) {
    cache[clave] = trazado;
    guardarCache(cache);
  }
  return trazado;
}
