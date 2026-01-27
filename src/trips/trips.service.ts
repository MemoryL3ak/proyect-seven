import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Trip } from './entities/trip.entity';

type TripRow = {
  id: string;
  event_id: string;
  driver_id: string;
  vehicle_id: string;
  status: string;
  route_geometry: unknown | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class TripsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private toRow(dto: CreateTripDto | UpdateTripDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) {
      row.event_id = dto.eventId;
    }
    if (dto.driverId !== undefined) {
      row.driver_id = dto.driverId;
    }
    if (dto.vehicleId !== undefined) {
      row.vehicle_id = dto.vehicleId;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.routeGeometry !== undefined) {
      row.route_geometry = dto.routeGeometry ?? null;
    }
    if (dto.scheduledAt !== undefined) {
      row.scheduled_at = dto.scheduledAt ?? null;
    }
    if (dto.startedAt !== undefined) {
      row.started_at = dto.startedAt ?? null;
    }
    if (dto.completedAt !== undefined) {
      row.completed_at = dto.completedAt ?? null;
    }

    return row;
  }

  private toEntity(row: TripRow): Trip {
    return {
      id: row.id,
      eventId: row.event_id,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      status: row.status,
      routeGeometry: row.route_geometry,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(createTripDto: CreateTripDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .insert(this.toRow(createTripDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating trip',
      );
    }

    return this.toEntity(data as TripRow);
  }

  async findAll() {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching trips',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as TripRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching trip',
      );
    }

    if (!data) {
      throw new NotFoundException(`Trip with id ${id} not found`);
    }

    return this.toEntity(data as TripRow);
  }

  async update(id: string, updateTripDto: UpdateTripDto) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .update(this.toRow(updateTripDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating trip',
      );
    }

    if (!data) {
      throw new NotFoundException(`Trip with id ${id} not found`);
    }

    return this.toEntity(data as TripRow);
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting trip',
      );
    }

    if (!data) {
      throw new NotFoundException(`Trip with id ${id} not found`);
    }

    return this.toEntity(data as TripRow);
  }
}
