import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { Accommodation } from './entities/accommodation.entity';

type AccommodationRow = {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  geo_location: unknown | null;
  total_capacity: number;
  room_inventory: Record<string, number> | null;
  bed_inventory: Record<string, number> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AccommodationsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(Accommodation)
    private readonly accommodationRepository: Repository<Accommodation>,
  ) {}

  private toRow(dto: CreateAccommodationDto | UpdateAccommodationDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.name !== undefined) {
      row.name = dto.name;
    }
    if (dto.address !== undefined) {
      row.address = dto.address ?? null;
    }
    if (dto.geoLocation !== undefined) {
      row.geo_location = dto.geoLocation ?? null;
    }
    if (dto.totalCapacity !== undefined) {
      row.total_capacity = dto.totalCapacity;
    }
    if (dto.roomInventory !== undefined) {
      row.room_inventory = dto.roomInventory ?? {};
    }
    if (dto.bedInventory !== undefined) {
      row.bed_inventory = dto.bedInventory ?? {};
    }

    return row;
  }

  private toEntity(row: AccommodationRow): Accommodation {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      address: row.address,
      geoLocation: row.geo_location,
      totalCapacity: row.total_capacity,
      roomInventory: row.room_inventory ?? {},
      bedInventory: row.bed_inventory ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createAccommodationDto: CreateAccommodationDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('accommodations')
      .insert(this.toRow(createAccommodationDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating accommodation',
      );
    }

    return this.toEntity(data as AccommodationRow);
  }

  async findAll() {
    try {
      return await this.accommodationRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching accommodations',
      );
    }
  }

  async findOne(id: string) {
    let data: Accommodation | null;
    try {
      data = await this.accommodationRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching accommodation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Accommodation with id ${id} not found`);
    }

    return data;
  }

  async update(id: string, updateAccommodationDto: UpdateAccommodationDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('accommodations')
      .update(this.toRow(updateAccommodationDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating accommodation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Accommodation with id ${id} not found`);
    }

    return this.toEntity(data as AccommodationRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('accommodations')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting accommodation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Accommodation with id ${id} not found`);
    }

    return this.toEntity(data as AccommodationRow);
  }
}
