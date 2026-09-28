import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { UpdateTripDto } from '../trips/dto/update-trip.dto';
import {
  AEROPUERTO,
  cambiosDeTraslado,
  FichaAnd,
  TramoAnd,
  tramosAnd,
} from './traslados-and';

type FilaFicha = FichaAnd & {
  event_id: string;
  delegation_id: string | null;
  user_type: string | null;
  origin: string | null;
  hotel_accommodation_id: string | null;
  arrival_flight_id: string | null;
  hotel_name: string | null;
};

type FilaViaje = {
  id: string;
  status: string;
  scheduled_at: string | null;
  driver_id: string | null;
  origin: string | null;
  destination: string | null;
  flight_number: string | null;
};

/**
 * Al guardar una ficha de AND con su vuelo: el vuelo de llegada queda en el
 * Monitor de Vuelos y se crean (o se ajustan) sus traslados Transfer In y
 * Transfer Out con el conductor de la ficha. Los viajes se crean con
 * TripsService, así el conductor recibe el aviso de "Nuevo viaje asignado"
 * y el viaje aparece en sus actividades como cualquier otro.
 */
@Injectable()
export class TrasladosAndService {
  private readonly logger = new Logger(TrasladosAndService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly trips: TripsService,
  ) {}

  /** Nunca hace fallar el guardado de la ficha: si algo falla, queda en el log. */
  async sincronizarSinFallar(fichaId: string): Promise<void> {
    try {
      await this.sincronizar(fichaId);
    } catch (err) {
      this.logger.warn(
        `No se pudieron generar los traslados de AND de la ficha ${fichaId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async sincronizar(fichaId: string): Promise<void> {
    const filas = await this.dataSource.query<FilaFicha[]>(
      `select a.id, a.event_id, a.delegation_id, a.user_type, a.trip_type,
              a.flight_number, a.airline, a.origin, a.arrival_time,
              a.departure_time, a.transport_type, a.hotel_accommodation_id,
              a.arrival_flight_id, a.metadata, h.name as hotel_name
         from core.athletes a
         left join logistics.accommodations h on h.id = a.hotel_accommodation_id
        where a.id = $1`,
      [fichaId],
    );
    const ficha = filas[0];
    if (!ficha) return;

    for (const tramo of tramosAnd(ficha)) {
      if (tramo.sentido === 'LLEGADA') await this.vueloDeLlegada(ficha, tramo);
      await this.traslado(ficha, tramo);
    }
  }

  /**
   * El Monitor de Vuelos lista los vuelos de transport.flights y les cuelga
   * los pasajeros por número de vuelo. Los pasajeros de un mismo vuelo
   * comparten la fila.
   */
  private async vueloDeLlegada(ficha: FilaFicha, tramo: TramoAnd) {
    const existentes = await this.dataSource.query<Array<{ id: string }>>(
      `select id from transport.flights
        where event_id = $1
          and upper(replace(flight_number, ' ', '')) = $2
          and arrival_time = $3
        limit 1`,
      [ficha.event_id, tramo.vuelo, tramo.horaVuelo],
    );
    let vueloId = existentes[0]?.id;
    if (!vueloId) {
      const nuevos = await this.dataSource.query<Array<{ id: string }>>(
        `insert into transport.flights (event_id, flight_number, airline, arrival_time, origin)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [
          ficha.event_id,
          tramo.vuelo,
          tramo.aerolinea ?? '',
          tramo.horaVuelo,
          ficha.origin ?? '',
        ],
      );
      vueloId = nuevos[0].id;
    }
    if (ficha.arrival_flight_id === vueloId) return;

    await this.dataSource.query(
      `update core.athletes set arrival_flight_id = $2 where id = $1`,
      [ficha.id, vueloId],
    );
    // Cambió el vuelo o su hora: el anterior se borra si ya nadie lo usa, para
    // que el monitor no muestre un vuelo vacío.
    if (ficha.arrival_flight_id) {
      await this.dataSource.query(
        `delete from transport.flights f
          where f.id = $1
            and not exists (select 1 from core.athletes a where a.arrival_flight_id = f.id)`,
        [ficha.arrival_flight_id],
      );
    }
  }

  private async traslado(ficha: FilaFicha, tramo: TramoAnd) {
    const hotel = ficha.hotel_name?.trim() || 'Hotel por confirmar';
    const llegada = tramo.sentido === 'LLEGADA';
    const origen = llegada ? AEROPUERTO : hotel;
    const destino = llegada ? hotel : AEROPUERTO;
    const hotelId = ficha.hotel_accommodation_id ?? undefined;

    const actuales = await this.dataSource.query<FilaViaje[]>(
      `select id, status, scheduled_at, driver_id, origin, destination,
              metadata->>'flightNumber' as flight_number
         from transport.trips
        where metadata->>'andKey' = $1
        order by created_at
        limit 1`,
      [tramo.clave],
    );
    const actual = actuales[0];

    if (!actual) {
      const nuevo: Partial<CreateTripDto> = {
        eventId: ficha.event_id,
        tripType: tramo.tipoViaje,
        scheduledAt: tramo.horaViaje,
        origin: origen,
        destination: destino,
        ...(llegada
          ? { destinationHotelId: hotelId }
          : { originHotelId: hotelId ?? null }),
        requesterAthleteId: ficha.id,
        delegationId: ficha.delegation_id ?? null,
        driverId: tramo.conductorId ?? undefined,
        clientType: ficha.user_type ?? undefined,
        passengerCount: 1,
        flightNumber: tramo.vuelo,
        metadata: {
          andKey: tramo.clave,
          source: 'AND',
          flightTime: tramo.horaVuelo,
          airline: tramo.aerolinea,
        },
      };
      await this.trips.create(nuevo as CreateTripDto);
      return;
    }

    const cambios = cambiosDeTraslado(
      {
        status: actual.status,
        scheduledAt: actual.scheduled_at,
        driverId: actual.driver_id,
        origin: actual.origin,
        destination: actual.destination,
        flightNumber: actual.flight_number,
      },
      {
        scheduledAt: tramo.horaViaje,
        driverId: tramo.conductorId,
        origin: origen,
        destination: destino,
        flightNumber: tramo.vuelo,
      },
    );
    if (Object.keys(cambios).length === 0) return;
    const ajuste: Partial<UpdateTripDto> = { ...cambios };
    if (cambios.origin !== undefined || cambios.destination !== undefined) {
      if (llegada) ajuste.destinationHotelId = hotelId;
      else ajuste.originHotelId = hotelId ?? null;
    }
    if (cambios.scheduledAt) ajuste.metadata = { flightTime: tramo.horaVuelo };
    await this.trips.update(actual.id, ajuste as UpdateTripDto, null);
  }
}
