import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * SA-BACKEND-03 · 5.3.2 — ninguna credencial de sesión sale en una
 * respuesta. `portalSessionId` es la credencial activa de un usuario de
 * portal (viaja en x-portal-session): exponerla en listados permitiría la
 * suplantación de cualquier participante. Se elimina recursivamente de toda
 * respuesta JSON, venga del módulo que venga.
 */
const STRIP_KEYS = new Set(['portalSessionId', 'portalSessionAt']);

function strip(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => strip(item, depth + 1));
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (STRIP_KEYS.has(key)) continue;
    out[key] = strip(inner, depth + 1);
  }
  return out;
}

@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => strip(body)));
  }
}
