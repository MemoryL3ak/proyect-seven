import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

// JWT HS256 mínimo (sin dependencias): suficiente para firmar tokens que
// Supabase Realtime valida contra el JWT secret del proyecto.
function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

export type MobileLoginResult =
  | {
      kind: 'athlete';
      athleteId: string;
      profile: {
        id: string;
        fullName: string;
        email: string | null;
      };
    }
  | {
      kind: 'driver';
      driverId: string;
      profile: {
        id: string;
        fullName: string;
        email: string | null;
      };
    };

export type MobileRecoverResult = {
  status: 'ok';
  message: string;
};

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly logger: Logger = new Logger(MobileAuthService.name),
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validación ESTRICTA de la sesión de portal — para autorizar acceso a
   * recursos (SA-BACKEND-02), no para mantener sesiones vivas. A diferencia
   * de validateSession(), un dato incompleto o no coincidente es rechazo.
   */
  async validateSessionStrict(
    kind: string,
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    if (!userId || !sessionId || !['athlete', 'driver'].includes(kind)) {
      return false;
    }
    const target = await this.sessionTable(kind, userId);
    if (!target) return false;
    try {
      const { data: row } = await this.supabase
        .schema(target.schema)
        .from(target.table)
        .select('metadata, status')
        .eq('id', userId)
        .maybeSingle();
      if (!row || row.status === 'DELETED') return false;
      const meta = (row.metadata as Record<string, unknown> | null) ?? {};
      return (
        typeof meta.portalSessionId === 'string' &&
        meta.portalSessionId.length > 0 &&
        meta.portalSessionId === sessionId
      );
    } catch {
      return false;
    }
  }

  /**
   * Token efímero para Supabase Realtime: los usuarios de portal no tienen
   * cuenta Supabase, así que el backend firma un JWT (HS256, secret del
   * proyecto) con rol `authenticated` y el claim `portal`, que las políticas
   * RLS usan para acotar la lectura a los viajes en que participa.
   */
  async mintRealtimeToken(input: {
    kind?: string;
    userId?: string;
    sessionId?: string;
  }): Promise<{ token: string; expiresIn: number }> {
    const kind = String(input.kind || '');
    const userId = String(input.userId || '').trim();
    const sessionId = String(input.sessionId || '').trim();

    const valid = await this.validateSessionStrict(kind, userId, sessionId);
    if (!valid) {
      throw new UnauthorizedException('Sesión de portal inválida');
    }

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      // Sin el secret el portal sigue funcionando por polling REST; sólo se
      // pierde el push de Realtime.
      throw new InternalServerErrorException(
        'SUPABASE_JWT_SECRET no configurada',
      );
    }

    const expiresIn = 3600;
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256Jwt(
      {
        aud: 'authenticated',
        role: 'authenticated',
        sub: userId,
        portal: kind,
        iat: now,
        exp: now + expiresIn,
      },
      secret,
    );
    return { token, expiresIn };
  }

  async login(input: { code: string }): Promise<MobileLoginResult> {
    const code = String(input.code || '').trim().toLowerCase();

    if (!code || code.length < 6) {
      throw new UnauthorizedException('Código inválido');
    }

    const athleteResult = await this.tryAthleteByCode(code);
    if (athleteResult) return athleteResult;

    const driverResult = await this.tryDriverByCode(code);
    if (driverResult) return driverResult;

    throw new UnauthorizedException('Código inválido');
  }

  // ── Sesión única por usuario ────────────────────────────────────────────────
  // Sólo puede haber UN dispositivo con sesión activa por usuario, y LA SESIÓN
  // EXISTENTE MANDA: un segundo dispositivo no expulsa a la primera, sino que
  // su login se rechaza con ACTIVE_ELSEWHERE. La sesión activa refresca su
  // "latido" (portalSessionAt) en cada validación; si deja de latir por más de
  // SESSION_STALE_MS (app cerrada sin logout), otro dispositivo puede reclamar.
  // El logout libera la sesión de inmediato.

  private static readonly SESSION_STALE_MS = 2 * 60 * 1000;

  private async sessionTable(kind: string, userId: string): Promise<{ schema: string; table: string } | null> {
    if (kind === 'athlete') return { schema: 'core', table: 'athletes' };
    if (kind === 'driver') {
      // El conductor puede vivir en transport.drivers o en provider_participants.
      const { data } = await this.supabase
        .schema('transport')
        .from('drivers')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (data) return { schema: 'transport', table: 'drivers' };
      return { schema: 'core', table: 'provider_participants' };
    }
    return null;
  }

  async claimSession(input: { kind?: string; userId?: string; currentSessionId?: string }) {
    const kind = String(input.kind || '');
    const userId = String(input.userId || '');
    const currentSessionId = String(input.currentSessionId || '');
    if (!userId || !['athlete', 'driver'].includes(kind)) {
      throw new BadRequestException('kind y userId son obligatorios');
    }
    const target = await this.sessionTable(kind, userId);
    if (!target) throw new BadRequestException('kind inválido');

    try {
      const { data: row } = await this.supabase
        .schema(target.schema)
        .from(target.table)
        .select('id, metadata, status')
        .eq('id', userId)
        .maybeSingle();
      if (!row) throw new UnauthorizedException('Usuario no encontrado');
      if (row.status === 'DELETED') {
        throw new UnauthorizedException('Cuenta eliminada');
      }
      const meta = ((row.metadata as Record<string, unknown>) ?? {});
      const existing = typeof meta.portalSessionId === 'string' ? meta.portalSessionId : '';
      const at = meta.portalSessionAt ? new Date(String(meta.portalSessionAt)).getTime() : 0;
      const alive =
        Number.isFinite(at) && at > 0 && Date.now() - at < MobileAuthService.SESSION_STALE_MS;

      // La sesión existente manda: si otro dispositivo tiene una sesión viva,
      // este login se rechaza (no se expulsa al primero).
      if (existing && alive && existing !== currentSessionId) {
        return { claimed: false, reason: 'ACTIVE_ELSEWHERE', sessionId: null };
      }

      // Mismo dispositivo (re-login) conserva su sessionId; si no, uno nuevo.
      const sessionId = existing && existing === currentSessionId ? existing : randomUUID();
      const metadata = {
        ...meta,
        portalSessionId: sessionId,
        portalSessionAt: new Date().toISOString(),
      };
      const { error } = await this.supabase
        .schema(target.schema)
        .from(target.table)
        .update({ metadata })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      return { claimed: true, sessionId };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // Si la metadata no se puede leer/escribir, no bloquear el login: se
      // degrada a comportamiento sin sesión única.
      this.logger.warn(
        `No se pudo registrar la sesión de ${kind} ${userId}: ${err instanceof Error ? err.message : err}`,
      );
      return { claimed: true, sessionId: null };
    }
  }

  async validateSession(input: { kind?: string; userId?: string; sessionId?: string }) {
    const kind = String(input.kind || '');
    const userId = String(input.userId || '');
    const sessionId = String(input.sessionId || '');
    if (!userId || !sessionId || !['athlete', 'driver'].includes(kind)) {
      return { valid: true }; // datos incompletos: no forzar logout
    }
    const target = await this.sessionTable(kind, userId);
    if (!target) return { valid: true };
    try {
      const { data: row } = await this.supabase
        .schema(target.schema)
        .from(target.table)
        .select('metadata, status')
        .eq('id', userId)
        .maybeSingle();
      // Cuenta eliminada: cualquier dispositivo que siga dentro debe salir.
      if (row?.status === 'DELETED') return { valid: false };
      const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
      const current = meta.portalSessionId;
      // Sin sesión registrada (usuarios antiguos) → válida; distinta → la
      // sesión de este dispositivo fue liberada/expiró y otro la reclamó.
      const valid = !current || current === sessionId;
      if (valid && current === sessionId) {
        // Latido: la sesión activa se mantiene viva mientras el portal valida.
        const { error } = await this.supabase
          .schema(target.schema)
          .from(target.table)
          .update({ metadata: { ...meta, portalSessionAt: new Date().toISOString() } })
          .eq('id', userId);
        if (error) {
          this.logger.warn(
            `No se pudo refrescar el latido de sesión de ${kind} ${userId}: ${error.message}`,
          );
        }
      }
      return { valid };
    } catch {
      return { valid: true }; // ante error de lectura, no expulsar al usuario
    }
  }

  /** Libera la sesión al cerrar sesión, para que otro dispositivo pueda entrar. */
  async releaseSession(input: { kind?: string; userId?: string; sessionId?: string }) {
    const kind = String(input.kind || '');
    const userId = String(input.userId || '');
    const sessionId = String(input.sessionId || '');
    if (!userId || !sessionId || !['athlete', 'driver'].includes(kind)) {
      return { ok: true };
    }
    const target = await this.sessionTable(kind, userId);
    if (!target) return { ok: true };
    try {
      const { data: row } = await this.supabase
        .schema(target.schema)
        .from(target.table)
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();
      const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
      // Sólo el dueño de la sesión puede liberarla.
      if (meta.portalSessionId !== sessionId) return { ok: true };
      const metadata = { ...meta };
      delete metadata.portalSessionId;
      delete metadata.portalSessionAt;
      await this.supabase
        .schema(target.schema)
        .from(target.table)
        .update({ metadata })
        .eq('id', userId);
      return { ok: true };
    } catch (err) {
      this.logger.warn(
        `No se pudo liberar la sesión de ${kind} ${userId}: ${err instanceof Error ? err.message : err}`,
      );
      return { ok: false };
    }
  }

  // ── Eliminación de cuenta (iniciada por el propio usuario) ──────────────────
  // Soft delete: la fila se conserva (historial de viajes, canjes, etc. siguen
  // consistentes) pero status pasa a DELETED, con lo que el login por código y
  // el reclamo de sesión la rechazan. El código de acceso (últimos 6 del id)
  // confirma que quien pide la baja conoce la credencial — el mismo nivel de
  // autenticación que usa el login de los portales.

  async deleteAccount(input: { kind?: string; userId?: string; code?: string }) {
    const kind = String(input.kind || '');
    const userId = String(input.userId || '').trim();
    const code = String(input.code || '').trim().toLowerCase();
    if (!userId || !['athlete', 'driver', 'staff'].includes(kind)) {
      throw new BadRequestException('kind y userId son obligatorios');
    }
    if (!code || userId.slice(-6).toLowerCase() !== code) {
      throw new UnauthorizedException('Código inválido');
    }

    const target =
      kind === 'staff'
        ? { schema: 'core', table: 'provider_participants' }
        : await this.sessionTable(kind, userId);
    if (!target) throw new BadRequestException('kind inválido');

    const { data: row, error: readError } = await this.supabase
      .schema(target.schema)
      .from(target.table)
      .select('id, metadata, status')
      .eq('id', userId)
      .maybeSingle();
    if (readError) {
      throw new InternalServerErrorException('No se pudo eliminar la cuenta');
    }
    if (!row) throw new UnauthorizedException('Usuario no encontrado');

    const meta = { ...(((row.metadata as Record<string, unknown>) ?? {})) };
    delete meta.portalSessionId;
    delete meta.portalSessionAt;
    const metadata = {
      ...meta,
      deletedAt: new Date().toISOString(),
      deletedBy: 'self',
      statusBeforeDeletion: row.status ?? null,
    };

    const { error: updateError } = await this.supabase
      .schema(target.schema)
      .from(target.table)
      .update({ status: 'DELETED', metadata })
      .eq('id', userId);
    if (updateError) {
      this.logger.error(
        `No se pudo eliminar la cuenta de ${kind} ${userId}: ${updateError.message}`,
      );
      throw new InternalServerErrorException('No se pudo eliminar la cuenta');
    }

    // Best-effort: sin la cuenta ya no deben llegar push a sus dispositivos.
    const { error: tokenError } = await this.supabase
      .schema('core')
      .from('device_tokens')
      .delete()
      .eq('user_id', userId);
    if (tokenError) {
      this.logger.warn(
        `Cuenta ${kind} ${userId} eliminada, pero no se pudieron borrar sus device tokens: ${tokenError.message}`,
      );
    }

    // Los datos de ubicación se eliminan de inmediato con la baja (no esperan
    // el ciclo de purga): es lo que declara la política de privacidad y el
    // formulario de Data safety de Google Play.
    await this.purgeLocationData(kind, userId);

    this.logger.log(`Cuenta ${kind} ${userId} eliminada a pedido del usuario`);
    return { ok: true };
  }

  /**
   * Borra el rastro de ubicación del usuario al eliminar su cuenta.
   * Best-effort: cualquier fallo se loguea pero no revierte la baja (la
   * purga programada de cuentas lo reintenta al cierre del período de gracia).
   */
  private async purgeLocationData(kind: string, userId: string): Promise<void> {
    // Conductores (en transport.drivers o provider_participants): su historial
    // GPS completo. El staff puede tener rol de conductor, así que también.
    if (kind === 'driver' || kind === 'staff') {
      const { error } = await this.supabase
        .schema('telemetry')
        .from('vehicle_positions')
        .delete()
        .eq('driver_id', userId);
      if (error) {
        this.logger.warn(
          `No se pudo borrar el GPS de conductor ${userId}: ${error.message}`,
        );
      }
    }

    if (kind === 'athlete') {
      // Tracking VIP permanente del portal.
      const { error: userPosError } = await this.supabase
        .schema('telemetry')
        .from('user_positions')
        .delete()
        .eq('athlete_id', userId);
      if (userPosError) {
        this.logger.warn(
          `No se pudo borrar el GPS de usuario ${userId}: ${userPosError.message}`,
        );
      }

      // Última posición del pasajero guardada en sus viajes
      // (transport.trips.passenger_lat/lng): también es dato de ubicación.
      const { error: reqTripsError } = await this.supabase
        .schema('transport')
        .from('trips')
        .update({ passenger_lat: null, passenger_lng: null })
        .eq('requester_athlete_id', userId);
      if (reqTripsError) {
        this.logger.warn(
          `No se pudo limpiar la posición de pasajero (viajes solicitados) de ${userId}: ${reqTripsError.message}`,
        );
      }

      const { data: links, error: linksError } = await this.supabase
        .schema('transport')
        .from('trip_athletes')
        .select('trip_id')
        .eq('athlete_id', userId);
      if (linksError) {
        this.logger.warn(
          `No se pudieron listar los viajes de ${userId} para limpiar su posición: ${linksError.message}`,
        );
        return;
      }
      const tripIds = Array.from(
        new Set((links ?? []).map((l) => l.trip_id as string).filter(Boolean)),
      );
      if (tripIds.length > 0) {
        const { error: memberTripsError } = await this.supabase
          .schema('transport')
          .from('trips')
          .update({ passenger_lat: null, passenger_lng: null })
          .in('id', tripIds);
        if (memberTripsError) {
          this.logger.warn(
            `No se pudo limpiar la posición de pasajero (viajes como miembro) de ${userId}: ${memberTripsError.message}`,
          );
        }
      }
    }
  }

  async recover(input: { email: string }): Promise<MobileRecoverResult> {
    const email = String(input.email || '').trim().toLowerCase();

    const genericMessage =
      'Si tu correo está registrado, te enviaremos tu código de acceso en breve.';

    const athlete = await this.findAthleteByEmail(email);
    if (athlete) {
      const code = String(athlete.id).slice(-6).toLowerCase();
      this.logger.log(
        `Recover requested by athlete ${athlete.id} (${email}) — code ${code}`,
      );
      return { status: 'ok', message: genericMessage };
    }

    const driver = await this.findDriverByEmail(email);
    if (driver) {
      const code = String(driver.id).slice(-6).toLowerCase();
      this.logger.log(
        `Recover requested by driver ${driver.id} (${email}) — code ${code}`,
      );
      return { status: 'ok', message: genericMessage };
    }

    this.logger.log(`Recover request from unknown email ${email}`);
    return { status: 'ok', message: genericMessage };
  }

  private async findAthleteByEmail(
    email: string,
  ): Promise<{ id: string; full_name: string; email: string | null } | null> {
    if (!email) return null;
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email')
      .neq('status', 'DELETED')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error('Athlete email lookup error', JSON.stringify(error));
      return null;
    }
    return data ?? null;
  }

  private async findDriverByEmail(
    email: string,
  ): Promise<{ id: string; full_name: string; email: string | null } | null> {
    if (!email) return null;
    const { data: driver, error: driverError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email')
      .neq('status', 'DELETED')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (driverError) {
      this.logger.error('Driver email lookup error', JSON.stringify(driverError));
    }
    if (driver) return driver;

    const { data: participant, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, metadata')
      .neq('status', 'DELETED')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    if (participantError) {
      this.logger.error(
        'Participant email lookup error',
        JSON.stringify(participantError),
      );
      return null;
    }
    if (!participant) return null;

    const meta = (participant.metadata ?? {}) as Record<string, unknown>;
    if (meta.isDriver === true || meta.isDriver === 'true') {
      return {
        id: participant.id,
        full_name: participant.full_name,
        email: participant.email ?? null,
      };
    }
    return null;
  }

  private async tryAthleteByCode(
    code: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'athlete' }> | null> {
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email')
      .neq('status', 'DELETED');

    if (error) {
      this.logger.error('Athlete lookup error', JSON.stringify(error));
      return null;
    }

    const matches = (data ?? []).filter(
      (row) => String(row.id).slice(-6).toLowerCase() === code,
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
      this.logger.warn(
        `Code collision in athletes for ${code} (${matches.length} matches)`,
      );
      return null;
    }

    const match = matches[0];
    return {
      kind: 'athlete',
      athleteId: match.id,
      profile: {
        id: match.id,
        fullName: match.full_name,
        email: match.email ?? null,
      },
    };
  }

  private async tryDriverByCode(
    code: string,
  ): Promise<Extract<MobileLoginResult, { kind: 'driver' }> | null> {
    // 1. transport.drivers
    const { data: driverData, error: driverError } = await this.supabase
      .schema('transport')
      .from('drivers')
      .select('id, full_name, email')
      .neq('status', 'DELETED');

    if (driverError) {
      this.logger.error('Driver lookup error', JSON.stringify(driverError));
    }

    const driverMatches = (driverData ?? []).filter(
      (row) => String(row.id).slice(-6).toLowerCase() === code,
    );

    if (driverMatches.length > 1) {
      this.logger.warn(
        `Code collision in drivers for ${code} (${driverMatches.length} matches)`,
      );
      return null;
    }

    if (driverMatches.length === 1) {
      const match = driverMatches[0];
      return {
        kind: 'driver',
        driverId: match.id,
        profile: {
          id: match.id,
          fullName: match.full_name,
          email: match.email ?? null,
        },
      };
    }

    // 2. core.provider_participants flagged as driver
    const { data: participantData, error: participantError } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .select('id, full_name, email, metadata')
      .neq('status', 'DELETED');

    if (participantError) {
      this.logger.error(
        'Participant lookup error',
        JSON.stringify(participantError),
      );
      return null;
    }

    const participantMatches = (participantData ?? []).filter((row) => {
      if (String(row.id).slice(-6).toLowerCase() !== code) return false;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      return meta.isDriver === true || meta.isDriver === 'true';
    });

    if (participantMatches.length === 0) return null;
    if (participantMatches.length > 1) {
      this.logger.warn(
        `Code collision in provider_participants for ${code} (${participantMatches.length} matches)`,
      );
      return null;
    }

    const match = participantMatches[0];
    return {
      kind: 'driver',
      driverId: match.id,
      profile: {
        id: match.id,
        fullName: match.full_name,
        email: match.email ?? null,
      },
    };
  }
}
