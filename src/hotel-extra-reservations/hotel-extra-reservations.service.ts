import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateHotelExtraReservationDto } from './dto/create-hotel-extra-reservation.dto';
import { UpdateHotelExtraReservationDto } from './dto/update-hotel-extra-reservation.dto';
import { HotelExtraReservation } from './entities/hotel-extra-reservation.entity';

type HotelExtraReservationRow = {
  id: string;
  extra_id: string;
  participant_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class HotelExtraReservationsService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: HotelExtraReservationRow): HotelExtraReservation {
    return {
      id: row.id,
      extraId: row.extra_id,
      participantId: row.participant_id,
      quantity: row.quantity,
      notes: row.notes,
      status: row.status,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateHotelExtraReservationDto) {
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.hotel_extra_reservations (extra_id, participant_id, quantity, notes, status, start_date, end_date)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
        `,
        [
          dto.extraId,
          dto.participantId,
          dto.quantity ?? 1,
          dto.notes ?? null,
          dto.status ?? 'PENDING',
          dto.startDate ?? null,
          dto.endDate ?? null,
        ],
      )) as HotelExtraReservationRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating reservation',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select * from logistics.hotel_extra_reservations order by created_at desc
      `)) as HotelExtraReservationRow[];
      return rows.map((r) => this.toEntity(r));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching reservations',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.hotel_extra_reservations where id = $1 limit 1`,
        [id],
      )) as HotelExtraReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching reservation',
      );
    }
  }

  async update(id: string, dto: UpdateHotelExtraReservationDto) {
    const map: Record<string, unknown> = {};
    if (dto.extraId !== undefined) map.extra_id = dto.extraId;
    if (dto.participantId !== undefined) map.participant_id = dto.participantId;
    if (dto.quantity !== undefined) map.quantity = dto.quantity;
    if (dto.notes !== undefined) map.notes = dto.notes;
    if (dto.status !== undefined) map.status = dto.status;
    if (dto.startDate !== undefined) map.start_date = dto.startDate;
    if (dto.endDate !== undefined) map.end_date = dto.endDate;
    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOne(id);

    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => map[k]);

    try {
      const rows = (await this.dataSource.query(
        `update logistics.hotel_extra_reservations set ${setSql}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      )) as HotelExtraReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating reservation',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.hotel_extra_reservations where id = $1 returning *`,
        [id],
      )) as HotelExtraReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting reservation',
      );
    }
  }
}
