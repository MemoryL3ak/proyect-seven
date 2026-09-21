import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BulkFromScheduleDto,
  ScheduleRowDto,
} from './dto/bulk-from-schedule.dto';
import { AutoAssignDriversDto } from './dto/auto-assign-drivers.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

const MONTHS_ES: Record<string, number> = {
  ene: 0,
  enero: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
  '1': 0,
  '01': 0,
  '2': 1,
  '02': 1,
  '3': 2,
  '03': 2,
  '4': 3,
  '04': 3,
  '5': 4,
  '05': 4,
  '6': 5,
  '06': 5,
  '7': 6,
  '07': 6,
  '8': 7,
  '08': 7,
  '9': 8,
  '09': 8,
  '10': 9,
  '11': 10,
  '12': 11,
};

/**
 * Zona horaria en la que están escritas las horas de la planilla. El evento es
 * en Chile y la base guarda en UTC; el servidor puede correr en cualquier lado,
 * así que la conversión no puede depender de su reloj.
 */
const EVENT_TIME_ZONE = process.env.EVENT_TIME_ZONE || 'America/Santiago';

/**
 * El conductor se presenta 15 minutos antes de la hora del viaje. La hora de
 * presentación se calcula con esta regla y no se toma de la planilla: en los
 * archivos reales esa columna venía con criterios distintos según quién los
 * armaba.
 */
const PRESENTATION_LEAD_MINUTES = 15;

const VALID_CLIENT_TYPES = [
  'TF',
  'TM',
  'TA',
  'VIP',
  'T1',
  'FAMILIA_PARAPAN',
  'JEFE_MISION',
  'COORDINADOR_COMITE',
  'COORDINADOR_TRANSPORTE',
  'COORDINADOR_SEDE',
  'COMITE_ORGANIZADOR',
  'PROVEEDORES',
];

type TripWindow = {
  id: string;
  start: number;
  end: number;
  driverId: string | null;
};

type DriverProfile = {
  id: string;
  fullName: string;
  allowedClientTypes: string[];
  vehicleId: string | null;
  vehicleType: string | null;
  vehicleCapacity: number;
  vehiclePlate: string | null;
  isWheelchairCapable: boolean;
};

type TripCandidate = {
  id: string;
  eventId: string;
  origin: string | null;
  destination: string | null;
  clientType: string | null;
  fleetAcronym: string | null;
  passengerCount: number;
  wheelchairCount: number;
  scheduledAt: Date;
  returnAt: Date | null;
  presentationAt: Date | null;
  travelTimeMinutes: number;
  isRoundTrip: boolean;
  parentTripId: string | null;
  legType: string | null;
};

/**
 * Conductor candidato para emparejar con la columna "Conductor"/"Patente" de la
 * planilla de operatividad. Vive en transport.drivers (Flota propia) o en
 * core.provider_participants marcados como conductor, que es donde se
 * administran hoy el vehículo y la patente de cada chofer.
 */
type ScheduleDriver = {
  id: string;
  fullName: string;
  plate: string | null;
};

