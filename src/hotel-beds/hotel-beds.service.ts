import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateHotelBedDto } from './dto/create-hotel-bed.dto';
import { UpdateHotelBedDto } from './dto/update-hotel-bed.dto';
import { HotelBed } from './entities/hotel-bed.entity';

type HotelBedRow = {
  id: string;
  room_id: string;
  bed_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class HotelBedsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateHotelBedDto | UpdateHotelBedDto) {
    const row: Record<string, unknown> = {};
    if (dto.roomId !== undefined) row.room_id = dto.roomId;
    if (dto.bedType !== undefined) row.bed_type = dto.bedType;
    if (dto.status !== undefined) row.status = dto.status;
    return row;
  }

  private toEntity(row: HotelBedRow): HotelBed {
    return {
      id: row.id,
      roomId: row.room_id,
      bedType: row.bed_type,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateHotelBedDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating hotel bed',
      );
    }

    return this.toEntity(data as HotelBedRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel beds',
      );
    }

    const { data: assignments, error: assignmentError } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('bed_id')
      .not('bed_id', 'is', null);

    if (assignmentError) {
      throw new InternalServerErrorException(
        assignmentError.message || 'Error fetching hotel assignments',
      );
    }

    const occupiedBeds = new Set(
      (assignments ?? [])
        .map((row) => row.bed_id as string | null)
        .filter((bedId): bedId is string => typeof bedId === 'string'),
    );

    return (data ?? []).map((row) => {
      const entity = this.toEntity(row as HotelBedRow);
      return {
        ...entity,
        status: occupiedBeds.has(entity.id) ? 'OCCUPIED' : 'AVAILABLE',
      };
    });
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel bed',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel bed with id ${id} not found`);
    }

    return this.toEntity(data as HotelBedRow);
  }

  async update(id: string, dto: UpdateHotelBedDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .update(this.toRow(dto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating hotel bed',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel bed with id ${id} not found`);
    }

    return this.toEntity(data as HotelBedRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting hotel bed',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel bed with id ${id} not found`);
    }

    return this.toEntity(data as HotelBedRow);
  }
}
