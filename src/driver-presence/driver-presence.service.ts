import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Subject } from 'rxjs';
import { HeartbeatDto } from './dto/heartbeat.dto';

/**
 * Ventana de inactividad tras la cual una sesión se considera offline /
 * terminada. El Portal Conductor envía un heartbeat cada ~30s, así que 100s
 * tolera 2-3 latidos perdidos antes de marcar al chofer como desconectado.
 */
const ONLINE_WINDOW = "100 seconds";

export interface DriverPresenceRow {
  driverId: string;
  fullName: string;
  driverStatus: string | null;
  eventId: string | null;
  phone: string | null;
  online: boolean;
  sessionStartedAt: string | null;
  lastSeenAt: string | null;
  secondsSinceSeen: number | null;
  heartbeats: number | null;
  platform: string | null;
  appVersion: string | null;
  activeTrips: number;
  /** Viajes asignados al conductor para la fecha consultada (default: hoy en zona Chile). */
  dayTripCount: number;
  activeTripId: string | null;
  activeTripStatus: string | null;
  gpsAgeSeconds: number | null;
  lat: number | null;
  lng: number | null;
  gpsTimestamp: string | null;
  allowedClientTypes: string[];
  disciplines: string[];
}

@Injectable()
export class DriverPresenceService {
  private readonly logger = new Logger(DriverPresenceService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Registra un latido del Portal Conductor: continúa o abre una sesión. */
  async heartbeat(dto: HeartbeatDto): Promise<{ sessionId: string; status: 'started' | 'continued' }> {
    // Cierra sesiones del chofer que quedaron sin latidos (zombis).
    await this.dataSource.query(
      `update transport.driver_sessions
         set ended_at = last_seen_at
       where driver_id = $1
         and ended_at is null
         and last_seen_at < now() - interval '${ONLINE_WINDOW}'`,
      [dto.driverId],
    );

    // Intenta continuar una sesión activa.
    const updated = (await this.dataSource.query(
      `update transport.driver_sessions
         set last_seen_at = now(),
             heartbeats = heartbeats + 1,
             app_version = coalesce($2, app_version),
             platform = coalesce($3, platform)
       where driver_id = $1 and ended_at is null
       returning id`,
      [dto.driverId, dto.appVersion ?? null, dto.platform ?? null],
    )) as Array<{ id: string }>;

    if (updated.length > 0) {
      return { sessionId: updated[0].id, status: 'continued' };
    }

    // No había sesión activa: abre una nueva.
    const created = (await this.dataSource.query(
      `insert into transport.driver_sessions
         (driver_id, event_id, app_version, platform, user_agent)
       values ($1,$2,$3,$4,$5)
       returning id`,
      [
        dto.driverId,
        dto.eventId ?? null,
        dto.appVersion ?? null,
        dto.platform ?? null,
        dto.userAgent ?? null,
      ],
    )) as Array<{ id: string }>;

    this.logger.log(`Driver ${dto.driverId} inició sesión en la app.`);
    return { sessionId: created[0].id, status: 'started' };
  }

  /** Lista todos los conductores con su estado de presencia. */
  async list(eventId?: string, date?: string): Promise<DriverPresenceRow[]> {
    // Validación de formato YYYY-MM-DD; si es inválido se usa "hoy" en zona Chile.
    const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    const rows = (await this.dataSource.query(
      `select
         d.id            as driver_id,
         d.full_name     as full_name,
         d.status        as driver_status,
         g.event_id      as event_id,
         d.phone         as phone,
         -- provider_participants no tiene allowed_client_types (era de la tabla
         -- legacy transport.drivers); se expone vacío para no romper el filtro.
         '{}'::text[]    as allowed_client_types,
         s.started_at    as session_started_at,
         s.last_seen_at  as last_seen_at,
         s.heartbeats    as heartbeats,
         s.platform      as platform,
         s.app_version   as app_version,
         -- "Online" if a recent heartbeat OR a recent GPS fix. Drivers keyed in
         -- core.provider_participants transmit position without a driver_session
         -- row, so GPS freshness alone must count as connected.
         (
           (s.last_seen_at is not null and s.ended_at is null
            and s.last_seen_at > now() - interval '${ONLINE_WINDOW}')
           or (g.timestamp is not null
            and g.timestamp > now() - interval '${ONLINE_WINDOW}')
         ) as online,
         extract(epoch from (now() - s.last_seen_at))::int as seconds_since_seen,
         (select count(*)::int from transport.trips t
            where t.driver_id = d.id
              and t.status in ('EN_ROUTE','PICKED_UP')) as active_trips,
         coalesce(day_trips.day_trip_count, 0) as day_trip_count,
         tr.id          as active_trip_id,
         tr.status      as active_trip_status,
         g.lat          as gps_lat,
         g.lng          as gps_lng,
         g.timestamp    as gps_timestamp,
         extract(epoch from (now() - g.timestamp))::int as gps_age,
         coalesce(disc.disciplines, '{}'::text[]) as disciplines
       -- Drivers live in core.provider_participants flagged isDriver; the legacy
       -- transport.drivers table is essentially empty, so sourcing from it hid
       -- every real driver from the monitor.
       from core.provider_participants d
       left join lateral (
         select * from transport.driver_sessions ds
         where ds.driver_id = d.id
         order by ds.last_seen_at desc
         limit 1
       ) s on true
       left join lateral (
         -- The driver's active trip; prefer PICKED_UP (passenger aboard) over
         -- EN_ROUTE (heading to pickup) when somehow both exist.
         select t.id, t.status from transport.trips t
         where t.driver_id = d.id
           and t.status in ('EN_ROUTE','PICKED_UP')
         order by (t.status = 'PICKED_UP') desc, t.updated_at desc nulls last
         limit 1
       ) tr on true
       left join lateral (
         select vp.lat, vp.lng, vp.timestamp, vp.event_id
         from telemetry.vehicle_positions vp
         where vp.driver_id = d.id
         order by vp.timestamp desc
         limit 1
       ) g on true
       left join lateral (
         select count(*)::int as day_trip_count
         from transport.trips tr
         where tr.driver_id = d.id
           and tr.scheduled_at::date = coalesce(
             $2::date,
             (now() at time zone 'America/Santiago')::date
           )
       ) day_trips on true
       left join lateral (
         -- Disciplinas únicas de los participantes en los viajes asignados
         -- al conductor en la fecha seleccionada (o "hoy" si no se pasa).
         select array_agg(distinct dx.name) filter (where dx.name is not null) as disciplines
         from transport.trips tr
         left join transport.trip_athletes ta on ta.trip_id = tr.id
         left join core.athletes a on a.id = ta.athlete_id
         left join core.disciplines dx on dx.id = a.discipline_id
         where tr.driver_id = d.id
           and tr.scheduled_at::date = coalesce(
             $2::date,
             (now() at time zone 'America/Santiago')::date
           )
       ) disc on true
       where d.metadata->>'isDriver' = 'true'
         and ($1::uuid is null or g.event_id = $1)
       order by online desc nulls last, s.last_seen_at desc nulls last, d.full_name asc`,
      [eventId ?? null, safeDate],
    )) as Array<Record<string, any>>;

    return rows.map((r) => ({
      driverId: r.driver_id,
      fullName: r.full_name,
      driverStatus: r.driver_status ?? null,
      eventId: r.event_id ?? null,
      phone: r.phone ?? null,
      online: Boolean(r.online),
      sessionStartedAt: r.session_started_at ?? null,
      lastSeenAt: r.last_seen_at ?? null,
      secondsSinceSeen: r.seconds_since_seen != null ? Number(r.seconds_since_seen) : null,
      heartbeats: r.heartbeats != null ? Number(r.heartbeats) : null,
      platform: r.platform ?? null,
      appVersion: r.app_version ?? null,
      activeTrips: Number(r.active_trips ?? 0),
      dayTripCount: Number(r.day_trip_count ?? 0),
      activeTripId: r.active_trip_id ?? null,
      activeTripStatus: r.active_trip_status ?? null,
      gpsAgeSeconds: r.gps_age != null ? Number(r.gps_age) : null,
      lat: r.gps_lat != null ? Number(r.gps_lat) : null,
      lng: r.gps_lng != null ? Number(r.gps_lng) : null,
      gpsTimestamp: r.gps_timestamp ?? null,
      allowedClientTypes: Array.isArray(r.allowed_client_types) ? r.allowed_client_types : [],
      disciplines: Array.isArray(r.disciplines) ? r.disciplines : [],
    }));
  }

  /** KPIs agregados de presencia. */
  async stats(eventId?: string) {
    const rows = (await this.dataSource.query(
      `select
         (select count(*)::int from core.provider_participants
            where metadata->>'isDriver' = 'true') as total_drivers,
         -- Online = fresh heartbeat OR fresh GPS fix (see list()).
         (select count(*)::int from core.provider_participants d
            where d.metadata->>'isDriver' = 'true'
              and (
                exists (select 1 from transport.driver_sessions ds
                         where ds.driver_id = d.id and ds.ended_at is null
                           and ds.last_seen_at > now() - interval '${ONLINE_WINDOW}')
                or exists (select 1 from telemetry.vehicle_positions vp
                            where vp.driver_id = d.id
                              and vp.timestamp > now() - interval '${ONLINE_WINDOW}')
              )) as online_now,
         -- Active today = opened the app (session) or sent a fix today.
         (select count(*)::int from core.provider_participants d
            where d.metadata->>'isDriver' = 'true'
              and (
                exists (select 1 from transport.driver_sessions ds
                         where ds.driver_id = d.id and ds.started_at::date = now()::date)
                or exists (select 1 from telemetry.vehicle_positions vp
                            where vp.driver_id = d.id and vp.created_at::date = now()::date)
              )) as drivers_today,
         (select count(*)::int from transport.driver_sessions
            where started_at::date = now()::date) as sessions_today`,
      [],
    )) as Array<Record<string, any>>;
    const r = rows[0] || {};
    return {
      totalDrivers: Number(r.total_drivers ?? 0),
      onlineNow: Number(r.online_now ?? 0),
      driversToday: Number(r.drivers_today ?? 0),
      sessionsToday: Number(r.sessions_today ?? 0),
    };
  }

  /** Snapshot combinado (lista + stats) para el feed en vivo. */
  async snapshot(eventId?: string, date?: string) {
    const [drivers, stats] = await Promise.all([this.list(eventId, date), this.stats(eventId)]);
    return { ts: new Date().toISOString(), stats, drivers };
  }

  /** Stream SSE: emite un snapshot cada 8 segundos. */
  liveStream(eventId?: string, date?: string): Subject<unknown> {
    const subject = new Subject<unknown>();
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        subject.next(await this.snapshot(eventId, date));
      } catch (err) {
        this.logger.error(`driver-presence liveStream error: ${err}`);
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 8000);

    const original = subject.complete.bind(subject);
    subject.complete = () => {
      stopped = true;
      clearInterval(interval);
      original();
    };
    return subject;
  }
}
