import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransportDto } from './dto/create-transport.dto';
import { UpdateTransportDto } from './dto/update-transport.dto';
import { Transport } from './entities/transport.entity';
import { SupabaseClient } from '@supabase/supabase-js';

type TransportRow = {
  id: string;
  event_id: string;
  plate: string;
  type: string;
  brand: string | null;
  model: string | null;
  capacity: number;
  status: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class TransportsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateTransportDto | UpdateTransportDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.plate !== undefined) {
      row.plate = dto.plate;
    }
    if (dto.type !== undefined) {
      row.type = dto.type;
    }
    if (dto.brand !== undefined) {
      row.brand = dto.brand ?? null;
    }
    if (dto.model !== undefined) {
      row.model = dto.model ?? null;
    }
    if (dto.capacity !== undefined) {
      row.capacity = dto.capacity;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }

    return row;
  }

  private toEntity(row: TransportRow): Transport {
    return {
      id: row.id,
      eventId: row.event_id,
      plate: row.plate,
      type: row.type,
      brand: row.brand,
      model: row.model,
      capacity: row.capacity,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createTransportDto: CreateTransportDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .insert(this.toRow(createTransportDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating transport',
      );
    }

    return this.toEntity(data as TransportRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching transports',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as TransportRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching transport',
      );
    }

    if (!data) {
      throw new NotFoundException(`Transport with id ${id} not found`);
    }

    return this.toEntity(data as TransportRow);
  }

  async update(id: string, updateTransportDto: UpdateTransportDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .update(this.toRow(updateTransportDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating transport',
      );
    }

    if (!data) {
      throw new NotFoundException(`Transport with id ${id} not found`);
    }

    return this.toEntity(data as TransportRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('vehicles')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting transport',
      );
    }

    if (!data) {
      throw new NotFoundException(`Transport with id ${id} not found`);
    }

    return this.toEntity(data as TransportRow);
  }
}
