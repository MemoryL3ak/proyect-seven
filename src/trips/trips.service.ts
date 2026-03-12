import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Trip } from './entities/trip.entity';

type TripRow = {
  id: string;
  event_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  requester_athlete_id: string | null;
  destination_venue_id: string | null;
  requested_vehicle_type: string | null;
  passenger_count: number | null;
  notes: string | null;
  requested_at: string | null;
  origin: string | null;
  destination: string | null;
  trip_type: string | null;
  client_type: string | null;
  trip_cost: number | null;
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
    @InjectRepository(Trip)
    private readonly tripRepository: Repository<Trip>,
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
    if (dto.requesterAthleteId !== undefined) {
      row.requester_athlete_id = dto.requesterAthleteId ?? null;
    }
    if (dto.destinationVenueId !== undefined) {
      row.destination_venue_id = dto.destinationVenueId ?? null;
    }
    if (dto.requestedVehicleType !== undefined) {
      row.requested_vehicle_type = dto.requestedVehicleType ?? null;
    }
    if (dto.passengerCount !== undefined) {
      row.passenger_count = dto.passengerCount ?? null;
    }
    if (dto.notes !== undefined) {
      row.notes = dto.notes ?? null;
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
    if (dto.tripCost !== undefined) {
      row.trip_cost = dto.tripCost ?? null;
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
    if (dto.requestedAt !== undefined) {
      row.requested_at = dto.requestedAt ?? null;
    }

    return row;
  }

  private inferStatus(
    dto: CreateTripDto | UpdateTripDto,
    currentStatus?: string | null,
  ) {
    const hasAssignedResources =
      (dto.driverId !== undefined && Boolean(dto.driverId)) ||
      (dto.vehicleId !== undefined && Boolean(dto.vehicleId));

    if (hasAssignedResources) {
      if (
        dto.status === 'REQUESTED' ||
        !dto.status && (!currentStatus || currentStatus === 'REQUESTED')
      ) {
        return 'SCHEDULED';
      }
      if (dto.status !== undefined) {
        return dto.status;
      }
      return currentStatus;
    }

    if (dto.status !== undefined) {
      return dto.status;
    }

    if (!currentStatus && dto.tripType === 'PORTAL_REQUEST') {
      return 'REQUESTED';
    }

    return currentStatus;
  }

  private isMissingPassengerCountColumn(error: { message?: string } | null | undefined) {
    const message = error?.message ?? '';
    return message.includes("Could not find the 'passenger_count' column");
  }

  private withoutPassengerCount(row: Record<string, unknown>) {
    const next = { ...row };
    delete next.passenger_count;
    return next;
  }

  private toEntity(row: TripRow): Trip {
    return {
      id: row.id,
      eventId: row.event_id,
      driverId: row.driver_id,
      vehicleId: row.vehicle_id,
      requesterAthleteId: row.requester_athlete_id,
      destinationVenueId: row.destination_venue_id,
      requestedVehicleType: row.requested_vehicle_type,
      passengerCount: row.passenger_count,
      notes: row.notes,
      requestedAt: row.requested_at ? new Date(row.requested_at) : null,
      origin: row.origin,
      destination: row.destination,
      tripType: row.trip_type,
      clientType: row.client_type,
      tripCost: row.trip_cost,
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
    const row = this.toRow(createTripDto);
    const inferredStatus = this.inferStatus(createTripDto, null);
    if (inferredStatus) {
      row.status = inferredStatus;
    }

    let { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .insert(row)
      .select('*')
      .single();

    if (this.isMissingPassengerCountColumn(error)) {
      ({ data, error } = await this.supabase
        .schema('transport')
        .from('trips')
        .insert(this.withoutPassengerCount(row))
        .select('*')
        .single());
    }

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
    try {
      const trips = await this.tripRepository.find({
        order: { createdAt: 'DESC' },
      });
      return trips.map((trip) => ({
        ...trip,
        athleteIds: [],
        athleteNames: [],
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching trips',
      );
    }
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
    const currentTrip = await this.findOne(id);
    const row = this.toRow(updateTripDto);
    const inferredStatus = this.inferStatus(updateTripDto, currentTrip.status);
    if (inferredStatus !== undefined) {
      row.status = inferredStatus;
    }

    let { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (this.isMissingPassengerCountColumn(error)) {
      ({ data, error } = await this.supabase
        .schema('transport')
        .from('trips')
        .update(this.withoutPassengerCount(row))
        .eq('id', id)
        .select('*')
        .maybeSingle());
    }

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
