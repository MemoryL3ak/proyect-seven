import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonReservationDto } from './dto/create-salon-reservation.dto';
import { UpdateSalonReservationDto } from './dto/update-salon-reservation.dto';
import { Salon } from './entities/salon.entity';
import { SalonReservation } from './entities/salon-reservation.entity';

type SalonRow = {
  id: string;
  hotel_id: string;
  name: string;
  type: string;
  capacity: number;
  status: string;
  floor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ReservationRow = {
  id: string;
  salon_id: string;
  title: string;
  organizer_name: string | null;
  organizer_email: string | null;
  event_id: string | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  attendees: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SalonesService {
  constructor(private readonly dataSource: DataSource) {}

  private toSalon(row: SalonRow): Salon {
    return {
      id: row.id,
      hotelId: row.hotel_id,
      name: row.name,
      type: row.type,
      capacity: row.capacity,
      status: row.status,
      floor: row.floor,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private toReservation(row: ReservationRow): SalonReservation {
    return {
      id: row.id,
      salonId: row.salon_id,
      title: row.title,
      organizerName: row.organizer_name,
      organizerEmail: row.organizer_email,
      eventId: row.event_id,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      attendees: row.attendees,
      status: row.status,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ── Salones CRUD ──────────────────────────────────────────

  async createSalon(dto: CreateSalonDto) {
    try {
      const rows = (await this.dataSource.query(
        `insert into logistics.salones (hotel_id, name, type, capacity, status, floor, notes)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [dto.hotelId, dto.name, dto.type ?? 'SALA_REUNION', dto.capacity ?? 0,
         dto.status ?? 'ACTIVE', dto.floor ?? null, dto.notes ?? null],
      )) as SalonRow[];
      return this.toSalon(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error creating salon');
    }
  }

  async findAllSalones() {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.salones order by created_at desc`,
      )) as SalonRow[];
      return rows.map((r) => this.toSalon(r));
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error fetching salones');
    }
  }

  async findOneSalon(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.salones where id = $1 limit 1`, [id],
      )) as SalonRow[];
      if (!rows[0]) throw new NotFoundException(`Salon ${id} not found`);
      return this.toSalon(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error fetching salon');
    }
  }

  async updateSalon(id: string, dto: UpdateSalonDto) {
    const map: Record<string, unknown> = {};
    if (dto.hotelId !== undefined) map.hotel_id = dto.hotelId;
    if (dto.name !== undefined) map.name = dto.name;
    if (dto.type !== undefined) map.type = dto.type;
    if (dto.capacity !== undefined) map.capacity = dto.capacity;
    if (dto.status !== undefined) map.status = dto.status;
    if (dto.floor !== undefined) map.floor = dto.floor ?? null;
    if (dto.notes !== undefined) map.notes = dto.notes ?? null;
    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOneSalon(id);
    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    try {
      const rows = (await this.dataSource.query(
        `update logistics.salones set ${setSql}, updated_at = now() where id = $1 returning *`,
        [id, ...keys.map((k) => map[k])],
      )) as SalonRow[];
      if (!rows[0]) throw new NotFoundException(`Salon ${id} not found`);
      return this.toSalon(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error updating salon');
    }
  }

  async removeSalon(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.salones where id = $1 returning *`, [id],
      )) as SalonRow[];
      if (!rows[0]) throw new NotFoundException(`Salon ${id} not found`);
      return this.toSalon(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error deleting salon');
    }
  }

  // ── Reservations CRUD ─────────────────────────────────────

  async createReservation(dto: CreateSalonReservationDto) {
    try {
      const rows = (await this.dataSource.query(
        `insert into logistics.salon_reservations
           (salon_id, title, organizer_name, organizer_email, event_id,
            start_date, end_date, start_time, end_time, attendees, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [dto.salonId, dto.title, dto.organizerName ?? null, dto.organizerEmail ?? null,
         dto.eventId ?? null, dto.startDate, dto.endDate, dto.startTime, dto.endTime,
         dto.attendees ?? null, dto.status ?? 'CONFIRMED', dto.notes ?? null],
      )) as ReservationRow[];
      return this.toReservation(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error creating reservation');
    }
  }

  async findAllReservations() {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.salon_reservations order by start_date asc, start_time asc`,
      )) as ReservationRow[];
      return rows.map((r) => this.toReservation(r));
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error fetching reservations');
    }
  }

  async findOneReservation(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.salon_reservations where id = $1 limit 1`, [id],
      )) as ReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toReservation(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error fetching reservation');
    }
  }

  async updateReservation(id: string, dto: UpdateSalonReservationDto) {
    const map: Record<string, unknown> = {};
    if (dto.salonId !== undefined) map.salon_id = dto.salonId;
    if (dto.title !== undefined) map.title = dto.title;
    if (dto.organizerName !== undefined) map.organizer_name = dto.organizerName ?? null;
    if (dto.organizerEmail !== undefined) map.organizer_email = dto.organizerEmail ?? null;
    if (dto.eventId !== undefined) map.event_id = dto.eventId ?? null;
    if (dto.startDate !== undefined) map.start_date = dto.startDate;
    if (dto.endDate !== undefined) map.end_date = dto.endDate;
    if (dto.startTime !== undefined) map.start_time = dto.startTime;
    if (dto.endTime !== undefined) map.end_time = dto.endTime;
    if (dto.attendees !== undefined) map.attendees = dto.attendees ?? null;
    if (dto.status !== undefined) map.status = dto.status;
    if (dto.notes !== undefined) map.notes = dto.notes ?? null;
    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOneReservation(id);
    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    try {
      const rows = (await this.dataSource.query(
        `update logistics.salon_reservations set ${setSql}, updated_at = now() where id = $1 returning *`,
        [id, ...keys.map((k) => map[k])],
      )) as ReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toReservation(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error updating reservation');
    }
  }

  async removeReservation(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.salon_reservations where id = $1 returning *`, [id],
      )) as ReservationRow[];
      if (!rows[0]) throw new NotFoundException(`Reservation ${id} not found`);
      return this.toReservation(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error deleting reservation');
    }
  }
}
