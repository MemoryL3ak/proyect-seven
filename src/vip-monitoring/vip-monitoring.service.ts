import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Monitoreo de usuarios VIP: dónde está cada VIP ahora, SIEMPRE — no sólo
 * durante un viaje.
 *
 * Fuentes de ubicación, en orden de preferencia:
 * 1. `telemetry.user_positions` — GPS del propio teléfono del VIP, que el
 *    portal reporta en forma periódica mientras está abierto (tracking
 *    permanente, con o sin viaje).
 * 2. `transport.trips.passenger_lat/lng` — GPS reportado por el portal
 *    durante un viaje activo (EN_ROUTE/PICKED_UP).
 * 3. Última posición del vehículo del viaje del día
 *    (`telemetry.vehicle_positions`, por trip_id con fallback a driver_id).
 */
@Injectable()
export class VipMonitoringService {
  private readonly logger = new Logger(VipMonitoringService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Guarda una posición reportada por el portal del usuario. */
  async reportPosition(body: {
    athleteId?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
  }) {
    const athleteId = String(body.athleteId ?? '');
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!UUID.test(athleteId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('athleteId, lat y lng son obligatorios');
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException('Coordenadas fuera de rango');
    }
    const accuracy = Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null;
    try {
      await this.dataSource.query(
        `insert into telemetry.user_positions (athlete_id, lat, lng, accuracy)
         values ($1, $2, $3, $4)`,
        [athleteId, lat, lng, accuracy],
      );
      return { ok: true };
    } catch (error) {
      // Tabla aún no migrada u otro problema puntual: no romper el portal.
      this.logger.warn(
        `No se pudo guardar la posición del usuario ${athleteId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return { ok: false };
    }
  }

  private snapshotQuery(withUserPositions: boolean): string {
    const upLateral = withUserPositions
      ? `left join lateral (
        -- Tracking permanente: última posición reportada por el portal del
        -- propio VIP en las últimas 24 h, con o sin viaje.
        select up.lat, up.lng, up."timestamp"
        from telemetry.user_positions up
        where up.athlete_id = a.id
          and up."timestamp" > now() - interval '24 hours'
        order by up."timestamp" desc
        limit 1
      ) up on true`
      : `left join lateral (
        select null::double precision as lat, null::double precision as lng,
               null::timestamptz as "timestamp"
      ) up on true`;
    return `
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
        vp."timestamp"       as vehicle_gps_at,
        up.lat               as user_lat,
        up.lng               as user_lng,
        up."timestamp"       as user_gps_at
      from core.athletes a
      ${upLateral}
      left join lateral (`;
  }

  async snapshot(eventId?: string) {
    const safeEventId = eventId && UUID.test(eventId) ? eventId : null;
    const tail = `
        -- Viaje relevante del VIP: uno activo (en camino / a bordo) manda;
        -- si no hay, el viaje más reciente de hoy en cualquier estado. Antes
        -- se exigía EN_ROUTE/PICKED_UP exactos y si el conductor no marcaba
        -- el estado (pero sí transmitía GPS) el VIP no aparecía en el mapa.
        select t.*
        from transport.trips t
        where t.status <> 'CANCELLED'
          and (
            t.status in ('EN_ROUTE', 'PICKED_UP')
            or coalesce(t.trip_date, (t.scheduled_at at time zone 'America/Santiago')::date)
               = (now() at time zone 'America/Santiago')::date
          )
          and (
            t.requester_athlete_id = a.id
            or exists (
              select 1 from transport.trip_athletes ta
              where ta.trip_id = t.id and ta.athlete_id = a.id
            )
          )
        order by (t.status in ('EN_ROUTE', 'PICKED_UP')) desc,
                 t.scheduled_at desc nulls last
        limit 1
      ) t on true
      left join transport.drivers d           on d.id  = t.driver_id
      left join core.provider_participants pp on pp.id = t.driver_id
      left join lateral (
        -- Última posición ligada al viaje o al conductor asignado (últimas
        -- 12 h), aunque el viaje no esté marcado como activo.
        select vp.lat, vp.lng, vp."timestamp"
        from telemetry.vehicle_positions vp
        where (vp.trip_id = t.id
           or (t.driver_id is not null and vp.driver_id = t.driver_id))
          and vp."timestamp" > now() - interval '12 hours'
        order by vp."timestamp" desc
        limit 1
      ) vp on t.id is not null
      where case upper(coalesce(nullif(trim(a.user_type), ''), ''))
              when 'OTHER' then 'VIP'
              else upper(coalesce(nullif(trim(a.user_type), ''), ''))
            end = 'VIP'
        and ($1::uuid is null or a.event_id = $1)
      order by (t.id is not null) desc, a.full_name asc
      `;

    let rows: any[];
    try {
      rows = await this.dataSource.query(this.snapshotQuery(true) + tail, [safeEventId]);
    } catch (error) {
      // telemetry.user_positions puede no estar migrada todavía: el monitoreo
      // sigue funcionando con las fuentes de viaje/vehículo.
      this.logger.warn(
        `Snapshot sin user_positions (¿falta migrar la tabla?): ${
          error instanceof Error ? error.message : error
        }`,
      );
      rows = await this.dataSource.query(this.snapshotQuery(false) + tail, [safeEventId]);
    }

    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const ACTIVE = ['EN_ROUTE', 'PICKED_UP'];
    const ts = (v: unknown): number => {
      const t = new Date(String(v ?? '')).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const vips = rows.map((r: any) => {
      const isActive = ACTIVE.includes(String(r.trip_status ?? ''));

      type Candidate = { lat: number; lng: number; source: string; timestamp: string | null; at: number };
      const candidates: Candidate[] = [];

      // 1. Tracking permanente del portal (la señal principal).
      const userLat = num(r.user_lat);
      const userLng = num(r.user_lng);
      if (userLat !== null && userLng !== null) {
        candidates.push({
          lat: userLat,
          lng: userLng,
          source: 'PASSENGER',
          timestamp: r.user_gps_at ?? null,
          at: ts(r.user_gps_at),
        });
      }
      // 2. GPS del portal durante el viaje activo (sin timestamp: es "ahora").
      const passengerLat = num(r.passenger_lat);
      const passengerLng = num(r.passenger_lng);
      if (isActive && passengerLat !== null && passengerLng !== null) {
        candidates.push({
          lat: passengerLat,
          lng: passengerLng,
          source: 'PASSENGER',
          timestamp: null,
          at: Date.now(),
        });
      }
      // 3. Última posición del vehículo del viaje del día.
      const vehicleLat = num(r.vehicle_lat);
      const vehicleLng = num(r.vehicle_lng);
      if (vehicleLat !== null && vehicleLng !== null) {
        candidates.push({
          lat: vehicleLat,
          lng: vehicleLng,
          source: 'VEHICLE',
          timestamp: r.vehicle_gps_at ?? null,
          at: ts(r.vehicle_gps_at),
        });
      }
      // Gana la señal más fresca.
      candidates.sort((a, b) => b.at - a.at);
      const best = candidates[0] ?? null;

      return {
        id: r.id,
        fullName: r.full_name,
        phone: r.phone ?? null,
        eventId: r.event_id ?? null,
        trip: r.trip_id
          ? {
              id: r.trip_id,
              status: r.trip_status,
              active: isActive,
              origin: r.origin ?? null,
              destination: r.destination ?? null,
              scheduledAt: r.scheduled_at ?? null,
              driverName: r.driver_name ?? null,
            }
          : null,
        position: best
          ? { lat: best.lat, lng: best.lng, source: best.source, timestamp: best.timestamp }
          : null,
      };
    });

    return {
      ts: new Date().toISOString(),
      stats: {
        total: vips.length,
        enViaje: vips.filter((v: any) => v.trip?.active).length,
        conUbicacion: vips.filter((v: any) => v.position).length,
      },
      vips,
    };
  }
}
