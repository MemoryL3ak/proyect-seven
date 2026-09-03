import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/**
 * SA-BACKEND-04 · 1 — Buckets privados con URLs firmadas.
 *
 * Los buckets con datos personales pasan a privados. La referencia canónica
 * persistida en la base sigue siendo la URL en su forma pública
 * (`/storage/v1/object/public/<bucket>/<ruta>`), que al volverse privado el
 * bucket deja de ser accesible directamente. Este interceptor global
 * convierte, al momento de responder, toda URL de un bucket privado en una
 * URL firmada de vigencia limitada — venga del módulo que venga y a cualquier
 * profundidad del JSON. El control de acceso lo aporta el guard global: solo
 * una identidad autenticada recibe respuestas (y por tanto URLs firmadas).
 *
 * `venue-photos` (fotos de hoteles y recintos, sin datos personales) queda
 * público deliberadamente y no se firma.
 */
const PRIVATE_BUCKETS = new Set([
  'athlete-photos',
  'driver-photos',
  'driver-documents',
  'provider-documents',
  'event-documents',
  'athlete-health-docs',
]);

const PUBLIC_MARKER = '/storage/v1/object/public/';
// URLs ya firmadas que quedaron persistidas en la base (el token caduca): hay
// que reconocerlas para volver a firmarlas frescas al leer, si no la imagen
// deja de cargar cuando expira el token.
const SIGN_MARKER = '/storage/v1/object/sign/';
const SIGN_TTL_SECONDS = 3600; // vigencia de la URL firmada
const CACHE_REUSE_MS = 30 * 60 * 1000; // reutilizar firmas hasta 30 min
const MAX_DEPTH = 12;

type ParsedRef = { bucket: string; path: string };

function parsePrivateRef(value: string): ParsedRef | null {
  const marker = value.includes(PUBLIC_MARKER)
    ? PUBLIC_MARKER
    : value.includes(SIGN_MARKER)
      ? SIGN_MARKER
      : null;
  if (!marker) return null;
  const idx = value.indexOf(marker);
  const rest = value.slice(idx + marker.length).split('?')[0];
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!PRIVATE_BUCKETS.has(bucket) || !path) return null;
  return { bucket, path };
}

@Injectable()
export class SignedStorageUrlInterceptor implements NestInterceptor {
  private admin: SupabaseClient | null | undefined;
  private readonly cache = new Map<string, { url: string; at: number }>();

  constructor(private readonly configService: ConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((body) => this.sign(body)));
  }

  private getAdmin(): SupabaseClient | null {
    if (this.admin !== undefined) return this.admin;
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.admin = url && key ? createClient(url, key) : null;
    return this.admin;
  }

  private async sign(body: unknown): Promise<unknown> {
    // 1ª pasada: recolectar las URLs de buckets privados presentes.
    const found = new Map<string, ParsedRef>(); // url original → ref
    collect(body, found, 0);
    if (found.size === 0) return body;

    const admin = this.getAdmin();
    if (!admin) return body;

    // Firmar (con caché) por bucket, en lote.
    const now = Date.now();
    const replacements = new Map<string, string>();
    const pending = new Map<string, { original: string; path: string }[]>();
    for (const [original, ref] of found) {
      const cached = this.cache.get(original);
      if (cached && now - cached.at < CACHE_REUSE_MS) {
        replacements.set(original, cached.url);
        continue;
      }
      const list = pending.get(ref.bucket) ?? [];
      list.push({ original, path: ref.path });
      pending.set(ref.bucket, list);
    }

    for (const [bucket, items] of pending) {
      try {
        const { data, error } = await admin.storage
          .from(bucket)
          .createSignedUrls(items.map((item) => item.path), SIGN_TTL_SECONDS);
        if (error || !data) continue;
        data.forEach((entry, i) => {
          const signed = (entry as { signedUrl?: string; signedURL?: string }).signedUrl
            ?? (entry as { signedURL?: string }).signedURL;
          if (!signed || entry.error) return;
          const base = this.configService.get<string>('SUPABASE_URL') ?? '';
          const url = signed.startsWith('http') ? signed : `${base}/storage/v1${signed}`;
          replacements.set(items[i].original, url);
          this.cache.set(items[i].original, { url, at: now });
        });
      } catch {
        // Si la firma falla, la respuesta conserva la URL original.
      }
    }

    // Higiene de la caché (evitar crecimiento indefinido).
    if (this.cache.size > 5000) {
      for (const [key, entry] of this.cache) {
        if (now - entry.at >= CACHE_REUSE_MS) this.cache.delete(key);
      }
    }

    if (replacements.size === 0) return body;

    // 2ª pasada: reconstruir la respuesta con las URLs firmadas.
    return replace(body, replacements, 0);
  }
}

function collect(value: unknown, found: Map<string, ParsedRef>, depth: number): void {
  if (depth > MAX_DEPTH || value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (!found.has(value)) {
      const ref = parsePrivateRef(value);
      if (ref) found.set(value, ref);
    }
    return;
  }
  if (typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, found, depth + 1);
    return;
  }
  for (const inner of Object.values(value as Record<string, unknown>)) {
    collect(inner, found, depth + 1);
  }
}

function replace(
  value: unknown,
  replacements: Map<string, string>,
  depth: number,
): unknown {
  if (depth > MAX_DEPTH || value === null || value === undefined) return value;
  if (typeof value === 'string') return replacements.get(value) ?? value;
  if (typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    return value.map((item) => replace(item, replacements, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = replace(inner, replacements, depth + 1);
  }
  return out;
}
