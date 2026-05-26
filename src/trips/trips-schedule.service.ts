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

const VALID_CLIENT_TYPES = [
  'TF',
  'TM',
  'TA',
  'VIP',
  'T1',
  'FAMILIA_PARAPAN',
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

@Injectable()
export class TripsScheduleService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers de parsing
  // ─────────────────────────────────────────────────────────────────────────

  private parseDate(raw: string | undefined, defaultYear?: string): Date | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;

    // ISO yyyy-mm-dd or yyyy-mm-ddTHH:mm
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
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
        return new Date(year, month, day);
      }
    }

    return null;
  }

  private mergeDateTime(date: Date | null, hhmm: string | undefined): Date | null {
    if (!date) return null;
    const t = String(hhmm || '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const result = new Date(date);
    result.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return result;
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

  // ─────────────────────────────────────────────────────────────────────────
  // 1) Bulk import desde CSV / XLSX
  // ─────────────────────────────────────────────────────────────────────────

  async bulkFromSchedule(dto: BulkFromScheduleDto) {
    const created: Array<{ index: number; id: string }> = [];
    const skipped: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];

      try {
        const tripDate = this.parseDate(row.date, dto.defaultYear);
        if (!tripDate) {
          skipped.push({ index: i, reason: 'Fecha inválida o ausente' });
          continue;
        }

        const presentationAt = this.mergeDateTime(tripDate, row.presentationTime);
        const departureAt = this.mergeDateTime(tripDate, row.departureTime);
        const arrivalAt = this.mergeDateTime(tripDate, row.arrivalTime);
        const returnAt = this.mergeDateTime(tripDate, row.returnTime);
        const scheduledAt = arrivalAt || departureAt || presentationAt;

        if (!scheduledAt) {
          skipped.push({ index: i, reason: 'Sin hora de salida/llegada' });
          continue;
        }

        const clientType = this.normalizeClientType(row.clientType);
        const fleetAcronym = String(row.fleetAcronym || '').trim().toUpperCase() || null;
        const legType = this.isReturnLeg(row.legType) ? 'RETURN' : 'OUTBOUND';
        const isRoundTrip = !!returnAt && legType === 'OUTBOUND';

        const tripRow: Record<string, unknown> = {
          event_id: dto.eventId,
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

        const { data, error } = await this.supabase
          .schema('transport')
          .from('trips')
          .insert(tripRow)
          .select('id')
          .single();

        if (error || !data) {
          skipped.push({
            index: i,
            reason: error?.message || 'Error desconocido al insertar',
          });
          continue;
        }

        created.push({ index: i, id: (data as { id: string }).id });

        // Si es ida con retorno, crear el viaje de retorno asociado
        if (isRoundTrip && returnAt) {
          const returnArrival = new Date(
            returnAt.getTime() +
              this.parseDurationMinutes(row.travelTime) * 60000,
          );
          const returnRow: Record<string, unknown> = {
            ...tripRow,
            origin: row.destinationName || row.destinationAddress || null,
            destination: row.originName || row.originAddress || null,
            scheduled_at: returnAt.toISOString(),
            presentation_at: returnAt.toISOString(),
            return_at: null,
            is_round_trip: true,
            leg_type: 'RETURN',
            parent_trip_id: (data as { id: string }).id,
          };

          await this.supabase
            .schema('transport')
            .from('trips')
            .insert(returnRow);
        }
      } catch (err) {
        skipped.push({
          index: i,
          reason: err instanceof Error ? err.message : 'Error procesando fila',
        });
      }
    }

    return {
      created,
      skipped,
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
        return {
          assigned: [],
          unassigned: [],
          assignedCount: 0,
          unassignedCount: 0,
          message: 'No hay viajes pendientes que coincidan con el filtro',
        };
      }

      // 2) Cargar drivers + sus vehículos
      const drivers = await this.fetchDriverProfiles(dto.eventId, dto.fleetAcronym);
      if (drivers.length === 0) {
        return {
          assigned: [],
          unassigned: trips.map((t) => ({
            tripId: t.id,
            reason: 'No hay choferes disponibles para este filtro',
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
        driverId: string;
        driverName: string;
      }> = [];
      const unassigned: Array<{ tripId: string; reason: string }> = [];

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

        const candidates = drivers.filter((d) => {
          // a) Client type
          if (enforceClientTypeMatch && trip.clientType) {
            if (!d.allowedClientTypes.includes(trip.clientType)) return false;
          }
          // b) Fleet type
          if (enforceFleetTypeMatch && trip.fleetAcronym && d.vehicleType) {
            if (
              d.vehicleType.toUpperCase() !== trip.fleetAcronym.toUpperCase()
            ) {
              return false;
            }
          }
          // c) Capacity
          if (
            respectVehicleCapacity &&
            trip.passengerCount > 0 &&
            d.vehicleCapacity > 0 &&
            trip.passengerCount > d.vehicleCapacity
          ) {
            return false;
          }
          // d) Wheelchair
          if (
            respectWheelchair &&
            trip.wheelchairCount > 0 &&
            !d.isWheelchairCapable
          ) {
            return false;
          }
          // e) Cupo diario
          if (
            maxTripsPerDriver !== null &&
            (driverTripCount.get(d.id) ?? 0) >= maxTripsPerDriver
          ) {
            return false;
          }
          // f) No solapar agenda
          const windows = driverWindows.get(d.id) ?? [];
          const overlaps = windows.some(
            (w) => !(winEnd <= w.start || winStart >= w.end),
          );
          if (overlaps) return false;

          return true;
        });

        if (candidates.length === 0) {
          return { reason: 'Sin chofer compatible (revisar restricciones)' };
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
            driverId: result.driverId,
            driverName: result.driverName,
          });
          if (trip.isRoundTrip) {
            outboundAssignment.set(trip.id, result.driverId);
          }
        } else {
          unassigned.push({ tripId: trip.id, reason: result.reason });
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
            driverId: result.driverId,
            driverName: result.driverName,
          });
        } else {
          unassigned.push({ tripId: trip.id, reason: result.reason });
        }
      }

      // 6) Persistir si no es dryRun
      if (!dryRun) {
        for (const a of assigned) {
          await this.supabase
            .schema('transport')
            .from('trips')
            .update({ driver_id: a.driverId, status: 'ASSIGNED' })
            .eq('id', a.tripId);
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
        'id, event_id, client_type, fleet_acronym, passenger_count, wheelchair_count, scheduled_at, return_at, presentation_at, travel_time_minutes, is_round_trip, parent_trip_id, leg_type, driver_id, trip_date',
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

    if (fleetAcronym) {
      return profiles.filter(
        (p) =>
          !p.vehicleType ||
          p.vehicleType.toUpperCase() === fleetAcronym.toUpperCase(),
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
