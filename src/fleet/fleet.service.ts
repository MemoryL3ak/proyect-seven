import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DriverAvailability {
  id: string;
  fullName: string;
  rut: string | null;
  phone: string | null;
  status: string;
  online: boolean;
  lastSeenAt: string | null;
  secondsSinceSeen: number | null;
  accessTypes: string[];
  allowedClientTypes: string[];
  preferredVehicleId: string | null;
  preferredVehiclePlate: string | null;
  activeTripId: string | null;
  activeTripStatus: string | null;
  activeTripDestination: string | null;
  activeTripClientType: string | null;
  activeTripScheduledAt: string | null;
  /** "FREE" | "ON_TRIP" | "OFFLINE" | "INACTIVE" */
  availability: 'FREE' | 'ON_TRIP' | 'OFFLINE' | 'INACTIVE';
}

export interface VehicleAvailability {
  id: string;
  plate: string;
  type: string;
  brand: string | null;
  model: string | null;
  capacity: number;
  status: string;
  activeTripId: string | null;
  activeTripStatus: string | null;
  activeTripDestination: string | null;
  activeTripDriverId: string | null;
  activeTripDriverName: string | null;
  activeTripScheduledAt: string | null;
  /** "FREE" | "ON_TRIP" | "OUT_OF_SERVICE" */
  availability: 'FREE' | 'ON_TRIP' | 'OUT_OF_SERVICE';
}

export interface FleetAvailabilityResponse {
  ts: string;
  drivers: DriverAvailability[];
  vehicles: VehicleAvailability[];
  summary: {
    drivers: { total: number; free: number; onTrip: number; offline: number; inactive: number };
    vehicles: { total: number; free: number; onTrip: number; outOfService: number };
  };
}

@Injectable()
export class FleetService {
  constructor(private readonly dataSource: DataSource) {}

