/**
 * `fetch` con reintento para el cliente de Supabase del API.
 *
 * El API corre en Houston y Supabase en Virginia; de vez en cuando una
 * conexión entre ambos se cae y la librería devuelve "TypeError: fetch
 * failed". Muchos servicios pasan ese texto tal cual al teléfono (el
 * conductor lo vio al entrar al portal el 23-09-2026). Una lectura se puede
 * repetir sin riesgo: se reintenta un par de veces con una espera corta.
 * Una escritura no: si la petición llegó y sólo se perdió la respuesta,
 * repetirla duplicaría el dato.
 */
export const REINTENTOS_LECTURA = 2;
export const ESPERAS_MS: readonly number[] = [150, 400];
const METODOS_REPETIBLES = new Set(['GET', 'HEAD', 'OPTIONS']);

type Fetch = typeof globalThis.fetch;

/** Un fallo de red (no una respuesta HTTP): la petición no llegó o se cortó. */
export function esFalloDeRed(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; message?: unknown };
  const nombre = typeof e.name === 'string' ? e.name : '';
  const mensaje = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return (
    nombre === 'TypeError' ||
    mensaje.includes('fetch failed') ||
    mensaje.includes('econnreset') ||
    mensaje.includes('socket hang up')
  );
}

function metodoDe(input: Parameters<Fetch>[0], init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && input !== null && 'method' in input) {
    return String((input as { method?: string }).method ?? 'GET').toUpperCase();
  }
  return 'GET';
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Envuelve un `fetch`: las lecturas (GET/HEAD/OPTIONS) que fallan por red se
 * repiten hasta `REINTENTOS_LECTURA` veces; lo demás se propaga tal cual.
 */
export function fetchConReintento(
  base: Fetch,
  esperas: readonly number[] = ESPERAS_MS,
): Fetch {
  return async function fetchReintentando(input, init) {
    const repetible = METODOS_REPETIBLES.has(metodoDe(input, init));
    let intento = 0;
    for (;;) {
      try {
        return await base(input, init);
      } catch (err) {
        if (!repetible || !esFalloDeRed(err) || intento >= REINTENTOS_LECTURA)
          throw err;
        await esperar(esperas[Math.min(intento, esperas.length - 1)] ?? 0);
        intento += 1;
      }
    }
  } as Fetch;
}
