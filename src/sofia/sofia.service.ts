import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { randomUUID, randomBytes } from 'node:crypto';
import { PLATFORM_KNOWLEDGE } from './sofia-knowledge';
import { CUADERNO_CARGO_BVAN } from './sofia-document-knowledge';
import { SOFIA_TOOLS } from './sofia-tools';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  ILike,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Delegation } from '../delegations/entities/delegation.entity';
import { Athlete } from '../athletes/entities/athlete.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Transport } from '../transports/entities/transport.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Provider } from '../providers/entities/provider.entity';
import { DriverPresenceService } from '../driver-presence/driver-presence.service';
import { Subject } from 'rxjs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Visual artifact produced by a tool. The frontend renders it inline in the
 * chat (chart, KPI card, action card, live panel, table).
 */
export interface SofiaArtifact {
  id: string;
  kind: 'chart' | 'kpi' | 'action' | 'live' | 'table';
  title?: string;
  note?: string;
  /* chart */
  chartType?: 'line' | 'bar' | 'area';
  xKey?: string;
  series?: Array<{ key: string; label: string; color?: string }>;
  rows?: Array<Record<string, unknown>>;
  /* kpi */
  kpis?: Array<{ label: string; value: string | number; hint?: string; tone?: string }>;
  /* action */
  action?: {
    tool: string;
    label: string;
    status: 'success' | 'error';
    summary: string;
    logId?: string;
    undoable?: boolean;
  };
  /* live */
  feed?: 'gps' | 'trips' | 'alerts' | 'presence';
  eventId?: string | null;
  /* table */
  columns?: Array<{ key: string; label: string }>;
}

export type SofiaAnswer = {
  answer: string;
  responseId?: string | null;
  artifacts?: SofiaArtifact[];
};

export interface SofiaStreamChunk {
  type: 'delta' | 'done' | 'error' | 'tool_call' | 'render';
  content: string;
  responseId?: string | null;
  artifact?: SofiaArtifact;
}

/** Internal: a tool may return data for the LLM plus an artifact for the UI. */
interface ToolOutcome {
  __data: unknown;
  __artifact?: SofiaArtifact;
}

