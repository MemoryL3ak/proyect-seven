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

type VehiclePositionRow = {
  id: string;
  event_id: string;
  vehicle_id: string | null;
  driver_id: string;
  timestamp: string;
  location: unknown;
  speed: number | null;
  heading: number | null;
  created_at: string;
};

@Injectable()
export class VehiclePositionsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(VehiclePosition)
    private readonly vehiclePositionRepository: Repository<VehiclePosition>,
  ) {}

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
      timestamp: new Date(row.timestamp),
      location: row.location,
      speed: row.speed,
      heading: row.heading,
      createdAt: new Date(row.created_at),
    };
  }

  async create(createVehiclePositionDto: CreateVehiclePositionDto) {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .insert(this.toRow(createVehiclePositionDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating vehicle position',
      );
    }

    return this.toEntity(data as VehiclePositionRow);
  }

  async findLatestByVehicle(vehicleId: string): Promise<VehiclePosition | null> {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching latest vehicle position',
      );
    }

    if (!data) return null;
    return this.toEntity(data as VehiclePositionRow);
  }

  async findLatestByDriver(driverId: string): Promise<VehiclePosition | null> {
    const { data, error } = await this.supabase
      .schema('telemetry')
      .from('vehicle_positions')
      .select('*')
      .eq('driver_id', driverId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching latest driver position',
      );
    }

    if (!data) return null;
    return this.toEntity(data as VehiclePositionRow);
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
           "timestamp",
           ST_AsGeoJSON(location)::json AS location,
           speed,
           heading,
           created_at
         FROM telemetry.vehicle_positions
         WHERE created_at > NOW() - INTERVAL '30 minutes'
         ORDER BY driver_id, "timestamp" DESC`,
      );
      return rows.map((row: VehiclePositionRow) => ({
        id: row.id,
        eventId: row.event_id,
        vehicleId: row.vehicle_id,
        driverId: row.driver_id,
        timestamp: new Date(row.timestamp),
        location: row.location,
        speed: row.speed,
        heading: row.heading,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching vehicle positions',
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
