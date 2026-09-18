import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { StaffScope } from '../auth/staff-scope.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

export type IncidentRow = {
  id: string;
  event_id: string | null;
  delegation_id: string | null;
  delegation_name: string | null;
  venue_id: string | null;
  venue_name: string | null;
  trip_id: string | null;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  reported_by_id: string | null;
  reported_by_name: string | null;
  reported_by_role: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentFilters = {
  eventId?: string;
  delegationId?: string;
  status?: string;
};

const SELECT = `
  select i.*,
         dl.metadata->>'name' as delegation_name,
         v.name as venue_name
  from core.incidents i
  left join core.delegations dl on dl.id = i.delegation_id
  left join logistics.venues v on v.id = i.venue_id`;

/**
 * Incidencias del evento. Un Jefe de Misión (scope con delegationId) ve y
 * reporta sólo las de su delegación; operaciones ve todas y es quien cierra.
 */
@Injectable()
export class IncidentsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(filters: IncidentFilters, scope: StaffScope | null) {
    const delegationId = scope?.delegationId ?? filters.delegationId ?? null;
    const rows = await this.dataSource.query<IncidentRow[]>(
      `${SELECT}
       where ($1::uuid is null or i.event_id = $1)
         and ($2::uuid is null or i.delegation_id = $2)
         and ($3::text is null or i.status = $3)
       order by (i.status in ('ABIERTA','EN_CURSO')) desc, i.created_at desc
       limit 500`,
      [filters.eventId ?? null, delegationId, filters.status ?? null],
    );
    return rows.map(toEntity);
  }

  async findOne(id: string, scope: StaffScope | null) {
    const rows = await this.dataSource.query<IncidentRow[]>(`${SELECT} where i.id = $1`, [id]);
    const row = rows[0];
    if (!row) throw new NotFoundException('Incidencia no encontrada');
    if (scope?.delegationId && row.delegation_id !== scope.delegationId) {
      throw new ForbiddenException('La incidencia pertenece a otra delegación');
    }
    return toEntity(row);
  }

  async create(dto: CreateIncidentDto, scope: StaffScope | null) {
    // El evento vigente es el más reciente si el formulario no lo manda.
    const eventId =
      dto.eventId ??
      (
        await this.dataSource.query<Array<{ id: string }>>(
          `select id from core.events order by created_at desc limit 1`,
        )
      )[0]?.id ??
      null;
    const delegationId = scope?.delegationId ?? dto.delegationId ?? null;
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `insert into core.incidents
         (event_id, delegation_id, venue_id, trip_id, category, severity, title, description,
          reported_by_id, reported_by_name, reported_by_role)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        eventId,
        delegationId,
        dto.venueId ?? null,
        dto.tripId ?? null,
        dto.category ?? 'OTRO',
        dto.severity ?? 'MEDIA',
        dto.title.trim(),
        dto.description?.trim() || null,
        scope?.userId ?? null,
        scope?.name ?? null,
        scope?.role ?? null,
      ],
    );
    return this.findOne(rows[0].id, scope);
  }

  async update(id: string, dto: UpdateIncidentDto, scope: StaffScope | null) {
    await this.findOne(id, scope); // 404 / 403 según corresponda
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (dto.title !== undefined) set('title', dto.title.trim());
    if (dto.description !== undefined) set('description', dto.description?.trim() || null);
    if (dto.category !== undefined) set('category', dto.category);
    if (dto.severity !== undefined) set('severity', dto.severity);
    if (dto.venueId !== undefined) set('venue_id', dto.venueId || null);
    if (dto.tripId !== undefined) set('trip_id', dto.tripId || null);
    // La delegación sólo la cambia operaciones; el Jefe de Misión queda en la suya.
    if (dto.delegationId !== undefined && !scope?.delegationId) {
      set('delegation_id', dto.delegationId || null);
    }
    if (dto.resolution !== undefined) set('resolution', dto.resolution?.trim() || null);
    if (dto.status !== undefined) {
      set('status', dto.status);
      const closed = dto.status === 'RESUELTA' || dto.status === 'CERRADA';
      sets.push(closed ? 'resolved_at = coalesce(resolved_at, now())' : 'resolved_at = null');
    }
    if (sets.length > 0) {
      params.push(id);
      await this.dataSource.query(
        `update core.incidents set ${sets.join(', ')}, updated_at = now() where id = $${params.length}`,
        params,
      );
    }
    return this.findOne(id, scope);
  }

  async remove(id: string, scope: StaffScope | null) {
    // Borrar es de operaciones; el Jefe de Misión cierra, no elimina.
    if (scope?.delegationId) {
      throw new ForbiddenException('Sólo operaciones puede eliminar incidencias');
    }
    const incident = await this.findOne(id, scope);
    await this.dataSource.query(`delete from core.incidents where id = $1`, [id]);
    return incident;
  }
}

function toEntity(r: IncidentRow) {
  return {
    id: r.id,
    eventId: r.event_id,
    delegationId: r.delegation_id,
    delegationName: r.delegation_name,
    venueId: r.venue_id,
    venueName: r.venue_name,
    tripId: r.trip_id,
    category: r.category,
    severity: r.severity,
    status: r.status,
    title: r.title,
    description: r.description,
    reportedById: r.reported_by_id,
    reportedByName: r.reported_by_name,
    reportedByRole: r.reported_by_role,
    resolution: r.resolution,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
