import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { DataSource, Repository } from 'typeorm';
import { StaffScopeService } from '../auth/staff-scope.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { Delegation } from './entities/delegation.entity';

type DelegationRow = {
  id: string;
  event_id: string;
  country_code: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DelegationDisciplineRow = {
  delegation_id: string;
  discipline_id: string;
};

type DisciplineRow = {
  id: string;
  name: string;
};

@Injectable()
export class DelegationsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(Delegation)
    private readonly delegationRepository: Repository<Delegation>,
    private readonly dataSource: DataSource,
    private readonly scope: StaffScopeService,
  ) {}

  private toRow(dto: CreateDelegationDto | UpdateDelegationDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.countryCode !== undefined) {
      row.country_code = dto.countryCode;
    }
    if (dto.metadata !== undefined) {
      row.metadata = dto.metadata ?? {};
    }

    return row;
  }

  private touchesMetadata(dto: CreateDelegationDto | UpdateDelegationDto) {
    return dto.metadata !== undefined || dto.name !== undefined;
  }

  /**
   * Metadata resultante: la existente + dto.metadata + el nombre visible del
   * formulario. Así editar un campo no pisa lo demás que viva en metadata.
   */
  private mergeMetadata(
    existing: Record<string, unknown>,
    dto: CreateDelegationDto | UpdateDelegationDto,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = { ...existing, ...(dto.metadata ?? {}) };
    if (dto.name !== undefined) next.name = dto.name?.trim() || null;
    return next;
  }

  /**
   * Jefe de Misión = participante encargado de la delegación. Sólo uno por
   * delegación: el elegido pasa a is_delegation_lead (y a esta delegación) y
   * el resto de sus participantes deja de serlo. null destituye al actual.
   */
  private async applyMissionHead(id: string, dto: CreateDelegationDto | UpdateDelegationDto) {
    if (dto.missionHeadId === undefined) return;
    const headId = dto.missionHeadId?.trim() || null;
    const [demoted] = await this.dataSource.query<[Array<{ id: string }>, number]>(
      `update core.athletes set is_delegation_lead = false, updated_at = now()
       where delegation_id = $1 and is_delegation_lead = true
         and ($2::uuid is null or id <> $2)
       returning id`,
      [id, headId],
    );
    for (const row of demoted) this.scope.invalidate(row.id);
    if (headId) {
      const [promoted] = await this.dataSource.query<[Array<{ id: string }>, number]>(
        `update core.athletes set is_delegation_lead = true, delegation_id = $1, updated_at = now()
         where id = $2 and status is distinct from 'DELETED'
         returning id`,
        [id, headId],
      );
      if (promoted.length === 0) {
        throw new NotFoundException(`Participant with id ${headId} not found`);
      }
      this.scope.invalidate(headId);
    }
  }

  /** Hoteles y flota fija de la delegación (sólo si el DTO los trae). */
  private async applyLinks(id: string, dto: CreateDelegationDto | UpdateDelegationDto) {
    if (dto.accommodationIds) {
      await this.dataSource.query(
        `delete from core.delegation_accommodations where delegation_id = $1`,
        [id],
      );
      if (dto.accommodationIds.length > 0) {
        await this.dataSource.query(
          `insert into core.delegation_accommodations (delegation_id, accommodation_id)
           select $1, unnest($2::uuid[]) on conflict do nothing`,
          [id, dto.accommodationIds],
        );
      }
    }
    // Flota fija: los seleccionados pasan a esta delegación; los que estaban y
    // ya no vienen quedan libres. Los choferes viven en dos tablas.
    if (dto.driverIds) {
      for (const table of ['core.provider_participants', 'transport.drivers']) {
        await this.dataSource.query(
          `update ${table} set delegation_id = null
           where delegation_id = $1 and not (id = any($2::uuid[]))`,
          [id, dto.driverIds],
        );
        if (dto.driverIds.length > 0) {
          await this.dataSource.query(
            `update ${table} set delegation_id = $1 where id = any($2::uuid[])`,
            [id, dto.driverIds],
          );
        }
      }
    }
    if (dto.vehicleIds) {
      await this.dataSource.query(
        `update transport.vehicles set delegation_id = null
         where delegation_id = $1 and not (id = any($2::uuid[]))`,
        [id, dto.vehicleIds],
      );
      if (dto.vehicleIds.length > 0) {
        await this.dataSource.query(
          `update transport.vehicles set delegation_id = $1 where id = any($2::uuid[])`,
          [id, dto.vehicleIds],
        );
      }
    }
  }

  /**
   * Campos derivados para la UI: nombre visible, jefe de misión, hoteles y
   * flota fija. Se leen aparte para no tocar la entidad TypeORM.
   */
  private async attachExtras<T extends { id: string; metadata: Record<string, unknown> | null }>(
    delegations: T[],
  ) {
    if (delegations.length === 0) return delegations;
    const ids = delegations.map((d) => d.id);
    const [hotels, drivers, vehicles, heads] = await Promise.all([
      this.dataSource.query<Array<{ delegation_id: string; accommodation_id: string }>>(
        `select delegation_id, accommodation_id from core.delegation_accommodations
         where delegation_id = any($1::uuid[])`,
        [ids],
      ),
      this.dataSource.query<Array<{ id: string; delegation_id: string }>>(
        `select id, delegation_id from core.provider_participants
         where delegation_id = any($1::uuid[]) and status is distinct from 'DELETED'
         union all
         select id, delegation_id from transport.drivers where delegation_id = any($1::uuid[])`,
        [ids],
      ),
      this.dataSource.query<Array<{ id: string; delegation_id: string }>>(
        `select id, delegation_id from transport.vehicles where delegation_id = any($1::uuid[])`,
        [ids],
      ),
      // Jefe de Misión: el participante encargado de la delegación.
      this.dataSource.query<Array<{ id: string; delegation_id: string; full_name: string | null; phone: string | null }>>(
        `select id, delegation_id, full_name, phone from core.athletes
         where delegation_id = any($1::uuid[]) and is_delegation_lead = true
           and status is distinct from 'DELETED'
         order by updated_at desc`,
        [ids],
      ),
    ]);
    const group = (rows: Array<{ delegation_id: string }>, key: string) => {
      const map = new Map<string, string[]>();
      for (const r of rows) {
        const list = map.get(r.delegation_id) ?? [];
        list.push(String((r as Record<string, unknown>)[key]));
        map.set(r.delegation_id, list);
      }
      return map;
    };
    const hotelsBy = group(hotels, 'accommodation_id');
    const driversBy = group(drivers, 'id');
    const vehiclesBy = group(vehicles, 'id');
    const headBy = new Map<string, (typeof heads)[number]>();
    for (const h of heads) if (!headBy.has(h.delegation_id)) headBy.set(h.delegation_id, h);
    return delegations.map((d) => {
      const meta = d.metadata ?? {};
      const head = headBy.get(d.id) ?? null;
      return {
        ...d,
        name: typeof meta.name === 'string' ? meta.name : null,
        missionHeadId: head?.id ?? null,
        missionHeadName: head?.full_name ?? null,
        missionHeadPhone: head?.phone ?? null,
        accommodationIds: hotelsBy.get(d.id) ?? [],
        driverIds: driversBy.get(d.id) ?? [],
        vehicleIds: vehiclesBy.get(d.id) ?? [],
      };
    });
  }

  private toEntity(row: DelegationRow): Delegation {
    return {
      id: row.id,
      eventId: row.event_id,
      countryCode: row.country_code,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async attachDisciplines(delegations: Delegation[]) {
    if (delegations.length === 0) return delegations;
    const delegationIds = delegations.map((item) => item.id);

    const safeLinks = (await this.dataSource.query(
      `
        select delegation_id, discipline_id
        from core.delegation_disciplines
        where delegation_id = any($1::uuid[])
      `,
      [delegationIds],
    )) as DelegationDisciplineRow[];

    if (safeLinks.length === 0) {
      return delegations.map((delegation) => ({
        ...delegation,
        disciplineIds: [],
        disciplineNames: [],
      }));
    }

    const disciplineIds = Array.from(
      new Set(safeLinks.map((link) => link.discipline_id)),
    );

    const disciplines = (await this.dataSource.query(
      `
        select id, name
        from core.disciplines
        where id = any($1::uuid[])
      `,
      [disciplineIds],
    )) as DisciplineRow[];

    const disciplineMap = new Map<string, string>();
    disciplines.forEach((discipline) => {
      disciplineMap.set(discipline.id, discipline.name);
    });

    const byDelegation = new Map<string, string[]>();
    safeLinks.forEach((link) => {
      const current = byDelegation.get(link.delegation_id) ?? [];
      current.push(link.discipline_id);
      byDelegation.set(link.delegation_id, current);
    });

    return delegations.map((delegation) => {
      const ids = byDelegation.get(delegation.id) ?? [];
      const names = ids
        .map((disciplineId) => disciplineMap.get(disciplineId))
        .filter((name): name is string => Boolean(name));
      return {
        ...delegation,
        disciplineIds: ids,
        disciplineNames: names,
      };
    });
  }

  private async setDelegationDisciplines(
    delegationId: string,
    disciplineIds: string[],
  ) {
    const { error: deleteError } = await this.supabase
      .schema('core')
      .from('delegation_disciplines')
      .delete()
      .eq('delegation_id', delegationId);

    if (deleteError) {
      throw new InternalServerErrorException(
        deleteError.message || 'Error clearing delegation disciplines',
      );
    }

    if (disciplineIds.length === 0) return;

    const payload = disciplineIds.map((disciplineId) => ({
      delegation_id: delegationId,
      discipline_id: disciplineId,
    }));

    const { error: insertError } = await this.supabase
      .schema('core')
      .from('delegation_disciplines')
      .insert(payload);

    if (insertError) {
      throw new InternalServerErrorException(
        insertError.message || 'Error assigning delegation disciplines',
      );
    }
  }

  async create(createDelegationDto: CreateDelegationDto) {
    const row = this.toRow(createDelegationDto);
    if (this.touchesMetadata(createDelegationDto)) {
      row.metadata = this.mergeMetadata({}, createDelegationDto);
    }
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .upsert(row, { onConflict: 'event_id,country_code' })
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating delegation',
      );
    }

    if (createDelegationDto.disciplineIds) {
      await this.setDelegationDisciplines(
        (data as DelegationRow).id,
        createDelegationDto.disciplineIds,
      );
    }
    await this.applyLinks((data as DelegationRow).id, createDelegationDto);
    await this.applyMissionHead((data as DelegationRow).id, createDelegationDto);

    return this.findOne((data as DelegationRow).id);
  }

  async findAll() {
    try {
      const delegations = await this.delegationRepository.find({
        order: { createdAt: 'DESC' },
      });
      return await this.attachExtras(await this.attachDisciplines(delegations));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching delegations',
      );
    }
  }

  async findOne(id: string) {
    let delegation: Delegation | null;
    try {
      delegation = await this.delegationRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching delegation',
      );
    }

    if (!delegation) {
      throw new NotFoundException(`Delegation with id ${id} not found`);
    }

    const [full] = await this.attachExtras(await this.attachDisciplines([delegation]));
    return full;
  }

  async update(id: string, updateDelegationDto: UpdateDelegationDto) {
    const row = this.toRow(updateDelegationDto);
    if (this.touchesMetadata(updateDelegationDto)) {
      const current = await this.delegationRepository.findOne({ where: { id } });
      row.metadata = this.mergeMetadata(current?.metadata ?? {}, updateDelegationDto);
    }
    if (Object.keys(row).length > 0) {
      const { data, error } = await this.supabase
        .schema('core')
        .from('delegations')
        .update(row)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new InternalServerErrorException(
          error.message || 'Error updating delegation',
        );
      }

      if (!data) {
        throw new NotFoundException(`Delegation with id ${id} not found`);
      }
    } else {
      // Sólo vínculos (jefe de misión, hoteles, flota): PostgREST no acepta un
      // update vacío, así que se verifica la existencia aparte.
      const exists = await this.delegationRepository.findOne({ where: { id } });
      if (!exists) {
        throw new NotFoundException(`Delegation with id ${id} not found`);
      }
    }

    if (updateDelegationDto.disciplineIds) {
      await this.setDelegationDisciplines(id, updateDelegationDto.disciplineIds);
    }
    await this.applyLinks(id, updateDelegationDto);
    await this.applyMissionHead(id, updateDelegationDto);

    return this.findOne(id);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting delegation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Delegation with id ${id} not found`);
    }

    return this.toEntity(data as DelegationRow);
  }
}
