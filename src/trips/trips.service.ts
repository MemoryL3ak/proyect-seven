import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Trip } from './entities/trip.entity';
import { TripMessage } from './entities/trip-message.entity';
import { ProviderRate } from '../providers/entities/provider-rate.entity';

type TripRow = {
  id: string;
  event_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  requester_athlete_id: string | null;
  destination_venue_id: string | null;
  destination_hotel_id: string | null;
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
  driver_rating: number | null;
  rating_comment: string | null;
  rated_at: string | null;
  passenger_lat: number | null;
  passenger_lng: number | null;
  is_round_trip: boolean;
  parent_trip_id: string | null;
  leg_type: string | null;
  committee_validated: boolean;
  committee_validated_at: string | null;
  committee_validated_by: string | null;
  metadata: Record<string, unknown>;
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
    @InjectRepository(TripMessage)
    private readonly messageRepository: Repository<TripMessage>,
    @InjectRepository(ProviderRate)
    private readonly rateRepository: Repository<ProviderRate>,
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
    if (dto.vehiclePlate !== undefined) {
      row.vehicle_plate = dto.vehiclePlate ?? null;
    }
    if (dto.requesterAthleteId !== undefined) {
      row.requester_athlete_id = dto.requesterAthleteId ?? null;
    }
    if (dto.destinationVenueId !== undefined) {
      row.destination_venue_id = dto.destinationVenueId ?? null;
    }
    if (dto.destinationHotelId !== undefined) {
      row.destination_hotel_id = dto.destinationHotelId ?? null;
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
    if (dto.driverRating !== undefined) {
      row.driver_rating = dto.driverRating ?? null;
    }
    if (dto.ratingComment !== undefined) {
      row.rating_comment = dto.ratingComment ?? null;
    }
    if (dto.ratedAt !== undefined) {
      row.rated_at = dto.ratedAt ?? null;
    }
    if (dto.isRoundTrip !== undefined) {
      row.is_round_trip = dto.isRoundTrip ?? false;
    }
    if (dto.parentTripId !== undefined) {
      row.parent_trip_id = dto.parentTripId ?? null;
    }
    if (dto.legType !== undefined) {
      row.leg_type = dto.legType ?? null;
    }
    if (dto.committeeValidated !== undefined) {
      row.committee_validated = dto.committeeValidated ?? false;
      if (dto.committeeValidated) {
        row.committee_validated_at = new Date().toISOString();
      }
    }
    if (dto.committeeValidatedBy !== undefined) {
      row.committee_validated_by = dto.committeeValidatedBy ?? null;
    }
    if (dto.metadata !== undefined) {
      row.metadata = dto.metadata;
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

    if (dto.status) {
      return dto.status;
    }

    if (!currentStatus && dto.tripType === 'PORTAL_REQUEST') {
      return 'REQUESTED';
    }

    if (!currentStatus) {
      return 'SCHEDULED';
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
      vehiclePlate: row.vehicle_plate,
      requesterAthleteId: row.requester_athlete_id,
      destinationVenueId: row.destination_venue_id,
      destinationHotelId: row.destination_hotel_id,
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
      driverRating: row.driver_rating,
      ratingComment: row.rating_comment,
      ratedAt: row.rated_at ? new Date(row.rated_at) : null,
      passengerLat: row.passenger_lat,
      passengerLng: row.passenger_lng,
      isRoundTrip: row.is_round_trip ?? false,
      parentTripId: row.parent_trip_id,
      legType: row.leg_type,
      committeeValidated: row.committee_validated ?? false,
      committeeValidatedAt: row.committee_validated_at ? new Date(row.committee_validated_at) : null,
      committeeValidatedBy: row.committee_validated_by,
      metadata: row.metadata ?? {},
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

  private async lookupClientPrice(driverId: string | undefined | null, fleetType: string | undefined | null, tripType: string | undefined | null): Promise<number | null> {
    if (!driverId || !fleetType || !tripType) return null;
    try {
      // Get driver's provider
      const { data: driver } = await this.supabase
        .schema('core')
        .from('drivers')
        .select('provider_id')
        .eq('id', driverId)
        .maybeSingle();
      if (!driver?.provider_id) return null;

      const rate = await this.rateRepository.findOne({
        where: { providerId: driver.provider_id, fleetType, tripType },
      });
      return rate ? Number(rate.clientPrice) : null;
    } catch {
      return null;
    }
  }

  private async insertTrip(row: Record<string, unknown>) {
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

    return data as TripRow;
  }

  async create(createTripDto: CreateTripDto) {
    // Extract return-trip data before building outbound row
    const { returnScheduledAt, returnOrigin, returnDestination, returnDestinationVenueId, ...outboundDto } = createTripDto;

    const row = this.toRow(outboundDto);
    const inferredStatus = this.inferStatus(outboundDto, null);
    if (inferredStatus) {
      row.status = inferredStatus;
    }

    if (createTripDto.isRoundTrip) {
      row.leg_type = 'OUTBOUND';
    }

    // Auto-assign cost from provider rates
    if (row.trip_cost === undefined || row.trip_cost === null) {
      const cost = await this.lookupClientPrice(
        createTripDto.driverId,
        createTripDto.requestedVehicleType,
        createTripDto.tripType,
      );
      if (cost !== null) row.trip_cost = cost;
    }

    const outboundData = await this.insertTrip(row);

    if (createTripDto.athleteIds) {
      await this.setTripAthletes(outboundData.id, createTripDto.athleteIds);
    }

    // Auto-create return trip when round trip
    if (createTripDto.isRoundTrip) {
      const returnRow = this.toRow({
        eventId: createTripDto.eventId,
        requesterAthleteId: createTripDto.requesterAthleteId,
        requestedVehicleType: createTripDto.requestedVehicleType,
        passengerCount: createTripDto.passengerCount,
        tripType: createTripDto.tripType,
        clientType: createTripDto.clientType,
        notes: createTripDto.notes,
        origin: returnOrigin || createTripDto.destination,
        destination: returnDestination || createTripDto.origin,
        destinationVenueId: returnDestinationVenueId || undefined,
        scheduledAt: returnScheduledAt,
        requestedAt: createTripDto.requestedAt,
      });
      returnRow.status = this.inferStatus({} as CreateTripDto, null) || 'REQUESTED';
      returnRow.is_round_trip = true;
      returnRow.parent_trip_id = outboundData.id;
      returnRow.leg_type = 'RETURN';

      const returnData = await this.insertTrip(returnRow);

      if (createTripDto.athleteIds) {
        await this.setTripAthletes(returnData.id, createTripDto.athleteIds);
      }
    }

    return this.findOne(outboundData.id);
  }

  async findAll(requesterAthleteId?: string) {
    try {
      const where = requesterAthleteId ? { requesterAthleteId } : undefined;
      const trips = await this.tripRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });

      // Group child trips under their parents
      const tripMap = new Map<string, any>();
      const childTrips: Trip[] = [];

      for (const trip of trips) {
        const extended = { ...trip, athleteIds: [] as string[], athleteNames: [] as string[], childTrips: [] as Trip[] };
        if (trip.parentTripId) {
          childTrips.push(trip);
        } else {
          tripMap.set(trip.id, extended);
        }
      }

      for (const child of childTrips) {
        const parent = tripMap.get(child.parentTripId!);
        if (parent) {
          parent.childTrips.push({ ...child, athleteIds: [], athleteNames: [] });
        } else {
          // Orphan child – show as standalone
          tripMap.set(child.id, { ...child, athleteIds: [], athleteNames: [], childTrips: [] });
        }
      }

      return Array.from(tripMap.values());
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

    // Attach child trips (return legs)
    const { data: childRows } = await this.supabase
      .schema('transport')
      .from('trips')
      .select('*')
      .eq('parent_trip_id', id);

    if (childRows && childRows.length > 0) {
      const childTrips = (childRows as TripRow[]).map((row) => this.toEntity(row));
      const childrenWithAthletes = await this.attachAthletes(childTrips);
      (withAthletes as any).childTrips = childrenWithAthletes;
    }

    return withAthletes;
  }

  async update(id: string, updateTripDto: UpdateTripDto) {
    const currentTrip = await this.findOne(id);

    // ── Auto-generate bitácora entries from detected changes ──
    const existingMeta = (currentTrip.metadata ?? {}) as Record<string, unknown>;
    const existingLog = Array.isArray(existingMeta.log) ? existingMeta.log : [];
    const incomingLog = Array.isArray(updateTripDto.metadata?.log) ? updateTripDto.metadata.log : [];
    const autoEntries: { action: string; by: string; at: string; detail?: string }[] = [];
    const now = new Date().toISOString();
    const by = 'Sistema';

    if (updateTripDto.driverId !== undefined && updateTripDto.driverId !== currentTrip.driverId) {
      autoEntries.push({ action: 'DRIVER_ASSIGNED', by, at: now, detail: updateTripDto.driverId || 'removido' });
    }
    if (updateTripDto.vehicleId !== undefined && updateTripDto.vehicleId !== currentTrip.vehicleId) {
      autoEntries.push({ action: 'VEHICLE_ASSIGNED', by, at: now, detail: updateTripDto.vehicleId || 'removido' });
    }
    if (updateTripDto.status !== undefined && updateTripDto.status !== currentTrip.status) {
      autoEntries.push({ action: 'STATUS_CHANGED', by, at: now, detail: `${currentTrip.status} → ${updateTripDto.status}` });
    }
    if (updateTripDto.scheduledAt !== undefined) {
      const oldSch = currentTrip.scheduledAt ? new Date(currentTrip.scheduledAt).toISOString() : null;
      if (updateTripDto.scheduledAt !== oldSch) {
        autoEntries.push({ action: 'SCHEDULE_CHANGED', by, at: now });
      }
    }
    if (updateTripDto.requestedVehicleType !== undefined && updateTripDto.requestedVehicleType !== currentTrip.requestedVehicleType) {
      autoEntries.push({ action: 'VEHICLE_TYPE_CHANGED', by, at: now, detail: `${currentTrip.requestedVehicleType ?? '-'} → ${updateTripDto.requestedVehicleType}` });
    }
    if (updateTripDto.passengerCount !== undefined && updateTripDto.passengerCount !== currentTrip.passengerCount) {
      autoEntries.push({ action: 'PASSENGER_COUNT_CHANGED', by, at: now, detail: `${currentTrip.passengerCount ?? 0} → ${updateTripDto.passengerCount}` });
    }

    const mergedLog = [...existingLog, ...incomingLog, ...autoEntries];
    updateTripDto.metadata = {
      ...existingMeta,
      ...(updateTripDto.metadata ?? {}),
      log: mergedLog,
    };

    const row = this.toRow(updateTripDto);
    const inferredStatus = this.inferStatus(updateTripDto, currentTrip.status);
    if (inferredStatus !== undefined) {
      row.status = inferredStatus;
    }

    // Re-calculate cost when driver or vehicle type changes
    if (updateTripDto.driverId !== undefined || updateTripDto.requestedVehicleType !== undefined || updateTripDto.tripType !== undefined) {
      const driverId = updateTripDto.driverId ?? currentTrip.driverId;
      const fleetType = updateTripDto.requestedVehicleType ?? currentTrip.requestedVehicleType;
      const tripType = updateTripDto.tripType ?? currentTrip.tripType;
      const cost = await this.lookupClientPrice(driverId, fleetType, tripType);
      if (cost !== null) row.trip_cost = cost;
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

  /* ─── Passenger Position ─── */

  async updatePassengerPosition(tripId: string, lat: number, lng: number) {
    await this.tripRepository.update(tripId, {
      passengerLat: lat,
      passengerLng: lng,
    });
    return { ok: true };
  }

  /* ─── Trip Chat Messages ─── */

  async getMessages(tripId: string, since?: string) {
    const where: Record<string, any> = { tripId };
    if (since) {
      where.createdAt = MoreThan(new Date(since));
    }
    return this.messageRepository.find({
      where,
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async sendMessage(
    tripId: string,
    senderType: 'DRIVER' | 'PASSENGER',
    senderName: string,
    content: string,
  ) {
    const message = this.messageRepository.create({
      tripId,
      senderType,
      senderName,
      content: content.slice(0, 1000),
    });
    return this.messageRepository.save(message);
  }
}
