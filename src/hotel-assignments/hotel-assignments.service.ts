import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateHotelAssignmentDto } from './dto/create-hotel-assignment.dto';
import { UpdateHotelAssignmentDto } from './dto/update-hotel-assignment.dto';
import { AutoAssignHotelByRoomTypeDto } from './dto/auto-assign-hotel-by-room-type.dto';
import { HotelAssignment } from './entities/hotel-assignment.entity';

type HotelAssignmentRow = {
  id: string;
  participant_id: string;
  hotel_id: string;
  room_id: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type RoomRow = {
  id: string;
  room_number: string;
  room_type: string;
  beds_capacity: number;
};

type AssignmentProfile = {
  assignmentId: string;
  participantId: string;
  roomId: string;
  gender: string;
  isMinor: boolean;
  countryCode: string;
  disciplineId: string;
};

type Candidate = {
  id: string;
  gender: string;
  isMinor: boolean;
  countryCode: string;
  disciplineId: string;
};

const CLOSED_STATUSES = ['CHECKOUT', 'CHECKED_OUT', 'FINISHED', 'CANCELLED'];

function isClosedStatus(status?: string | null) {
  return CLOSED_STATUSES.includes(String(status || '').trim().toUpperCase());
}

function normalizedGender(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'M' || normalized === 'MALE' || normalized === 'MASCULINO') return 'MALE';
  if (normalized === 'F' || normalized === 'FEMALE' || normalized === 'FEMENINO') return 'FEMALE';
  if (normalized === 'X' || normalized === 'MIXED') return 'MIXED';
  return normalized;
}

function isMinorFromDate(value?: string | null) {
  if (!value) return false;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age < 18;
}

@Injectable()
export class HotelAssignmentsService {
  constructor(private readonly dataSource: DataSource) {}