  async availability(eventId?: string): Promise<FleetAvailabilityResponse> {
    const ts = new Date().toISOString();

    // ── Conductores ─────────────────────────────────────────────
    const driverRows = (await this.dataSource.query(
      `select
         d.id, d.full_name, d.rut, d.phone, d.status,
         d.access_types, d.allowed_client_types,
         d.vehicle_id as preferred_vehicle_id,
         pv.plate as preferred_vehicle_plate,
         s.last_seen_at,
         extract(epoch from (now() - s.last_seen_at))::int as seconds_since_seen,
         t.id as active_trip_id,
         t.status as active_trip_status,
         coalesce(t.destination, t.notes) as active_trip_destination,
         t.client_type as active_trip_client_type,
         t.scheduled_at as active_trip_scheduled_at
       from transport.drivers d
       left join transport.vehicles pv on pv.id = d.vehicle_id
       left join lateral (
         select last_seen_at
         from transport.driver_sessions
         where driver_id = d.id
         order by last_seen_at desc nulls last
         limit 1
       ) s on true
       left join lateral (
         select id, status, destination, notes, client_type, scheduled_at
         from transport.trips
         where driver_id = d.id
           and status in ('EN_ROUTE', 'PICKED_UP', 'SCHEDULED')
         order by case status when 'EN_ROUTE' then 1 when 'PICKED_UP' then 2 else 3 end,
                  scheduled_at asc nulls last
         limit 1
       ) t on true
       where ($1::uuid is null or d.event_id = $1)
       order by d.full_name asc`,
      [eventId ?? null],
    )) as Array<Record<string, any>>;

    const drivers: DriverAvailability[] = driverRows.map((r) => {
      const isOnline =
        r.seconds_since_seen != null && Number(r.seconds_since_seen) < 90; // <1.5min
      const onTrip = r.active_trip_id && ['EN_ROUTE', 'PICKED_UP'].includes(r.active_trip_status);
      const inactive = (r.status || '').toUpperCase() !== 'ACTIVE';

      let availability: DriverAvailability['availability'];
      if (inactive) availability = 'INACTIVE';
      else if (onTrip) availability = 'ON_TRIP';
      else if (!isOnline) availability = 'OFFLINE';
      else availability = 'FREE';

      return {
        id: r.id,
        fullName: r.full_name,
        rut: r.rut ?? null,
        phone: r.phone ?? null,
        status: r.status ?? 'UNKNOWN',
        online: isOnline,
        lastSeenAt: r.last_seen_at ?? null,
        secondsSinceSeen: r.seconds_since_seen != null ? Number(r.seconds_since_seen) : null,
        accessTypes: Array.isArray(r.access_types) ? r.access_types : [],
        allowedClientTypes: Array.isArray(r.allowed_client_types) ? r.allowed_client_types : [],
        preferredVehicleId: r.preferred_vehicle_id ?? null,
        preferredVehiclePlate: r.preferred_vehicle_plate ?? null,
        activeTripId: r.active_trip_id ?? null,
        activeTripStatus: r.active_trip_status ?? null,
        activeTripDestination: r.active_trip_destination ?? null,
        activeTripClientType: r.active_trip_client_type ?? null,
        activeTripScheduledAt: r.active_trip_scheduled_at ?? null,
        availability,
      };
    });

    // ── Vehículos ───────────────────────────────────────────────
    const vehicleRows = (await this.dataSource.query(
      `select
         v.id, v.plate, v.type, v.brand, v.model, v.capacity, v.status,
         t.id as active_trip_id,
         t.status as active_trip_status,
         coalesce(t.destination, t.notes) as active_trip_destination,
         t.driver_id as active_trip_driver_id,
         d.full_name as active_trip_driver_name,
         t.scheduled_at as active_trip_scheduled_at
       from transport.vehicles v
       left join lateral (
         select id, status, destination, notes, driver_id, scheduled_at
         from transport.trips
         where vehicle_id = v.id
           and status in ('EN_ROUTE', 'PICKED_UP', 'SCHEDULED')
         order by case status when 'EN_ROUTE' then 1 when 'PICKED_UP' then 2 else 3 end,
                  scheduled_at asc nulls last
         limit 1
       ) t on true
       left join transport.drivers d on d.id = t.driver_id
       where ($1::uuid is null or v.event_id = $1)
       order by v.plate asc`,
      [eventId ?? null],
    )) as Array<Record<string, any>>;

    const vehicles: VehicleAvailability[] = vehicleRows.map((r) => {
      const onTrip =
        r.active_trip_id && ['EN_ROUTE', 'PICKED_UP'].includes(r.active_trip_status);
      const outOfService = ['MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'].includes(
        (r.status || '').toUpperCase(),
      );

      let availability: VehicleAvailability['availability'];
      if (outOfService) availability = 'OUT_OF_SERVICE';
      else if (onTrip) availability = 'ON_TRIP';
      else availability = 'FREE';

      return {
        id: r.id,
        plate: r.plate,
        type: r.type,
        brand: r.brand ?? null,
        model: r.model ?? null,
        capacity: Number(r.capacity ?? 0),
        status: r.status ?? 'AVAILABLE',
        activeTripId: r.active_trip_id ?? null,
        activeTripStatus: r.active_trip_status ?? null,
        activeTripDestination: r.active_trip_destination ?? null,
        activeTripDriverId: r.active_trip_driver_id ?? null,
        activeTripDriverName: r.active_trip_driver_name ?? null,
        activeTripScheduledAt: r.active_trip_scheduled_at ?? null,
        availability,
      };
    });

    // ── Summary ─────────────────────────────────────────────────
    const summary = {
      drivers: {
        total: drivers.length,
        free: drivers.filter((d) => d.availability === 'FREE').length,
        onTrip: drivers.filter((d) => d.availability === 'ON_TRIP').length,
        offline: drivers.filter((d) => d.availability === 'OFFLINE').length,
        inactive: drivers.filter((d) => d.availability === 'INACTIVE').length,
      },
      vehicles: {
        total: vehicles.length,
        free: vehicles.filter((v) => v.availability === 'FREE').length,
        onTrip: vehicles.filter((v) => v.availability === 'ON_TRIP').length,
        outOfService: vehicles.filter((v) => v.availability === 'OUT_OF_SERVICE').length,
      },
    };

    return { ts, drivers, vehicles, summary };
  }
}
