import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Monitoreo de usuarios VIP: dónde está cada VIP ahora.
 *
 * Fuentes de ubicación, en orden de preferencia:
 * 1. `transport.trips.passenger_lat/lng` — GPS del propio teléfono del VIP,
 *    que el portal reporta mientras su viaje está EN_ROUTE/PICKED_UP.
 * 2. Última posición del vehículo del viaje activo
 *    (`telemetry.vehicle_positions`, por trip_id con fallback a driver_id).
 */
@Injectable()
export class VipMonitoringService {
  private readonly logger = new Logger(VipMonitoringService.name);

  constructor(private readonly dataSource: DataSource) {}

  async snapshot(eventId?: string) {
    const safeEventId = eventId && UUID.test(eventId) ? eventId : null;
    const rows = await this.dataSource.query(
      `
      select
        a.id,
        a.full_name,
        a.phone,
        a.event_id,
        t.id                 as trip_id,
        t.status             as trip_status,
        t.origin,
        t.destination,
        t.scheduled_at,
        t.passenger_lat,
        t.passenger_lng,
        coalesce(d.full_name, pp.full_name) as driver_name,
        vp.lat               as vehicle_lat,
        vp.lng               as vehicle_lng,
        vp."timestamp"       as vehicle_gps_at
      from core.athletes a
      left join lateral (
        select t.*
        from transport.trips t
        where t.status in ('EN_ROUTE', 'PICKED_UP')
          and (
            t.requester_athlete_id = a.id
            or exists (
              select 1 from transport.trip_athletes ta
              where ta.trip_id = t.id and ta.athlete_id = a.id
            )
          )
        order by t.scheduled_at desc nulls last
        limit 1
      ) t on true
      left join transport.drivers d           on d.id  = t.driver_id
      left join core.provider_participants pp on pp.id = t.driver_id
      left join lateral (
        select vp.lat, vp.lng, vp."timestamp"
        from telemetry.vehicle_positions vp
        where vp.trip_id = t.id
           or (t.driver_id is not null and vp.driver_id = t.driver_id)
        order by vp."timestamp" desc
        limit 1
      ) vp on t.id is not null
      where case upper(coalesce(nullif(trim(a.user_type), ''), ''))
              when 'OTHER' then 'VIP'
              else upper(coalesce(nullif(trim(a.user_type), ''), ''))
            end = 'VIP'
        and ($1::uuid is null or a.event_id = $1)
      order by (t.id is not null) desc, a.full_name asc
      `,
      [safeEventId],
    );

    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const vips = rows.map((r: any) => {
      const passengerLat = num(r.passenger_lat);
      const passengerLng = num(r.passenger_lng);
      const vehicleLat = num(r.vehicle_lat);
      const vehicleLng = num(r.vehicle_lng);
      const usePassenger = r.trip_id && passengerLat !== null && passengerLng !== null;
      const lat = usePassenger ? passengerLat : vehicleLat;
      const lng = usePassenger ? passengerLng : vehicleLng;
      return {
        id: r.id,
        fullName: r.full_name,
        phone: r.phone ?? null,
        eventId: r.event_id ?? null,
        trip: r.trip_id
          ? {
              id: r.trip_id,
              status: r.trip_status,
              origin: r.origin ?? null,
              destination: r.destination ?? null,
              scheduledAt: r.scheduled_at ?? null,
              driverName: r.driver_name ?? null,
            }
          : null,
        position:
          lat !== null && lng !== null
            ? {
                lat,
                lng,
                source: usePassenger ? 'PASSENGER' : 'VEHICLE',
                timestamp: usePassenger ? null : (r.vehicle_gps_at ?? null),
              }
            : null,
      };
    });

    return {
      ts: new Date().toISOString(),
      stats: {
        total: vips.length,
        enViaje: vips.filter((v: any) => v.trip).length,
        conUbicacion: vips.filter((v: any) => v.position).length,
      },
      vips,
    };
  }
}
