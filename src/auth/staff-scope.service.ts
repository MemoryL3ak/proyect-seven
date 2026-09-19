import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { ApiRequest } from './api-auth.guard';

/**
 * Quién es quien llama, para acotar datos operativos:
 *  - staff:        personal del panel; sin delegación en su metadata ve todo.
 *  - mission_head: Jefe de Misión = participante (core.athletes) marcado como
 *                  encargado de su delegación; entra por el portal con su
 *                  código y ve sólo su región (flota, incidencias,
 *                  alimentación, calendario).
 *  - participant:  cualquier otro participante del portal (sin alcance
 *                  operativo: no ve flota ni incidencias).
 *  - driver / provider_staff: sesiones de portal de conductor y de staff de
 *                  proveedor (control de acceso).
 */
export type ScopeKind = 'staff' | 'mission_head' | 'participant' | 'driver' | 'provider_staff';

export type StaffScope = {
  kind: ScopeKind;
  userId: string;
  name: string | null;
  role: string | null;
  /** Delegación (región) a la que está acotado; null = sin restricción. */
  delegationId: string | null;
  /** Nombre visible de esa delegación ("Región de Ñuble"). */
  delegationName: string | null;
};

export const MISSION_HEAD_ROLE = 'Jefe de Misión';

/** Alcance con el que SofIA responde: null = panel, delegación = Jefe de Misión. */
export type SofiaCallerScope = { delegationId: string; delegationName: string | null } | null;

/** Tipo de cliente que identifica al Jefe de Misión de una delegación. */
export const MISSION_HEAD_CLIENT_TYPE = 'JEFE_MISION';

const CACHE_TTL_MS = 60_000;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

type DelegationNameRow = { name: string | null; country_code: string | null };

type AthleteScopeRow = {
  id: string;
  full_name: string | null;
  delegation_id: string | null;
  is_delegation_lead: boolean | null;
  user_type: string | null;
};

/**
 * Resuelve el alcance del llamador a partir de req.apiCaller (que el guard ya
 * validó). Para el panel lee role/delegationId de user_metadata en Supabase
 * Auth; para el portal de participantes lee core.athletes. Caché corto para
 * no repetir la consulta en cada request del monitoreo (refresca cada 8 s);
 * AuthService.updateUser y AthletesService invalidan la entrada.
 */
@Injectable()
export class StaffScopeService {
  private readonly cache = new Map<string, { at: number; scope: StaffScope }>();

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly dataSource: DataSource,
  ) {}

  async forRequest(req: ApiRequest): Promise<StaffScope | null> {
    const caller = req.apiCaller;
    if (!caller) return null;
    if (caller.type === 'staff') return this.forUser(caller.userId);
    if (caller.kind === 'athlete') return this.forAthlete(caller.userId);
    return {
      kind: caller.kind === 'driver' ? 'driver' : 'provider_staff',
      userId: caller.userId,
      name: null,
      role: null,
      delegationId: null,
      delegationName: null,
    };
  }

  /** Nombre visible de una delegación, para saludar y para el prompt de SofIA. */
  private async delegationNameOf(delegationId: string | null): Promise<string | null> {
    if (!delegationId) return null;
    try {
      const rows = await this.dataSource.query<DelegationNameRow[]>(
        `select metadata->>'name' as name, country_code from core.delegations where id = $1`,
        [delegationId],
      );
      return asString(rows[0]?.name) ?? asString(rows[0]?.country_code);
    } catch {
      return null;
    }
  }

  /** Usuario del panel (Supabase Auth). */
  async forUser(userId: string): Promise<StaffScope | null> {
    const key = `staff:${userId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.scope;
    try {
      const { data, error } = await this.supabase.auth.admin.getUserById(userId);
      if (error || !data?.user) return null;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const delegationId = asString(meta.delegationId);
      const scope: StaffScope = {
        kind: 'staff',
        userId,
        name: asString(meta.name),
        role: asString(meta.role),
        delegationId,
        delegationName: asString(meta.delegationLabel) ?? (await this.delegationNameOf(delegationId)),
      };
      this.cache.set(key, { at: Date.now(), scope });
      return scope;
    } catch {
      return null;
    }
  }

  /** Participante del portal: Jefe de Misión si es el encargado de su delegación. */
  async forAthlete(athleteId: string): Promise<StaffScope | null> {
    const key = `athlete:${athleteId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.scope;
    try {
      const rows = await this.dataSource.query<AthleteScopeRow[]>(
        `select id, full_name, delegation_id, is_delegation_lead, user_type
         from core.athletes
         where id = $1 and status is distinct from 'DELETED'`,
        [athleteId],
      );
      const row = rows[0];
      if (!row) return null;
      // Sin delegación no hay alcance posible: se trata como participante
      // común (si no, vería la operación completa).
      const isHead =
        (row.is_delegation_lead === true ||
          String(row.user_type ?? '').trim().toUpperCase() === MISSION_HEAD_CLIENT_TYPE) &&
        Boolean(row.delegation_id);
      const scope: StaffScope = {
        kind: isHead ? 'mission_head' : 'participant',
        userId: row.id,
        name: asString(row.full_name),
        role: isHead ? MISSION_HEAD_ROLE : 'Participante',
        delegationId: isHead ? row.delegation_id : null,
        delegationName: isHead ? await this.delegationNameOf(row.delegation_id) : null,
      };
      this.cache.set(key, { at: Date.now(), scope });
      return scope;
    } catch {
      return null;
    }
  }

  /** Delegación a la que está acotado quien llama, o null si ve todo. */
  async delegationOf(req: ApiRequest): Promise<string | null> {
    return (await this.forRequest(req))?.delegationId ?? null;
  }

  /**
   * Endpoints operativos (flota, posiciones, incidencias): sólo el panel o un
   * Jefe de Misión. Un participante común, un conductor o staff de proveedor
   * recibe 403 aunque tenga sesión válida.
   */
  async requireOperator(req: ApiRequest): Promise<StaffScope> {
    const scope = await this.forRequest(req);
    if (!scope || (scope.kind !== 'staff' && scope.kind !== 'mission_head')) {
      throw new ForbiddenException('Requiere sesión del panel o de Jefe de Misión');
    }
    return scope;
  }

  invalidate(userId: string) {
    this.cache.delete(`staff:${userId}`);
    this.cache.delete(`athlete:${userId}`);
  }
}
