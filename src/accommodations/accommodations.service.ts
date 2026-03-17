import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  room_inventory: Record<string, number> | string | null;
  bed_inventory: Record<string, number> | string | null;
  created_at: string;
  updated_at: string;
};

type HotelRoomRow = {
  id: string;
  room_type: string;
  room_number: string;
  beds_capacity: number;
};

const ROOM_CAPACITY_BY_TYPE: Record<string, number> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  SUITE: 2,
};

const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE', 'SUITE'];
const CLOSED_STATUSES = ['CHECKOUT', 'CHECKED_OUT', 'FINISHED', 'CANCELLED'];

function parseJsonObject(value: unknown): Record<string, number> {
  const source =
    typeof value === 'string'
      ? (() => {
          try {
            return value.trim() ? JSON.parse(value) : {};
          } catch {
            return {};
          }
        })()
      : value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

  return Object.entries(source).reduce<Record<string, number>>((acc, [key, raw]) => {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) acc[String(key).toUpperCase()] = Math.floor(n);
    return acc;
  }, {});
}

function parseRoomInventoryFromPayload(
  dto: Partial<CreateAccommodationDto & UpdateAccommodationDto> & Record<string, unknown>,
): Record<string, number> | undefined {
  const normalized = parseJsonObject(dto.roomInventory);

  const directMap: Array<[string, string]> = [
    ['roomSingle', 'SINGLE'],
    ['roomDouble', 'DOUBLE'],
    ['roomTriple', 'TRIPLE'],
    ['roomSuite', 'SUITE'],
    ['room_single', 'SINGLE'],
    ['room_double', 'DOUBLE'],
    ['room_triple', 'TRIPLE'],
    ['room_suite', 'SUITE'],
    ['singleRooms', 'SINGLE'],
    ['doubleRooms', 'DOUBLE'],
    ['tripleRooms', 'TRIPLE'],
    ['suiteRooms', 'SUITE'],
    ['single', 'SINGLE'],
    ['double', 'DOUBLE'],
    ['triple', 'TRIPLE'],
    ['suite', 'SUITE'],
  ];

  directMap.forEach(([key, type]) => {
    const raw = dto[key];
    if (raw === undefined || raw === null || raw === '') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      normalized[type] = Math.floor(parsed);
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function calculateTotalCapacityFromInventory(roomInventory: Record<string, number>): number {
  return ROOM_TYPES.reduce((sum, type) => {
    const rooms = Number(roomInventory[type] ?? 0);
    const perRoom = Number(ROOM_CAPACITY_BY_TYPE[type] ?? 1);
    if (!Number.isFinite(rooms) || rooms <= 0) return sum;
    return sum + rooms * perRoom;
  }, 0);
}

@Injectable()
export class AccommodationsService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: AccommodationRow): Accommodation {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      address: row.address,
      geoLocation: row.geo_location,
      totalCapacity: row.total_capacity,
      roomInventory: parseJsonObject(row.room_inventory),
      bedInventory: parseJsonObject(row.bed_inventory),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private buildBaseUpdate(
    dto: CreateAccommodationDto | UpdateAccommodationDto,
    paramsOffset = 2,
  ) {
    const set: string[] = [];
    const params: unknown[] = [];
    let index = paramsOffset;

    if (dto.eventId !== undefined) {
      set.push(`event_id = $${index++}`);
      params.push(dto.eventId);
    }
    if (dto.name !== undefined) {
      set.push(`name = $${index++}`);
      params.push(dto.name);
    }
    if (dto.address !== undefined) {
      set.push(`address = $${index++}`);
      params.push(dto.address ?? null);
    }
    if (dto.totalCapacity !== undefined) {
      set.push(`total_capacity = $${index++}`);
      params.push(dto.totalCapacity);
    }
    if (dto.roomInventory !== undefined) {
      set.push(`room_inventory = $${index++}::jsonb`);
      params.push(JSON.stringify(dto.roomInventory ?? {}));
    }
    if (dto.bedInventory !== undefined) {
      set.push(`bed_inventory = $${index++}::jsonb`);
      params.push(JSON.stringify(dto.bedInventory ?? {}));
    }
    if (dto.geoLocation !== undefined) {
      if (dto.geoLocation === null) {
        set.push(`geo_location = null`);
      } else {
        set.push(`geo_location = ST_SetSRID(ST_GeomFromGeoJSON($${index++}), 4326)`);
        params.push(JSON.stringify(dto.geoLocation));
      }
    }

    return { set, params };
  }

  private async syncHotelRooms(hotelId: string, roomInventoryRaw: unknown) {
    const roomInventory = parseJsonObject(roomInventoryRaw);

    const rooms = (await this.dataSource.query(
      `
      select id, room_type, room_number, beds_capacity
      from logistics.hotel_rooms
      where hotel_id = $1
      order by room_type asc, room_number asc, created_at asc
    `,
      [hotelId],
    )) as HotelRoomRow[];

    const roomsByType = new Map<string, HotelRoomRow[]>();
    rooms.forEach((room) => {
      const type = String(room.room_type || '').toUpperCase();
      const current = roomsByType.get(type) || [];
      current.push(room);
      roomsByType.set(type, current);
    });

    for (const type of ROOM_TYPES) {
      const target = Number(roomInventory[type] ?? 0);
      const current = roomsByType.get(type) || [];
      const capacity = ROOM_CAPACITY_BY_TYPE[type] ?? 1;

      if (current.length < target) {
        const missing = target - current.length;
        let nextIndex =
          current.reduce((max, room) => {
            const prefix = `${type}-`;
            const roomNumber = String(room.room_number || '');
            if (!roomNumber.startsWith(prefix)) return max;
            const parsed = Number(roomNumber.slice(prefix.length));
            if (!Number.isFinite(parsed)) return max;
            return Math.max(max, parsed);
          }, 0) + 1;

        const existingNumbers = new Set<string>(
          rooms.map((room) => String(room.room_number || '').trim()).filter((value) => value.length > 0),
        );

        let inserted = 0;
        while (inserted < missing) {
          const roomNumber = `${type}-${String(nextIndex).padStart(3, '0')}`;
          nextIndex += 1;

          if (existingNumbers.has(roomNumber)) {
            continue;
          }

          const globalCollision = (await this.dataSource.query(
            `
            select 1
            from logistics.hotel_rooms
            where room_number = $1
            limit 1
          `,
            [roomNumber],
          )) as Array<{ '?column?': number }>;

          if (globalCollision.length > 0) {
            continue;
          }

          await this.dataSource.query(
            `
            insert into logistics.hotel_rooms (
              hotel_id,
              room_number,
              room_type,
              beds_capacity,
              status
            ) values ($1, $2, $3, $4, 'AVAILABLE')
          `,
            [hotelId, roomNumber, type, capacity],
          );
          existingNumbers.add(roomNumber);
          inserted += 1;
        }
      }

      if (current.length > target) {
        const removable = [...current].reverse();
        let pendingToRemove = current.length - target;

        for (const room of removable) {
          if (pendingToRemove <= 0) break;
          const activeAssignments = (await this.dataSource.query(
            `
            select count(*)::int as active_count
            from logistics.hotel_assignments
            where room_id = $1
              and upper(coalesce(status, 'ASSIGNED')) <> all($2::text[])
          `,
            [room.id, CLOSED_STATUSES],
          )) as Array<{ active_count: number }>;

          const hasActive = Number(activeAssignments[0]?.active_count ?? 0) > 0;
          if (hasActive) continue;

          await this.dataSource.query(
            `
            delete from logistics.hotel_rooms
            where id = $1
          `,
            [room.id],
          );
          pendingToRemove -= 1;
        }
      }

      await this.dataSource.query(
        `
        update logistics.hotel_rooms
        set beds_capacity = $1
        where hotel_id = $2
          and upper(room_type) = $3
      `,
        [capacity, hotelId, type],
      );
    }
  }

  async syncRoomsFromInventory(hotelId: string, roomInventoryRaw: unknown) {
    const existing = (await this.dataSource.query(
      `
      select id, room_inventory
      from logistics.accommodations
      where id = $1
      limit 1
    `,
      [hotelId],
    )) as Array<{ id: string; room_inventory: unknown }>;

    if (!existing[0]) {
      throw new NotFoundException(`Accommodation with id ${hotelId} not found`);
    }

    const normalizedRoomInventory =
      parseRoomInventoryFromPayload(
        { roomInventory: roomInventoryRaw } as Record<string, unknown> &
          Partial<CreateAccommodationDto & UpdateAccommodationDto>,
      ) ?? parseJsonObject(roomInventoryRaw);

    await this.dataSource.query(
      `
      update logistics.accommodations
      set room_inventory = $2::jsonb,
          total_capacity = $3,
          updated_at = now()
      where id = $1
    `,
      [
        hotelId,
        JSON.stringify(normalizedRoomInventory),
        calculateTotalCapacityFromInventory(normalizedRoomInventory),
      ],
    );

    await this.syncHotelRooms(hotelId, normalizedRoomInventory);
    return this.findOne(hotelId);
  }

  async create(createAccommodationDto: CreateAccommodationDto) {
    try {
      const normalizedRoomInventory = parseRoomInventoryFromPayload(
        createAccommodationDto as CreateAccommodationDto & Record<string, unknown>,
      );
      const createDto: CreateAccommodationDto = {
        ...createAccommodationDto,
        ...(normalizedRoomInventory ? { roomInventory: normalizedRoomInventory } : {}),
        ...(createAccommodationDto.totalCapacity === undefined && normalizedRoomInventory
          ? { totalCapacity: calculateTotalCapacityFromInventory(normalizedRoomInventory) }
          : {}),
      };

      const columns = ['event_id', 'name'];
      const values: unknown[] = [createDto.eventId, createDto.name];
      let index = 3;

      const optionalField = (col: string, value: unknown, cast = '') => {
        columns.push(col);
        values.push(value);
        return `$${index++}${cast}`;
      };

      const placeholders: string[] = ['$1', '$2'];
      placeholders.push(optionalField('address', createDto.address ?? null));
      if (createDto.geoLocation !== undefined && createDto.geoLocation !== null) {
        columns.push('geo_location');
        placeholders.push(`ST_SetSRID(ST_GeomFromGeoJSON($${index++}), 4326)`);
        values.push(JSON.stringify(createDto.geoLocation));
      }
      placeholders.push(optionalField('total_capacity', createDto.totalCapacity ?? 0));
      placeholders.push(optionalField('room_inventory', JSON.stringify(createDto.roomInventory ?? {}), '::jsonb'));
      placeholders.push(optionalField('bed_inventory', JSON.stringify(createDto.bedInventory ?? {}), '::jsonb'));

      const rows = (await this.dataSource.query(
        `
        insert into logistics.accommodations (${columns.join(', ')})
        values (${placeholders.join(', ')})
        returning *
      `,
        values,
      )) as AccommodationRow[];

      const entity = this.toEntity(rows[0]);
      await this.syncHotelRooms(entity.id, entity.roomInventory);
      return entity;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating accommodation',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(
        `
        select *
        from logistics.accommodations
        order by created_at desc
      `,
      )) as AccommodationRow[];
      return rows.map((row) => this.toEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching accommodations',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        select *
        from logistics.accommodations
        where id = $1
        limit 1
      `,
        [id],
      )) as AccommodationRow[];

      if (!rows[0]) throw new NotFoundException(`Accommodation with id ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching accommodation',
      );
    }
  }

  async update(id: string, updateAccommodationDto: UpdateAccommodationDto) {
    const normalizedRoomInventory = parseRoomInventoryFromPayload(
      updateAccommodationDto as UpdateAccommodationDto & Record<string, unknown>,
    );
    const updateDto: UpdateAccommodationDto = {
      ...updateAccommodationDto,
      ...(normalizedRoomInventory ? { roomInventory: normalizedRoomInventory } : {}),
      ...(updateAccommodationDto.totalCapacity === undefined && normalizedRoomInventory
        ? { totalCapacity: calculateTotalCapacityFromInventory(normalizedRoomInventory) }
        : {}),
    };

    const { set, params } = this.buildBaseUpdate(updateDto, 2);
    if (set.length === 0) {
      return this.findOne(id);
    }

    try {
      const rows = (await this.dataSource.query(
        `
        update logistics.accommodations
        set ${set.join(', ')}, updated_at = now()
        where id = $1
        returning *
      `,
        [id, ...params],
      )) as AccommodationRow[];

      if (!rows[0]) throw new NotFoundException(`Accommodation with id ${id} not found`);

      const entity = this.toEntity(rows[0]);
      await this.syncHotelRooms(entity.id, entity.roomInventory);
      return entity;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating accommodation',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
        delete from logistics.accommodations
        where id = $1
        returning *
      `,
        [id],
      )) as AccommodationRow[];

      if (!rows[0]) throw new NotFoundException(`Accommodation with id ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting accommodation',
      );
    }
  }
}
