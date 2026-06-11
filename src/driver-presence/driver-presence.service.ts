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
  async list(eventId?: string): Promise<DriverPresenceRow[]> {
    const rows = (await this.dataSource.query(
      `select
         d.id                    as driver_id,
         d.full_name             as full_name,
         d.status                as driver_status,
         d.event_id              as event_id,
         d.phone                 as phone,
         d.allowed_client_types  as allowed_client_types,
         s.started_at            as session_started_at,
         s.last_seen_at          as last_seen_at,
         s.heartbeats            as heartbeats,
         s.platform              as platform,
         s.app_version           as app_version,
         (s.last_seen_at is not null and s.ended_at is null
          and s.last_seen_at > now() - interval '${ONLINE_WINDOW}') as online,
         extract(epoch from (now() - s.last_seen_at))::int as seconds_since_seen,
         (select count(*)::int from transport.trips t
            where t.driver_id = d.id
              and t.status in ('EN_ROUTE','PICKED_UP')) as active_trips,
         g.lat          as gps_lat,
         g.lng          as gps_lng,
         g.timestamp    as gps_timestamp,
         extract(epoch from (now() - g.timestamp))::int as gps_age,
         coalesce(disc.disciplines, '{}'::text[]) as disciplines
       from transport.drivers d
       left join lateral (
         select * from transport.driver_sessions ds
         where ds.driver_id = d.id
         order by ds.last_seen_at desc
         limit 1
       ) s on true
       left join lateral (
         select vp.lat, vp.lng, vp.timestamp
         from telemetry.vehicle_positions vp
         where vp.driver_id = d.id
         order by vp.timestamp desc
         limit 1
       ) g on true
       left join lateral (
         select array_agg(distinct dx.name) filter (where dx.name is not null) as disciplines
         from transport.trips tr
         left join transport.trip_athletes ta on ta.trip_id = tr.id
         left join core.athletes a on a.id = ta.athlete_id
         left join core.disciplines dx on dx.id = a.discipline_id
         where tr.driver_id = d.id
           and (
             tr.scheduled_at::date = (now() at time zone 'America/Santiago')::date
             or tr.status in ('EN_ROUTE','PICKED_UP')
           )
       ) disc on true
       where ($1::uuid is null or d.event_id = $1)
       order by online desc nulls last, s.last_seen_at desc nulls last, d.full_name asc`,
      [eventId ?? null],
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
         (select count(*)::int from transport.drivers
            where ($1::uuid is null or event_id = $1)) as total_drivers,
         (select count(distinct driver_id)::int from transport.driver_sessions
            where ended_at is null
              and last_seen_at > now() - interval '${ONLINE_WINDOW}'
              and ($1::uuid is null or event_id = $1)) as online_now,
         (select count(distinct driver_id)::int from transport.driver_sessions
            where started_at::date = now()::date
              and ($1::uuid is null or event_id = $1)) as drivers_today,
         (select count(*)::int from transport.driver_sessions
            where started_at::date = now()::date
              and ($1::uuid is null or event_id = $1)) as sessions_today`,
      [eventId ?? null],
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
  async snapshot(eventId?: string) {
    const [drivers, stats] = await Promise.all([this.list(eventId), this.stats(eventId)]);
    return { ts: new Date().toISOString(), stats, drivers };
  }

  /** Stream SSE: emite un snapshot cada 8 segundos. */
  liveStream(eventId?: string): Subject<unknown> {
    const subject = new Subject<unknown>();
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        subject.next(await this.snapshot(eventId));
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
