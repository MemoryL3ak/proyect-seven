import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { Provider } from './entities/provider.entity';

type ProviderRow = {
  id: string;
  name: string;
  email: string | null;
  rut: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ProvidersService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateProviderDto | UpdateProviderDto) {
    const row: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      row.name = dto.name;
    }
    if (dto.email !== undefined) {
      row.email = dto.email ?? null;
    }
    if (dto.rut !== undefined) {
      row.rut = dto.rut ?? null;
    }
    if (dto.metadata !== undefined) {
      row.metadata = dto.metadata ?? {};
    }

    return row;
  }

  private toEntity(row: ProviderRow): Provider {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      rut: row.rut,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createProviderDto: CreateProviderDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .insert(this.toRow(createProviderDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating provider',
      );
    }

    return this.toEntity(data as ProviderRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching providers',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as ProviderRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .update(this.toRow(updateProviderDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('providers')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting provider',
      );
    }

    if (!data) {
      throw new NotFoundException(`Provider with id ${id} not found`);
    }

    return this.toEntity(data as ProviderRow);
  }
}
