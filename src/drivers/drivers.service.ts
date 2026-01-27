import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Driver } from './entities/driver.entity';

type DriverRow = {
  id: string;
  event_id: string;
  user_id: string;
  license_number: string | null;
  phone: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class DriversService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateDriverDto | UpdateDriverDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.userId !== undefined) {
      row.user_id = dto.userId;
    }
    if (dto.licenseNumber !== undefined) {
      row.license_number = dto.licenseNumber ?? null;
    }
    if (dto.phone !== undefined) {
      row.phone = dto.phone ?? null;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.metadata !== undefined) {
      row.metadata = dto.metadata ?? {};
    }

    return row;
  }

  private toEntity(row: DriverRow): Driver {
    return {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      licenseNumber: row.license_number,
      phone: row.phone,
      status: row.status,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createDriverDto: CreateDriverDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .insert(this.toRow(createDriverDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating driver',
      );
    }

    return this.toEntity(data as DriverRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching drivers',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as DriverRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }

  async update(id: string, updateDriverDto: UpdateDriverDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .update(this.toRow(updateDriverDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting driver',
      );
    }

    if (!data) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    return this.toEntity(data as DriverRow);
  }
}
