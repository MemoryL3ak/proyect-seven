import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateHotelAssignmentDto } from './dto/create-hotel-assignment.dto';
import { UpdateHotelAssignmentDto } from './dto/update-hotel-assignment.dto';
import { HotelAssignment } from './entities/hotel-assignment.entity';

type HotelAssignmentRow = {
  id: string;
  participant_id: string;
  hotel_id: string;
  room_id: string | null;
  bed_id: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class HotelAssignmentsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateHotelAssignmentDto | UpdateHotelAssignmentDto) {
    const row: Record<string, unknown> = {};
    if (dto.participantId !== undefined) row.participant_id = dto.participantId;
    if (dto.hotelId !== undefined) row.hotel_id = dto.hotelId;
    if (dto.roomId !== undefined) row.room_id = dto.roomId ?? null;
    if (dto.bedId !== undefined) row.bed_id = dto.bedId ?? null;
    if (dto.checkinAt !== undefined) row.checkin_at = dto.checkinAt ?? null;
    if (dto.checkoutAt !== undefined) row.checkout_at = dto.checkoutAt ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    return row;
  }

  private toEntity(row: HotelAssignmentRow): HotelAssignment {
    return {
      id: row.id,
      participantId: row.participant_id,
      hotelId: row.hotel_id,
      roomId: row.room_id,
      bedId: row.bed_id,
      checkinAt: row.checkin_at ? new Date(row.checkin_at) : null,
      checkoutAt: row.checkout_at ? new Date(row.checkout_at) : null,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateHotelAssignmentDto) {
    if (dto.bedId) {
      const { data: bed, error: bedError } = await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .select('status')
        .eq('id', dto.bedId)
        .maybeSingle();

      if (bedError) {
        throw new InternalServerErrorException(
          bedError.message || 'Error fetching bed status',
        );
      }

      if (bed && bed.status !== 'AVAILABLE') {
        throw new InternalServerErrorException('La cama ya está ocupada');
      }
    }

    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating hotel assignment',
      );
    }

    if (data.bed_id) {
      const { error: bedStatusError } = await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'OCCUPIED' })
        .eq('id', data.bed_id);

      if (bedStatusError) {
        throw new InternalServerErrorException(
          bedStatusError.message || 'Error updating bed status',
        );
      }
    }

    return this.toEntity(data as HotelAssignmentRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel assignments',
      );
    }

    return (data ?? []).map((row) =>
      this.toEntity(row as HotelAssignmentRow),
    );
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel assignment',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel assignment with id ${id} not found`);
    }

    return this.toEntity(data as HotelAssignmentRow);
  }

  async update(id: string, dto: UpdateHotelAssignmentDto) {
    const { data: existing } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('bed_id')
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .update(this.toRow(dto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating hotel assignment',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel assignment with id ${id} not found`);
    }

    if (existing?.bed_id && existing.bed_id !== data.bed_id) {
      await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'AVAILABLE' })
        .eq('id', existing.bed_id);
    }
    if (data.bed_id) {
      await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'OCCUPIED' })
        .eq('id', data.bed_id);
    }

    return this.toEntity(data as HotelAssignmentRow);
  }

  async remove(id: string) {
    const { data: existing } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('bed_id')
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting hotel assignment',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel assignment with id ${id} not found`);
    }

    if (existing?.bed_id) {
      await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'AVAILABLE' })
        .eq('id', existing.bed_id);
    }

    return this.toEntity(data as HotelAssignmentRow);
  }
}
