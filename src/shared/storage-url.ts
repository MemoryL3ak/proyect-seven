/**
 * Normaliza URLs de Storage antes de PERSISTIRLAS: convierte una URL firmada
 * (`/object/sign/<bucket>/<path>?token=...`) de vuelta a su forma pública
 * canónica (`/object/public/<bucket>/<path>`). El token de una URL firmada
 * caduca (~1 h); si el frontend reenvía una URL firmada al guardar (porque el
 * interceptor la firmó en la respuesta previa), sin esto la base quedaría con
 * un token muerto. La referencia canónica en la base es siempre la pública; el
 * SignedStorageUrlInterceptor firma al leer.
 */
const SIGN_MARKER = '/storage/v1/object/sign/';
const PUBLIC_PREFIX = '/storage/v1/object/public/';

export function normalizeStorageUrl<T>(value: T): T {
  if (typeof value !== 'string') return value;
  const idx = value.indexOf(SIGN_MARKER);
  if (idx < 0) return value;
  const origin = value.slice(0, idx);
  const rest = value.slice(idx + SIGN_MARKER.length).split('?')[0];
  return `${origin}${PUBLIC_PREFIX}${rest}` as unknown as T;
}

/** Aplica normalizeStorageUrl recursivamente a un objeto de metadata. */
export function normalizeStorageUrlsDeep(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || value === undefined) return value;
  if (typeof value === 'string') return normalizeStorageUrl(value);
  if (typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeStorageUrlsDeep(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = normalizeStorageUrlsDeep(inner, depth + 1);
  }
  return out;
}
