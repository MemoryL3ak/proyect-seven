import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApiRequest } from './api-auth.guard';

/**
 * Alcance de datos de un usuario del panel. Hoy el único alcance es la
 * delegación: un Jefe de Misión ve sólo su región (flota, incidencias,
 * alimentación, calendario). Sin delegación en su metadata, ve todo.
 */
export type StaffScope = {
  userId: string;
  name: string | null;
  role: string | null;
  /** Delegación (región) a la que está acotado; null = sin restricción. */
  delegationId: string | null;
};

const CACHE_TTL_MS = 60_000;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Lee role/delegationId de user_metadata en Supabase Auth. El guard ya validó
 * el token y dejó el userId en req.apiCaller; acá sólo se resuelve el alcance,
 * con un caché corto para no llamar a Auth en cada request del monitoreo
 * (que refresca cada 8 s). AuthService.updateUser invalida la entrada.
 */
@Injectable()
export class StaffScopeService {
  private readonly cache = new Map<string, { at: number; scope: StaffScope }>();

  constructor(@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient) {}

  async forRequest(req: ApiRequest): Promise<StaffScope | null> {
    const caller = req.apiCaller;
    if (!caller || caller.type !== 'staff') return null;
    return this.forUser(caller.userId);
  }

  async forUser(userId: string): Promise<StaffScope | null> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.scope;
    try {
      const { data, error } = await this.supabase.auth.admin.getUserById(userId);
      if (error || !data?.user) return null;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const scope: StaffScope = {
        userId,
        name: asString(meta.name),
        role: asString(meta.role),
        delegationId: asString(meta.delegationId),
      };
      this.cache.set(userId, { at: Date.now(), scope });
      return scope;
    } catch {
      return null;
    }
  }

  /** Delegación a la que está acotado quien llama, o null si ve todo. */
  async delegationOf(req: ApiRequest): Promise<string | null> {
    return (await this.forRequest(req))?.delegationId ?? null;
  }

  invalidate(userId: string) {
    this.cache.delete(userId);
  }
}
