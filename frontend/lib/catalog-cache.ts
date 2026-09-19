/**
 * Caché local de los catálogos del evento (sedes, hoteles, disciplinas,
 * lugares de comida y menús).
 *
 * Son listas que casi no cambian y que el portal pedía enteras en cada
 * apertura: cinco de las diez peticiones del arranque. Ahora la pantalla se
 * pinta con lo último que se vio y la respuesta fresca lo reemplaza cuando
 * llega. Si el teléfono no deja escribir (modo privado), todo sigue igual,
 * sólo sin caché.
 */
const PREFIJO = "seven.catalogo.";
/** Más allá de esto no se usa lo guardado: se espera la respuesta del servidor. */
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

type Entrada<T> = { at: number; data: T };

export function leerCatalogo<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const entrada = JSON.parse(crudo) as Entrada<T>;
    if (!entrada || typeof entrada.at !== "number") return null;
    if (Date.now() - entrada.at > VIGENCIA_MS) return null;
    return entrada.data;
  } catch {
    return null;
  }
}

export function guardarCatalogo<T>(clave: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIJO + clave, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Sin espacio o sin permiso: la app funciona igual, sólo sin caché.
  }
}

/**
 * Devuelve lo guardado (si hay) y, en paralelo, pide la versión fresca.
 * `alLlegar` se llama sólo cuando la respuesta del servidor es válida.
 */
export async function catalogoConCache<T>(
  clave: string,
  pedir: () => Promise<T>,
  alLlegar: (data: T) => void,
): Promise<void> {
  const enCache = leerCatalogo<T>(clave);
  if (enCache !== null) alLlegar(enCache);
  try {
    const fresco = await pedir();
    if (fresco === null || fresco === undefined) return;
    guardarCatalogo(clave, fresco);
    alLlegar(fresco);
  } catch {
    // Se queda con lo de la caché.
  }
}
