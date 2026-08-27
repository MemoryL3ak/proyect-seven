import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Período de gracia tras la baja: mientras dura, la reactivación desde el
// portal de administración sigue funcionando. Al vencer, este job anonimiza
// los datos personales de forma definitiva e irreversible.
const GRACE_DAYS = 30;

export type PurgeSummary = {
  cutoff: string;
  athletes: number;
  drivers: number;
  participants: number;
  errors: number;
};

type DeletedRow = { id: string; metadata: Record<string, unknown> | null };

/**
 * Borrado definitivo de cuentas dadas de baja (Google Play / RGPD / Ley
 * 21.719): pasados los GRACE_DAYS desde metadata.deletedAt, se anonimizan los
 * campos identificatorios y se eliminan archivos de Storage, notificaciones,
 * tokens y telemetría del usuario.
 *
 * Anonimiza en vez de borrar la fila: viajes, asignaciones de hotel y cupones
 * la referencian, y el historial operacional debe seguir consistente. La fila
 * queda marcada con metadata.purgedAt, que además bloquea la reactivación.
 */
@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  // 08:00 UTC = 04:00/05:00 América/Santiago — después de la purga de
  // telemetría de pg_cron y fuera del horario del evento.
  @Cron('0 8 * * *')
  async runScheduled(): Promise<void> {
    try {
      const summary = await this.run();
      if (summary.athletes || summary.drivers || summary.participants || summary.errors) {
        this.logger.log(`Purga de cuentas: ${JSON.stringify(summary)}`);
      }
    } catch (err) {
      this.logger.error(
        `Purga de cuentas falló: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async run(): Promise<PurgeSummary> {
    const cutoff = new Date(
      Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const summary: PurgeSummary = {
      cutoff,
      athletes: 0,
      drivers: 0,
      participants: 0,
      errors: 0,
    };

    for (const row of await this.findExpired('core', 'athletes', cutoff)) {
      try {
        await this.purgeAthlete(row);
        summary.athletes += 1;
      } catch (err) {
        summary.errors += 1;
        this.logger.error(
          `No se pudo purgar athlete ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    for (const row of await this.findExpired('transport', 'drivers', cutoff)) {
      try {
        await this.purgeDriver(row);
        summary.drivers += 1;
      } catch (err) {
        summary.errors += 1;
        this.logger.error(
          `No se pudo purgar driver ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    for (const row of await this.findExpired('core', 'provider_participants', cutoff)) {
      try {
        await this.purgeParticipant(row);
        summary.participants += 1;
      } catch (err) {
        summary.errors += 1;
        this.logger.error(
          `No se pudo purgar participant ${row.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return summary;
  }

  /**
   * Cuentas DELETED cuyo período de gracia venció y que aún no fueron
   * purgadas. deletedAt se guarda siempre como ISO-8601 UTC, así que la
   * comparación de texto equivale a la temporal.
   */
  private async findExpired(
    schema: string,
    table: string,
    cutoff: string,
  ): Promise<DeletedRow[]> {
    const { data, error } = await this.supabase
      .schema(schema)
      .from(table)
      .select('id, metadata')
      .eq('status', 'DELETED')
      .lt('metadata->>deletedAt', cutoff)
      .is('metadata->>purgedAt', null);
    if (error) {
      this.logger.error(
        `No se pudieron listar cuentas vencidas de ${schema}.${table}: ${error.message}`,
      );
      return [];
    }
    return (data ?? []) as DeletedRow[];
  }

  /** Metadata mínima que sobrevive a la purga: el rastro de auditoría de la baja. */
  private purgedMetadata(meta: Record<string, unknown> | null) {
    const source = meta ?? {};
    return {
      deletedAt: source.deletedAt ?? null,
      deletedBy: source.deletedBy ?? null,
      purgedAt: new Date().toISOString(),
    };
  }

  private async purgeAthlete(row: DeletedRow): Promise<void> {
    const id = row.id;
    await this.removeStoragePrefix('athlete-health-docs', id);
    await this.removeStoragePrefix('athlete-photos', `photos/${id}`);
    await this.deleteRows('core', 'notifications', 'user_id', id);
    await this.deleteRows('core', 'device_tokens', 'user_id', id);
    await this.deleteRows('telemetry', 'user_positions', 'athlete_id', id);

    // Por si la baja fue anterior al borrado inmediato de ubicación.
    const { error: tripsError } = await this.supabase
      .schema('transport')
      .from('trips')
      .update({ passenger_lat: null, passenger_lng: null })
      .eq('requester_athlete_id', id);
    if (tripsError) {
      this.logger.warn(
        `Posición de pasajero de ${id} no se pudo limpiar: ${tripsError.message}`,
      );
    }

    const { error } = await this.supabase
      .schema('core')
      .from('athletes')
      .update({
        full_name: 'Usuario eliminado',
        email: null,
        phone: null,
        passport_number: null,
        date_of_birth: null,
        dietary_needs: null,
        metadata: this.purgedMetadata(row.metadata),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    this.logger.log(`Athlete ${id} purgado definitivamente`);
  }

  private async purgeDriver(row: DeletedRow): Promise<void> {
    const id = row.id;
    await this.removeStoragePrefix('driver-photos', id);
    await this.removeStoragePrefix('driver-photos', `journey/${id}`);
    await this.removeStoragePrefix('driver-documents', id);
    await this.deleteRows('core', 'notifications', 'user_id', id);
    await this.deleteRows('core', 'device_tokens', 'user_id', id);
    await this.deleteRows('telemetry', 'vehicle_positions', 'driver_id', id);

    // rut es NOT NULL en transport.drivers: se sobrescribe en vez de anular.
    const { error } = await this.supabase
      .schema('transport')
      .from('drivers')
      .update({
        full_name: 'Conductor eliminado',
        rut: 'ELIMINADO',
        email: null,
        phone: null,
        license_number: null,
        photo_url: null,
        metadata: this.purgedMetadata(row.metadata),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    this.logger.log(`Driver ${id} purgado definitivamente`);
  }

  private async purgeParticipant(row: DeletedRow): Promise<void> {
    const id = row.id;
    // Sus documentos comparten bucket con los de conductores, bajo `${id}/`.
    await this.removeStoragePrefix('driver-documents', id);
    await this.deleteRows('core', 'notifications', 'user_id', id);
    await this.deleteRows('core', 'device_tokens', 'user_id', id);
    // Un participante puede haber conducido (metadata.isDriver).
    await this.deleteRows('telemetry', 'vehicle_positions', 'driver_id', id);

    const { error } = await this.supabase
      .schema('core')
      .from('provider_participants')
      .update({
        full_name: 'Usuario eliminado',
        rut: null,
        email: null,
        phone: null,
        passport_number: null,
        date_of_birth: null,
        observations: null,
        metadata: this.purgedMetadata(row.metadata),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    this.logger.log(`Participant ${id} purgado definitivamente`);
  }

  private async deleteRows(
    schema: string,
    table: string,
    column: string,
    value: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema(schema)
      .from(table)
      .delete()
      .eq(column, value);
    if (error) {
      // No aborta la purga de la cuenta: lo que quede se reintenta al día
      // siguiente sólo si la anonimización final también falló (purgedAt).
      this.logger.warn(
        `No se pudo borrar ${schema}.${table} de ${value}: ${error.message}`,
      );
    }
  }

  /**
   * Borra todos los archivos bajo un prefijo del bucket. Los uploads del
   * sistema guardan los archivos directamente bajo `${prefijo}/`, sin
   * subcarpetas, así que un list plano por página alcanza.
   */
  private async removeStoragePrefix(
    bucket: string,
    prefix: string,
  ): Promise<void> {
    const admin = this.getAdminClient();
    if (!admin) {
      this.logger.warn(
        `SUPABASE_SERVICE_ROLE_KEY no configurada: no se pueden borrar archivos de ${bucket}/${prefix}`,
      );
      return;
    }
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 100 });
      if (error) {
        this.logger.warn(
          `No se pudo listar ${bucket}/${prefix}: ${error.message}`,
        );
        return;
      }
      // Las "carpetas" virtuales vienen sin id; sólo se borran archivos.
      const files = (data ?? []).filter((entry) => entry.id);
      if (files.length === 0) return;
      const paths = files.map((file) => `${prefix}/${file.name}`);
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(paths);
      if (removeError) {
        this.logger.warn(
          `No se pudieron borrar ${paths.length} archivos de ${bucket}/${prefix}: ${removeError.message}`,
        );
        return;
      }
      if (files.length < 100) return;
    }
  }
}
