/**
 * Traslados que genera una ficha de AND (27-09-2026, pedido de Ariel para
 * World Rugby U20): al guardar un participante con su vuelo, el vuelo de
 * llegada aparece en el Monitor de Vuelos y se crean sus traslados, el de
 * llegada (Transfer In: aeropuerto → hotel) y el de salida (Transfer Out:
 * hotel → aeropuerto), asignados al conductor elegido en la ficha para que
 * lo vea en sus actividades.
 *
 * Aquí va la regla sin base de datos: qué tramos corresponden a una ficha.
 */

/** El mismo aeropuerto que usa Viajes al elegir Transfer In / Out. */
export const AEROPUERTO =
  'Aeropuerto Internacional Arturo Merino Benítez, Pudahuel, Santiago, Chile';

/**
 * El traslado de salida recoge en el hotel con esta anticipación al vuelo:
 * los vuelos de AND son en su mayoría internacionales (3 h de embarque).
 * Se puede corregir en Viajes; el traslado no se vuelve a mover mientras la
 * ficha no cambie su vuelo.
 */
export const ANTICIPACION_SALIDA_MIN = 180;

export type SentidoAnd = 'LLEGADA' | 'SALIDA';

export type FichaAnd = {
  id: string;
  trip_type?: string | null;
  flight_number?: string | null;
  airline?: string | null;
  arrival_time?: string | Date | null;
  departure_time?: string | Date | null;
  transport_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type TramoAnd = {
  sentido: SentidoAnd;
  /** TRANSFER_IN (llegada) o TRANSFER_OUT (salida). */
  tipoViaje: 'TRANSFER_IN' | 'TRANSFER_OUT';
  /** Clave del viaje en su metadata: una ficha tiene a lo más uno por sentido. */
  clave: string;
  vuelo: string;
  aerolinea: string | null;
  /** Hora del vuelo (aterrizaje o despegue), ISO. */
  horaVuelo: string;
  /** Hora del traslado: al aterrizar, o la anticipación antes del despegue. */
  horaViaje: string;
  conductorId: string | null;
};

const registro = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const texto = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d =
    v instanceof Date
      ? v
      : typeof v === 'string' || typeof v === 'number'
        ? new Date(v)
        : null;
  if (!d) return null;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** "la 1324" → "LA1324": así se agrupan los pasajeros de un mismo vuelo. */
export const normalizarVuelo = (vuelo: string) =>
  vuelo.replace(/\s+/g, '').toUpperCase();

export const claveTrasladoAnd = (fichaId: string, sentido: SentidoAnd) =>
  `and:${fichaId}:${sentido}`;

/**
 * Tramos de una ficha. Hace falta vuelo y hora: sin número de vuelo no hay
 * nada que monitorear ni a quién esperar. Quien llega en bus no genera
 * traslado al aeropuerto.
 *
 * La carga de AND guarda llegada y salida en metadata.arrival / departure;
 * el formulario además escribe la fila (flight_number, arrival_time,
 * departure_time). Las horas se leen primero de la fila (cualquier edición
 * las escribe ahí); el número de vuelo, primero de la metadata, porque la
 * fila tiene uno solo.
 */
export function tramosAnd(ficha: FichaAnd): TramoAnd[] {
  if (String(ficha.transport_type ?? '').toUpperCase() === 'BUS') return [];
  const meta = registro(ficha.metadata);
  const llegada = registro(meta.arrival);
  const salida = registro(meta.departure);
  const esSalida = String(ficha.trip_type ?? '').toUpperCase() === 'DEPARTURE';
  const tramos: TramoAnd[] = [];

  const vueloLlegada =
    texto(llegada.flightNumber) ??
    (!esSalida ? texto(ficha.flight_number) : null);
  const horaLlegada = iso(ficha.arrival_time) ?? iso(llegada.time);
  if (vueloLlegada && horaLlegada) {
    tramos.push({
      sentido: 'LLEGADA',
      tipoViaje: 'TRANSFER_IN',
      clave: claveTrasladoAnd(ficha.id, 'LLEGADA'),
      vuelo: normalizarVuelo(vueloLlegada),
      aerolinea: texto(llegada.airline) ?? texto(ficha.airline),
      horaVuelo: horaLlegada,
      horaViaje: horaLlegada,
      conductorId: texto(llegada.driverId),
    });
  }

  const vueloSalida =
    texto(salida.flightNumber) ??
    (esSalida ? texto(ficha.flight_number) : null);
  const horaSalida = iso(ficha.departure_time) ?? iso(salida.time);
  if (vueloSalida && horaSalida) {
    tramos.push({
      sentido: 'SALIDA',
      tipoViaje: 'TRANSFER_OUT',
      clave: claveTrasladoAnd(ficha.id, 'SALIDA'),
      vuelo: normalizarVuelo(vueloSalida),
      aerolinea:
        texto(salida.airline) ?? (esSalida ? texto(ficha.airline) : null),
      horaVuelo: horaSalida,
      horaViaje: new Date(
        new Date(horaSalida).getTime() - ANTICIPACION_SALIDA_MIN * 60_000,
      ).toISOString(),
      conductorId: texto(salida.driverId),
    });
  }
  return tramos;
}

/** Estados en los que el traslado todavía se puede reprogramar solo. */
export const ESTADOS_SIN_INICIAR = new Set(['REQUESTED', 'SCHEDULED']);

export type ViajeAnd = {
  status: string;
  scheduledAt: string | null;
  driverId: string | null;
  /** Conductor que puso AND en el viaje (metadata.andDriverId). */
  andDriverId?: string | null;
  origin: string | null;
  destination: string | null;
  flightNumber: string | null;
};

export type CambiosTraslado = Partial<{
  scheduledAt: string;
  /** null = quitar el conductor que había puesto AND. */
  driverId: string | null;
  origin: string;
  destination: string;
  flightNumber: string;
}>;

/**
 * Lo que hay que cambiarle a un traslado ya creado para que calce con su
 * ficha. Vacío si ya calza o si el viaje ya partió: lo que pasó en la calle
 * no lo reescribe una edición de la ficha.
 */
export function cambiosDeTraslado(
  actual: ViajeAnd,
  deseado: {
    scheduledAt: string;
    driverId: string | null;
    origin: string;
    destination: string;
    flightNumber: string;
  },
): CambiosTraslado {
  if (!ESTADOS_SIN_INICIAR.has(actual.status)) return {};
  const cambios: CambiosTraslado = {};
  if (iso(actual.scheduledAt) !== deseado.scheduledAt)
    cambios.scheduledAt = deseado.scheduledAt;
  // El conductor de la ficha se pone o se cambia. Si la ficha queda sin
  // conductor, se quita del viaje sólo si lo había puesto AND: el que asignó
  // despacho en Viajes no se toca.
  if (deseado.driverId && actual.driverId !== deseado.driverId)
    cambios.driverId = deseado.driverId;
  if (
    !deseado.driverId &&
    actual.driverId &&
    actual.andDriverId &&
    actual.driverId === actual.andDriverId
  )
    cambios.driverId = null;
  if ((actual.origin ?? '') !== deseado.origin) cambios.origin = deseado.origin;
  if ((actual.destination ?? '') !== deseado.destination)
    cambios.destination = deseado.destination;
  if (normalizarVuelo(actual.flightNumber ?? '') !== deseado.flightNumber)
    cambios.flightNumber = deseado.flightNumber;
  return cambios;
}