  private toRow(dto: CreateHotelAssignmentDto | UpdateHotelAssignmentDto) {
    const row: Record<string, unknown> = {};
    if (dto.participantId !== undefined) row.participant_id = dto.participantId;
    if (dto.hotelId !== undefined) row.hotel_id = dto.hotelId;
    if (dto.roomId !== undefined) row.room_id = dto.roomId ?? null;
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
      checkinAt: row.checkin_at ? new Date(row.checkin_at) : null,
      checkoutAt: row.checkout_at ? new Date(row.checkout_at) : null,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async ensureRoomHasAvailability(roomId?: string | null, ignoreAssignmentId?: string) {
    if (!roomId) return;

    const rooms = (await this.dataSource.query(
      `
      select id, beds_capacity
      from logistics.hotel_rooms
      where id = $1
      limit 1
      `,
      [roomId],
    )) as Array<{ id: string; beds_capacity: number }>;

    const room = rooms[0];
    if (!room) throw new NotFoundException(`Hotel room with id ${roomId} not found`);

    const params: unknown[] = [roomId, CLOSED_STATUSES];
    let sql = `
      select count(*)::int as current_count
      from logistics.hotel_assignments
      where room_id = $1
        and upper(coalesce(status, 'ASSIGNED')) <> all($2::text[])
    `;

    if (ignoreAssignmentId) {
      sql += ' and id <> $3';
      params.push(ignoreAssignmentId);
    }

    const countRows = (await this.dataSource.query(sql, params)) as Array<{ current_count: number }>;
    const currentCount = Number(countRows[0]?.current_count ?? 0);
    if (currentCount >= Number(room.beds_capacity ?? 0)) {
      throw new InternalServerErrorException('No hay capacidad disponible en la habitación seleccionada');
    }
  }

  async create(dto: CreateHotelAssignmentDto) {
    await this.ensureRoomHasAvailability(dto.roomId ?? null);

    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.hotel_assignments (
          participant_id,
          hotel_id,
          room_id,
          checkin_at,
          checkout_at,
          status
        ) values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
        [
          dto.participantId,
          dto.hotelId,
          dto.roomId ?? null,
          dto.checkinAt ?? null,
          dto.checkoutAt ?? null,
          dto.status ?? 'ASSIGNED',
        ],
      )) as HotelAssignmentRow[];

      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating hotel assignment',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select *
        from logistics.hotel_assignments
        order by created_at desc
      `)) as HotelAssignmentRow[];
      return rows.map((row) => this.toEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel assignments',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        select *
        from logistics.hotel_assignments
        where id = $1
        limit 1
      `,
        [id],
      )) as HotelAssignmentRow[];

      if (!rows[0]) {
        throw new NotFoundException(`Hotel assignment with id ${id} not found`);
      }

      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel assignment',
      );
    }
  }

  async findByParticipant(participantId: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        select *
        from logistics.hotel_assignments
        where participant_id = $1
        order by updated_at desc, created_at desc
        limit 1
      `,
        [participantId],
      )) as HotelAssignmentRow[];

      if (!rows[0]) return null;
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching hotel assignment by participant',
      );
    }
  }

  async update(id: string, dto: UpdateHotelAssignmentDto) {
    const current = await this.findOne(id);
    const nextRoomId = dto.roomId !== undefined ? dto.roomId ?? null : current.roomId ?? null;
    await this.ensureRoomHasAvailability(nextRoomId, id);

    const row = this.toRow(dto);
    const keys = Object.keys(row);
    if (keys.length === 0) return current;

    const setSql = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = keys.map((key) => row[key]);

    try {
      const rows = (await this.dataSource.query(
        `
        update logistics.hotel_assignments
        set ${setSql}, updated_at = now()
        where id = $1
        returning *
      `,
        [id, ...values],
      )) as HotelAssignmentRow[];

      if (!rows[0]) {
        throw new NotFoundException(`Hotel assignment with id ${id} not found`);
      }

      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating hotel assignment',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        delete from logistics.hotel_assignments
        where id = $1
        returning *
      `,
        [id],
      )) as HotelAssignmentRow[];

      if (!rows[0]) {
        throw new NotFoundException(`Hotel assignment with id ${id} not found`);
      }

      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting hotel assignment',
      );
    }
  }

  async getCapacityByHotel(hotelId: string) {
    try {
      const rooms = (await this.dataSource.query(
        `
        select id, room_type, beds_capacity
        from logistics.hotel_rooms
        where hotel_id = $1
      `,
        [hotelId],
      )) as Array<{ id: string; room_type: string; beds_capacity: number }>;

      const assigned = (await this.dataSource.query(
        `
        select hr.room_type, count(*)::int as assigned_count
        from logistics.hotel_assignments ha
        join logistics.hotel_rooms hr on hr.id = ha.room_id
        where ha.hotel_id = $1
          and upper(coalesce(ha.status, 'ASSIGNED')) <> all($2::text[])
        group by hr.room_type
      `,
        [hotelId, CLOSED_STATUSES],
      )) as Array<{ room_type: string; assigned_count: number }>;

      const assignedByType = new Map<string, number>();
      assigned.forEach((row) => {
        assignedByType.set(String(row.room_type || '').toUpperCase(), Number(row.assigned_count || 0));
      });

      const byType = new Map<
        string,
        { roomType: string; rooms: number; totalCapacity: number; assigned: number }
      >();

      rooms.forEach((room) => {
        const type = String(room.room_type || '').toUpperCase();
        const current = byType.get(type) || {
          roomType: type,
          rooms: 0,
          totalCapacity: 0,
          assigned: assignedByType.get(type) ?? 0,
        };
        current.rooms += 1;
        current.totalCapacity += Number(room.beds_capacity || 0);
        byType.set(type, current);
      });

      return Array.from(byType.values())
        .map((row) => ({
          roomType: row.roomType,
          rooms: row.rooms,
          totalCapacity: row.totalCapacity,
          assigned: row.assigned,
          available: Math.max(0, row.totalCapacity - row.assigned),
        }))
        .sort((a, b) => a.roomType.localeCompare(b.roomType));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error loading hotel capacity',
      );
    }
  }

  private isCompatible(
    roomAssignments: AssignmentProfile[],
    candidate: Candidate,
    rules: {
      keepCountryTogether: boolean;
      keepDisciplineTogether: boolean;
      avoidMixedGender: boolean;
      avoidMinorAdultMix: boolean;
    },
  ) {
    if (roomAssignments.length === 0) return true;

    if (rules.avoidMixedGender) {
      const mixedGender = roomAssignments.some((item) => item.gender && candidate.gender && item.gender !== candidate.gender);
      if (mixedGender) return false;
    }

    if (rules.avoidMinorAdultMix) {
      const mixedAgeGroup = roomAssignments.some((item) => item.isMinor !== candidate.isMinor);
      if (mixedAgeGroup) return false;
    }

    if (rules.keepCountryTogether) {
      const mixedCountry = roomAssignments.some((item) => item.countryCode && candidate.countryCode && item.countryCode !== candidate.countryCode);
      if (mixedCountry) return false;
    }

    if (rules.keepDisciplineTogether) {
      const mixedDiscipline = roomAssignments.some((item) => item.disciplineId && candidate.disciplineId && item.disciplineId !== candidate.disciplineId);
      if (mixedDiscipline) return false;
    }

    return true;
  }

  async autoAssignByRoomType(dto: AutoAssignHotelByRoomTypeDto) {
    const keepCountryTogether = dto.keepCountryTogether ?? true;
    const keepDisciplineTogether = dto.keepDisciplineTogether ?? true;
    const avoidMixedGender = dto.avoidMixedGender ?? true;
    const avoidMinorAdultMix = dto.avoidMinorAdultMix ?? true;
    const assignmentsCount = Math.max(1, Number(dto.assignmentsCount || 1));

    try {
      const rooms = (await this.dataSource.query(
        `
        select id, room_number, room_type, beds_capacity
        from logistics.hotel_rooms
        where hotel_id = $1
          and upper(room_type) = upper($2)
        order by room_number asc, created_at asc
      `,
        [dto.hotelId, dto.roomType],
      )) as RoomRow[];

      if (rooms.length === 0) {
        return { created: [], unassigned: [], reason: 'No hay habitaciones para ese tipo' };
      }

      const roomById = new Map(rooms.map((room) => [room.id, room]));
      const occupancyRaw = (await this.dataSource.query(
        `
        select
          ha.id as assignment_id,
          ha.participant_id,
          ha.room_id,
          a.country_code,
          a.discipline_id,
          a.date_of_birth,
          a.metadata
        from logistics.hotel_assignments ha
        join core.athletes a on a.id = ha.participant_id
        where ha.hotel_id = $1
          and ha.room_id = any($2::uuid[])
          and upper(coalesce(ha.status, 'ASSIGNED')) <> all($3::text[])
      `,
        [dto.hotelId, rooms.map((r) => r.id), CLOSED_STATUSES],
      )) as Array<{
        assignment_id: string;
        participant_id: string;
        room_id: string;
        country_code: string | null;
        discipline_id: string | null;
        date_of_birth: string | null;
        metadata: Record<string, unknown> | null;
      }>;

      const occupancyByRoom = new Map<string, AssignmentProfile[]>();
      occupancyRaw.forEach((row) => {
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const gender = normalizedGender(String((metadata as Record<string, unknown>).gender || ''));
        const profile: AssignmentProfile = {
          assignmentId: row.assignment_id,
          participantId: row.participant_id,
          roomId: row.room_id,
          gender,
          isMinor: isMinorFromDate(row.date_of_birth),
          countryCode: String(row.country_code || '').trim().toUpperCase(),
          disciplineId: String(row.discipline_id || '').trim(),
        };
        const current = occupancyByRoom.get(row.room_id) || [];
        current.push(profile);
        occupancyByRoom.set(row.room_id, current);
      });

      let candidateRows: Array<{
        id: string;
        country_code: string | null;
        discipline_id: string | null;
        date_of_birth: string | null;
        metadata: Record<string, unknown> | null;
      }> = [];

      if (dto.participantIds && dto.participantIds.length > 0) {
        candidateRows = (await this.dataSource.query(
          `
          select id, country_code, discipline_id, date_of_birth, metadata
          from core.athletes
          where id = any($1::uuid[])
        `,
          [dto.participantIds],
        )) as Array<{
          id: string;
          country_code: string | null;
          discipline_id: string | null;
          date_of_birth: string | null;
          metadata: Record<string, unknown> | null;
        }>;
      } else {
        candidateRows = (await this.dataSource.query(
          `
          select id, country_code, discipline_id, date_of_birth, metadata
          from core.athletes
          where hotel_accommodation_id = $1
            and upper(coalesce(room_type, '')) = upper($2)
        `,
          [dto.hotelId, dto.roomType],
        )) as Array<{
          id: string;
          country_code: string | null;
          discipline_id: string | null;
          date_of_birth: string | null;
          metadata: Record<string, unknown> | null;
        }>;
      }

      const alreadyAssignedRows = (await this.dataSource.query(
        `
        select participant_id
        from logistics.hotel_assignments
        where hotel_id = $1
          and upper(coalesce(status, 'ASSIGNED')) <> all($2::text[])
      `,
        [dto.hotelId, CLOSED_STATUSES],
      )) as Array<{ participant_id: string }>;

      const alreadyAssigned = new Set(alreadyAssignedRows.map((row) => row.participant_id));

      const candidates: Candidate[] = candidateRows
        .filter((row) => !alreadyAssigned.has(row.id))
        .map((row) => {
          const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
          return {
            id: row.id,
            gender: normalizedGender(String((metadata as Record<string, unknown>).gender || '')),
            isMinor: isMinorFromDate(row.date_of_birth),
            countryCode: String(row.country_code || '').trim().toUpperCase(),
            disciplineId: String(row.discipline_id || '').trim(),
          };
        });

      candidates.sort((a, b) => {
        if (keepCountryTogether) {
          const byCountry = a.countryCode.localeCompare(b.countryCode);
          if (byCountry !== 0) return byCountry;
        }
        if (keepDisciplineTogether) {
          const byDiscipline = a.disciplineId.localeCompare(b.disciplineId);
          if (byDiscipline !== 0) return byDiscipline;
        }
        return a.id.localeCompare(b.id);
      });

      const created: HotelAssignment[] = [];
      const unassigned: Array<{ participantId: string; reason: string }> = [];

      for (const candidate of candidates) {
        if (created.length >= assignmentsCount) break;

        let assignedRoomId: string | null = null;
        for (const room of rooms) {
          const roomOccupancy = occupancyByRoom.get(room.id) || [];
          if (roomOccupancy.length >= Number(room.beds_capacity || 0)) continue;
          if (
            !this.isCompatible(roomOccupancy, candidate, {
              keepCountryTogether,
              keepDisciplineTogether,
              avoidMixedGender,
              avoidMinorAdultMix,
            })
          ) {
            continue;
          }
          assignedRoomId = room.id;
          break;
        }

        if (!assignedRoomId) {
          unassigned.push({ participantId: candidate.id, reason: 'Sin cupo compatible disponible' });
          continue;
        }

        const rows = (await this.dataSource.query(
          `
          insert into logistics.hotel_assignments (
            participant_id,
            hotel_id,
            room_id,
            status
          ) values ($1, $2, $3, $4)
          returning *
        `,
          [candidate.id, dto.hotelId, assignedRoomId, 'ASSIGNED'],
        )) as HotelAssignmentRow[];

        if (rows[0]) {
          created.push(this.toEntity(rows[0]));
          const roomOccupancy = occupancyByRoom.get(assignedRoomId) || [];
          roomOccupancy.push({
            assignmentId: rows[0].id,
            participantId: candidate.id,
            roomId: assignedRoomId,
            gender: candidate.gender,
            isMinor: candidate.isMinor,
            countryCode: candidate.countryCode,
            disciplineId: candidate.disciplineId,
          });
          occupancyByRoom.set(assignedRoomId, roomOccupancy);
        }
      }

      return {
        created,
        unassigned,
        requested: assignmentsCount,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error auto-assigning hotel rooms',
      );
    }
  }
}
