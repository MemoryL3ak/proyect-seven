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

  async create(createDelegationDto: CreateDelegationDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('delegations')
      .insert(this.toRow(createDelegationDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating delegation',
      );
    }

    return this.toEntity(data as DelegationRow);
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

    return (data ?? []).map((row) => this.toEntity(row as DelegationRow));
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

    return this.toEntity(data as DelegationRow);
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

    return this.toEntity(data as DelegationRow);
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
