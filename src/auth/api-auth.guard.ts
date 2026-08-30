import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { MobileAuthService } from '../mobile-auth/mobile-auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { STAFF_ONLY_KEY } from './staff-only.decorator';

/**
 * Quién llama a la API (SA-BACKEND-03 · 5.3.1):
 *  - staff:  personal del panel de administración (sesión Supabase Auth).
 *  - portal: usuario de portal con sesión única activa — atleta, conductor o
 *            staff de proveedor (control de acceso) — identificado por los
 *            headers x-portal-kind / x-portal-user / x-portal-session.
 */
export type ApiCaller =
  | { type: 'staff'; userId: string }
  | { type: 'portal'; kind: 'athlete' | 'driver' | 'staff'; userId: string };

export type ApiRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  apiCaller?: ApiCaller | null;
};

export const isStaffCaller = (caller: ApiCaller | null | undefined) =>
  caller?.type === 'staff';

export const isSelfCaller = (
  caller: ApiCaller | null | undefined,
  userId: string,
) => caller?.type === 'portal' && caller.userId === userId;

const headerValue = (
  headers: ApiRequest['headers'],
  name: string,
): string => {
  const raw = headers[name];
  return String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim();
};

/**
 * Control de acceso GLOBAL (APP_GUARD): todo endpoint exige autenticación
 * salvo los marcados explícitamente con @Public(). Los servicios nuevos
 * quedan protegidos por omisión. @StaffOnly() restringe además al panel.
 */
@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly dataSource: DataSource,
    private readonly mobileAuth: MobileAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const req = context.switchToHttp().getRequest<ApiRequest>();

    // Preflight CORS nunca lleva credenciales.
    if (req.method === 'OPTIONS') return true;

    const caller = await this.identify(req);
    req.apiCaller = caller;

    if (isPublic) return true;
    if (!caller) {
      throw new UnauthorizedException('Autenticación requerida');
    }

    const staffOnly = this.reflector.getAllAndOverride<boolean>(STAFF_ONLY_KEY, targets);
    if (staffOnly && caller.type !== 'staff') {
      throw new ForbiddenException('Requiere sesión del panel de administración');
    }
    return true;
  }

  async identify(req: ApiRequest): Promise<ApiCaller | null> {
    // 1. Sesión Supabase Auth (panel). Las cuentas Supabase vinculadas a
    //    conductores (drivers.user_id) NO son staff: se mapean a su identidad
    //    de conductor de portal.
    const authHeader = headerValue(req.headers, 'authorization');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (!error && data?.user) {
            const rows = (await this.dataSource.query(
              `SELECT id FROM transport.drivers WHERE user_id = $1 LIMIT 1`,
              [data.user.id],
            )) as Array<{ id: string }>;
            if (rows.length > 0) {
              return { type: 'portal', kind: 'driver', userId: rows[0].id };
            }
            return { type: 'staff', userId: data.user.id };
          }
        } catch {
          // token ilegible o no Supabase (p. ej. token de socio): se sigue
        }
      }
    }

    // 2. Sesión única de portal.
    const kind = headerValue(req.headers, 'x-portal-kind');
    const userId = headerValue(req.headers, 'x-portal-user');
    const sessionId = headerValue(req.headers, 'x-portal-session');
    if (
      (kind === 'athlete' || kind === 'driver' || kind === 'staff') &&
      userId &&
      sessionId
    ) {
      const valid = await this.mobileAuth.validateSessionStrict(kind, userId, sessionId);
      if (valid) return { type: 'portal', kind, userId };
    }

    return null;
  }
}
