import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { Repository } from 'typeorm';
import { MobileAuthService } from '../mobile-auth/mobile-auth.service';
import { CreateVehiclePositionDto } from './dto/create-vehicle-position.dto';
import { VehiclePosition } from './entities/vehicle-position.entity';

/**
 * Quién está llamando al módulo de posiciones (SA-BACKEND-02):
 * - staff: sesión Supabase válida (panel de administración).
 * - portal: atleta o conductor con sesión de portal activa (headers
 *   x-portal-kind / x-portal-user / x-portal-session).
 */
export type VpCaller =
  | { type: 'staff' }
  | { type: 'portal'; kind: 'athlete' | 'driver'; userId: string };

export type VpRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  vpCaller?: VpCaller | null;
};

const headerValue = (
  headers: VpRequest['headers'],
  name: string,
): string => {
  const raw = headers[name];
  return String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim();
};

@Injectable()
export class VehiclePositionsAccessService {
  private readonly logger = new Logger(VehiclePositionsAccessService.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    @InjectRepository(VehiclePosition)
    private readonly vehiclePositionRepository: Repository<VehiclePosition>,
    private readonly mobileAuth: MobileAuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Modo transicional de la ingesta GPS: el shell nativo aún no adjunta la
   * sesión del conductor a sus POST. Con 'log' (default) los POST sin
   * credenciales se aceptan y se registran en el log; al pasar el env
   * VEHICLE_POSITIONS_INGEST_AUTH=enforce quedan denegados (cierre definitivo
   * del punto 4.3.2 una vez desplegada la app actualizada).
   */
  ingestEnforced(): boolean {
    return (
      (this.config.get<string>('VEHICLE_POSITIONS_INGEST_AUTH') || 'log')
        .trim()
        .toLowerCase() === 'enforce'
    );
  }

  async identify(req: VpRequest): Promise<VpCaller | null> {
    // 1. JWT de Supabase emitido por /auth/login. OJO: no todo usuario de
    //    Supabase Auth es staff — a los conductores con email se les crea una
    //    cuenta por invitación (drivers.user_id). Esas cuentas se mapean a su
    //    identidad de conductor para que la autorización por participación
    //    aplique igual; solo el resto cuenta como personal del panel.
    const authHeader = headerValue(req.headers, 'authorization');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (!error && data?.user) {
            const rows = (await this.vehiclePositionRepository.query(
              `SELECT id FROM transport.drivers WHERE user_id = $1 LIMIT 1`,
              [data.user.id],
            )) as Array<{ id: string }>;
            if (rows.length > 0) {
              return { type: 'portal', kind: 'driver', userId: rows[0].id };
            }
            return { type: 'staff' };
          }
        } catch {
          // token ilegible: se sigue con la vía de portal
        }
      }
    }

    // 2. Usuario de portal: sesión única activa (la misma que mantiene
    //    PortalSessionGuard en el cliente).
    const kind = headerValue(req.headers, 'x-portal-kind');
    const userId = headerValue(req.headers, 'x-portal-user');
    const sessionId = headerValue(req.headers, 'x-portal-session');
    if ((kind === 'athlete' || kind === 'driver') && userId && sessionId) {
      const valid = await this.mobileAuth.validateSessionStrict(
        kind,
        userId,
        sessionId,
      );
      if (valid) return { type: 'portal', kind, userId };
    }

    return null;
  }

  requireStaff(caller: VpCaller | null | undefined): void {
    if (caller?.type !== 'staff') {
      throw new ForbiddenException('Requiere sesión del panel de administración');
    }
  }

  /**
   * Identidades equivalentes de un conductor: los viajes y las posiciones
   * referencian indistintamente drivers.id o drivers.user_id (el portal
   * conductor matchea por ambas), así que la autorización debe tratarlas
   * como la misma persona. Para provider_participants la identidad es única.
   */
  private async driverIdentitySet(userId: string): Promise<string[]> {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `SELECT id, user_id FROM transport.drivers WHERE id = $1 OR user_id = $1`,
        [userId],
      )) as Array<{ id: string; user_id: string | null }>;
      if (rows.length > 0) {
        return Array.from(
          new Set(
            rows
              .flatMap((row) => [row.id, row.user_id])
              .filter((value): value is string => Boolean(value)),
          ),
        );
      }
    } catch {
      // ante error de lectura se autoriza solo por la identidad presentada
    }
    return [userId];
  }

  /** Lectura por conductor: el propio conductor, staff, o un pasajero con viaje activo con él. */
  async assertCanReadDriver(
    caller: VpCaller | null | undefined,
    driverId: string,
  ): Promise<void> {
    if (caller?.type === 'staff') return;
    if (caller?.type !== 'portal') {
      throw new ForbiddenException('Acceso no autorizado');
    }
    if (caller.kind === 'driver') {
      const ids = await this.driverIdentitySet(caller.userId);
      if (ids.includes(driverId)) return;
      throw new ForbiddenException('Sólo puedes consultar tu propia posición');
    }
    const rows = (await this.vehiclePositionRepository.query(
      `SELECT 1
         FROM transport.trips t
        WHERE t.driver_id = $1
          AND t.status IN ('EN_ROUTE','PICKED_UP')
          AND (t.requester_athlete_id = $2
               OR EXISTS (SELECT 1 FROM transport.trip_athletes ta
                           WHERE ta.trip_id = t.id AND ta.athlete_id = $2))
        LIMIT 1`,
      [driverId, caller.userId],
    )) as unknown[];
    if (rows.length === 0) {
      throw new ForbiddenException('Sin viaje activo con este conductor');
    }
  }

  /** Lectura por vehículo: staff o participante de un viaje activo con ese vehículo. */
  async assertCanReadVehicle(
    caller: VpCaller | null | undefined,
    vehicleId: string,
  ): Promise<void> {
    if (caller?.type === 'staff') return;
    if (caller?.type !== 'portal') {
      throw new ForbiddenException('Acceso no autorizado');
    }
    const isDriver = caller.kind === 'driver';
    const condition = isDriver
      ? `t.driver_id = ANY($2)`
      : `(t.requester_athlete_id = $2
          OR EXISTS (SELECT 1 FROM transport.trip_athletes ta
                      WHERE ta.trip_id = t.id AND ta.athlete_id = $2))`;
    const param: string | string[] = isDriver
      ? await this.driverIdentitySet(caller.userId)
      : caller.userId;
    const rows = (await this.vehiclePositionRepository.query(
      `SELECT 1
         FROM transport.trips t
        WHERE t.vehicle_id = $1
          AND t.status IN ('EN_ROUTE','PICKED_UP')
          AND ${condition}
        LIMIT 1`,
      [vehicleId, param],
    )) as unknown[];
    if (rows.length === 0) {
      throw new ForbiddenException('Sin viaje activo con este vehículo');
    }
  }

  /** Lectura por viaje: staff o participante del viaje (conductor, solicitante o pasajero). */
  async assertCanReadTrip(
    caller: VpCaller | null | undefined,
    tripId: string,
  ): Promise<void> {
    if (caller?.type === 'staff') return;
    if (caller?.type !== 'portal') {
      throw new ForbiddenException('Acceso no autorizado');
    }
    const isDriver = caller.kind === 'driver';
    const condition = isDriver
      ? `t.driver_id = ANY($2)`
      : `(t.requester_athlete_id = $2
          OR EXISTS (SELECT 1 FROM transport.trip_athletes ta
                      WHERE ta.trip_id = t.id AND ta.athlete_id = $2))`;
    const param: string | string[] = isDriver
      ? await this.driverIdentitySet(caller.userId)
      : caller.userId;
    const rows = (await this.vehiclePositionRepository.query(
      `SELECT 1
         FROM transport.trips t
        WHERE t.id = $1
          AND ${condition}
        LIMIT 1`,
      [tripId, param],
    )) as unknown[];
    if (rows.length === 0) {
      throw new ForbiddenException('No participas en este viaje');
    }
  }

  /** Ingesta GPS: sólo el conductor autenticado puede reportar su propia posición. */
  async assertCanIngest(
    caller: VpCaller | null | undefined,
    dto: CreateVehiclePositionDto,
  ): Promise<void> {
    if (caller?.type === 'staff') return;
    if (caller?.type === 'portal' && caller.kind === 'driver') {
      const ids = await this.driverIdentitySet(caller.userId);
      if (dto.driverId && ids.includes(dto.driverId)) return;
      throw new ForbiddenException(
        'Sólo puedes reportar tu propia posición',
      );
    }
    if (!caller && !this.ingestEnforced()) {
      // Modo transicional: shell nativo sin credenciales todavía.
      this.logger.warn(
        `POST /vehicle-positions sin credenciales (driver ${dto.driverId ?? '?'}) — modo log`,
      );
      return;
    }
    throw new ForbiddenException('Sólo el conductor puede reportar posiciones');
  }
}
