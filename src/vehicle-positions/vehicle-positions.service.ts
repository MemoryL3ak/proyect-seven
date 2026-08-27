import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { CreateVehiclePositionDto } from './dto/create-vehicle-position.dto';
import { UpdateVehiclePositionDto } from './dto/update-vehicle-position.dto';
import { VehiclePosition } from './entities/vehicle-position.entity';
import { TripProximityService } from './trip-proximity.service';

type VehiclePositionRow = {
  id: string;
  event_id: string;
  vehicle_id: string | null;
  driver_id: string;
  trip_id: string | null;
  timestamp: string;
  location: unknown;
  lat?: number | null;
  lng?: number | null;
  speed: number | null;
  heading: number | null;
  created_at: string;
};

// SELECT compartido por las consultas raw: la geometría PostGIS viaja como
// GeoJSON (no como hex WKB, que el cliente no puede decodificar) y lat/lng
// van como numéricos planos listos para el mapa.
const POSITION_SELECT = `
  SELECT id,
         event_id,
         vehicle_id,
         driver_id,
         trip_id,
         "timestamp",
         ST_AsGeoJSON(location)::json AS location,
         lat,
         lng,
         speed,
         heading,
         created_at
    FROM telemetry.vehicle_positions`;

@Injectable()
export class VehiclePositionsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(VehiclePosition)
    private readonly vehiclePositionRepository: Repository<VehiclePosition>,
    private readonly tripProximity: TripProximityService,
  ) {}

  private mapRow(row: VehiclePositionRow) {
    return {
      id: row.id,
      eventId: row.event_id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      tripId: row.trip_id,
      timestamp: new Date(row.timestamp),
      location: row.location,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      speed: row.speed,
      heading: row.heading,
      createdAt: new Date(row.created_at),
    };
  }

  private toRow(dto: CreateVehiclePositionDto | UpdateVehiclePositionDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.vehicleId !== undefined) {
      row.vehicle_id = dto.vehicleId ?? null;
    }
    if ((dto as any).driverId !== undefined) {
      row.driver_id = (dto as any).driverId;
    }
    if ((dto as any).tripId !== undefined) {
      row.trip_id = (dto as any).tripId ?? null;
    }
    if (dto.timestamp !== undefined) {
      row.timestamp = dto.timestamp;
    }
    if (dto.location !== undefined) {
      row.location = dto.location;
    }
    if (dto.speed !== undefined) {
      row.speed = dto.speed ?? null;
    }
    if (dto.heading !== undefined) {
      row.heading = dto.heading ?? null;
    }

    return row;
  }

  private toEntity(row: VehiclePositionRow): VehiclePosition {
    return {
      id: row.id,
      eventId: row.event_id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      tripId: row.trip_id,
      timestamp: new Date(row.timestamp),
      location: row.location,
      speed: row.speed,
      heading: row.heading,
      createdAt: new Date(row.created_at),
    };
  }

  // Resolves the driver's currently-active trip (heading to pickup or with the
  // passenger on board) so each fix can be tagged with it. Returns null when the
  // driver has no active trip — the position is still stored, just untagged.
  private async resolveActiveTripId(driverId: string): Promise<string | null> {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `SELECT id
           FROM transport.trips
          WHERE driver_id = $1
            AND status IN ('EN_ROUTE','PICKED_UP')
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1`,
        [driverId],
      )) as Array<{ id: string }>;
      return rows[0]?.id ?? null;
    } catch {
      // Never let trip resolution block storing the position.
      return null;
    }
  }

  async create(createVehiclePositionDto: CreateVehiclePositionDto) {
    const row = this.toRow(createVehiclePositionDto);
    // Tag the fix with the driver's active trip unless the caller already did.
    // Done here (server-side) so the mobile app doesn't need to track trips.
    if (row.trip_id === undefined && createVehiclePositionDto.driverId) {
      row.trip_id = await this.resolveActiveTripId(
        createVehiclePositionDto.driverId,
      );
    }

    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating vehicle position',
      );
    }

    const created = data as VehiclePositionRow;
    // Con el fix ya guardado, evaluar avisos de proximidad al pasajero.
    // Fire-and-forget: nunca bloquea ni rompe la ingesta.
    const fixLat =
      typeof created.lat === 'number'
        ? created.lat
        : this.coordFromDto(createVehiclePositionDto, 1);
    const fixLng =
      typeof created.lng === 'number'
        ? created.lng
        : this.coordFromDto(createVehiclePositionDto, 0);
    if (created.trip_id && fixLat !== null && fixLng !== null) {
      void this.tripProximity.check(
        created.trip_id,
        fixLat,
        fixLng,
        created.speed ?? null,
      );
    }

    return this.toEntity(created);
  }

  // GeoJSON Point del DTO: coordinates = [lng, lat]. Respaldo por si el
  // insert de PostgREST no devolviera las columnas generadas lat/lng.
  private coordFromDto(
    dto: CreateVehiclePositionDto,
    index: 0 | 1,
  ): number | null {
    const coords = (dto.location as { coordinates?: unknown } | undefined)
      ?.coordinates;
    if (!Array.isArray(coords)) return null;
    const value = coords[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  async findLatestByVehicle(vehicleId: string) {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `${POSITION_SELECT}
          WHERE vehicle_id = $1
          ORDER BY "timestamp" DESC
          LIMIT 1`,
        [vehicleId],
      )) as VehiclePositionRow[];
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching latest vehicle position',
      );
    }
  }

  async findLatestByDriver(driverId: string) {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `${POSITION_SELECT}
          WHERE driver_id = $1
          ORDER BY "timestamp" DESC
          LIMIT 1`,
        [driverId],
      )) as VehiclePositionRow[];
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching latest driver position',
      );
    }
  }

  // Última posición del viaje: la clave más precisa para el portal del
  // pasajero — no depende de que el viaje tenga vehicle_id asignado.
  async findLatestByTrip(tripId: string) {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `${POSITION_SELECT}
          WHERE trip_id = $1
          ORDER BY "timestamp" DESC
          LIMIT 1`,
        [tripId],
      )) as VehiclePositionRow[];
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching latest trip position',
      );
    }
  }

  // Returns only the latest fix per driver, within the recent window.
  // The admin polls this every 1-3s; returning the full history (tens of
  // thousands of rows) was the main cause of perceived "non-realtime" lag
  // during field testing — most of the time was serialization + transport,
  // not DB work.
  async findAll() {
    try {
      const rows = await this.vehiclePositionRepository.query(
        `SELECT DISTINCT ON (driver_id)
           id,
           event_id,
           vehicle_id,
           driver_id,
           trip_id,
           "timestamp",
           ST_AsGeoJSON(location)::json AS location,
           lat,
           lng,
           speed,
           heading,
           created_at
         FROM telemetry.vehicle_positions
         WHERE created_at > NOW() - INTERVAL '30 minutes'
         ORDER BY driver_id, "timestamp" DESC`,
      );
      return rows.map((row: VehiclePositionRow) => this.mapRow(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching vehicle positions',
      );
    }
  }

  // Full ordered breadcrumb of a trip — the raw material to redraw the route
  // the driver actually took. Ascending by timestamp so the path is in order.
  async findByTrip(tripId: string) {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `${POSITION_SELECT}
          WHERE trip_id = $1
          ORDER BY "timestamp" ASC`,
        [tripId],
      )) as VehiclePositionRow[];
      return rows.map((row) => this.mapRow(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching trip breadcrumb',
      );
    }
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching vehicle position',
      );
    }

    if (!data) {
      throw new NotFoundException(`Vehicle position with id ${id} not found`);
    }

    return this.toEntity(data as VehiclePositionRow);
  }

  async update(id: string, updateVehiclePositionDto: UpdateVehiclePositionDto) {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .update(this.toRow(updateVehiclePositionDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating vehicle position',
      );
    }

    if (!data) {
      throw new NotFoundException(`Vehicle position with id ${id} not found`);
    }

    return this.toEntity(data as VehiclePositionRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting vehicle position',
      );
    }

    if (!data) {
      throw new NotFoundException(`Vehicle position with id ${id} not found`);
    }

    return this.toEntity(data as VehiclePositionRow);
  }
}
