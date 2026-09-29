import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiRequest } from './api-auth.guard';
import { CAMPOS_DE_COBRO, ocultaCobros } from './permisos-panel';

/**
 * SA-BACKEND-03 · 5.3.2 — ninguna credencial de sesión sale en una
 * respuesta. `portalSessionId` es la credencial activa de un usuario de
 * portal (viaja en x-portal-session): exponerla en listados permitiría la
 * suplantación de cualquier participante. Se elimina recursivamente de toda
 * respuesta JSON, venga del módulo que venga.
 */
const STRIP_KEYS = new Set(['portalSessionId', 'portalSessionAt']);
/** Además, el valor de los viajes para quien no ve cobros (permisos-panel). */
const STRIP_KEYS_SIN_COBROS = new Set([...STRIP_KEYS, ...CAMPOS_DE_COBRO]);

export function strip(value: unknown, depth = 0, claves: Set<string> = STRIP_KEYS): unknown {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => strip(item, depth + 1, claves));
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (claves.has(key)) continue;
    out[key] = strip(inner, depth + 1, claves);
  }
  return out;
}

@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ApiRequest | undefined>();
    const claves = ocultaCobros(req?.apiCaller) ? STRIP_KEYS_SIN_COBROS : STRIP_KEYS;
    return next.handle().pipe(map((body) => strip(body, 0, claves)));
  }
}
