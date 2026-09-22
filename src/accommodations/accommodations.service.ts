import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { delegationHotelsSql } from '../shared/delegation-hotels';
import {
  ACCOMMODATION_CONTACT_ROLES,
  ACCOMMODATION_CONTACT_SHIFTS,
  AccommodationCoordinatorDto,
  CreateAccommodationDto,
} from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { Accommodation } from './entities/accommodation.entity';

type AccommodationRow = {
  id: string;
  event_id: string;
  name: string;
  accommodation_type: string;
  tower: string | null;
  address: string | null;
  photo_url?: string | null;
  geo_location: unknown | null;
  total_capacity: number;
  room_inventory: Record<string, number> | string | null;
  bed_inventory: Record<string, number> | string | null;
  check_in: string | null;
  check_out: string | null;
  coordinators: unknown;
  /** Derivada en findAll desde la planilla de distribución; no es columna. */
  discipline_ids?: string[] | null;
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

/**
 * Deja la lista de contactos del hotel en un estado seguro para guardar.
 *
 * La columna es jsonb y en este proyecto no corre ningún ValidationPipe, así
 * que lo que llegue en el cuerpo entraría tal cual: acá se descartan los
 * elementos sin nombre, se recortan los textos, se acotan rol y turno al
 * catálogo y se limita el largo de la lista. Un contacto sin rol es un
 * coordinador, que es el caso normal.
 */
const MAX_CONTACTOS_HOTEL = 20;
const LARGO_MAX_TEXTO = 120;

function sanitizeCoordinators(value: unknown): AccommodationCoordinatorDto[] {
  const source =
    typeof value === 'string'
      ? (() => {
          try {
            return value.trim() ? JSON.parse(value) : [];
          } catch {
            return [];
          }
        })()
      : value;
  if (!Array.isArray(source)) return [];

  const roles = new Set<string>(ACCOMMODATION_CONTACT_ROLES);
  const shifts = new Set<string>(ACCOMMODATION_CONTACT_SHIFTS);
  const texto = (raw: unknown) =>
    typeof raw === 'string' ? raw.trim().slice(0, LARGO_MAX_TEXTO) : '';

  const limpios: AccommodationCoordinatorDto[] = [];
  for (const item of source.slice(0, MAX_CONTACTOS_HOTEL)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const name = texto(row.name);
    if (!name) continue;
    const role = String(row.role ?? '').toUpperCase();
    const shift = String(row.shift ?? '').toUpperCase();
    limpios.push({
      name,
      phone: texto(row.phone) || null,
      role: (roles.has(role) ? role : 'COORDINADOR') as AccommodationCoordinatorDto['role'],
      // El turno sólo lo anota la planilla en el apoyo; vacío es válido.
      shift: (shifts.has(shift) ? shift : null) as AccommodationCoordinatorDto['shift'],
    });
  }
  return limpios;
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
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /** Sube la foto del hotel (data URL base64) al storage y guarda photo_url. */
  async uploadPhoto(id: string, dataUrl: string) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) throw new BadRequestException('Invalid photo payload');

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const extension = contentType.split('/')[1] || 'jpg';
    const path = `${id}/${Date.now()}.${extension}`;

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload accommodation photos',
      );
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin.storage
      .from('venue-photos')
      .upload(`hotels/${path}`, buffer, { contentType, upsert: true });
    if (error) {
      throw new InternalServerErrorException(error.message || 'Error uploading accommodation photo');
    }

    const { data } = admin.storage.from('venue-photos').getPublicUrl(`hotels/${path}`);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException('Error resolving accommodation photo URL');
    }

    return this.update(id, { photoUrl: publicUrl });
  }

  private toEntity(row: AccommodationRow): Accommodation {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      accommodationType: String(row.accommodation_type || 'HOTEL').toUpperCase(),
      tower: row.tower ?? null,
      address: row.address,
      photoUrl: row.photo_url ?? null,
      geoLocation: row.geo_location,
      totalCapacity: row.total_capacity,
      roomInventory: parseJsonObject(row.room_inventory),
      bedInventory: parseJsonObject(row.bed_inventory),
      checkIn: row.check_in ?? null,
      checkOut: row.check_out ?? null,
      coordinators: sanitizeCoordinators(row.coordinators),
      disciplineIds: row.discipline_ids ?? [],
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
    if (dto.accommodationType !== undefined) {
      set.push(`accommodation_type = $${index++}`);
      params.push(String(dto.accommodationType || 'HOTEL').toUpperCase());
    }
    if (dto.tower !== undefined) {
      set.push(`tower = $${index++}`);
      params.push(dto.tower ?? null);
    }
    if (dto.address !== undefined) {
      set.push(`address = $${index++}`);
      params.push(dto.address ?? null);
    }
    if (dto.photoUrl !== undefined) {
      set.push(`photo_url = $${index++}`);
      params.push(dto.photoUrl ?? null);
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
    if (dto.checkIn !== undefined) {
      set.push(`check_in = $${index++}`);
      params.push(dto.checkIn ?? null);
    }
    if (dto.checkOut !== undefined) {
      set.push(`check_out = $${index++}`);
      params.push(dto.checkOut ?? null);
    }
    if (dto.coordinators !== undefined) {
      set.push(`coordinators = $${index++}::jsonb`);
      params.push(JSON.stringify(sanitizeCoordinators(dto.coordinators)));
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

      const columns = ['event_id', 'name', 'accommodation_type'];
      const values: unknown[] = [
        createDto.eventId,
        createDto.name,
        String(createDto.accommodationType || 'HOTEL').toUpperCase(),
      ];
      let index = 4;

      const optionalField = (col: string, value: unknown, cast = '') => {
        columns.push(col);
        values.push(value);
        return `$${index++}${cast}`;
      };

      const placeholders: string[] = ['$1', '$2', '$3'];
      placeholders.push(optionalField('tower', createDto.tower ?? null));
      placeholders.push(optionalField('address', createDto.address ?? null));
      if (createDto.photoUrl !== undefined) {
        placeholders.push(optionalField('photo_url', createDto.photoUrl ?? null));
      }
      if (createDto.geoLocation !== undefined && createDto.geoLocation !== null) {
        columns.push('geo_location');
        placeholders.push(`ST_SetSRID(ST_GeomFromGeoJSON($${index++}), 4326)`);
        values.push(JSON.stringify(createDto.geoLocation));
      }
      placeholders.push(optionalField('total_capacity', createDto.totalCapacity ?? 0));
      placeholders.push(optionalField('room_inventory', JSON.stringify(createDto.roomInventory ?? {}), '::jsonb'));
      placeholders.push(optionalField('bed_inventory', JSON.stringify(createDto.bedInventory ?? {}), '::jsonb'));
      if (createDto.checkIn !== undefined) placeholders.push(optionalField('check_in', createDto.checkIn ?? null));
      if (createDto.checkOut !== undefined) placeholders.push(optionalField('check_out', createDto.checkOut ?? null));
      if (createDto.coordinators !== undefined) {
        placeholders.push(
          optionalField(
            'coordinators',
            JSON.stringify(sanitizeCoordinators(createDto.coordinators)),
            '::jsonb',
          ),
        );
      }

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

  /**
   * @param delegationId Jefe de Misión: sólo los hoteles donde se aloja su
   * delegación; el resto de la operación ve todos.
   */
  /**
   * Sólo id y nombre de cada hotel. El listado completo está acotado a los
   * hoteles de la delegación del Jefe de Misión, y por eso en sus tarjetas de
   * viaje el destino aparecía como una dirección suelta ("2 Norte 65") en vez
   * de "Hotel Bordeplaza": el hotel al que va el bus no tiene por qué ser uno
   * de los suyos. El nombre no descubre nada que la tarjeta no diga ya.
   */
  async findNames() {
    try {
      const filas: { id: string; name: string | null }[] =
        await this.dataSource.query(
          `select id, name from logistics.accommodations order by name`,
        );
      return filas;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching accommodation names',
      );
    }
  }

  async findAll(delegationId?: string | null) {
    try {
      // Los deportes alojados en cada hotel salen de la planilla de
      // distribución (logistics.delegation_hotels), que es donde se decide
      // quién duerme dónde. Viajan con el listado a propósito: el portal los
      // pinta como fichas, igual que en Sedes, y pedirlos aparte sería otra
      // ida y vuelta al servidor nada más que para eso.
      //
      // Acotados a la delegación cuando la hay: al Jefe de Misión le importan
      // los deportes de *su* región en ese hotel, no los de las otras que
      // comparten el edificio.
      const rows = (await this.dataSource.query(
        `
        select h.*,
               coalesce(d.ids, '{}'::uuid[]) as discipline_ids
        from logistics.accommodations h
        left join lateral (
          select array_agg(distinct dh.discipline_id) as ids
          from logistics.delegation_hotels dh
          where dh.accommodation_id = h.id
            and ($1::uuid is null or dh.delegation_id = $1)
        ) d on true
        where ($1::uuid is null or h.id in ${delegationHotelsSql('$1')})
        order by h.created_at desc
      `,
        [delegationId ?? null],
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
