import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { UpdateTripDto } from '../trips/dto/update-trip.dto';
import {
  AEROPUERTO,
  arregloTransferInOut,
  cambiosDeTraslado,
  claveGrupoAnd,
  claveTrasladoAnd,
  clavesDelViaje,
  ESTADOS_SIN_INICIAR,
  fichaDeClave,
  fichasDelViaje,
  FichaAnd,
  grupoDelViaje,
  mismasFichas,
  SentidoAnd,
  sentidoDeClave,
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

export type FilaViaje = {
  id: string;
  event_id: string;
  status: string;
  scheduled_at: string | null;
  driver_id: string | null;
  origin: string | null;
  destination: string | null;
  requested_vehicle_type: string | null;
  delegation_id: string | null;
  destination_hotel_id: string | null;
  origin_hotel_id: string | null;
  passenger_count: number | null;
  trip_type: string | null;
  parent_trip_id: string | null;
  leg_type: string | null;
  is_round_trip: boolean | null;
  return_at: string | null;
  metadata: Record<string, unknown> | null;
};

const COLUMNAS_VIAJE = `id, event_id, status, scheduled_at, driver_id, origin, destination,
       requested_vehicle_type, delegation_id, destination_hotel_id, origin_hotel_id,
       passenger_count, trip_type, parent_trip_id, leg_type, is_round_trip, return_at,
       metadata`;

/** El viaje que lleva a esta ficha: por `andKeys` o, en los de antes, por `andKey`. */
const CONTIENE_FICHA = `(t.metadata->>'andKey' = $1 or t.metadata->'andKeys' ? $1)`;

const textoMeta = (meta: Record<string, unknown> | null | undefined, clave: string): string | null => {
  const v = meta?.[clave];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

/**
 * Al guardar una ficha de AND con su vuelo: el vuelo de llegada queda en el
 * Monitor de Vuelos y se crean (o se ajustan) sus traslados Transfer In y
 * Transfer Out con el conductor de la ficha. Los viajes se crean con
 * TripsService, así el conductor recibe el aviso de "Nuevo viaje asignado"
 * y el viaje aparece en sus actividades como cualquier otro.
 *
 * Desde el 16-10-2026 las fichas que comparten delegación, vuelo, hotel y
 * conductor van en UN viaje con todos como pasajeros (ver traslados-and.ts,
 * "Un traslado por grupo"). La primera ficha crea el viaje; las siguientes
 * se suman. Si una ficha cambia de vuelo, hotel o conductor, se cambia de
 * viaje: deja el suyo (que se borra si queda vacío y no ha partido) y se
 * suma al que le corresponde o crea uno nuevo. Un viaje que ya partió no se
 * toca: lo que pasó en la calle es historial.
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
   * Al borrar una ficha: sale de sus traslados de AND que no han partido (si
   * viajaba sola, el viaje se borra; si no, quedaba asignado al conductor
   * con un pasajero de más) y el vuelo de llegada se borra si ya nadie lo
   * usa. Los traslados iniciados o terminados quedan como historial. Se
   * llama antes y después de borrar la ficha.
   */
  async antesDeBorrarFicha(fichaId: string): Promise<string | null> {
    try {
      const tocados: string[] = [];
      for (const sentido of ['LLEGADA', 'SALIDA'] as SentidoAnd[]) {
        const clave = claveTrasladoAnd(fichaId, sentido);
        const viaje = await this.viajeConFicha(clave);
        if (!viaje || !ESTADOS_SIN_INICIAR.has(viaje.status)) continue;
        await this.quitarDelViaje(viaje, clave);
        tocados.push(viaje.id);
      }
      for (const id of tocados) await this.emparejarViaje(id);
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

    // Viajes que la ficha deja al cambiar de grupo: hay que volver a mirar
    // si su llegada y su salida siguen siendo un Transfer In Out.
    const dejados = new Set<string>();
    for (const tramo of tramosAnd(ficha)) {
      if (tramo.sentido === 'LLEGADA') await this.vueloDeLlegada(ficha, tramo);
      await this.traslado(ficha, tramo, dejados);
    }
    await this.emparejarFicha(ficha.id);
    for (const id of dejados) await this.emparejarViaje(id);
  }

  /* ─── Lecturas ─── */

  private async viajeConFicha(clave: string): Promise<FilaViaje | null> {
    const filas = await this.dataSource.query<FilaViaje[]>(
      `select ${COLUMNAS_VIAJE}
         from transport.trips t
        where ${CONTIENE_FICHA}
          and status <> 'CANCELLED'
        order by created_at
        limit 1`,
      [clave],
    );
    return filas[0] ?? null;
  }

  /** El viaje abierto del grupo (el más antiguo si hubiera más de uno). */
  private async viajeDelGrupo(grupo: string, excepto?: string): Promise<FilaViaje | null> {
    const filas = await this.dataSource.query<FilaViaje[]>(
      `select ${COLUMNAS_VIAJE}
         from transport.trips t
        where t.metadata->>'andGrupo' = $1
          and status in ('REQUESTED', 'SCHEDULED')
          and ($2::uuid is null or id <> $2::uuid)
        order by created_at
        limit 1`,
      [grupo, excepto ?? null],
    );
    return filas[0] ?? null;
  }

  private async viajePorId(id: string): Promise<FilaViaje | null> {
    const filas = await this.dataSource.query<FilaViaje[]>(
      `select ${COLUMNAS_VIAJE} from transport.trips t where id = $1`,
      [id],
    );
    return filas[0] ?? null;
  }

  /* ─── Vuelo ─── */

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

  /* ─── Traslado de un tramo ─── */

  private async traslado(ficha: FilaFicha, tramo: TramoAnd, dejados: Set<string>) {
    const grupo = claveGrupoAnd({
      sentido: tramo.sentido,
      vuelo: tramo.vuelo,
      horaVuelo: tramo.horaVuelo,
      delegationId: ficha.delegation_id ?? null,
      hotelId: ficha.hotel_accommodation_id ?? null,
      conductorId: tramo.conductorId,
    });

    const actual = await this.viajeConFicha(tramo.clave);
    if (actual) {
      if (grupoDelViaje(actual) === grupo) {
        await this.ajustarViaje(actual, ficha, tramo, grupo);
        return;
      }
      // Ya partió: lo que pasó en la calle no lo reescribe una edición de la ficha.
      if (!ESTADOS_SIN_INICIAR.has(actual.status)) return;
      const destino = await this.viajeDelGrupo(grupo, actual.id);
      // Viaja sola y no hay otro viaje de su nuevo grupo: el viaje se mueve
      // con ella (conserva su bitácora y lo que despacho le haya puesto).
      if (!destino && clavesDelViaje(actual.metadata).length <= 1) {
        await this.ajustarViaje(actual, ficha, tramo, grupo);
        return;
      }
      await this.quitarDelViaje(actual, tramo.clave);
      dejados.add(actual.id);
      if (destino) {
        await this.sumarAlViaje(destino, tramo);
        return;
      }
      await this.crearViaje(ficha, tramo, grupo);
      return;
    }

    const destino = await this.viajeDelGrupo(grupo);
    if (destino) {
      await this.sumarAlViaje(destino, tramo);
      return;
    }
    await this.crearViaje(ficha, tramo, grupo);
  }

  private lugares(ficha: FilaFicha, tramo: TramoAnd) {
    const hotel = ficha.hotel_name?.trim() || 'Hotel por confirmar';
    const llegada = tramo.sentido === 'LLEGADA';
    return {
      llegada,
      origen: llegada ? AEROPUERTO : hotel,
      destino: llegada ? hotel : AEROPUERTO,
      hotelId: ficha.hotel_accommodation_id ?? undefined,
    };
  }

  private async crearViaje(ficha: FilaFicha, tramo: TramoAnd, grupo: string) {
    const { llegada, origen, destino, hotelId } = this.lugares(ficha, tramo);
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
      athleteIds: [ficha.id],
      delegationId: ficha.delegation_id ?? null,
      driverId: tramo.conductorId ?? undefined,
      clientType: ficha.user_type ?? undefined,
      passengerCount: 1,
      flightNumber: tramo.vuelo,
      ...(tramo.flota ? { requestedVehicleType: tramo.flota } : {}),
      metadata: {
        andKey: tramo.clave,
        andKeys: [tramo.clave],
        andGrupo: grupo,
        andDriverId: tramo.conductorId,
        ...(tramo.patente ? { andPatente: tramo.patente } : {}),
        source: 'AND',
        flightTime: tramo.horaVuelo,
        airline: tramo.aerolinea,
      },
    };
    await this.trips.create(nuevo as CreateTripDto);
  }

  /**
   * La ficha ya viaja en este viaje y sigue en su grupo: se ajusta lo que
   * cambió en la ficha (hora, conductor, hotel, vuelo, flota, patente) y se
   * dejan escritas las claves del grupo si el viaje es de antes.
   */
  private async ajustarViaje(actual: FilaViaje, ficha: FilaFicha, tramo: TramoAnd, grupo: string) {
    const { llegada, origen, destino, hotelId } = this.lugares(ficha, tramo);
    const meta = actual.metadata ?? {};
    const cambios = cambiosDeTraslado(
      {
        status: actual.status,
        scheduledAt: actual.scheduled_at,
        driverId: actual.driver_id,
        andDriverId: textoMeta(meta, 'andDriverId'),
        origin: actual.origin,
        destination: actual.destination,
        flightNumber: textoMeta(meta, 'flightNumber'),
        requestedVehicleType: actual.requested_vehicle_type,
        andPatente: textoMeta(meta, 'andPatente'),
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
    // driverId puede venir en null (quitar el conductor que puso AND).
    const { andPatente, ...delViaje } = cambios;
    const ajuste: Record<string, unknown> = { ...delViaje };
    if (cambios.origin !== undefined || cambios.destination !== undefined) {
      if (llegada) ajuste.destinationHotelId = hotelId;
      else ajuste.originHotelId = hotelId ?? null;
    }
    if (
      ESTADOS_SIN_INICIAR.has(actual.status) &&
      (actual.delegation_id ?? null) !== (ficha.delegation_id ?? null)
    ) {
      ajuste.delegationId = ficha.delegation_id ?? null;
    }
    const metadata: Record<string, unknown> = {};
    if (cambios.scheduledAt) metadata.flightTime = tramo.horaVuelo;
    // Se anota qué conductor puso AND, para poder quitarlo después.
    if (cambios.driverId !== undefined) metadata.andDriverId = cambios.driverId;
    if (andPatente) metadata.andPatente = andPatente;
    if (Object.keys(metadata).length) ajuste.metadata = metadata;
    if (Object.keys(ajuste).length > 0) {
      await this.trips.update(actual.id, ajuste as UpdateTripDto, null);
    }
    // Claves del grupo: a los viajes de antes se les escriben una vez; a uno
    // que se movió con su única ficha, el grupo nuevo.
    const claves = clavesDelViaje(meta);
    if (textoMeta(meta, 'andGrupo') !== grupo || !Array.isArray(meta.andKeys)) {
      await this.escribirMiembros(actual, claves.length ? claves : [tramo.clave], grupo, null);
    }
  }

  /** Una ficha más en el viaje del grupo. */
  private async sumarAlViaje(destino: FilaViaje, tramo: TramoAnd) {
    const antes = clavesDelViaje(destino.metadata);
    const claves = Array.from(new Set([...antes, tramo.clave]));
    const extra: Record<string, unknown> = {};
    // La patente de la plantilla, si el viaje no traía ninguna.
    if (tramo.patente && !textoMeta(destino.metadata, 'andPatente')) {
      extra.andPatente = tramo.patente;
    }
    await this.escribirMiembros(
      destino,
      claves,
      textoMeta(destino.metadata, 'andGrupo'),
      `${antes.length} → ${claves.length}`,
      extra,
    );
  }

  /** La ficha sale del viaje; si era la única y no ha partido, el viaje se borra. */
  private async quitarDelViaje(viaje: FilaViaje, clave: string) {
    const antes = clavesDelViaje(viaje.metadata);
    const claves = antes.filter((c) => c !== clave);
    if (claves.length === 0) {
      // Los pasajeros (trip_athletes) se van en cascada; un regreso colgado
      // queda suelto y lo ordena emparejarViaje.
      await this.dataSource.query(`delete from transport.trips where id = $1`, [viaje.id]);
      return;
    }
    await this.escribirMiembros(
      viaje,
      claves,
      textoMeta(viaje.metadata, 'andGrupo'),
      `${antes.length} → ${claves.length}`,
    );
  }

  /**
   * Escribe quiénes viajan: pasajeros (trip_athletes), cuántos son, el
   * solicitante (la primera ficha) y las claves en la metadata. Va directo a
   * la tabla y no por TripsService.update: ése copia los pasajeros al tramo
   * de regreso, y el regreso de un grupo no siempre es el mismo grupo.
   */
  private async escribirMiembros(
    viaje: FilaViaje,
    claves: string[],
    grupo: string | null,
    detallePasajeros: string | null,
    extra: Record<string, unknown> = {},
  ) {
    const fichas = claves.map(fichaDeClave).filter((id): id is string => Boolean(id));
    const metadata: Record<string, unknown> = {
      ...extra,
      andKeys: claves,
      andKey: claves[0],
      ...(grupo ? { andGrupo: grupo } : {}),
    };
    const log = detallePasajeros
      ? [
          {
            action: 'PASSENGER_COUNT_CHANGED',
            by: 'AND',
            at: new Date().toISOString(),
            detail: detallePasajeros,
          },
        ]
      : [];
    await this.dataSource.query(
      `update transport.trips
          set passenger_count = $2,
              requester_athlete_id = $3,
              metadata = (coalesce(metadata, '{}'::jsonb) || $4::jsonb)
                         || jsonb_build_object('log', coalesce(metadata->'log', '[]'::jsonb) || $5::jsonb),
              updated_at = now()
        where id = $1`,
      [viaje.id, fichas.length, fichas[0] ?? null, JSON.stringify(metadata), JSON.stringify(log)],
    );
    await this.dataSource.query(`delete from transport.trip_athletes where trip_id = $1`, [viaje.id]);
    if (fichas.length > 0) {
      await this.dataSource.query(
        `insert into transport.trip_athletes (trip_id, athlete_id)
         select $1, unnest($2::uuid[])
         on conflict do nothing`,
        [viaje.id, fichas],
      );
    }
  }

  /* ─── Transfer In Out ─── */

  /**
   * Un solo Transfer In Out (28-09-2026, pedido de Ariel): la salida queda
   * como tramo de regreso de la llegada. En Viajes se ve como un viaje con su
   * "Tramo de regreso"; la app del conductor muestra cada tramo como una
   * actividad. Con grupos, sólo cuando llegan y salen exactamente las mismas
   * fichas: si el grupo se parte a la vuelta, la llegada es un Transfer In y
   * cada salida un Transfer Out. Los cambios de forma van directo a la
   * tabla: pasar por TripsService.update crearía otro regreso.
   */
  private async emparejarFicha(fichaId: string) {
    const llegada = await this.viajeConFicha(claveTrasladoAnd(fichaId, 'LLEGADA'));
    const salida = await this.viajeConFicha(claveTrasladoAnd(fichaId, 'SALIDA'));
    if (llegada) await this.emparejarLlegada(llegada);
    if (salida) await this.emparejarSalida(salida);
  }

  private async emparejarViaje(id: string) {
    const viaje = await this.viajePorId(id);
    if (!viaje) return;
    const [clave] = clavesDelViaje(viaje.metadata);
    const sentido = clave ? sentidoDeClave(clave) : null;
    if (sentido === 'LLEGADA') await this.emparejarLlegada(viaje);
    else if (sentido === 'SALIDA') await this.emparejarSalida(viaje);
  }

  /** El viaje del otro sentido que lleva exactamente a las mismas fichas. */
  private async contraparte(viaje: FilaViaje, sentido: SentidoAnd): Promise<FilaViaje | null> {
    const fichas = fichasDelViaje(viaje.metadata);
    if (fichas.length === 0) return null;
    const candidatas = await this.dataSource.query<FilaViaje[]>(
      `select ${COLUMNAS_VIAJE}
         from transport.trips t
        where ${CONTIENE_FICHA}
          and status <> 'CANCELLED'
          and id <> $2
        order by created_at`,
      [claveTrasladoAnd(fichas[0], sentido), viaje.id],
    );
    return candidatas.find((c) => mismasFichas(fichasDelViaje(c.metadata), fichas)) ?? null;
  }

  private async emparejarLlegada(llegada: FilaViaje) {
    const deseada = await this.contraparte(llegada, 'SALIDA');
    // Sólo los regresos que puso AND: uno que despacho agregó a mano se respeta.
    const hijos = await this.dataSource.query<FilaViaje[]>(
      `select ${COLUMNAS_VIAJE}
         from transport.trips t
        where parent_trip_id = $1
          and metadata->>'source' = 'AND'
          and status <> 'CANCELLED'`,
      [llegada.id],
    );
    const arreglos = [
      ...arregloTransferInOut(guardado(llegada), deseada ? guardado(deseada) : null),
      ...hijos
        .filter((h) => h.id !== deseada?.id)
        .flatMap((h) => arregloTransferInOut(null, guardado(h))),
    ];
    await this.aplicarArreglos(arreglos);
  }

  private async emparejarSalida(salida: FilaViaje) {
    const llegada = await this.contraparte(salida, 'LLEGADA');
    if (llegada) {
      await this.emparejarLlegada(llegada);
      return;
    }
    await this.aplicarArreglos(arregloTransferInOut(null, guardado(salida)));
  }

  private async aplicarArreglos(arreglos: ReturnType<typeof arregloTransferInOut>) {
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
}

const guardado = (f: FilaViaje): TramoGuardado => ({
  id: f.id,
  tripType: f.trip_type,
  parentTripId: f.parent_trip_id,
  legType: f.leg_type,
  isRoundTrip: f.is_round_trip,
  returnAt: f.return_at,
  scheduledAt: f.scheduled_at,
});
