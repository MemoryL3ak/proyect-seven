import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
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

    const { data: links, error: linksError } = await this.supabase
      .schema('core')
      .from('delegation_disciplines')
      .select('delegation_id, discipline_id')
      .in('delegation_id', delegationIds);

    if (linksError) {
      throw new InternalServerErrorException(
        linksError.message || 'Error fetching delegation disciplines',
      );
    }

    const safeLinks = (links ?? []) as DelegationDisciplineRow[];
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

    const { data: disciplines, error: disciplinesError } = await this.supabase
      .schema('core')
      .from('disciplines')
      .select('id, name')
      .in('id', disciplineIds);

    if (disciplinesError) {
      throw new InternalServerErrorException(
        disciplinesError.message || 'Error fetching disciplines',
      );
    }

    const disciplineMap = new Map<string, string>();
    (disciplines ?? []).forEach((discipline) => {
      const row = discipline as DisciplineRow;
      disciplineMap.set(row.id, row.name);
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
        .map((id) => disciplineMap.get(id))
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

    return this.findOne((data as DelegationRow).id);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching delegations',
      );
    }

    const delegations = (data ?? []).map((row) => this.toEntity(row as DelegationRow));
    return this.attachDisciplines(delegations);
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching delegation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Delegation with id ${id} not found`);
    }

    const delegation = this.toEntity(data as DelegationRow);
    const [withDisciplines] = await this.attachDisciplines([delegation]);
    return withDisciplines;
  }

  async update(id: string, updateDelegationDto: UpdateDelegationDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .update(this.toRow(updateDelegationDto))
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

    if (updateDelegationDto.disciplineIds) {
      await this.setDelegationDisciplines(id, updateDelegationDto.disciplineIds);
    }

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
