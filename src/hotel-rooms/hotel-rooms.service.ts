import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  constructor(private readonly dataSource: DataSource) {}

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
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.hotel_rooms (
          hotel_id,
          room_number,
          room_type,
          beds_capacity,
          base_bed_type,
          status,
          notes
        ) values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
        [
          dto.hotelId,
          dto.roomNumber,
          dto.roomType ?? null,
          dto.bedsCapacity ?? 0,
          dto.defaultBedType ?? null,
          dto.status ?? 'AVAILABLE',
          dto.notes ?? null,
        ],
      )) as HotelRoomRow[];

      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating hotel room',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select *
        from logistics.hotel_rooms
        order by created_at desc
      `)) as HotelRoomRow[];
      return rows.map((row) => this.toEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel rooms',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        select *
        from logistics.hotel_rooms
        where id = $1
        limit 1
      `,
        [id],
      )) as HotelRoomRow[];

      if (!rows[0]) throw new NotFoundException(`Hotel room with id ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel room',
      );
    }
  }

  async update(id: string, dto: UpdateHotelRoomDto) {
    const row = this.toRow(dto);
    const keys = Object.keys(row);
    if (keys.length === 0) return this.findOne(id);

    const setSql = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = keys.map((key) => row[key]);

    try {
      const rows = (await this.dataSource.query(
        `
        update logistics.hotel_rooms
        set ${setSql}, updated_at = now()
        where id = $1
        returning *
      `,
        [id, ...values],
      )) as HotelRoomRow[];

      if (!rows[0]) throw new NotFoundException(`Hotel room with id ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating hotel room',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        delete from logistics.hotel_rooms
        where id = $1
        returning *
      `,
        [id],
      )) as HotelRoomRow[];

      if (!rows[0]) throw new NotFoundException(`Hotel room with id ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting hotel room',
      );
    }
  }
}
