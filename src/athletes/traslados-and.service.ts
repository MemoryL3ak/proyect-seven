import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { UpdateTripDto } from '../trips/dto/update-trip.dto';
import {
  AEROPUERTO,
  arregloTransferInOut,
  cambiosDeTraslado,
  claveTrasladoAnd,
  FichaAnd,
  TramoAnd,
  TramoGuardado,
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
  and_driver_id: string | null;
  origin: string | null;
  destination: string | null;
  flight_number: string | null;
  requested_vehicle_type: string | null;
  and_patente: string | null;
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

  /**
   * Al borrar una ficha: sus traslados de AND que no han partido se borran
   * (si no, quedaban asignados al conductor sin pasajero) y el vuelo de
   * llegada se borra si ya nadie lo usa. Los traslados iniciados o terminados
   * quedan como historial. Se llama antes y después de borrar la ficha.
   */
  async antesDeBorrarFicha(fichaId: string): Promise<string | null> {
    try {
      await this.dataSource.query(
        `delete from transport.trips
          where metadata->>'andKey' in ($1, $2)
            and status in ('REQUESTED', 'SCHEDULED')`,
        [
          claveTrasladoAnd(fichaId, 'LLEGADA'),
          claveTrasladoAnd(fichaId, 'SALIDA'),
        ],
      );
      const filas = await this.dataSource.query<
        Array<{ arrival_flight_id: string | null }>
      >(`select arrival_flight_id from core.athletes where id = $1`, [fichaId]);
      return filas[0]?.arrival_flight_id ?? null;
    } catch (err) {
      this.logger.warn(
        `No se pudieron borrar los traslados de la ficha ${fichaId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  async despuesDeBorrarFicha(vueloId: string | null): Promise<void> {
    if (!vueloId) return;
    try {
      await this.dataSource.query(
        `delete from transport.flights f
          where f.id = $1
            and not exists (select 1 from core.athletes a where a.arrival_flight_id = f.id)`,
        [vueloId],
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo borrar el vuelo ${vueloId}: ${
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
    await this.unirTramos(ficha.id);
  }

  /**
   * Un solo Transfer In Out por persona (28-09-2026, pedido de Ariel): la
   * salida queda como tramo de regreso de la llegada. En Viajes se ve como un
   * viaje con su "Tramo de regreso"; la app del conductor muestra cada tramo
   * como una actividad. Los cambios de forma van directo a la tabla: pasar
   * por TripsService.update crearía otro regreso.
   */
  private async unirTramos(fichaId: string): Promise<void> {
    const filas = await this.dataSource.query<
      Array<{
        id: string;
        clave: string;
        trip_type: string | null;
        parent_trip_id: string | null;
        leg_type: string | null;
        is_round_trip: boolean | null;
        return_at: string | null;
        scheduled_at: string | null;
      }>
    >(
      `select id, metadata->>'andKey' as clave, trip_type, parent_trip_id,
              leg_type, is_round_trip, return_at, scheduled_at
         from transport.trips
        where metadata->>'andKey' in ($1, $2)
          and status <> 'CANCELLED'
        order by created_at`,
      [claveTrasladoAnd(fichaId, 'LLEGADA'), claveTrasladoAnd(fichaId, 'SALIDA')],
    );
    const tramo = (clave: string): TramoGuardado | null => {
      const f = filas.find((x) => x.clave === clave);
      return f
        ? {
            id: f.id,
            tripType: f.trip_type,
            parentTripId: f.parent_trip_id,
            legType: f.leg_type,
            isRoundTrip: f.is_round_trip,
            returnAt: f.return_at,
            scheduledAt: f.scheduled_at,
          }
        : null;
    };
    const arreglos = arregloTransferInOut(
      tramo(claveTrasladoAnd(fichaId, 'LLEGADA')),
      tramo(claveTrasladoAnd(fichaId, 'SALIDA')),
    );
    for (const a of arreglos) {
      await this.dataSource.query(
        `update transport.trips
            set trip_type = $2, parent_trip_id = $3, leg_type = $4,
                is_round_trip = $5, return_at = $6, updated_at = now()
          where id = $1`,
        [a.id, a.tripType, a.parentTripId, a.legType, a.isRoundTrip, a.returnAt],
      );
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
              metadata->>'flightNumber' as flight_number,
              metadata->>'andDriverId' as and_driver_id,
              requested_vehicle_type,
              metadata->>'andPatente' as and_patente
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
        ...(tramo.flota ? { requestedVehicleType: tramo.flota } : {}),
        metadata: {
          andKey: tramo.clave,
          andDriverId: tramo.conductorId,
          ...(tramo.patente ? { andPatente: tramo.patente } : {}),
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
        andDriverId: actual.and_driver_id,
        origin: actual.origin,
        destination: actual.destination,
        flightNumber: actual.flight_number,
        requestedVehicleType: actual.requested_vehicle_type,
        andPatente: actual.and_patente,
      },
      {
        scheduledAt: tramo.horaViaje,
        driverId: tramo.conductorId,
        origin: origen,
        destination: destino,
        flightNumber: tramo.vuelo,
        flota: tramo.flota,
        patente: tramo.patente,
      },
    );
    if (Object.keys(cambios).length === 0) return;
    // driverId puede venir en null (quitar el conductor que puso AND).
    const { andPatente, ...delViaje } = cambios;
    const ajuste: Record<string, unknown> = { ...delViaje };
    if (cambios.origin !== undefined || cambios.destination !== undefined) {
      if (llegada) ajuste.destinationHotelId = hotelId;
      else ajuste.originHotelId = hotelId ?? null;
    }
    const metadata: Record<string, unknown> = {};
    if (cambios.scheduledAt) metadata.flightTime = tramo.horaVuelo;
    // Se anota qué conductor puso AND, para poder quitarlo después.
    if (cambios.driverId !== undefined) metadata.andDriverId = cambios.driverId;
    if (andPatente) metadata.andPatente = andPatente;
    if (Object.keys(metadata).length) ajuste.metadata = metadata;
    await this.trips.update(actual.id, ajuste as UpdateTripDto, null);
  }
}