function isToolOutcome(value: unknown): value is ToolOutcome {
  return !!value && typeof value === 'object' && '__data' in value;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class SofiaService {
  private readonly logger = new Logger(SofiaService.name);

  /** Max tool-call round-trips to prevent infinite loops */
  private readonly MAX_TOOL_ROUNDS = 10;

  /** Tools that mutate data — used for audit logging on failure. */
  private readonly ACTION_TOOLS = new Set([
    'create_trip',
    'assign_driver_to_trip',
    'update_trip_status',
    'cancel_trip',
    'auto_assign_drivers',
    'create_hotel_assignment',
    'release_hotel_assignment',
    'create_premiacion',
    'update_premiacion_status',
    'create_coupon',
    'claim_coupon',
    'send_notification',
    'create_workforce_person',
    'create_event',
    'update_event_status',
    'create_delegation',
    'create_athlete',
    'update_athlete_status',
    'create_discipline',
    'create_provider',
    'create_venue',
    'create_driver',
    'create_vehicle',
    'create_flight',
    'create_accommodation',
    'create_hotel_room',
    'create_food_location',
    'create_food_menu',
    'update_accreditation_status',
    'undo_last_action',
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Delegation)
    private readonly delegationsRepo: Repository<Delegation>,
    @InjectRepository(Athlete)
    private readonly athletesRepo: Repository<Athlete>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(Transport)
    private readonly transportsRepo: Repository<Transport>,
    @InjectRepository(Accommodation)
    private readonly accommodationsRepo: Repository<Accommodation>,
    @InjectRepository(Flight)
    private readonly flightsRepo: Repository<Flight>,
    @InjectRepository(Provider)
    private readonly providersRepo: Repository<Provider>,
    private readonly driverPresence: DriverPresenceService,
  ) {}

  /* ================================================================ */
  /*  System prompt                                                    */
  /* ================================================================ */

  private buildSystemPrompt(locale?: string): string {
    const langInstruction = this.tr(
      locale,
      'Respondes siempre en español, con un tono profesional, claro y resolutivo.',
      'Always respond in English, with a professional, clear and resolute tone.',
      'Responde sempre em português, com um tom profissional, claro e resolutivo.',
    );
    return [
      'Eres SofIA, la inteligencia operativa de la plataforma Seven Arena para gestión de eventos deportivos.',
      langInstruction,
      '',
      '## Tu rol',
      'No eres un buscador: eres una asistente operativa. Además de informar, EJECUTAS acciones, generas',
      'pronósticos y abres paneles en tiempo real. Sé proactiva: cuando detectes un problema o una oportunidad,',
      'propón la acción concreta y, si el usuario la pide, ejecútala.',
      '',
      '## Herramientas de LECTURA',
      'query_* / count_* / get_summary consultan datos reales. Usa get_summary para una visión global y las',
      'query_* específicas con filtros para detalle. Puedes encadenar varias en una misma respuesta.',
      '',
      '## Herramientas de ACCIÓN (escriben en la base de datos)',
      'Cubres TODOS los módulos de la plataforma:',
      '- Eventos: create_event, update_event_status.',
      '- Registro: create_delegation, create_athlete, update_athlete_status, create_discipline, create_provider.',
      '- Transporte: create_trip, assign_driver_to_trip, update_trip_status, cancel_trip, auto_assign_drivers,',
      '  create_driver, create_vehicle, create_flight.',
      '- Hotelería: create_accommodation, create_hotel_room, create_hotel_assignment, release_hotel_assignment.',
      '- Alimentación: create_food_location, create_food_menu.',
      '- Recintos: create_venue.',
      '- Acreditación: update_accreditation_status.',
      '- Premiaciones: create_premiacion, update_premiacion_status.',
      '- Cupones: create_coupon, claim_coupon.',
      '- Workforce: create_workforce_person.',
      '- Comunicación: send_notification.',
      '- Reversión: undo_last_action.',
      '- Ejecuta la acción cuando el usuario lo pida, sin pedir confirmación adicional.',
      '- Si faltan datos obligatorios, primero consúltalos con las query_* (ej: busca el ID del conductor por nombre).',
      '- Toda acción queda auditada y, si es reversible, se puede deshacer con undo_last_action.',
      '- Tras ejecutar, confirma en lenguaje natural QUÉ se hizo y QUÉ cambió.',
      '',
      '## Herramientas de ANALÍTICA y PREDICCIÓN',
      'forecast_trip_demand, forecast_hotel_occupancy, coupon_partners_performance, workforce_kpis,',
      'analytics_trips_timeline. El frontend renderiza automáticamente el gráfico o las tarjetas: NO copies',
      'los números crudos en tu texto. En su lugar, interpreta: tendencias, picos, riesgos y recomendaciones.',
      '',
      '## Herramientas de TIEMPO REAL',
      'open_live_map (mapa GPS de conductores), open_live_trips (viajes en curso), open_alerts_feed (alertas),',
      'open_driver_monitor (presencia de conductores con la app abierta), get_active_alerts (foto puntual de',
      'alertas) y get_driver_presence (qué conductores están conectados ahora). Los paneles open_* se',
      'actualizan solos en pantalla.',
      '',
      '## Estilo de respuesta',
      '- Respuestas COMPLETAS y profesionales: contexto, dato, interpretación y siguiente paso sugerido.',
      '- Estructura con encabezados o listas cuando aporte claridad.',
      '- Cuando generes un gráfico, mapa o tarjeta, explica qué muestra y qué conviene hacer con esa información.',
      '- Si una acción falla, explica el motivo y ofrece una alternativa.',
      '',
      '## Manual de la plataforma',
      PLATFORM_KNOWLEDGE,
      '',
      '## Documento de referencia cargado por el usuario',
      'El siguiente documento fue cargado por el usuario como material de',
      'referencia. Cuando una pregunta se relacione con su contenido (operación',
      'de transporte, recintos, hoteles, coordinadores, glosario o rutas del',
      'evento Santiago 2023), respóndela basándote en este documento y cita los',
      'datos concretos que contiene. Si la pregunta no se relaciona con él, usa',
      'el resto de tus capacidades normalmente.',
      '',
      CUADERNO_CARGO_BVAN,
    ].join('\n');
  }

  /* ================================================================ */
  /*  Shared helpers                                                   */
  /* ================================================================ */

  private clampLimit(raw?: number): number {
    const n = raw && Number.isFinite(raw) ? raw : 50;
    return Math.min(Math.max(n, 1), 200);
  }

  /** Devuelve la cadena según el idioma de la interfaz (es | en | pt). */
  private tr(locale: string | undefined, es: string, en: string, pt: string): string {
    const l = (locale || 'es').slice(0, 2).toLowerCase();
    return l === 'en' ? en : l === 'pt' ? pt : es;
  }

  /** Resolve an event id: explicit → active event → most recent. */
  private async resolveEventId(provided?: string): Promise<string | null> {
    if (provided) return provided;
    const active = await this.eventsRepo.findOne({
      where: { status: 'ACTIVE' },
      order: { createdAt: 'DESC' },
    });
    if (active) return active.id;
    const latest = await this.eventsRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
    return latest?.id ?? null;
  }

  /** Persist an executed action to the audit log. Returns the log id. */
  private async logAction(entry: {
    tool: string;
    args: Record<string, unknown>;
    status: 'success' | 'error';
    result?: unknown;
    error?: string;
    summary?: string;
    undo?: { tool: string; args: Record<string, unknown> };
  }): Promise<string | undefined> {
    try {
      const rows = (await this.dataSource.query(
        `insert into public.sofia_action_log
           (tool, args, result, status, error, summary, undo_tool, undo_args)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [
          entry.tool,
          JSON.stringify(entry.args ?? {}),
          entry.result !== undefined ? JSON.stringify(entry.result) : null,
          entry.status,
          entry.error ?? null,
          entry.summary ?? null,
          entry.undo?.tool ?? null,
          entry.undo?.args ? JSON.stringify(entry.undo.args) : null,
        ],
      )) as Array<{ id: string }>;
      return rows[0]?.id;
    } catch (err) {
      this.logger.error(`logAction failed: ${err}`);
      return undefined;
    }
  }

  private actionArtifact(
    tool: string,
    label: string,
    status: 'success' | 'error',
    summary: string,
    logId?: string,
    undoable = false,
  ): SofiaArtifact {
    return {
      id: randomUUID(),
      kind: 'action',
      action: { tool, label, status, summary, logId, undoable },
    };
  }

  private genCouponCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = randomBytes(6);
    let out = 'CPN-';
    for (let i = 0; i < 6; i++) out += alphabet[buf[i] % alphabet.length];
    return out;
  }

  /** EMA + weekday-seasonality forecast over a daily history series. */
  private forecastSeries(
    history: Array<{ date: string; value: number }>,
    daysAhead: number,
  ): Array<{ date: string; value: number }> {
    const n = history.length;
    if (n === 0) return [];
    const alpha = 0.5;
    let ema = history[0].value;
    for (let i = 1; i < n; i++) ema = alpha * history[i].value + (1 - alpha) * ema;

    const globalAvg = history.reduce((s, h) => s + h.value, 0) / n || 1;
    const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
    history.forEach((h) => {
      const wd = new Date(`${h.date}T00:00:00`).getDay();
      byWeekday[wd].push(h.value);
    });
    const weekdayMult = byWeekday.map((arr) =>
      arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length / globalAvg : 1,
    );

    const out: Array<{ date: string; value: number }> = [];
    const last = new Date(`${history[n - 1].date}T00:00:00`);
    for (let d = 1; d <= daysAhead; d++) {
      const dt = new Date(last);
      dt.setDate(dt.getDate() + d);
      const v = Math.max(0, Math.round(ema * (weekdayMult[dt.getDay()] || 1)));
      out.push({ date: dt.toISOString().slice(0, 10), value: v });
    }
    return out;
  }

  /* ================================================================ */
  /*  Tool dispatch                                                    */
  /* ================================================================ */

  /**
   * Normaliza los argumentos que entrega el modelo: descarta strings vacíos
   * (el LLM a veces manda `""` en campos opcionales) para que un id vacío no
   * llegue a una consulta como `''::uuid` y reviente. Recorta espacios y
   * limpia entradas vacías de los arrays.
   */
  private sanitizeArgs(args: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(args ?? {})) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') continue;
        clean[key] = trimmed;
      } else if (Array.isArray(value)) {
        clean[key] = value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => !(typeof item === 'string' && item === ''));
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  /** Dispatch a function-call by name; returns LLM text + optional artifact. */
  private async executeTool(
    name: string,
    rawArgs: Record<string, any>,
    locale?: string,
  ): Promise<{ output: string; artifact?: SofiaArtifact }> {
    const args = this.sanitizeArgs(rawArgs);
    try {
      const result = await this.executeToolInner(name, args, locale);

      let payload: unknown = result;
      let artifact: SofiaArtifact | undefined;
      if (isToolOutcome(result)) {
        payload = result.__data;
        artifact = result.__artifact;
      }

      let json = JSON.stringify(payload);
      if (json.length > 30000) {
        const arr = Array.isArray(payload) ? payload : null;
        json = arr
          ? JSON.stringify({
              results: arr.slice(0, 20),
              totalCount: arr.length,
              note: 'Resultados truncados. Usa filtros para refinar la consulta.',
            })
          : json.slice(0, 30000) + '..."(truncated)"}';
      }
      return { output: json, artifact };
    } catch (err) {
      this.logger.error(`Tool ${name} failed: ${err}`);
      const message = err instanceof Error ? err.message : String(err);
      if (this.ACTION_TOOLS.has(name)) {
        const logId = await this.logAction({
          tool: name,
          args,
          status: 'error',
          error: message,
        });
        return {
          output: JSON.stringify({ error: `Error ejecutando ${name}: ${message}` }),
          artifact: this.actionArtifact(
            name,
            'Acción fallida',
            'error',
            message,
            logId,
          ),
        };
      }
      return {
        output: JSON.stringify({ error: `Error ejecutando ${name}: ${message}` }),
      };
    }
  }

  private async executeToolInner(
    name: string,
    args: Record<string, any>,
    locale?: string,
  ): Promise<unknown> {
    const limit = this.clampLimit(args.limit);

    switch (name) {
      /* ---------- LECTURA ---------- */
      case 'get_summary': {
        const [events, delegations, athletes, trips, drivers, vehicles, accommodations, flights, providers] =
          await Promise.all([
            this.eventsRepo.count(),
            this.delegationsRepo.count(),
            this.athletesRepo.count(),
            this.tripsRepo.count(),
            this.driversRepo.count(),
            this.transportsRepo.count(),
            this.accommodationsRepo.count(),
            this.flightsRepo.count(),
            this.providersRepo.count(),
          ]);
        return {
          timestamp: new Date().toISOString(),
          counts: { events, delegations, athletes, trips, drivers, vehicles, accommodations, flights, providers },
        };
      }

      case 'query_events': {
        const where: Record<string, any> = {};
        if (args.status) where.status = args.status;
        if (args.name) where.name = ILike(`%${args.name}%`);
        return this.eventsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'name', 'country', 'city', 'startDate', 'endDate', 'status'],
        });
      }

      case 'query_delegations': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.countryCode) where.countryCode = args.countryCode;
        return this.delegationsRepo.find({ where, take: limit, order: { createdAt: 'DESC' } });
      }

      case 'query_athletes': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.delegationId) where.delegationId = args.delegationId;
        if (args.fullName) where.fullName = ILike(`%${args.fullName}%`);
        if (args.countryCode) where.countryCode = args.countryCode;
        if (args.status) where.status = args.status;
        if (args.userType) where.userType = args.userType;
        if (args.hasHotel === true) where.hotelAccommodationId = Not(IsNull());
        if (args.hasHotel === false) where.hotelAccommodationId = IsNull();
        if (args.hasTrip === true) where.transportTripId = Not(IsNull());
        if (args.hasTrip === false) where.transportTripId = IsNull();
        return this.athletesRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'delegationId', 'fullName', 'countryCode',
            'userType', 'status', 'hotelAccommodationId', 'roomType',
            'transportTripId', 'arrivalTime', 'isDelegationLead', 'accreditationStatus',
          ],
        });
      }

      case 'query_trips': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.driverId) where.driverId = args.driverId;
        if (args.vehicleId) where.vehicleId = args.vehicleId;
        if (args.status) where.status = args.status;
        if (args.tripType) where.tripType = args.tripType;
        if (args.clientType) where.clientType = args.clientType;
        if (args.fromDate) where.scheduledAt = MoreThanOrEqual(new Date(args.fromDate));
        if (args.toDate) where.scheduledAt = LessThanOrEqual(new Date(args.toDate));
        return this.tripsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'driverId', 'vehicleId', 'vehiclePlate',
            'origin', 'destination', 'tripType', 'clientType', 'tripCost',
            'passengerCount', 'status', 'scheduledAt', 'startedAt', 'completedAt',
          ],
        });
      }

      case 'query_drivers': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.fullName) where.fullName = ILike(`%${args.fullName}%`);
        if (args.status) where.status = args.status;
        if (args.hasVehicle === true) where.vehicleId = Not(IsNull());
        if (args.hasVehicle === false) where.vehicleId = IsNull();
        return this.driversRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'eventId', 'fullName', 'rut', 'email', 'phone', 'vehicleId', 'budgetAmount', 'status'],
        });
      }

      case 'query_vehicles': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.plate) where.plate = ILike(`%${args.plate}%`);
        if (args.type) where.type = args.type;
        if (args.status) where.status = args.status;
        if (args.minCapacity) where.capacity = MoreThanOrEqual(args.minCapacity);
        return this.transportsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'eventId', 'plate', 'type', 'brand', 'model', 'capacity', 'status'],
        });
      }

      case 'query_accommodations': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.name) where.name = ILike(`%${args.name}%`);
        return this.accommodationsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'eventId', 'name', 'accommodationType', 'address', 'totalCapacity', 'roomInventory', 'bedInventory'],
        });
      }

      case 'query_flights': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.flightNumber) where.flightNumber = ILike(`%${args.flightNumber}%`);
        if (args.airline) where.airline = ILike(`%${args.airline}%`);
        if (args.fromDate) where.arrivalTime = MoreThanOrEqual(new Date(args.fromDate));
        if (args.toDate) where.arrivalTime = LessThanOrEqual(new Date(args.toDate));
        return this.flightsRepo.find({
          where,
          take: limit,
          order: { arrivalTime: 'DESC' },
          select: ['id', 'eventId', 'flightNumber', 'airline', 'origin', 'arrivalTime', 'terminal'],
        });
      }

      case 'query_providers': {
        const where: Record<string, any> = {};
        if (args.name) where.name = ILike(`%${args.name}%`);
        if (args.type) where.type = args.type;
        if (args.rut) where.rut = args.rut;
        return this.providersRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'name', 'type', 'subtype', 'email', 'rut'],
        });
      }

      case 'query_vehicle_positions': {
        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;
        if (args.eventId) { conditions.push(`event_id = $${idx++}`); params.push(args.eventId); }
        if (args.vehicleId) { conditions.push(`vehicle_id = $${idx++}`); params.push(args.vehicleId); }
        if (args.driverId) { conditions.push(`driver_id = $${idx++}`); params.push(args.driverId); }
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        return this.dataSource.query(
          `SELECT DISTINCT ON (driver_id)
             vehicle_id, driver_id, event_id, timestamp, speed, heading, lat, lng
           FROM telemetry.vehicle_positions
           ${whereClause}
           ORDER BY driver_id, timestamp DESC
           LIMIT $${idx}`,
          [...params, limit],
        );
      }

      case 'count_athletes_by_country': {
        const qb = this.athletesRepo
          .createQueryBuilder('a')
          .select('a.country_code', 'countryCode')
          .addSelect('COUNT(*)::int', 'total')
          .groupBy('a.country_code')
          .orderBy('total', 'DESC');
        if (args.eventId) qb.where('a.event_id = :eventId', { eventId: args.eventId });
        return qb.getRawMany();
      }

      case 'count_trips_by_status': {
        const qb = this.tripsRepo
          .createQueryBuilder('t')
          .select('t.status', 'status')
          .addSelect('COUNT(*)::int', 'total')
          .groupBy('t.status')
          .orderBy('total', 'DESC');
        if (args.eventId) qb.where('t.event_id = :eventId', { eventId: args.eventId });
        return qb.getRawMany();
      }

      /* ---------- ACCIONES ---------- */
      case 'create_trip': return this.actCreateTrip(args);
      case 'assign_driver_to_trip': return this.actAssignDriver(args);
      case 'update_trip_status': return this.actUpdateTripStatus(args);
      case 'cancel_trip': return this.actCancelTrip(args);
      case 'auto_assign_drivers': return this.actAutoAssignDrivers(args);
      case 'create_hotel_assignment': return this.actCreateHotelAssignment(args);
      case 'release_hotel_assignment': return this.actReleaseHotelAssignment(args);
      case 'create_premiacion': return this.actCreatePremiacion(args);
      case 'update_premiacion_status': return this.actUpdatePremiacionStatus(args);
      case 'create_coupon': return this.actCreateCoupon(args);
      case 'claim_coupon': return this.actClaimCoupon(args);
      case 'send_notification': return this.actSendNotification(args);
      case 'create_workforce_person': return this.actCreateWorkforcePerson(args);
      case 'create_event': return this.actCreateEvent(args);
      case 'update_event_status': return this.actUpdateEventStatus(args);
      case 'create_delegation': return this.actCreateDelegation(args);
      case 'create_athlete': return this.actCreateAthlete(args);
      case 'update_athlete_status': return this.actUpdateAthleteStatus(args);
      case 'create_discipline': return this.actCreateDiscipline(args);
      case 'create_provider': return this.actCreateProvider(args);
      case 'create_venue': return this.actCreateVenue(args);
      case 'create_driver': return this.actCreateDriver(args);
      case 'create_vehicle': return this.actCreateVehicle(args);
      case 'create_flight': return this.actCreateFlight(args);
      case 'create_accommodation': return this.actCreateAccommodation(args);
      case 'create_hotel_room': return this.actCreateHotelRoom(args);
      case 'create_food_location': return this.actCreateFoodLocation(args);
      case 'create_food_menu': return this.actCreateFoodMenu(args);
      case 'update_accreditation_status': return this.actUpdateAccreditationStatus(args);
      case 'undo_last_action': return this.actUndoLastAction(args);

      /* ---------- ANALÍTICA ---------- */
      case 'forecast_trip_demand': return this.anForecastTripDemand(args, locale);
      case 'forecast_hotel_occupancy': return this.anForecastHotelOccupancy(args, locale);
      case 'coupon_partners_performance': return this.anCouponPartners(args, locale);
      case 'workforce_kpis': return this.anWorkforceKpis(args, locale);
      case 'analytics_trips_timeline': return this.anTripsTimeline(args, locale);
      case 'analytics_participants': return this.anParticipants(args, locale);

      /* ---------- TIEMPO REAL ---------- */
      case 'open_live_map': return this.liveArtifact('gps', args.eventId, locale);
      case 'open_live_trips': return this.liveArtifact('trips', args.eventId, locale);
      case 'open_alerts_feed': return this.liveArtifact('alerts', args.eventId, locale);
      case 'open_driver_monitor': return this.liveArtifact('presence', args.eventId, locale);
      case 'get_active_alerts': {
        const eventId = await this.resolveEventId(args.eventId);
        return { eventId, alerts: await this.computeAlerts(eventId) };
      }
      case 'get_driver_presence': {
        const eventId = await this.resolveEventId(args.eventId);
        return this.driverPresence.snapshot(eventId ?? undefined);
      }

      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }

  /* ================================================================ */
  /*  Action executors                                                 */
  /* ================================================================ */

  private async actCreateTrip(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible para crear el viaje.');
    const status = args.driverId ? 'SCHEDULED' : 'SCHEDULED';
    const rows = (await this.dataSource.query(
      `insert into transport.trips
         (event_id, driver_id, origin, destination, scheduled_at,
          passenger_count, trip_type, client_type, notes, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id, origin, destination, scheduled_at, status, driver_id`,
      [
        eventId,
        args.driverId ?? null,
        args.origin,
        args.destination,
        args.scheduledAt,
        args.passengerCount ?? null,
        args.tripType ?? null,
        args.clientType ?? null,
        args.notes ?? null,
        status,
      ],
    )) as Array<Record<string, any>>;
    const trip = rows[0];
    const summary = `Viaje creado: ${args.origin} → ${args.destination} (${new Date(args.scheduledAt).toLocaleString('es-CL')}).`;
    const logId = await this.logAction({
      tool: 'create_trip',
      args,
      status: 'success',
      result: trip,
      summary,
      undo: { tool: 'cancel_trip', args: { tripId: trip.id } },
    });
    return {
      __data: trip,
      __artifact: this.actionArtifact('create_trip', 'Viaje creado', 'success', summary, logId, true),
    };
  }

  private async actAssignDriver(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `update transport.trips
         set driver_id = $2,
             status = case when status = 'REQUESTED' then 'SCHEDULED' else status end,
             updated_at = now()
       where id = $1
       returning id, driver_id, status, origin, destination`,
      [args.tripId, args.driverId],
    )) as Array<Record<string, any>>;
    if (!rows[0]) throw new Error(`No se encontró el viaje ${args.tripId}.`);
    const summary = `Conductor asignado al viaje ${args.tripId}.`;
    const logId = await this.logAction({
      tool: 'assign_driver_to_trip',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('assign_driver_to_trip', 'Conductor asignado', 'success', summary, logId),
    };
  }

  private async actUpdateTripStatus(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from transport.trips where id = $1`,
      [args.tripId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró el viaje ${args.tripId}.`);
    const prevStatus = before[0].status;
    const rows = (await this.dataSource.query(
      `update transport.trips set status = $2, updated_at = now()
       where id = $1 returning id, status`,
      [args.tripId, args.status],
    )) as Array<Record<string, any>>;
    const summary = `Estado del viaje ${args.tripId}: ${prevStatus} → ${args.status}.`;
    const logId = await this.logAction({
      tool: 'update_trip_status',
      args,
      status: 'success',
      result: rows[0],
      summary,
      undo: { tool: 'update_trip_status', args: { tripId: args.tripId, status: prevStatus } },
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('update_trip_status', 'Estado actualizado', 'success', summary, logId, true),
    };
  }

  private async actCancelTrip(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from transport.trips where id = $1`,
      [args.tripId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró el viaje ${args.tripId}.`);
    const prevStatus = before[0].status;
    await this.dataSource.query(
      `update transport.trips set status = 'CANCELLED', updated_at = now() where id = $1`,
      [args.tripId],
    );
    const summary = `Viaje ${args.tripId} cancelado${args.reason ? ` (${args.reason})` : ''}.`;
    const logId = await this.logAction({
      tool: 'cancel_trip',
      args,
      status: 'success',
      summary,
      undo: { tool: 'update_trip_status', args: { tripId: args.tripId, status: prevStatus } },
    });
    return {
      __data: { id: args.tripId, status: 'CANCELLED' },
      __artifact: this.actionArtifact('cancel_trip', 'Viaje cancelado', 'success', summary, logId, true),
    };
  }

  private async actAutoAssignDrivers(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const max = Math.min(Math.max(Number(args.maxAssignments) || 20, 1), 100);

    const pending = (await this.dataSource.query(
      `select id, origin, destination, scheduled_at from transport.trips
       where event_id = $1 and driver_id is null
         and status in ('SCHEDULED','REQUESTED')
       order by scheduled_at asc nulls last
       limit $2`,
      [eventId, max],
    )) as Array<Record<string, any>>;

    const drivers = (await this.dataSource.query(
      `select id, full_name from transport.drivers
       where event_id = $1 and coalesce(status,'ACTIVE') = 'ACTIVE'
       order by full_name asc`,
      [eventId],
    )) as Array<{ id: string; full_name: string }>;

    if (drivers.length === 0) throw new Error('No hay conductores activos disponibles.');

    const assignments: Array<{ tripId: string; driverId: string; driverName: string }> = [];
    for (let i = 0; i < pending.length; i++) {
      const driver = drivers[i % drivers.length];
      await this.dataSource.query(
        `update transport.trips
           set driver_id = $2,
               status = case when status = 'REQUESTED' then 'SCHEDULED' else status end,
               updated_at = now()
         where id = $1`,
        [pending[i].id, driver.id],
      );
      assignments.push({ tripId: pending[i].id, driverId: driver.id, driverName: driver.full_name });
    }

    const summary = `${assignments.length} viaje(s) asignados automáticamente entre ${drivers.length} conductor(es).`;
    const logId = await this.logAction({
      tool: 'auto_assign_drivers',
      args,
      status: 'success',
      result: assignments,
      summary,
    });
    return {
      __data: { eventId, assigned: assignments.length, assignments },
      __artifact: this.actionArtifact('auto_assign_drivers', 'Asignación automática', 'success', summary, logId),
    };
  }

  private async actCreateHotelAssignment(args: Record<string, any>): Promise<ToolOutcome> {
    if (args.roomId) {
      const rooms = (await this.dataSource.query(
        `select beds_capacity from logistics.hotel_rooms where id = $1`,
        [args.roomId],
      )) as Array<{ beds_capacity: number }>;
      if (!rooms[0]) throw new Error(`No se encontró la habitación ${args.roomId}.`);
      const used = (await this.dataSource.query(
        `select count(*)::int as c from logistics.hotel_assignments
         where room_id = $1 and upper(coalesce(status,'ASSIGNED'))
               <> all (array['CHECKOUT','CHECKED_OUT','FINISHED','CANCELLED'])`,
        [args.roomId],
      )) as Array<{ c: number }>;
      if (Number(used[0]?.c ?? 0) >= Number(rooms[0].beds_capacity ?? 0)) {
        throw new Error('La habitación seleccionada no tiene capacidad disponible.');
      }
    }
    const rows = (await this.dataSource.query(
      `insert into logistics.hotel_assignments
         (participant_id, hotel_id, room_id, checkin_at, checkout_at, status)
       values ($1,$2,$3,$4,$5,'ASSIGNED')
       returning id, participant_id, hotel_id, room_id, status`,
      [args.participantId, args.hotelId, args.roomId ?? null, args.checkinAt ?? null, args.checkoutAt ?? null],
    )) as Array<Record<string, any>>;
    const summary = `Hotel asignado al participante ${args.participantId}.`;
    const logId = await this.logAction({
      tool: 'create_hotel_assignment',
      args,
      status: 'success',
      result: rows[0],
      summary,
      undo: { tool: 'release_hotel_assignment', args: { assignmentId: rows[0].id } },
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('create_hotel_assignment', 'Hotel asignado', 'success', summary, logId, true),
    };
  }

  private async actReleaseHotelAssignment(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `update logistics.hotel_assignments
         set status = 'CANCELLED', updated_at = now()
       where id = $1 returning id, status`,
      [args.assignmentId],
    )) as Array<Record<string, any>>;
    if (!rows[0]) throw new Error(`No se encontró la asignación ${args.assignmentId}.`);
    const summary = `Asignación de hotel ${args.assignmentId} liberada.`;
    const logId = await this.logAction({
      tool: 'release_hotel_assignment',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('release_hotel_assignment', 'Hotel liberado', 'success', summary, logId),
    };
  }

  private async actCreatePremiacion(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const rows = (await this.dataSource.query(
      `insert into core.premiaciones
         (event_id, title, discipline, scheduled_at, venue_name, notes, status)
       values ($1,$2,$3,$4,$5,$6,'PROGRAMADA')
       returning id, title, scheduled_at, status`,
      [eventId, args.title, args.discipline ?? null, args.scheduledAt, args.venueName ?? null, args.notes ?? null],
    )) as Array<Record<string, any>>;
    const summary = `Premiación creada: "${args.title}" (${new Date(args.scheduledAt).toLocaleString('es-CL')}).`;
    const logId = await this.logAction({
      tool: 'create_premiacion',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('create_premiacion', 'Premiación creada', 'success', summary, logId),
    };
  }

  private async actUpdatePremiacionStatus(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from core.premiaciones where id = $1`,
      [args.premiacionId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró la premiación ${args.premiacionId}.`);
    const rows = (await this.dataSource.query(
      `update core.premiaciones set status = $2, updated_at = now()
       where id = $1 returning id, status`,
      [args.premiacionId, args.status],
    )) as Array<Record<string, any>>;
    const summary = `Premiación ${args.premiacionId}: ${before[0].status} → ${args.status}.`;
    const logId = await this.logAction({
      tool: 'update_premiacion_status',
      args,
      status: 'success',
      result: rows[0],
      summary,
      undo: { tool: 'update_premiacion_status', args: { premiacionId: args.premiacionId, status: before[0].status } },
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('update_premiacion_status', 'Premiación actualizada', 'success', summary, logId, true),
    };
  }

  private async actCreateCoupon(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const code = args.code || this.genCouponCode();
    const rows = (await this.dataSource.query(
      `insert into public.coupons
         (event_id, code, title, description, category, discount_type,
          discount_value, valid_until, max_redemptions, per_user_limit,
          audience, status, partner_name)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,'{}','ACTIVE',$10)
       returning id, code, title, status, discount_type, discount_value`,
      [
        eventId,
        code,
        args.title,
        args.description ?? null,
        args.category ?? 'OTHER',
        args.discountType ?? 'PERCENTAGE',
        args.discountValue ?? null,
        args.validUntil ?? null,
        args.maxRedemptions ?? null,
        args.partnerName ?? null,
      ],
    )) as Array<Record<string, any>>;
    const summary = `Cupón creado: "${args.title}" (código ${code}).`;
    const logId = await this.logAction({
      tool: 'create_coupon',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('create_coupon', 'Cupón creado', 'success', summary, logId),
    };
  }

  private async actClaimCoupon(args: Record<string, any>): Promise<ToolOutcome> {
    const coupons = (await this.dataSource.query(
      `select id, title, status from public.coupons where id = $1`,
      [args.couponId],
    )) as Array<{ id: string; title: string; status: string }>;
    if (!coupons[0]) throw new Error(`No se encontró el cupón ${args.couponId}.`);
    if (coupons[0].status !== 'ACTIVE') throw new Error('El cupón no está activo.');

    const uniqueCode = this.genCouponCode();
    const qrToken = randomBytes(32).toString('hex');
    const rows = (await this.dataSource.query(
      `insert into public.coupon_claims
         (coupon_id, user_id, user_type, user_name, unique_code, qr_token, status)
       values ($1,$2,$3,$4,$5,$6,'CLAIMED')
       returning id, unique_code, status`,
      [args.couponId, args.userId, args.userType ?? null, args.userName ?? null, uniqueCode, qrToken],
    )) as Array<Record<string, any>>;
    const summary = `Cupón "${coupons[0].title}" reclamado para el usuario ${args.userId} (código ${uniqueCode}).`;
    const logId = await this.logAction({
      tool: 'claim_coupon',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('claim_coupon', 'Cupón reclamado', 'success', summary, logId),
    };
  }

  private async actSendNotification(args: Record<string, any>): Promise<ToolOutcome> {
    const audience = String(args.audience || 'all').toLowerCase();
    const rows = (await this.dataSource.query(
      `insert into public.sofia_notifications
         (audience, target_id, title, body, priority)
       values ($1,$2,$3,$4,$5)
       returning id, audience, title`,
      [audience, args.targetId ?? null, args.title, args.body, args.priority ?? 'normal'],
    )) as Array<Record<string, any>>;
    const target = args.targetId ? `destinatario ${args.targetId}` : `audiencia "${audience}"`;
    const summary = `Notificación enviada a ${target}: "${args.title}".`;
    const logId = await this.logAction({
      tool: 'send_notification',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('send_notification', 'Notificación enviada', 'success', summary, logId),
    };
  }

  private async actCreateWorkforcePerson(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const rows = (await this.dataSource.query(
      `insert into public.workforce_persons
         (event_id, full_name, rut, phone, person_type, role, daily_rate, days_count, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')
       returning id, full_name, person_type, role`,
      [
        eventId,
        args.fullName,
        args.rut ?? null,
        args.phone ?? null,
        args.personType ?? 'STAFF',
        args.role ?? null,
        args.dailyRate ?? 0,
        args.daysCount ?? 0,
      ],
    )) as Array<Record<string, any>>;
    const summary = `Persona registrada: ${args.fullName} (${args.personType ?? 'STAFF'}).`;
    const logId = await this.logAction({
      tool: 'create_workforce_person',
      args,
      status: 'success',
      result: rows[0],
      summary,
    });
    return {
      __data: rows[0],
      __artifact: this.actionArtifact('create_workforce_person', 'Persona registrada', 'success', summary, logId),
    };
  }

  /** Shared tail for an action executor: audit-log + build artifact. */
  private async finishAction(
    tool: string,
    label: string,
    args: Record<string, unknown>,
    data: Record<string, any>,
    summary: string,
    undo?: { tool: string; args: Record<string, unknown> },
  ): Promise<ToolOutcome> {
    const logId = await this.logAction({
      tool,
      args,
      status: 'success',
      result: data,
      summary,
      undo,
    });
    return {
      __data: data,
      __artifact: this.actionArtifact(tool, label, 'success', summary, logId, !!undo),
    };
  }

  private async actCreateEvent(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `insert into core.events (name, country, city, start_date, end_date, status, config)
       values ($1,$2,$3,$4,$5,'DRAFT','{}') returning id, name, status`,
      [args.name, args.country ?? null, args.city ?? null, args.startDate ?? null, args.endDate ?? null],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_event', 'Evento creado', args, rows[0], `Evento creado: "${args.name}".`);
  }

  private async actUpdateEventStatus(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from core.events where id = $1`,
      [args.eventId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró el evento ${args.eventId}.`);
    const rows = (await this.dataSource.query(
      `update core.events set status = $2, updated_at = now() where id = $1 returning id, name, status`,
      [args.eventId, args.status],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'update_event_status',
      'Evento actualizado',
      args,
      rows[0],
      `Evento ${args.eventId}: ${before[0].status} → ${args.status}.`,
      { tool: 'update_event_status', args: { eventId: args.eventId, status: before[0].status } },
    );
  }

  private async actCreateDelegation(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into core.delegations (event_id, country_code, metadata)
       values ($1,$2,'{}') returning id, country_code`,
      [eventId, String(args.countryCode).toUpperCase()],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'create_delegation',
      'Delegación creada',
      args,
      rows[0],
      `Delegación ${String(args.countryCode).toUpperCase()} creada.`,
    );
  }

  private async actCreateAthlete(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into core.athletes
         (event_id, delegation_id, discipline_id, full_name, country_code, user_type, email, phone)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, full_name, status`,
      [
        eventId,
        args.delegationId ?? null,
        args.disciplineId ?? null,
        args.fullName,
        args.countryCode ? String(args.countryCode).toUpperCase() : null,
        args.userType ?? null,
        args.email ?? null,
        args.phone ?? null,
      ],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'create_athlete',
      'Participante registrado',
      args,
      rows[0],
      `Participante registrado: ${args.fullName}.`,
    );
  }

  private async actUpdateAthleteStatus(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from core.athletes where id = $1`,
      [args.athleteId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró el participante ${args.athleteId}.`);
    const rows = (await this.dataSource.query(
      `update core.athletes set status = $2, updated_at = now() where id = $1 returning id, full_name, status`,
      [args.athleteId, args.status],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'update_athlete_status',
      'Participante actualizado',
      args,
      rows[0],
      `Participante ${args.athleteId}: ${before[0].status} → ${args.status}.`,
      { tool: 'update_athlete_status', args: { athleteId: args.athleteId, status: before[0].status } },
    );
  }

  private async actCreateDiscipline(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const rows = (await this.dataSource.query(
      `insert into core.disciplines (name, event_id, category, gender, scheduled_at, venue_name)
       values ($1,$2,$3,$4,$5,$6) returning id, name`,
      [args.name, eventId, args.category ?? null, args.gender ?? null, args.scheduledAt ?? null, args.venueName ?? null],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_discipline', 'Disciplina creada', args, rows[0], `Disciplina creada: "${args.name}".`);
  }

  private async actCreateProvider(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `insert into core.providers
         (name, type, subtype, email, phone, rut, address, city, contact_name, status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE','{}')
       returning id, name, type`,
      [
        args.name,
        args.type ?? null,
        args.subtype ?? null,
        args.email ?? null,
        args.phone ?? null,
        args.rut ?? null,
        args.address ?? null,
        args.city ?? null,
        args.contactName ?? null,
      ],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_provider', 'Proveedor creado', args, rows[0], `Proveedor creado: "${args.name}".`);
  }

  private async actCreateVenue(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into logistics.venues (event_id, name, address, region, commune)
       values ($1,$2,$3,$4,$5) returning id, name`,
      [eventId, args.name, args.address ?? null, args.region ?? null, args.commune ?? null],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_venue', 'Recinto creado', args, rows[0], `Recinto creado: "${args.name}".`);
  }

  private async actCreateDriver(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into transport.drivers
         (event_id, full_name, rut, phone, email, license_number, budget_amount)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, full_name`,
      [
        eventId,
        args.fullName,
        args.rut,
        args.phone ?? null,
        args.email ?? null,
        args.licenseNumber ?? null,
        args.budgetAmount ?? null,
      ],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_driver', 'Conductor registrado', args, rows[0], `Conductor registrado: ${args.fullName}.`);
  }

  private async actCreateVehicle(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into transport.vehicles (event_id, plate, type, brand, model, capacity)
       values ($1,$2,$3,$4,$5,$6) returning id, plate, type`,
      [eventId, args.plate, args.type, args.brand ?? null, args.model ?? null, args.capacity ?? 0],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_vehicle', 'Vehículo registrado', args, rows[0], `Vehículo registrado: ${args.plate} (${args.type}).`);
  }

  private async actCreateFlight(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into transport.flights (event_id, flight_number, airline, arrival_time, origin, terminal)
       values ($1,$2,$3,$4,$5,$6) returning id, flight_number, airline`,
      [eventId, args.flightNumber, args.airline, args.arrivalTime, args.origin, args.terminal ?? null],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_flight', 'Vuelo registrado', args, rows[0], `Vuelo registrado: ${args.flightNumber} (${args.airline}).`);
  }

  private async actCreateAccommodation(args: Record<string, any>): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    if (!eventId) throw new Error('No hay un evento disponible.');
    const rows = (await this.dataSource.query(
      `insert into logistics.accommodations (event_id, name, accommodation_type, address, total_capacity)
       values ($1,$2,$3,$4,$5) returning id, name`,
      [eventId, args.name, args.accommodationType ?? 'HOTEL', args.address ?? null, args.totalCapacity ?? 0],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_accommodation', 'Hotel creado', args, rows[0], `Hotel/alojamiento creado: "${args.name}".`);
  }

  private async actCreateHotelRoom(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `insert into logistics.hotel_rooms (hotel_id, room_number, room_type, beds_capacity, status)
       values ($1,$2,$3,$4,'AVAILABLE') returning id, room_number, room_type`,
      [args.hotelId, args.roomNumber, args.roomType, args.bedsCapacity ?? 1],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'create_hotel_room',
      'Habitación creada',
      args,
      rows[0],
      `Habitación ${args.roomNumber} (${args.roomType}) creada.`,
    );
  }

  private async actCreateFoodLocation(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `insert into logistics.food_locations (accommodation_id, name, description, capacity, client_types)
       values ($1,$2,$3,$4,'{}') returning id, name`,
      [args.accommodationId ?? null, args.name, args.description ?? null, args.capacity ?? null],
    )) as Array<Record<string, any>>;
    return this.finishAction('create_food_location', 'Comedor creado', args, rows[0], `Comedor creado: "${args.name}".`);
  }

  private async actCreateFoodMenu(args: Record<string, any>): Promise<ToolOutcome> {
    const rows = (await this.dataSource.query(
      `insert into logistics.food_menus (date, meal_type, title, description, dietary_type, accommodation_id)
       values ($1,$2,$3,$4,$5,$6) returning id, title`,
      [
        args.date,
        args.mealType,
        args.title,
        args.description ?? null,
        args.dietaryType ?? null,
        args.accommodationId ?? null,
      ],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'create_food_menu',
      'Menú creado',
      args,
      rows[0],
      `Menú "${args.title}" creado para ${args.date} (${args.mealType}).`,
    );
  }

  private async actUpdateAccreditationStatus(args: Record<string, any>): Promise<ToolOutcome> {
    const before = (await this.dataSource.query(
      `select status from core.accreditations where id = $1`,
      [args.accreditationId],
    )) as Array<{ status: string }>;
    if (!before[0]) throw new Error(`No se encontró la acreditación ${args.accreditationId}.`);
    const rows = (await this.dataSource.query(
      `update core.accreditations set status = $2, updated_at = now() where id = $1 returning id, status`,
      [args.accreditationId, args.status],
    )) as Array<Record<string, any>>;
    return this.finishAction(
      'update_accreditation_status',
      'Acreditación actualizada',
      args,
      rows[0],
      `Acreditación ${args.accreditationId}: ${before[0].status} → ${args.status}.`,
      {
        tool: 'update_accreditation_status',
        args: { accreditationId: args.accreditationId, status: before[0].status },
      },
    );
  }

  private async actUndoLastAction(args: Record<string, any>): Promise<ToolOutcome> {
    const where = args.logId ? 'id = $1' : 'undone = false and undo_tool is not null';
    const params = args.logId ? [args.logId] : [];
    const rows = (await this.dataSource.query(
      `select id, tool, undo_tool, undo_args, undone from public.sofia_action_log
       where ${where}
       order by created_at desc limit 1`,
      params,
    )) as Array<Record<string, any>>;
    const entry = rows[0];
    if (!entry) throw new Error('No hay ninguna acción reversible para deshacer.');
    if (entry.undone) throw new Error('Esa acción ya fue deshecha.');
    if (!entry.undo_tool) throw new Error('Esa acción no es reversible.');

    const undoArgs =
      typeof entry.undo_args === 'string' ? JSON.parse(entry.undo_args) : entry.undo_args || {};
    await this.executeToolInner(entry.undo_tool, undoArgs);
    await this.dataSource.query(
      `update public.sofia_action_log set undone = true, undone_at = now() where id = $1`,
      [entry.id],
    );
    const summary = `Acción "${entry.tool}" deshecha correctamente.`;
    return {
      __data: { undoneLogId: entry.id, via: entry.undo_tool },
      __artifact: this.actionArtifact('undo_last_action', 'Acción deshecha', 'success', summary),
    };
  }

  /* ================================================================ */
  /*  Analytics executors                                              */
  /* ================================================================ */

  private async anForecastTripDemand(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const daysAhead = Math.min(Math.max(Number(args.daysAhead) || 7, 1), 21);
    const history = (await this.dataSource.query(
      `select to_char(date_trunc('day', coalesce(scheduled_at, created_at)),'YYYY-MM-DD') as date,
              count(*)::int as value
       from transport.trips
       where ($1::uuid is null or event_id = $1)
         and coalesce(scheduled_at, created_at) >= now() - interval '30 days'
       group by 1 order by 1`,
      [eventId],
    )) as Array<{ date: string; value: number }>;

    const forecast = this.forecastSeries(history, daysAhead);
    const rows = [
      ...history.map((h) => ({ date: h.date, history: h.value, forecast: null as number | null })),
      ...forecast.map((f) => ({ date: f.date, history: null as number | null, forecast: f.value })),
    ];
    const peak = forecast.reduce((m, f) => (f.value > m.value ? f : m), { date: '', value: -1 });

    return {
      __data: {
        eventId,
        historyDays: history.length,
        forecast,
        peakDay: peak.date ? { date: peak.date, expected: peak.value } : null,
      },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'line',
        title: this.tr(
          locale,
          `Demanda de viajes — pronóstico ${daysAhead} días`,
          `Trip demand — ${daysAhead}-day forecast`,
          `Demanda de viagens — previsão de ${daysAhead} dias`,
        ),
        xKey: 'date',
        series: [
          { key: 'history', label: this.tr(locale, 'Histórico', 'Historical', 'Histórico'), color: '#64748b' },
          { key: 'forecast', label: this.tr(locale, 'Pronóstico', 'Forecast', 'Previsão'), color: '#21D0B3' },
        ],
        rows,
        note: peak.date
          ? this.tr(
              locale,
              `Pico previsto: ${peak.date} (~${peak.value} viajes).`,
              `Expected peak: ${peak.date} (~${peak.value} trips).`,
              `Pico previsto: ${peak.date} (~${peak.value} viagens).`,
            )
          : undefined,
      },
    };
  }

  private async anForecastHotelOccupancy(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const daysAhead = Math.min(Math.max(Number(args.daysAhead) || 7, 1), 21);
    const hotelFilter = args.hotelId ? 'and hotel_id = $1' : '';
    const params = args.hotelId ? [args.hotelId] : [];

    const checkins = (await this.dataSource.query(
      `select to_char(date_trunc('day', checkin_at),'YYYY-MM-DD') as date, count(*)::int as value
       from logistics.hotel_assignments
       where checkin_at is not null ${hotelFilter}
         and checkin_at >= now() - interval '30 days'
       group by 1 order by 1`,
      params,
    )) as Array<{ date: string; value: number }>;
    const checkouts = (await this.dataSource.query(
      `select to_char(date_trunc('day', checkout_at),'YYYY-MM-DD') as date, count(*)::int as value
       from logistics.hotel_assignments
       where checkout_at is not null ${hotelFilter}
         and checkout_at >= now() - interval '30 days'
       group by 1 order by 1`,
      params,
    )) as Array<{ date: string; value: number }>;

    const fcIn = this.forecastSeries(checkins, daysAhead);
    const fcOut = this.forecastSeries(checkouts, daysAhead);
    const outByDate = new Map(fcOut.map((f) => [f.date, f.value]));
    let running = 0;
    const rows = fcIn.map((f) => {
      running += f.value - (outByDate.get(f.date) ?? 0);
      return {
        date: f.date,
        checkin: f.value,
        checkout: outByDate.get(f.date) ?? 0,
        guests: Math.max(0, running),
      };
    });

    return {
      __data: { hotelId: args.hotelId ?? null, daysAhead, forecast: rows },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'area',
        title: this.tr(
          locale,
          `Ocupación hotelera — pronóstico ${daysAhead} días`,
          `Hotel occupancy — ${daysAhead}-day forecast`,
          `Ocupação hoteleira — previsão de ${daysAhead} dias`,
        ),
        xKey: 'date',
        series: [
          { key: 'checkin', label: 'Check-in', color: '#21D0B3' },
          { key: 'checkout', label: 'Check-out', color: '#f59e0b' },
          { key: 'guests', label: this.tr(locale, 'Huéspedes activos', 'Active guests', 'Hóspedes ativos'), color: '#6366f1' },
        ],
        rows,
      },
    };
  }

  private async anCouponPartners(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const noPartner = this.tr(locale, 'Sin partner', 'No partner', 'Sem parceiro');
    const partnerRows = (await this.dataSource.query(
      `select coalesce(p.name, $1) as partner,
              count(*) filter (where c.status = 'REDEEMED')::int as redeemed,
              count(*) filter (where c.status = 'CLAIMED')::int as claimed
       from public.coupon_claims c
       left join public.coupon_partners p on p.id = c.redeemed_partner_id
       group by 1
       order by redeemed desc
       limit 12`,
      [noPartner],
    )) as Array<{ partner: string; redeemed: number; claimed: number }>;

    const totals = (await this.dataSource.query(
      `select
         (select count(*)::int from public.coupons) as total_cupones,
         (select count(*)::int from public.coupons where status = 'ACTIVE') as activos,
         (select count(*)::int from public.coupon_claims) as total_claims,
         (select count(*)::int from public.coupon_claims where status = 'REDEEMED') as redenciones`,
    )) as Array<Record<string, number>>;
    const t = totals[0] || {};
    const conversion = t.total_claims ? Math.round((t.redenciones / t.total_claims) * 100) : 0;

    return {
      __data: { totals: t, conversionPct: conversion, byPartner: partnerRows },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'bar',
        title: this.tr(locale, 'Desempeño de cupones por partner', 'Coupon performance by partner', 'Desempenho de cupons por parceiro'),
        xKey: 'partner',
        series: [
          { key: 'redeemed', label: this.tr(locale, 'Canjeados', 'Redeemed', 'Resgatados'), color: '#21D0B3' },
          { key: 'claimed', label: this.tr(locale, 'Reclamados (sin canjear)', 'Claimed (not redeemed)', 'Reservados (não resgatados)'), color: '#94a3b8' },
        ],
        rows: partnerRows,
        kpis: [
          {
            label: this.tr(locale, 'Cupones activos', 'Active coupons', 'Cupons ativos'),
            value: t.activos ?? 0,
            hint: this.tr(locale, `${t.total_cupones ?? 0} en total`, `${t.total_cupones ?? 0} total`, `${t.total_cupones ?? 0} no total`),
          },
          {
            label: this.tr(locale, 'Redenciones', 'Redemptions', 'Resgates'),
            value: t.redenciones ?? 0,
            hint: this.tr(locale, `${t.total_claims ?? 0} reclamos`, `${t.total_claims ?? 0} claims`, `${t.total_claims ?? 0} reservas`),
          },
          {
            label: this.tr(locale, 'Conversión', 'Conversion', 'Conversão'),
            value: `${conversion}%`,
            tone: conversion >= 50 ? 'good' : 'warn',
          },
        ],
      },
    };
  }

  private async anWorkforceKpis(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const eventFilter = args.eventId ? 'where event_id = $1' : '';
    const params = args.eventId ? [args.eventId] : [];
    const persons = (await this.dataSource.query(
      `select
         count(*)::int as total,
         count(*) filter (where person_type = 'STAFF')::int as staff,
         count(*) filter (where person_type = 'VOLUNTEER')::int as voluntarios,
         coalesce(sum(daily_rate * days_count),0)::numeric as costo_laboral
       from public.workforce_persons ${eventFilter}`,
      params,
    )) as Array<Record<string, any>>;
    const deliveries = (await this.dataSource.query(
      `select
         count(*)::int as total,
         count(*) filter (where validated_at is not null)::int as validadas,
         count(*) filter (where validated_at is null)::int as pendientes
       from public.workforce_deliveries`,
    )) as Array<Record<string, any>>;
    const p = persons[0] || {};
    const d = deliveries[0] || {};

    const numFmt = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-CL';
    return {
      __data: { persons: p, deliveries: d },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'bar',
        title: this.tr(locale, 'KPIs de fuerza de trabajo', 'Workforce KPIs', 'KPIs da força de trabalho'),
        xKey: 'category',
        series: [{ key: 'value', label: this.tr(locale, 'Cantidad', 'Count', 'Quantidade'), color: '#6366f1' }],
        rows: [
          { category: 'Staff', value: Number(p.staff ?? 0) },
          { category: this.tr(locale, 'Voluntarios', 'Volunteers', 'Voluntários'), value: Number(p.voluntarios ?? 0) },
          { category: this.tr(locale, 'Entregas validadas', 'Validated deliveries', 'Entregas validadas'), value: Number(d.validadas ?? 0) },
          { category: this.tr(locale, 'Entregas pendientes', 'Pending deliveries', 'Entregas pendentes'), value: Number(d.pendientes ?? 0) },
        ],
        kpis: [
          { label: this.tr(locale, 'Personal total', 'Total staff', 'Pessoal total'), value: Number(p.total ?? 0) },
          {
            label: this.tr(locale, 'Costo laboral', 'Labor cost', 'Custo trabalhista'),
            value: `$${Number(p.costo_laboral ?? 0).toLocaleString(numFmt)}`,
          },
          {
            label: this.tr(locale, 'Entregas pendientes', 'Pending deliveries', 'Entregas pendentes'),
            value: Number(d.pendientes ?? 0),
            tone: Number(d.pendientes ?? 0) > 0 ? 'warn' : 'good',
          },
        ],
      },
    };
  }

  private async anTripsTimeline(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const days = Math.min(Math.max(Number(args.days) || 14, 1), 60);
    const eventId = await this.resolveEventId(args.eventId);
    const raw = (await this.dataSource.query(
      `select to_char(date_trunc('day', coalesce(scheduled_at, created_at)),'YYYY-MM-DD') as date,
              status, count(*)::int as total
       from transport.trips
       where ($1::uuid is null or event_id = $1)
         and coalesce(scheduled_at, created_at) >= now() - ($2 || ' days')::interval
       group by 1, 2 order by 1`,
      [eventId, days],
    )) as Array<{ date: string; status: string; total: number }>;

    const byDate = new Map<string, Record<string, unknown>>();
    const statuses = new Set<string>();
    raw.forEach((r) => {
      statuses.add(r.status);
      const row = byDate.get(r.date) || { date: r.date };
      row[r.status] = r.total;
      byDate.set(r.date, row);
    });
    const palette = ['#21D0B3', '#6366f1', '#f59e0b', '#ef4444', '#94a3b8', '#0ea5e9'];
    const series = Array.from(statuses).map((s, i) => ({
      key: s,
      label: s,
      color: palette[i % palette.length],
    }));

    return {
      __data: { eventId, days, timeline: Array.from(byDate.values()) },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'bar',
        title: this.tr(
          locale,
          `Viajes por día — últimos ${days} días`,
          `Trips per day — last ${days} days`,
          `Viagens por dia — últimos ${days} dias`,
        ),
        xKey: 'date',
        series,
        rows: Array.from(byDate.values()),
      },
    };
  }

  private async anParticipants(args: Record<string, any>, locale?: string): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(args.eventId);
    const groupBy = String(args.groupBy || 'accreditation').toLowerCase();
    const colMap: Record<string, string> = {
      accreditation: 'accreditation_status',
      status: 'status',
      usertype: 'user_type',
      country: 'country_code',
    };
    const titleMap: Record<string, string> = {
      accreditation: this.tr(locale, 'Participantes por estado de acreditación', 'Participants by accreditation status', 'Participantes por status de credenciamento'),
      status: this.tr(locale, 'Participantes por estado', 'Participants by status', 'Participantes por status'),
      usertype: this.tr(locale, 'Participantes por tipo de usuario', 'Participants by user type', 'Participantes por tipo de usuário'),
      country: this.tr(locale, 'Participantes por país', 'Participants by country', 'Participantes por país'),
    };
    const col = colMap[groupBy] ?? 'accreditation_status';
    const noData = this.tr(locale, 'Sin dato', 'No data', 'Sem dado');

    const rows = (await this.dataSource.query(
      `select coalesce(nullif(trim(${col}::text), ''), $2) as label,
              count(*)::int as cantidad
       from core.athletes
       where ($1::uuid is null or event_id = $1)
       group by 1
       order by cantidad desc`,
      [eventId, noData],
    )) as Array<{ label: string; cantidad: number }>;

    const total = rows.reduce((s, r) => s + Number(r.cantidad), 0);
    const accredited = rows
      .filter((r) => ['APPROVED', 'CREDENTIAL_ISSUED', 'ACCREDITED'].includes(String(r.label).toUpperCase()))
      .reduce((s, r) => s + Number(r.cantidad), 0);
    const top = rows[0];
    const participantsLabel = this.tr(locale, 'Participantes', 'Participants', 'Participantes');

    const kpis: SofiaArtifact['kpis'] = [
      { label: this.tr(locale, 'Participantes totales', 'Total participants', 'Participantes totais'), value: total },
    ];
    if (groupBy === 'accreditation') {
      const pct = total ? Math.round((accredited / total) * 100) : 0;
      kpis.push({
        label: this.tr(locale, 'Acreditados', 'Accredited', 'Credenciados'),
        value: accredited,
        hint: this.tr(locale, `${pct}% del total`, `${pct}% of total`, `${pct}% do total`),
        tone: pct >= 50 ? 'good' : 'warn',
      });
    }
    if (top) {
      kpis.push({
        label: this.tr(locale, 'Grupo mayoritario', 'Largest group', 'Grupo majoritário'),
        value: `${top.label} (${top.cantidad})`,
      });
    }

    return {
      __data: { eventId, groupBy, total, accredited: groupBy === 'accreditation' ? accredited : undefined, breakdown: rows },
      __artifact: {
        id: randomUUID(),
        kind: 'chart',
        chartType: 'bar',
        title: titleMap[groupBy] ?? participantsLabel,
        xKey: 'label',
        series: [{ key: 'cantidad', label: participantsLabel, color: '#21D0B3' }],
        rows,
        kpis,
      },
    };
  }

  /* ================================================================ */
  /*  Real-time                                                        */
  /* ================================================================ */

  private async liveArtifact(
    feed: 'gps' | 'trips' | 'alerts' | 'presence',
    rawEventId?: string,
    locale?: string,
  ): Promise<ToolOutcome> {
    const eventId = await this.resolveEventId(rawEventId);
    const titles = {
      gps: this.tr(locale, 'Mapa en vivo — conductores activos', 'Live map — active drivers', 'Mapa ao vivo — motoristas ativos'),
      trips: this.tr(locale, 'Viajes en curso — tiempo real', 'Trips in progress — real time', 'Viagens em andamento — tempo real'),
      alerts: this.tr(locale, 'Alertas operativas — tiempo real', 'Operational alerts — real time', 'Alertas operacionais — tempo real'),
      presence: this.tr(locale, 'Monitoreo de conductores — tiempo real', 'Driver monitoring — real time', 'Monitoramento de motoristas — tempo real'),
    };
    const snapshot = await this.liveSnapshot(feed, eventId);
    return {
      __data: { feed, eventId, snapshot },
      __artifact: {
        id: randomUUID(),
        kind: 'live',
        feed,
        eventId,
        title: titles[feed],
      },
    };
  }

  /** One-shot snapshot for a live feed. Reused by the SSE endpoint. */
  async liveSnapshot(feed: string, eventId: string | null): Promise<unknown> {
    if (feed === 'gps') {
      const rows = (await this.dataSource.query(
        `select distinct on (vp.driver_id)
           vp.driver_id, vp.vehicle_id, vp.lat, vp.lng, vp.speed, vp.heading,
           vp.timestamp, d.full_name as driver_name,
           extract(epoch from (now() - vp.timestamp))::int as age_seconds
         from telemetry.vehicle_positions vp
         left join transport.drivers d on d.id = vp.driver_id
         where ($1::uuid is null or vp.event_id = $1)
           and vp.timestamp >= now() - interval '30 minutes'
         order by vp.driver_id, vp.timestamp desc`,
        [eventId],
      )) as Array<Record<string, any>>;
      return {
        ts: new Date().toISOString(),
        drivers: rows.map((r) => ({
          driverId: r.driver_id,
          name: r.driver_name || 'Conductor',
          lat: Number(r.lat),
          lng: Number(r.lng),
          speed: Number(r.speed ?? 0),
          heading: Number(r.heading ?? 0),
          ageSeconds: Number(r.age_seconds ?? 0),
          stale: Number(r.age_seconds ?? 0) > 120,
        })),
      };
    }

    if (feed === 'trips') {
      const rows = (await this.dataSource.query(
        `select t.id, t.origin, t.destination, t.status, t.scheduled_at,
                d.full_name as driver_name
         from transport.trips t
         left join transport.drivers d on d.id = t.driver_id
         where ($1::uuid is null or t.event_id = $1)
           and t.status in ('SCHEDULED','EN_ROUTE','PICKED_UP','REQUESTED')
         order by t.scheduled_at asc nulls last
         limit 60`,
        [eventId],
      )) as Array<Record<string, any>>;
      return {
        ts: new Date().toISOString(),
        trips: rows.map((r) => ({
          id: r.id,
          origin: r.origin,
          destination: r.destination,
          status: r.status,
          scheduledAt: r.scheduled_at,
          driver: r.driver_name || null,
        })),
      };
    }

    if (feed === 'presence') {
      return this.driverPresence.snapshot(eventId ?? undefined);
    }

    return { ts: new Date().toISOString(), alerts: await this.computeAlerts(eventId) };
  }

  /** Compute operational alerts on the fly. */
  async computeAlerts(eventId: string | null): Promise<
    Array<{ level: 'high' | 'warn'; type: string; message: string; ref?: string }>
  > {
    const alerts: Array<{ level: 'high' | 'warn'; type: string; message: string; ref?: string }> = [];

    const lateStart = (await this.dataSource.query(
      `select id, origin, destination, scheduled_at from transport.trips
       where ($1::uuid is null or event_id = $1)
         and status = 'SCHEDULED'
         and scheduled_at < now() - interval '15 minutes'
       order by scheduled_at asc limit 20`,
      [eventId],
    )) as Array<Record<string, any>>;
    lateStart.forEach((t) => {
      alerts.push({
        level: 'high',
        type: 'trip_late_start',
        message: `Viaje sin iniciar: ${t.origin} → ${t.destination} (programado ${new Date(t.scheduled_at).toLocaleString('es-CL')}).`,
        ref: t.id,
      });
    });

    const longRunning = (await this.dataSource.query(
      `select id, origin, destination, scheduled_at from transport.trips
       where ($1::uuid is null or event_id = $1)
         and status in ('EN_ROUTE','PICKED_UP')
         and coalesce(started_at, scheduled_at) < now() - interval '2 hours'
       order by scheduled_at asc limit 20`,
      [eventId],
    )) as Array<Record<string, any>>;
    longRunning.forEach((t) => {
      alerts.push({
        level: 'warn',
        type: 'trip_long_running',
        message: `Viaje en curso hace más de 2 horas: ${t.origin} → ${t.destination}.`,
        ref: t.id,
      });
    });

    const staleGps = (await this.dataSource.query(
      `select d.id, d.full_name,
              extract(epoch from (now() - max(vp.timestamp)))::int as age
       from transport.trips t
       join transport.drivers d on d.id = t.driver_id
       left join telemetry.vehicle_positions vp on vp.driver_id = d.id
       where ($1::uuid is null or t.event_id = $1)
         and t.status in ('EN_ROUTE','PICKED_UP')
       group by d.id, d.full_name
       having max(vp.timestamp) is null
           or max(vp.timestamp) < now() - interval '10 minutes'
       limit 20`,
      [eventId],
    )) as Array<Record<string, any>>;
    staleGps.forEach((d) => {
      alerts.push({
        level: 'warn',
        type: 'gps_stale',
        message: d.age
          ? `${d.full_name} sin señal GPS hace ${Math.round(Number(d.age) / 60)} min, con viaje activo.`
          : `${d.full_name} no reporta GPS y tiene un viaje activo.`,
        ref: d.id,
      });
    });

    return alerts;
  }

  /** SSE stream for a live feed — emits a snapshot every few seconds. */
  liveStream(feed: string, eventId: string | null): Subject<unknown> {
    const subject = new Subject<unknown>();
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        subject.next(await this.liveSnapshot(feed, eventId));
      } catch (err) {
        this.logger.error(`liveStream(${feed}) error: ${err}`);
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 5000);

    const original = subject.complete.bind(subject);
    subject.complete = () => {
      stopped = true;
      clearInterval(interval);
      original();
    };
    return subject;
  }

  /** Audit log accessor for the admin view. */
  async getActionLog(limit = 50): Promise<Array<Record<string, unknown>>> {
    const n = Math.min(Math.max(limit, 1), 200);
    return this.dataSource.query(
      `select id, tool, status, summary, error, undo_tool is not null as undoable,
              undone, created_at
       from public.sofia_action_log
       order by created_at desc
       limit $1`,
      [n],
    );
  }

  /* ================================================================ */
  /*  OpenAI Responses API helpers                                     */
  /* ================================================================ */

  private getApiKey(): string {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY no está configurada.');
    return key;
  }

  private getModel(): string {
    return this.configService.get<string>('SOFIA_MODEL') || 'gpt-4o-mini';
  }

  private async callOpenAI(payload: Record<string, unknown>): Promise<Record<string, any>> {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
    }
    return res.json() as Promise<Record<string, any>>;
  }

  private extractText(data: Record<string, any>): string {
    if (data.output_text) return data.output_text;
    if (Array.isArray(data.output)) {
      return data.output
        .flatMap((item: any) => item.content || [])
        .filter((c: any) => c.type === 'output_text')
        .map((c: any) => c.text)
        .join('');
    }
    return '';
  }

  private extractFunctionCalls(
    data: Record<string, any>,
  ): Array<{ callId: string; name: string; arguments: string }> {
    if (!Array.isArray(data.output)) return [];
    return data.output
      .filter((item: any) => item.type === 'function_call')
      .map((item: any) => ({
        callId: item.call_id,
        name: item.name,
        arguments: item.arguments,
      }));
  }

  /* ================================================================ */
  /*  Public: non-streaming ask                                        */
  /* ================================================================ */

  async ask(
    question: string,
    previousResponseId?: string,
    locale?: string,
  ): Promise<SofiaAnswer> {
    const model = this.getModel();
    const instructions = this.buildSystemPrompt(locale);
    const artifacts: SofiaArtifact[] = [];

    let payload: Record<string, unknown> = {
      model,
      instructions,
      tools: SOFIA_TOOLS,
      input: [{ role: 'user', content: question }],
    };
    if (previousResponseId) payload.previous_response_id = previousResponseId;

    let responseId: string | null = null;

    for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
      const data = await this.callOpenAI(payload);
      responseId = data.id ?? null;

      const functionCalls = this.extractFunctionCalls(data);

      if (functionCalls.length === 0) {
        const text = this.extractText(data);
        this.logger.log(`SOFIA answered (${round} tool rounds) | Q: "${question.slice(0, 80)}"`);
        return {
          answer: text || 'No tengo una respuesta con los datos disponibles.',
          responseId,
          artifacts,
        };
      }

      this.logger.log(
        `SOFIA tool round ${round + 1}: ${functionCalls.map((fc) => fc.name).join(', ')}`,
      );

      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          let parsed: Record<string, any> = {};
          try {
            parsed = JSON.parse(fc.arguments);
          } catch { /* empty args */ }
          const { output, artifact } = await this.executeTool(fc.name, parsed, locale);
          if (artifact) artifacts.push(artifact);
          return { type: 'function_call_output' as const, call_id: fc.callId, output };
        }),
      );

      payload = {
        model,
        instructions,
        tools: SOFIA_TOOLS,
        previous_response_id: responseId,
        input: toolResults,
      };
    }

    return {
      answer:
        'Se alcanzó el límite de consultas internas. Por favor reformula tu pregunta de forma más específica.',
      responseId,
      artifacts,
    };
  }

  /* ================================================================ */
  /*  Public: streaming ask (SSE)                                      */
  /* ================================================================ */

  askStream(
    question: string,
    previousResponseId?: string,
    locale?: string,
  ): Subject<SofiaStreamChunk> {
    const subject = new Subject<SofiaStreamChunk>();
    this.runStreamLoop(subject, question, previousResponseId, locale).catch((err) => {
      this.logger.error(`Stream error: ${err}`);
      subject.next({ type: 'error', content: String(err) });
      subject.complete();
    });
    return subject;
  }

  private async runStreamLoop(
    subject: Subject<SofiaStreamChunk>,
    question: string,
    previousResponseId?: string,
    locale?: string,
  ): Promise<void> {
    const model = this.getModel();
    const instructions = this.buildSystemPrompt(locale);

    let payload: Record<string, unknown> = {
      model,
      instructions,
      tools: SOFIA_TOOLS,
      input: [{ role: 'user', content: question }],
      stream: true,
    };
    if (previousResponseId) payload.previous_response_id = previousResponseId;

    let responseId: string | null = null;

    for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
      const { text, functionCalls, id } = await this.consumeStream(
        payload,
        subject,
        round > 0,
      );
      responseId = id;

      if (functionCalls.length === 0) {
        if (!text) {
          subject.next({ type: 'delta', content: 'No tengo una respuesta con los datos disponibles.' });
        }
        subject.next({ type: 'done', content: '', responseId });
        subject.complete();
        this.logger.log(`SOFIA stream done (${round} tool rounds) | Q: "${question.slice(0, 80)}"`);
        return;
      }

      subject.next({ type: 'tool_call', content: functionCalls.map((fc) => fc.name).join(', ') });

      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          let parsed: Record<string, any> = {};
          try {
            parsed = JSON.parse(fc.arguments);
          } catch { /* empty */ }
          const { output, artifact } = await this.executeTool(fc.name, parsed, locale);
          if (artifact) {
            subject.next({ type: 'render', content: artifact.kind, artifact });
          }
          return { type: 'function_call_output' as const, call_id: fc.callId, output };
        }),
      );

      payload = {
        model,
        instructions,
        tools: SOFIA_TOOLS,
        previous_response_id: responseId,
        input: toolResults,
        stream: true,
      };
    }

    subject.next({
      type: 'delta',
      content:
        'Se alcanzó el límite de consultas internas. Reformula tu pregunta de forma más específica.',
    });
    subject.next({ type: 'done', content: '', responseId });
    subject.complete();
  }

  private async consumeStream(
    payload: Record<string, unknown>,
    subject: Subject<SofiaStreamChunk>,
    suppressDeltas: boolean,
  ): Promise<{
    text: string;
    functionCalls: Array<{ callId: string; name: string; arguments: string }>;
    id: string | null;
  }> {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
    }
    if (!res.body) throw new Error('No response body for streaming');

    const nodeStream = Readable.fromWeb(res.body as any);

    let buffer = '';
    let fullText = '';
    let responseId: string | null = null;
    const functionCalls: Array<{ callId: string; name: string; arguments: string }> = [];
    const fcArgBuffers = new Map<string, { name: string; args: string; callId?: string }>();

    for await (const chunk of nodeStream) {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        let event: any;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (event.response?.id) responseId = event.response.id;
        if (event.id && !responseId) responseId = event.id;

        const eventType: string = event.type || '';

        if (eventType === 'response.output_text.delta') {
          const delta: string = event.delta || '';
          fullText += delta;
          if (!suppressDeltas) subject.next({ type: 'delta', content: delta });
        }

        if (eventType === 'response.function_call_arguments.delta') {
          const itemId = event.item_id || '';
          if (!fcArgBuffers.has(itemId)) {
            fcArgBuffers.set(itemId, { name: event.name || '', args: '', callId: event.call_id || '' });
          }
          fcArgBuffers.get(itemId)!.args += event.delta || '';
          if (event.call_id && !fcArgBuffers.get(itemId)!.callId) {
            fcArgBuffers.get(itemId)!.callId = event.call_id;
          }
        }

        if (eventType === 'response.output_item.added') {
          const item = event.item;
          if (item?.type === 'function_call') {
            fcArgBuffers.set(item.id || '', {
              name: item.name || '',
              args: '',
              callId: item.call_id || item.id || '',
            });
          }
        }

        if (eventType === 'response.function_call_arguments.done') {
          const itemId = event.item_id || '';
          const buf = fcArgBuffers.get(itemId);
          if (buf) {
            functionCalls.push({
              callId: event.call_id || (buf as any).callId || itemId,
              name: buf.name || event.name || '',
              arguments: event.arguments || buf.args,
            });
          }
        }

        if (eventType === 'response.completed' && event.response?.id) {
          responseId = event.response.id;
        }
      }
    }

    return { text: fullText, functionCalls, id: responseId };
  }
}