@Injectable()
export class TripsScheduleService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly pushService: PushNotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers de parsing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * La fecha se devuelve como medianoche UTC, o sea como fecha de calendario
   * pura: así `toISOString().slice(0,10)` da siempre el mismo día, corra el
   * servidor donde corra.
   */
  private parseDate(raw: string | undefined, defaultYear?: string): Date | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;

    // ISO yyyy-mm-dd or yyyy-mm-ddTHH:mm
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return new Date(
        Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
      );
    }

    // "1-nov" / "01-nov" / "1/11" / "1/11/2026"
    const parts = trimmed.split(/[-\/\s]/).filter(Boolean);
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10);
      const monthKey = String(parts[1]).toLowerCase();
      const month = MONTHS_ES[monthKey] ?? parseInt(parts[1], 10) - 1;
      const year =
        parts[2] && /^\d{4}$/.test(parts[2])
          ? Number(parts[2])
          : Number(defaultYear || new Date().getFullYear());
      if (!Number.isNaN(day) && month >= 0 && month <= 11) {
        return new Date(Date.UTC(year, month, day));
      }
    }

    return null;
  }

  /** Hora de presentación: los minutos de anticipación sobre la hora del viaje. */
  private withLead(at: Date): Date {
    return new Date(at.getTime() - PRESENTATION_LEAD_MINUTES * 60000);
  }

  /** Desfase en minutos de la zona del evento para un instante UTC dado. */
  private zoneOffsetMinutes(utcMs: number): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: EVENT_TIME_ZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utcMs));

    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const hour = get('hour') === 24 ? 0 : get('hour');
    const asIfUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      hour,
      get('minute'),
      get('second'),
    );
    return (asIfUtc - utcMs) / 60000;
  }

  /**
   * Combina la fecha con la hora escrita en la planilla. Las horas del archivo
   * son hora local del evento (Chile), no del servidor: sin esta conversión, un
   * backend en UTC guardaba "08:30" como 08:30Z y el panel lo mostraba a las
   * 05:30. Se resuelve el desfase con la zona horaria real, así que los cambios
   * de horario de verano quedan cubiertos.
   */
  private mergeDateTime(date: Date | null, hhmm: string | undefined): Date | null {
    if (!date) return null;
    const t = String(hhmm || '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;

    const naive = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      Number(m[1]),
      Number(m[2]),
    );
    // Dos pasadas: la primera estima el desfase, la segunda lo corrige en los
    // días en que el reloj cambia.
    let utcMs = naive - this.zoneOffsetMinutes(naive) * 60000;
    utcMs = naive - this.zoneOffsetMinutes(utcMs) * 60000;
    return new Date(utcMs);
  }

  private parseDurationMinutes(raw: string | undefined): number {
    const t = String(raw || '').trim();
    if (!t) return 0;
    const m = t.match(/^(\d+):(\d+)/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeClientType(raw: string | undefined): string | null {
    const v = String(raw || '').trim().toUpperCase();
    if (!v) return null;
    return VALID_CLIENT_TYPES.includes(v) ? v : v;
  }

  private isReturnLeg(legType?: string): boolean {
    const v = String(legType || '').trim().toUpperCase();
    return v === 'RETURN' || v === 'RETORNO' || v === 'REGRESO' || v === 'VUELTA';
  }

  /** Extrae el nombre de la columna faltante desde el error de PostgREST. */
  private missingColumnFrom(
    error: { message?: string } | null | undefined,
  ): string | null {
    const m = (error?.message ?? '').match(/Could not find the '([^']+)' column/);
    return m ? m[1] : null;
  }

  /** Descripción corta de un viaje candidato para los resultados de asignación. */
  private describeCandidate(t: TripCandidate): string {
    const date = t.scheduledAt.toISOString().slice(0, 10);
    const time = t.scheduledAt.toISOString().slice(11, 16);
    const route = [t.origin ?? '¿origen?', t.destination ?? '¿destino?'].join(' → ');
    const extras = [
      t.clientType,
      t.legType === 'RETURN' ? 'vuelta' : 'ida',
      t.passengerCount ? `${t.passengerCount} pax` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return `${date} ${time} · ${route}${extras ? ` (${extras})` : ''}`;
  }

  /**
   * Equivalencia entre el acrónimo de flota de la planilla (M1/M4/M5) y el tipo
   * de vehículo registrado (VAN/BUS/…): antes se comparaban por igualdad literal
   * y nunca coincidían, dejando todos los viajes sin chofer compatible.
   */
  private fleetMatches(fleetAcronym: string, vehicleType: string): boolean {
    const fleet = fleetAcronym.trim().toUpperCase();
    const type = vehicleType.trim().toUpperCase();
    if (!fleet || !type) return true;
    if (type === fleet) return true;
    const EQUIV: Record<string, RegExp> = {
      M1: /^(VAN(?!.*ADAPT)|SUV|AUTO|SEDAN)/,
      M4: /BUS/,
      M5: /(M5|ADAPT)/,
    };
    const re = EQUIV[fleet];
    return re ? re.test(type) : false;
  }

  /** Descripción corta de un viaje para resultados legibles por el operador. */
  private describeTripRow(tripRow: Record<string, unknown>): string {
    const date = String(tripRow.trip_date ?? '');
    const time = String(tripRow.scheduled_at ?? '').slice(11, 16);
    const route = [tripRow.origin ?? '¿origen?', tripRow.destination ?? '¿destino?'].join(' → ');
    const extras = [
      tripRow.client_type ?? null,
      tripRow.passenger_count ? `${tripRow.passenger_count} pax` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return `${date} ${time} · ${route}${extras ? ` (${extras})` : ''}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Emparejado del conductor que ya viene escrito en la planilla
  // ─────────────────────────────────────────────────────────────────────────

  /** Nombre comparable: sin tildes, sin dobles espacios, en minúsculas. */
  private normalizeName(raw: string | null | undefined): string {
    return String(raw ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Patente comparable: solo letras y dígitos ("SP GY 95" ≡ "SPGY95"). */
  private normalizePlate(raw: string | null | undefined): string {
    return String(raw ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Pool de conductores contra el que se empareja la planilla: la Flota del
   * evento más los participantes de proveedor marcados como conductor. Se
   * carga una sola vez por importación, no una vez por fila.
   */
  private async fetchScheduleDrivers(eventId: string): Promise<ScheduleDriver[]> {
    const drivers: ScheduleDriver[] = [];

    const { data: fleetRows } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, vehicle_id')
      .eq('status', 'ACTIVE')
      .eq('event_id', eventId);

    const fleet = (fleetRows as Array<Record<string, unknown>>) ?? [];
    const vehicleIds = fleet
      .map((d) => d.vehicle_id as string | null)
      .filter((v): v is string => !!v);

    const plateByVehicle = new Map<string, string>();
    if (vehicleIds.length) {
      const { data: vehicleRows } = await this.supabase
        .schema('transport')
        .from('vehicles')
        .select('id, plate')
        .in('id', vehicleIds);
      ((vehicleRows as Array<Record<string, unknown>>) ?? []).forEach((v) => {
        if (v.plate) plateByVehicle.set(v.id as string, String(v.plate));
      });
    }

    fleet.forEach((d) => {
      drivers.push({
        id: d.id as string,
        fullName: (d.full_name as string) ?? '',
        plate: d.vehicle_id
          ? (plateByVehicle.get(d.vehicle_id as string) ?? null)
          : null,
      });
    });

    // Una persona puede existir en ambas tablas con el MISMO id; el de Flota
    // manda y el de proveedor se omite, igual que en fetchDriverProfiles.
    const knownIds = new Set(drivers.map((d) => d.id));
    const { data: ppRows } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, metadata')
      .eq('metadata->>isDriver', 'true');

    ((ppRows as Array<Record<string, unknown>>) ?? []).forEach((p) => {
      if (knownIds.has(p.id as string)) return;
      const meta =
        p.metadata && typeof p.metadata === 'object'
          ? (p.metadata as Record<string, unknown>)
          : {};
      drivers.push({
        id: p.id as string,
        fullName: (p.full_name as string) ?? '',
        plate: String(meta.vehiclePatente ?? '').trim() || null,
      });
    });

    return drivers;
  }

  /**
   * Resuelve el conductor de una fila. Devuelve null cuando la planilla no dice
   * nada (no es un problema: lo resolverá la auto-asignación), el conductor
   * cuando la coincidencia es inequívoca, y un motivo cuando hay empate,
   * contradicción o ningún registro — en esos casos el viaje se crea sin chofer
   * en vez de arriesgar una asignación equivocada.
   */
  private matchScheduleDriver(
    drivers: ScheduleDriver[],
    rawName: string | undefined,
    rawPlate: string | undefined,
  ): { driver: ScheduleDriver } | { reason: string } | null {
    const name = this.normalizeName(rawName);
    const plate = this.normalizePlate(rawPlate);
    if (!name && !plate) return null;

    const byName = name
      ? drivers.filter((d) => this.normalizeName(d.fullName) === name)
      : [];
    const byPlate = plate
      ? drivers.filter((d) => this.normalizePlate(d.plate) === plate)
      : [];

    // Nombre + patente es la clave más específica: desempata los nombres
    // repetidos y las patentes compartidas entre dos choferes.
    const both = byName.filter((d) => byPlate.some((p) => p.id === d.id));
    if (both.length === 1) return { driver: both[0] };

    if (byName.length === 1 && byPlate.length === 1) {
      return {
        reason:
          `el conductor "${rawName}" y la patente ${rawPlate} apuntan a personas distintas ` +
          `("${byName[0].fullName}" y "${byPlate[0].fullName}")`,
      };
    }
    if (byName.length === 1) return { driver: byName[0] };
    if (byPlate.length === 1) return { driver: byPlate[0] };

    const ambiguous = Math.max(byName.length, byPlate.length, both.length);
    if (ambiguous > 1) {
      return {
        reason: `"${rawName || rawPlate}" coincide con ${ambiguous} conductores registrados`,
      };
    }
    return {
      reason: `no hay ningún conductor registrado que coincida con "${[rawName, rawPlate]
        .filter(Boolean)
        .join(' / ')}"`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1) Bulk import desde CSV / XLSX
  // ─────────────────────────────────────────────────────────────────────────

  async bulkFromSchedule(dto: BulkFromScheduleDto) {
    const created: Array<{
      index: number;
      id: string;
      label: string;
      driver?: string;
    }> = [];
    const skipped: Array<{ index: number; reason: string }> = [];
    const warnings: string[] = [];
    // La planilla ya trae escrito quién maneja cada bus. Se respeta: si el
    // nombre o la patente identifican a un conductor registrado sin ambigüedad,
    // el viaje se crea YA asignado y no pasa por la auto-asignación. Los
    // motivos por los que una fila no pudo emparejarse se agrupan para no
    // repetir la misma advertencia en cada tramo del mismo bus.
    const scheduleDrivers = await this.fetchScheduleDrivers(dto.eventId);
    const driverIssues = new Map<string, number[]>();
    let driverAssignedCount = 0;
    // Columnas que la base desplegada no tiene (desfase de esquema). Se detectan
    // en el primer insert que falla y se omiten en el resto de las filas; antes
    // esto hacía fallar TODAS las filas con un error críptico de PostgREST y la
    // importación terminaba en 0 viajes creados.
    const droppedColumns = new Set<string>();

    const insertTrip = async (
      row: Record<string, unknown>,
    ): Promise<{ id: string } | { failure: string }> => {
      let payload: Record<string, unknown> = { ...row };
      droppedColumns.forEach((c) => delete payload[c]);
      for (let attempt = 0; attempt < 12; attempt++) {
        const { data, error } = await this.supabase
          .schema('transport')
          .from('trips')
          .insert(payload)
          .select('id')
          .single();
        if (!error && data) return { id: (data as { id: string }).id };
        const missing = this.missingColumnFrom(error);
        if (!missing || !(missing in payload)) {
          return { failure: error?.message || 'Error desconocido al insertar' };
        }
        droppedColumns.add(missing);
        payload = { ...payload };
        delete payload[missing];
      }
      return { failure: 'La base de datos rechazó la fila repetidamente' };
    };

    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];

      try {
        const tripDate = this.parseDate(row.date, dto.defaultYear);
        if (!tripDate) {
          skipped.push({ index: i, reason: 'Fecha inválida o ausente' });
          continue;
        }

        const sheetPresentationAt = this.mergeDateTime(
          tripDate,
          row.presentationTime,
        );
        const departureAt = this.mergeDateTime(tripDate, row.departureTime);
        const arrivalAt = this.mergeDateTime(tripDate, row.arrivalTime);
        const returnAt = this.mergeDateTime(tripDate, row.returnTime);

        // La hora del viaje es la hora del bus: cuando tiene que estar en el
        // origen recogiendo ("Hora Llegada Bus"). Antes se usaba la llegada al
        // recinto, que es el final del traslado y no su inicio. Si la planilla
        // no trae esa columna se cae a la llegada al recinto y luego a la
        // presentación, para no perder la fila.
        const scheduledAt = departureAt || arrivalAt || sheetPresentationAt;

        if (!scheduledAt) {
          skipped.push({ index: i, reason: 'Sin hora de salida/llegada' });
          continue;
        }

        const presentationAt = this.withLead(scheduledAt);

        const clientType = this.normalizeClientType(row.clientType);
        const fleetAcronym = String(row.fleetAcronym || '').trim().toUpperCase() || null;
        const legType = this.isReturnLeg(row.legType) ? 'RETURN' : 'OUTBOUND';
        const isRoundTrip = !!returnAt && legType === 'OUTBOUND';

        const driverMatch = this.matchScheduleDriver(
          scheduleDrivers,
          row.driverName,
          row.vehiclePlate,
        );
        let driverId: string | null = null;
        let driverName: string | null = null;
        if (driverMatch && 'driver' in driverMatch) {
          driverId = driverMatch.driver.id;
          driverName = driverMatch.driver.fullName;
        } else if (driverMatch) {
          const rows = driverIssues.get(driverMatch.reason) ?? [];
          rows.push(i + 1);
          driverIssues.set(driverMatch.reason, rows);
        }

        const tripRow: Record<string, unknown> = {
          event_id: dto.eventId,
          driver_id: driverId,
          origin: row.originName || row.originAddress || null,
          destination: row.destinationName || row.destinationAddress || null,
          trip_type: row.activity || null,
          client_type: clientType,
          passenger_count: row.passengerCount ?? null,
          wheelchair_count: row.wheelchairCount ?? 0,
          notes: row.notes || row.observation || null,
          fleet_acronym: fleetAcronym,
          requested_vehicle_type: row.fleetType || null,
          vehicle_plate: row.vehiclePlate || null,
          discipline: row.discipline || null,
          activity: row.activity || null,
          trip_date: tripDate.toISOString().slice(0, 10),
          presentation_at: presentationAt?.toISOString() ?? null,
          scheduled_at: scheduledAt.toISOString(),
          return_at: returnAt?.toISOString() ?? null,
          travel_time_minutes: this.parseDurationMinutes(row.travelTime),
          is_round_trip: isRoundTrip,
          leg_type: legType,
          status: 'SCHEDULED',
          metadata: {
            importedAt: new Date().toISOString(),
            sourceRow: i,
            busNumber: row.busNumber || null,
            gender: row.gender || null,
            country: null,
          },
        };

        const inserted = await insertTrip(tripRow);
        if ('failure' in inserted) {
          skipped.push({ index: i, reason: inserted.failure });
          continue;
        }

        created.push({
          index: i,
          id: inserted.id,
          label: this.describeTripRow(tripRow),
          driver: driverName ?? undefined,
        });
        if (driverId) driverAssignedCount++;

        // Si es ida con retorno, crear el viaje de retorno asociado
        if (isRoundTrip && returnAt) {
          const returnRow: Record<string, unknown> = {
            ...tripRow,
            origin: row.destinationName || row.destinationAddress || null,
            destination: row.originName || row.originAddress || null,
            scheduled_at: returnAt.toISOString(),
            presentation_at: this.withLead(returnAt).toISOString(),
            return_at: null,
            is_round_trip: true,
            leg_type: 'RETURN',
            parent_trip_id: inserted.id,
          };

          const returnInserted = await insertTrip(returnRow);
          if ('failure' in returnInserted) {
            warnings.push(
              `Fila ${i + 1}: la ida se creó pero el viaje de retorno falló (${returnInserted.failure}).`,
            );
          } else {
            created.push({
              index: i,
              id: returnInserted.id,
              label: this.describeTripRow(returnRow),
              driver: driverName ?? undefined,
            });
            if (driverId) driverAssignedCount++;
          }
        }
      } catch (err) {
        skipped.push({
          index: i,
          reason: err instanceof Error ? err.message : 'Error procesando fila',
        });
      }
    }

    if (droppedColumns.size > 0) {
      warnings.push(
        `La base de datos no tiene la(s) columna(s): ${Array.from(droppedColumns).join(', ')}. ` +
          'Los viajes se crearon sin esos datos — hay una migración de esquema pendiente.',
      );
    }

    driverIssues.forEach((rows, reason) => {
      const etiqueta = rows.length > 1 ? `Filas ${rows.join(', ')}` : `Fila ${rows[0]}`;
      warnings.push(
        `${etiqueta}: ${reason}. El viaje se creó sin conductor — asígnalo en "Asignar conductores".`,
      );
    });

    return {
      created,
      skipped,
      warnings,
      driverAssignedCount,
      createdCount: created.length,
      skippedCount: skipped.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2) Auto-asignación de choferes
  // ─────────────────────────────────────────────────────────────────────────

  async autoAssignDrivers(dto: AutoAssignDriversDto) {
    const enforceClientTypeMatch = dto.enforceClientTypeMatch ?? true;
    const enforceFleetTypeMatch = dto.enforceFleetTypeMatch ?? true;
    const respectVehicleCapacity = dto.respectVehicleCapacity ?? true;
    const respectWheelchair = dto.respectWheelchair ?? true;
    const prioritizeRoundTrips = dto.prioritizeRoundTrips ?? true;
    const bufferMinutes = dto.bufferMinutes ?? 90;
    const maxTripsPerDriver = dto.maxTripsPerDriver ?? null;
    const strategy = dto.strategy ?? 'least_loaded';
    const dryRun = dto.dryRun ?? false;

    try {
      // 1) Cargar viajes objetivo (pendientes de chofer)
      const trips = await this.fetchPendingTrips(dto);
      if (trips.length === 0) {
        const filtros = [
          dto.date ? `fecha ${dto.date}` : null,
          dto.clientType ? `cliente ${dto.clientType}` : null,
          dto.fleetAcronym ? `flota ${dto.fleetAcronym}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return {
          assigned: [],
          unassigned: [],
          assignedCount: 0,
          unassignedCount: 0,
          message:
            `No hay viajes sin chofer${filtros ? ` para ${filtros}` : ''}. ` +
            'Verifica que la importación creó viajes en esa fecha y que aún no tienen conductor asignado.',
        };
      }

      // 2) Cargar drivers + sus vehículos
      const drivers = await this.fetchDriverProfiles(dto.eventId, dto.fleetAcronym);
      if (drivers.length === 0) {
        return {
          assigned: [],
          unassigned: trips.map((t) => ({
            tripId: t.id,
            tripLabel: this.describeCandidate(t),
            reason:
              'No hay choferes registrados que pasen este filtro: revisa los conductores de proveedores (Registro → Proveedores) y de la Flota.',
          })),
          assignedCount: 0,
          unassignedCount: trips.length,
        };
      }

      // 3) Cargar ventanas existentes (otros viajes ya asignados de los choferes
      //    candidatos) para no pisar agenda previa
      const existingWindows = await this.fetchExistingWindows(drivers.map((d) => d.id));

      // 4) Estructuras de trabajo
      const driverWindows = new Map<string, TripWindow[]>();
      drivers.forEach((d) => {
        driverWindows.set(d.id, existingWindows.get(d.id) ?? []);
      });
      const driverTripCount = new Map<string, number>();
      drivers.forEach((d) => {
        driverTripCount.set(d.id, (existingWindows.get(d.id) ?? []).length);
      });

      const assigned: Array<{
        tripId: string;
        tripLabel: string;
        driverId: string;
        driverName: string;
      }> = [];
      const unassigned: Array<{ tripId: string; tripLabel: string; reason: string }> = [];

      // 5) Procesar primero los OUTBOUND para poder priorizar el mismo chofer
      //    en el RETURN correspondiente
      const outbound = trips.filter((t) => (t.legType || 'OUTBOUND') !== 'RETURN');
      const returns = trips.filter((t) => t.legType === 'RETURN');
      const outboundAssignment = new Map<string, string>(); // parentTripId → driverId

      const tryAssign = (
        trip: TripCandidate,
        preferredDriverId?: string,
      ): { driverId: string; driverName: string } | { reason: string } => {
        const tripStart = (trip.presentationAt || trip.scheduledAt).getTime();
        const tripEnd =
          (trip.returnAt || trip.scheduledAt).getTime() +
          (trip.travelTimeMinutes || 30) * 60000;
        const winStart = tripStart - bufferMinutes * 60000;
        const winEnd = tripEnd + bufferMinutes * 60000;

        // Contadores de rechazo por regla, para explicar exactamente por qué
        // un viaje quedó sin chofer en vez del genérico "sin compatible".
        const rejections = {
          clientType: 0,
          fleet: 0,
          capacity: 0,
          wheelchair: 0,
          quota: 0,
          busy: 0,
        };

        const candidates = drivers.filter((d) => {
          // a) Client type — un chofer sin tipos declarados (choferes de
          //    proveedor) se considera sin restricción; los de Flota declaran
          //    VIP/T1 y por tanto solo toman esos viajes.
          if (
            enforceClientTypeMatch &&
            trip.clientType &&
            d.allowedClientTypes.length > 0 &&
            !d.allowedClientTypes.includes(trip.clientType)
          ) {
            rejections.clientType++;
            return false;
          }
          // b) Fleet type (equivalencia M1/M4/M5 ↔ tipo de vehículo)
          if (
            enforceFleetTypeMatch &&
            trip.fleetAcronym &&
            d.vehicleType &&
            !this.fleetMatches(trip.fleetAcronym, d.vehicleType)
          ) {
            rejections.fleet++;
            return false;
          }
          // c) Capacity
          if (
            respectVehicleCapacity &&
            trip.passengerCount > 0 &&
            d.vehicleCapacity > 0 &&
            trip.passengerCount > d.vehicleCapacity
          ) {
            rejections.capacity++;
            return false;
          }
          // d) Wheelchair
          if (
            respectWheelchair &&
            trip.wheelchairCount > 0 &&
            !d.isWheelchairCapable
          ) {
            rejections.wheelchair++;
            return false;
          }
          // e) Cupo diario
          if (
            maxTripsPerDriver !== null &&
            (driverTripCount.get(d.id) ?? 0) >= maxTripsPerDriver
          ) {
            rejections.quota++;
            return false;
          }
          // f) No solapar agenda
          const windows = driverWindows.get(d.id) ?? [];
          const overlaps = windows.some(
            (w) => !(winEnd <= w.start || winStart >= w.end),
          );
          if (overlaps) {
            rejections.busy++;
            return false;
          }

          return true;
        });

        if (candidates.length === 0) {
          const parts: string[] = [];
          if (rejections.clientType)
            parts.push(`${rejections.clientType} sin permiso para cliente ${trip.clientType}`);
          if (rejections.fleet)
            parts.push(`${rejections.fleet} con vehículo incompatible con flota ${trip.fleetAcronym}`);
          if (rejections.capacity)
            parts.push(`${rejections.capacity} sin capacidad para ${trip.passengerCount} pax`);
          if (rejections.wheelchair)
            parts.push(`${rejections.wheelchair} sin vehículo adaptado (viaje con silla de ruedas)`);
          if (rejections.quota)
            parts.push(`${rejections.quota} en su tope diario de viajes`);
          if (rejections.busy)
            parts.push(`${rejections.busy} con la agenda ocupada en ese horario (buffer ${bufferMinutes} min)`);
          return {
            reason: `Ninguno de los ${drivers.length} choferes calza: ${parts.join(', ') || 'sin candidatos'}`,
          };
        }

        // Estrategia
        let chosen = candidates[0];
        if (preferredDriverId) {
          const pref = candidates.find((c) => c.id === preferredDriverId);
          if (pref) chosen = pref;
        }
        if (chosen.id !== preferredDriverId) {
          if (strategy === 'least_loaded') {
            chosen = candidates.reduce((best, c) =>
              (driverTripCount.get(c.id) ?? 0) <
              (driverTripCount.get(best.id) ?? 0)
                ? c
                : best,
            );
          } else if (strategy === 'longest_idle') {
            chosen = candidates.reduce((best, c) => {
              const cLast = Math.max(
                ...((driverWindows.get(c.id) ?? []).map((w) => w.end) || [0]),
                0,
              );
              const bLast = Math.max(
                ...((driverWindows.get(best.id) ?? []).map((w) => w.end) || [
                  0,
                ]),
                0,
              );
              return cLast < bLast ? c : best;
            });
          }
        }

        // Reservar agenda
        const windows = driverWindows.get(chosen.id) ?? [];
        windows.push({
          id: trip.id,
          start: winStart,
          end: winEnd,
          driverId: chosen.id,
        });
        driverWindows.set(chosen.id, windows);
        driverTripCount.set(
          chosen.id,
          (driverTripCount.get(chosen.id) ?? 0) + 1,
        );

        return { driverId: chosen.id, driverName: chosen.fullName };
      };

      for (const trip of outbound) {
        const result = tryAssign(trip);
        if ('driverId' in result) {
          assigned.push({
            tripId: trip.id,
            tripLabel: this.describeCandidate(trip),
            driverId: result.driverId,
            driverName: result.driverName,
          });
          if (trip.isRoundTrip) {
            outboundAssignment.set(trip.id, result.driverId);
          }
        } else {
          unassigned.push({
            tripId: trip.id,
            tripLabel: this.describeCandidate(trip),
            reason: result.reason,
          });
        }
      }

      for (const trip of returns) {
        const preferredId =
          prioritizeRoundTrips && trip.parentTripId
            ? outboundAssignment.get(trip.parentTripId)
            : undefined;
        const result = tryAssign(trip, preferredId);
        if ('driverId' in result) {
          assigned.push({
            tripId: trip.id,
            tripLabel: this.describeCandidate(trip),
            driverId: result.driverId,
            driverName: result.driverName,
          });
        } else {
          unassigned.push({
            tripId: trip.id,
            tripLabel: this.describeCandidate(trip),
            reason: result.reason,
          });
        }
      }

      // 6) Persistir si no es dryRun. El enum trip_status de la BD no tiene
      //    'ASSIGNED': la asignación se expresa con driver_id y el viaje se
      //    mantiene/mueve a SCHEDULED. Cualquier fallo del UPDATE se degrada a
      //    "sin asignar" con el motivo, en vez de perderse en silencio.
      if (!dryRun) {
        const persisted: typeof assigned = [];
        for (const a of assigned) {
          const { error: updateError } = await this.supabase
            .schema('transport')
            .from('trips')
            .update({ driver_id: a.driverId, status: 'SCHEDULED' })
            .eq('id', a.tripId);
          if (updateError) {
            unassigned.push({
              tripId: a.tripId,
              tripLabel: a.tripLabel,
              reason: `La base de datos rechazó la asignación: ${updateError.message}`,
            });
          } else {
            persisted.push(a);
          }
        }
        assigned.length = 0;
        assigned.push(...persisted);

        // Notificar la asignación: al conductor y a los pasajeros del viaje.
        // Los viajes de la operatividad diaria no tienen requester_athlete_id,
        // así que los pasajeros se resuelven desde trip_athletes.
        if (assigned.length > 0) {
          const tripIds = assigned.map((a) => a.tripId);
          const { data: links } = await this.supabase
            .schema('transport')
            .from('trip_athletes')
            .select('trip_id, athlete_id')
            .in('trip_id', tripIds);
          const athletesByTrip = new Map<string, string[]>();
          (links ?? []).forEach((l: { trip_id: string; athlete_id: string }) => {
            const current = athletesByTrip.get(l.trip_id) ?? [];
            current.push(l.athlete_id);
            athletesByTrip.set(l.trip_id, current);
          });
          for (const a of assigned) {
            void this.pushService.send(
              { userKind: 'driver', userId: a.driverId },
              {
                title: 'Nuevo viaje asignado',
                body: a.tripLabel || 'Tienes un nuevo viaje pendiente',
                emoji: '🚕',
                kind: 'trip-assigned',
                data: { url: '/portal/conductor', tripId: a.tripId },
              },
            );
            for (const athleteId of athletesByTrip.get(a.tripId) ?? []) {
              void this.pushService.send(
                { userKind: 'athlete', userId: athleteId },
                {
                  title: 'Conductor asignado',
                  body: 'Tu traslado ya tiene conductor asignado',
                  emoji: '🚕',
                  kind: 'trip-status',
                  data: { url: '/portal/user', tripId: a.tripId },
                },
              );
            }
          }
        }
      }

      // 7) Auditoría
      await this.supabase.schema('transport').from('driver_assignment_runs').insert({
        event_id: dto.eventId ?? null,
        date_filter: dto.date ?? null,
        params: { ...dto },
        assigned_count: assigned.length,
        unassigned_count: unassigned.length,
        results: { assigned, unassigned },
        created_by: dto.createdBy ?? null,
      });

      return {
        assigned,
        unassigned,
        assignedCount: assigned.length,
        unassignedCount: unassigned.length,
        dryRun,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error en auto-asignación',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers de carga de datos
  // ─────────────────────────────────────────────────────────────────────────

  private async fetchPendingTrips(
    dto: AutoAssignDriversDto,
  ): Promise<TripCandidate[]> {
    let query = this.supabase
      .schema('transport')
      .from('trips')
      .select(
        'id, event_id, origin, destination, client_type, fleet_acronym, passenger_count, wheelchair_count, scheduled_at, return_at, presentation_at, travel_time_minutes, is_round_trip, parent_trip_id, leg_type, driver_id, trip_date',
      )
      .is('driver_id', null);

    if (dto.tripIds && dto.tripIds.length) {
      query = query.in('id', dto.tripIds);
    } else {
      if (dto.eventId) query = query.eq('event_id', dto.eventId);
      if (dto.date) query = query.eq('trip_date', dto.date);
      if (dto.clientType) query = query.eq('client_type', dto.clientType);
      if (dto.fleetAcronym) query = query.eq('fleet_acronym', dto.fleetAcronym);
    }

    const { data, error } = await query.order('scheduled_at', { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      eventId: (r.event_id as string) ?? '',
      origin: (r.origin as string) ?? null,
      destination: (r.destination as string) ?? null,
      clientType: (r.client_type as string) ?? null,
      fleetAcronym: (r.fleet_acronym as string) ?? null,
      passengerCount: Number(r.passenger_count ?? 0),
      wheelchairCount: Number(r.wheelchair_count ?? 0),
      scheduledAt: new Date(String(r.scheduled_at)),
      returnAt: r.return_at ? new Date(String(r.return_at)) : null,
      presentationAt: r.presentation_at
        ? new Date(String(r.presentation_at))
        : null,
      travelTimeMinutes: Number(r.travel_time_minutes ?? 30),
      isRoundTrip: Boolean(r.is_round_trip),
      parentTripId: (r.parent_trip_id as string) ?? null,
      legType: (r.leg_type as string) ?? null,
    }));
  }

  private async fetchDriverProfiles(
    eventId?: string,
    fleetAcronym?: string,
  ): Promise<DriverProfile[]> {
    let q = this.supabase
      .schema('transport')
      .from('drivers')
      .select(
        'id, full_name, allowed_client_types, vehicle_id, status',
      )
      .eq('status', 'ACTIVE');
    if (eventId) q = q.eq('event_id', eventId);

    const { data, error } = await q;
    if (error) throw new InternalServerErrorException(error.message);

    const driverRows = (data as Array<Record<string, unknown>>) ?? [];
    const vehicleIds = driverRows
      .map((d) => d.vehicle_id as string | null)
      .filter((v): v is string => !!v);

    let vehicles: Array<Record<string, unknown>> = [];
    if (vehicleIds.length) {
      const { data: vRows } = await this.supabase
        .schema('transport')
        .from('vehicles')
        .select('id, type, capacity, plate, metadata')
        .in('id', vehicleIds);
      vehicles = (vRows as Array<Record<string, unknown>>) ?? [];
    }
    const vehicleById = new Map(vehicles.map((v) => [v.id as string, v]));

    const profiles: DriverProfile[] = driverRows.map((d) => {
      const v = d.vehicle_id ? vehicleById.get(d.vehicle_id as string) : null;
      const vMeta =
        v && typeof v.metadata === 'object' && v.metadata
          ? (v.metadata as Record<string, unknown>)
          : {};
      return {
        id: d.id as string,
        fullName: (d.full_name as string) ?? '',
        allowedClientTypes: (d.allowed_client_types as string[]) ?? [],
        vehicleId: (d.vehicle_id as string) ?? null,
        vehicleType: v ? ((v.type as string) ?? null) : null,
        vehicleCapacity: v ? Number(v.capacity ?? 0) : 0,
        vehiclePlate: v ? ((v.plate as string) ?? null) : null,
        isWheelchairCapable:
          (v ? String(v.type ?? '').toUpperCase() === 'M5' : false) ||
          Boolean(vMeta.wheelchairCapable),
      };
    });

    // Los choferes operativos del día a día son los participantes de proveedor
    // marcados como conductores (la tabla transport.drivers es la Flota propia,
    // exclusiva VIP/T1). Sin este pool la auto-asignación no tenía candidatos.
    const { data: ppRows, error: ppError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, metadata')
      .eq('metadata->>isDriver', 'true');
    if (!ppError && Array.isArray(ppRows)) {
      const knownIds = new Set(profiles.map((p) => p.id));
      (ppRows as Array<Record<string, unknown>>).forEach((p) => {
        if (knownIds.has(p.id as string)) return;
        const meta =
          p.metadata && typeof p.metadata === 'object'
            ? (p.metadata as Record<string, unknown>)
            : {};
        const tipo = String(meta.vehicleTipo ?? '').trim().toUpperCase() || null;
        // Tipos de cliente declarados en Registro → Proveedores (default TA al
        // registrar). Lista vacía = sin restricción (choferes antiguos).
        const declaredTypes = Array.isArray(meta.allowedClientTypes)
          ? (meta.allowedClientTypes as unknown[]).map((v) => String(v).toUpperCase()).filter(Boolean)
          : [];
        profiles.push({
          id: p.id as string,
          fullName: (p.full_name as string) ?? '',
          allowedClientTypes: declaredTypes,
          vehicleId: null,
          vehicleType: tipo,
          // Capacidad declarada en la ficha del chofer; 0 = sin dato, y
          // entonces no se aplica el tope de PAX.
          vehicleCapacity: Number(meta.vehicleCapacity ?? 0) || 0,
          vehiclePlate: String(meta.vehiclePatente ?? '').trim() || null,
          isWheelchairCapable: tipo != null && /(M5|ADAPT)/.test(tipo),
        });
      });
    }

    if (fleetAcronym) {
      return profiles.filter(
        (p) => !p.vehicleType || this.fleetMatches(fleetAcronym, p.vehicleType),
      );
    }
    return profiles;
  }

  private async fetchExistingWindows(
    driverIds: string[],
  ): Promise<Map<string, TripWindow[]>> {
    if (driverIds.length === 0) return new Map();
    const { data, error } = await this.supabase
      .schema('transport')
      .from('trips')
      .select(
        'id, driver_id, scheduled_at, return_at, presentation_at, travel_time_minutes, status',
      )
      // Nota: el enum trip_status de la BD NO tiene 'ASSIGNED' — un viaje
      // asignado sigue en SCHEDULED con driver_id seteado.
      .in('driver_id', driverIds)
      .in('status', ['REQUESTED', 'SCHEDULED', 'EN_ROUTE', 'PICKED_UP']);

    if (error) throw new InternalServerErrorException(error.message);

    const map = new Map<string, TripWindow[]>();
    (data as Array<Record<string, unknown>>).forEach((r) => {
      const driverId = r.driver_id as string;
      const tt = Number(r.travel_time_minutes ?? 30);
      const start = new Date(
        String(r.presentation_at || r.scheduled_at),
      ).getTime();
      const end =
        new Date(String(r.return_at || r.scheduled_at)).getTime() +
        tt * 60000;
      const list = map.get(driverId) ?? [];
      list.push({
        id: r.id as string,
        driverId,
        start,
        end,
      });
      map.set(driverId, list);
    });
    return map;
  }
}
