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
  origin: string | null;
  destination: string | null;
  trip_type: string | null;
  client_type: string | null;
  status: string;
  route_geometry: unknown | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TripAthleteRow = {
  trip_id: string;
  athlete_id: string;
};

type AthleteRow = {
  id: string;
  full_name: string;
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
    if (dto.origin !== undefined) {
      row.origin = dto.origin ?? null;
    }
    if (dto.destination !== undefined) {
      row.destination = dto.destination ?? null;
    }
    if (dto.tripType !== undefined) {
      row.trip_type = dto.tripType ?? null;
    }
    if (dto.clientType !== undefined) {
      row.client_type = dto.clientType ?? null;
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
      origin: row.origin,
      destination: row.destination,
      tripType: row.trip_type,
      clientType: row.client_type,
      status: row.status,
      routeGeometry: row.route_geometry,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async attachAthletes(trips: Trip[]) {
    if (trips.length === 0) return trips;
    const tripIds = trips.map((item) => item.id);

    const { data: links, error: linksError } = await this.supabase
      .schema('transport')
      .from('trip_athletes')
      .select('trip_id, athlete_id')
      .in('trip_id', tripIds);

    if (linksError) {
      throw new InternalServerErrorException(
        linksError.message || 'Error fetching trip athletes',
      );
    }

    const safeLinks = (links ?? []) as TripAthleteRow[];
    if (safeLinks.length === 0) {
      return trips.map((trip) => ({
        ...trip,
        athleteIds: [],
        athleteNames: [],
      }));
    }

    const athleteIds = Array.from(
      new Set(safeLinks.map((link) => link.athlete_id)),
    );

    const { data: athletes, error: athletesError } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name')
      .in('id', athleteIds);

    if (athletesError) {
      throw new InternalServerErrorException(
        athletesError.message || 'Error fetching athletes',
      );
    }

    const athleteMap = new Map<string, string>();
    (athletes ?? []).forEach((athlete) => {
      const row = athlete as AthleteRow;
      athleteMap.set(row.id, row.full_name);
    });

    const byTrip = new Map<string, string[]>();
    safeLinks.forEach((link) => {
      const current = byTrip.get(link.trip_id) ?? [];
      current.push(link.athlete_id);
      byTrip.set(link.trip_id, current);
    });

    return trips.map((trip) => {
      const ids = byTrip.get(trip.id) ?? [];
      const names = ids
        .map((id) => athleteMap.get(id))
        .filter((name): name is string => Boolean(name));
      return {
        ...trip,
        athleteIds: ids,
        athleteNames: names,
      };
    });
  }

  private async setTripAthletes(tripId: string, athleteIds: string[]) {
    const { error: deleteError } = await this.supabase
      .schema('transport')
      .from('trip_athletes')
      .delete()
      .eq('trip_id', tripId);

    if (deleteError) {
      throw new InternalServerErrorException(
        deleteError.message || 'Error clearing trip athletes',
      );
    }

    if (athleteIds.length === 0) return;

    const payload = athleteIds.map((athleteId) => ({
      trip_id: tripId,
      athlete_id: athleteId,
    }));

    const { error: insertError } = await this.supabase
      .schema('transport')
      .from('trip_athletes')
      .insert(payload);

    if (insertError) {
      throw new InternalServerErrorException(
        insertError.message || 'Error assigning trip athletes',
      );
    }
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

    if (createTripDto.athleteIds) {
      await this.setTripAthletes(
        (data as TripRow).id,
        createTripDto.athleteIds,
      );
    }

    return this.findOne((data as TripRow).id);
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

    const trips = (data ?? []).map((row) => this.toEntity(row as TripRow));
    return this.attachAthletes(trips);
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

    const trip = this.toEntity(data as TripRow);
    const [withAthletes] = await this.attachAthletes([trip]);
    return withAthletes;
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

    if (updateTripDto.athleteIds) {
      await this.setTripAthletes(id, updateTripDto.athleteIds);
    }

    return this.findOne(id);
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
