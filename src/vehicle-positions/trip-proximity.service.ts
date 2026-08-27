import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { VehiclePosition } from './entities/vehicle-position.entity';

// Umbrales de proximidad al punto de recogida. Distancia en línea recta
// (ST_DistanceSphere): sin API de rutas en el backend es la señal disponible,
// y para avisar "está cerca / está llegando" es suficiente.
const NEARBY_METERS = 1500;
const ARRIVING_METERS = 400;
// Velocidad urbana de referencia cuando el fix no trae speed confiable.
const CITY_SPEED_MPS = 25 / 3.6;

type ProximityThreshold = 'NEARBY' | 'ARRIVING';

type TripProximityRow = {
  status: string;
  client_type: string | null;
  requester_athlete_id: string | null;
  dist_m: number | null;
};

/**
 * Avisos push de proximidad calculados server-side en cada fix GPS del
 * conductor. El portal ya avisa in-app cuando la pestaña está abierta; esto
 * cubre al pasajero con la app cerrada (Expo push + inbox de la campanita).
 */
@Injectable()
export class TripProximityService {
  private readonly logger = new Logger(TripProximityService.name);

  constructor(
    @InjectRepository(VehiclePosition)
    private readonly vehiclePositionRepository: Repository<VehiclePosition>,
    private readonly pushService: PushNotificationsService,
  ) {}

  async check(
    tripId: string,
    lat: number,
    lng: number,
    speed: number | null,
  ): Promise<void> {
    try {
      const rows = (await this.vehiclePositionRepository.query(
        `SELECT t.status,
                t.client_type,
                t.requester_athlete_id,
                CASE
                  WHEN t.passenger_lat IS NOT NULL AND t.passenger_lng IS NOT NULL
                  THEN ST_DistanceSphere(
                         ST_MakePoint($1, $2),
                         ST_MakePoint(t.passenger_lng, t.passenger_lat)
                       )
                END AS dist_m
           FROM transport.trips t
          WHERE t.id = $3`,
        [lng, lat, tripId],
      )) as TripProximityRow[];

      const trip = rows[0];
      // Solo aplica yendo a recoger; sin coordenadas del pasajero no hay
      // referencia contra la cual medir (el portal las envía durante EN_ROUTE).
      if (!trip || trip.status !== 'EN_ROUTE' || trip.dist_m == null) return;

      const distM = Number(trip.dist_m);
      const threshold: ProximityThreshold | null =
        distM <= ARRIVING_METERS
          ? 'ARRIVING'
          : distM <= NEARBY_METERS
            ? 'NEARBY'
            : null;
      if (!threshold) return;

      const claimed = await this.claimThreshold(tripId, threshold);
      if (!claimed) return;

      const recipients = await this.resolveRecipients(
        tripId,
        trip.requester_athlete_id,
      );
      if (recipients.length === 0) return;

      const mps = speed && speed > 1.5 ? speed : CITY_SPEED_MPS;
      const etaMin = Math.max(1, Math.round(distM / mps / 60));
      const msg =
        threshold === 'ARRIVING'
          ? {
              title: '¡Tu conductor está llegando!',
              body: 'Está a metros del punto de encuentro. Acércate para no hacerlo esperar.',
              emoji: '📍',
            }
          : {
              title: 'Tu conductor está cerca',
              body: `Llega en aproximadamente ${etaMin} min a recogerte.`,
              emoji: '🚖',
            };

      const url =
        (trip.client_type || '').trim().toUpperCase() === 'VIP'
          ? '/portal/vehicle-request'
          : '/portal/user';
      for (const athleteId of recipients) {
        void this.pushService.send(
          { userKind: 'athlete', userId: athleteId },
          {
            ...msg,
            kind: 'trip-proximity',
            data: { url, tripId, status: 'EN_ROUTE', proximity: threshold },
          },
        );
      }
    } catch (err) {
      // El aviso de proximidad nunca debe afectar la ingesta de posiciones.
      this.logger.warn(
        `proximity check failed for trip ${tripId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  /**
   * Marca el umbral en trip.metadata de forma atómica: solo un fix "gana" el
   * derecho a notificar aunque lleguen posiciones concurrentes cada pocos
   * segundos. ARRIVING también marca NEARBY para que un viaje que parte ya
   * cerca no reciba después el aviso menos urgente.
   */
  private async claimThreshold(
    tripId: string,
    threshold: ProximityThreshold,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const marks: Record<string, string> =
      threshold === 'ARRIVING'
        ? { ARRIVING: now, NEARBY: now }
        : { NEARBY: now };

    // CTE con SELECT final: el driver de postgres en TypeORM devuelve
    // [rows, rowCount] para un UPDATE pelado, pero filas planas para SELECT.
    const result = (await this.vehiclePositionRepository.query(
      `WITH claimed AS (
         UPDATE transport.trips
            SET metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{proximityPush}',
                  COALESCE(metadata->'proximityPush', '{}'::jsonb) || $2::jsonb,
                  true
                )
          WHERE id = $1
            AND metadata->'proximityPush'->>$3 IS NULL
          RETURNING id
       )
       SELECT id FROM claimed`,
      [tripId, JSON.stringify(marks), threshold],
    )) as Array<{ id: string }>;

    return result.length > 0;
  }

  private async resolveRecipients(
    tripId: string,
    requesterAthleteId: string | null,
  ): Promise<string[]> {
    const rows = (await this.vehiclePositionRepository.query(
      `SELECT athlete_id FROM transport.trip_athletes WHERE trip_id = $1`,
      [tripId],
    )) as Array<{ athlete_id: string }>;
    return Array.from(
      new Set(
        [requesterAthleteId, ...rows.map((r) => r.athlete_id)].filter(
          (v): v is string => Boolean(v),
        ),
      ),
    );
  }
}
