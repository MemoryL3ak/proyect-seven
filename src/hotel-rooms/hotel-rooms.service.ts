import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateHotelRoomDto } from './dto/create-hotel-room.dto';
import { UpdateHotelRoomDto } from './dto/update-hotel-room.dto';
import { HotelRoom } from './entities/hotel-room.entity';

type HotelRoomRow = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  beds_capacity: number;
  base_bed_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class HotelRoomsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private async syncBeds(room: HotelRoomRow, dto: CreateHotelRoomDto | UpdateHotelRoomDto) {
    if (!room.base_bed_type || !room.beds_capacity || room.beds_capacity <= 0) {
      return;
    }

    const { data: existingBeds, error: existingError } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .select('id')
      .eq('room_id', room.id);

    if (existingError) {
      throw new InternalServerErrorException(
        existingError.message || 'Error fetching hotel beds',
      );
    }

    const existingCount = (existingBeds ?? []).length;

    if (dto.defaultBedType !== undefined && existingCount > 0) {
      const { error: updateError } = await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ bed_type: room.base_bed_type })
        .eq('room_id', room.id);

      if (updateError) {
        throw new InternalServerErrorException(
          updateError.message || 'Error updating hotel bed type',
        );
      }
    }

    if (existingCount >= room.beds_capacity) {
      return;
    }

    const toCreate = room.beds_capacity - existingCount;
    const inserts = Array.from({ length: toCreate }).map(() => ({
      room_id: room.id,
      bed_type: room.base_bed_type,
      status: 'AVAILABLE',
    }));

    const { error: insertError } = await this.supabase
      .schema('logistics')
      .from('hotel_beds')
      .insert(inserts);

    if (insertError) {
      throw new InternalServerErrorException(
        insertError.message || 'Error creating hotel beds',
      );
    }
  }

  private toRow(dto: CreateHotelRoomDto | UpdateHotelRoomDto) {
    const row: Record<string, unknown> = {};
    if (dto.hotelId !== undefined) row.hotel_id = dto.hotelId;
    if (dto.roomNumber !== undefined) row.room_number = dto.roomNumber;
    if (dto.roomType !== undefined) row.room_type = dto.roomType;
    if (dto.bedsCapacity !== undefined) row.beds_capacity = dto.bedsCapacity;
    if (dto.defaultBedType !== undefined) row.base_bed_type = dto.defaultBedType ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    return row;
  }

  private toEntity(row: HotelRoomRow): HotelRoom {
    return {
      id: row.id,
      hotelId: row.hotel_id,
      roomNumber: row.room_number,
      roomType: row.room_type,
      bedsCapacity: row.beds_capacity,
      baseBedType: row.base_bed_type,
      defaultBedType: row.base_bed_type,
      status: row.status,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateHotelRoomDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_rooms')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating hotel room',
      );
    }

    await this.syncBeds(data as HotelRoomRow, dto);
    return this.toEntity(data as HotelRoomRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel rooms',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as HotelRoomRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching hotel room',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel room with id ${id} not found`);
    }

    return this.toEntity(data as HotelRoomRow);
  }

  async update(id: string, dto: UpdateHotelRoomDto) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_rooms')
      .update(this.toRow(dto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating hotel room',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel room with id ${id} not found`);
    }

    await this.syncBeds(data as HotelRoomRow, dto);
    return this.toEntity(data as HotelRoomRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('logistics')
      .from('hotel_rooms')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting hotel room',
      );
    }

    if (!data) {
      throw new NotFoundException(`Hotel room with id ${id} not found`);
    }

    return this.toEntity(data as HotelRoomRow);
  }
}
