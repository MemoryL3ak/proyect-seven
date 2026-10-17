/**
 * Botón Realizado / Pendiente de los monitores de vuelos y salidas
 * (28-09-2026, pedido de Ariel). Cambia el estado del viaje, el mismo que ve
 * el conductor en su app: marcarlo acá lo cierra allá, y lo que el conductor
 * finaliza aparece acá como realizado en el siguiente refresco.
 */
import { claveDiaEvento } from '@/lib/hora-evento';
import { esLlegada } from '@/lib/tramos-traslado';

export type TrasladoMarcable = {
  id: string;
  tripType?: string | null;
  legType?: string | null;
  parentTripId?: string | null;
  status?: string | null;
  driverId?: string | null;
  requesterAthleteId?: string | null;
  scheduledAt?: string | null;
  flightNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

const REALIZADO = new Set(['COMPLETED', 'DROPPED_OFF']);
const EN_CURSO = new Set(['EN_ROUTE', 'PICKED_UP']);

const estadoDe = (viaje: Pick<TrasladoMarcable, 'status'>) =>
  String(viaje.status ?? '').toUpperCase();

export const trasladoRealizado = (viaje: Pick<TrasladoMarcable, 'status'>) =>
  REALIZADO.has(estadoDe(viaje));

/**
 * Estado al tocar el botón: un traslado sin terminar pasa a Completado; uno
 * terminado vuelve a Programado (o a Solicitado si no tiene conductor), y el
 * servidor borra entonces su inicio y su cierre.
 */
export function estadoAlMarcar(
  viaje: Pick<TrasladoMarcable, 'status' | 'driverId'>,
): 'COMPLETED' | 'SCHEDULED' | 'REQUESTED' {
  if (!trasladoRealizado(viaje)) return 'COMPLETED';
  return viaje.driverId ? 'SCHEDULED' : 'REQUESTED';
}

export type EstadoTraslados =
  | 'SIN_TRASLADO'
  | 'PENDIENTE'
  | 'EN_CURSO'
  | 'PARCIAL'
  | 'REALIZADO';

export type ResumenTraslados = {
  total: number;
  realizados: number;
  enCurso: number;
  estado: EstadoTraslados;
};

export function resumenTraslados(
  viajes: Array<Pick<TrasladoMarcable, 'status'>>,
): ResumenTraslados {
  const activos = viajes.filter((v) => estadoDe(v) !== 'CANCELLED');
  const total = activos.length;
  const realizados = activos.filter(trasladoRealizado).length;
  const enCurso = activos.filter((v) => EN_CURSO.has(estadoDe(v))).length;
  const estado: EstadoTraslados =
    total === 0
      ? 'SIN_TRASLADO'
      : realizados === total
        ? 'REALIZADO'
        : enCurso > 0
          ? 'EN_CURSO'
          : realizados > 0
            ? 'PARCIAL'
            : 'PENDIENTE';
  return { total, realizados, enCurso, estado };
}

/** "LA 1324", "la-1324" y "LA1324" son el mismo vuelo. */
export const normalizarVuelo = (vuelo?: string | null) =>
  String(vuelo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export type PasajeroDeVuelo = {
  id: string;
  eventId?: string | null;
  arrivalFlightId?: string | null;
  arrivalTime?: string | null;
  flightNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Pasajeros de una fila del Monitoreo de Llegadas (17-10-2026). Un mismo
 * número de vuelo se repite en días distintos (LA715: Brasil el 30-09 y
 * México el 15-10) y cada fila juntaba a los pasajeros de todos esos días,
 * con sus traslados y conductores: el LA715 de México mostraba al conductor
 * que llevó a Brasil. Manda el enlace de la ficha al vuelo
 * (arrival_flight_id); sin enlace, el número de vuelo y el día de llegada.
 */
export function pasajerosDelVuelo<T extends PasajeroDeVuelo>(
  vuelo: {
    id: string;
    eventId?: string | null;
    flightNumber?: string | null;
    arrivalTime?: string | null;
  },
  pasajeros: T[],
): T[] {
  const numero = normalizarVuelo(vuelo.flightNumber);
  const dia = vuelo.arrivalTime ? claveDiaEvento(vuelo.arrivalTime) : '';
  return pasajeros.filter((p) => {
    // Un mismo número de vuelo existe en otro evento.
    if (p.eventId && vuelo.eventId && p.eventId !== vuelo.eventId) return false;
    if (p.arrivalFlightId) return p.arrivalFlightId === vuelo.id;
    if (!numero) return false;
    const meta = p.metadata ?? {};
    const suyo =
      normalizarVuelo(p.flightNumber) === numero ||
      normalizarVuelo(String(meta.vuelo_llegada ?? meta.vuelo_salida ?? '')) ===
        numero;
    if (!suyo) return false;
    return !dia || !p.arrivalTime || claveDiaEvento(p.arrivalTime) === dia;
  });
}

/**
 * Traslados de llegada de un vuelo: los Transfer In de sus pasajeros y los que
 * llevan su número de vuelo el mismo día (una ficha sin validar no figura
 * entre los pasajeros, pero su traslado sí trae el vuelo).
 */
export function trasladosDelVuelo<T extends TrasladoMarcable>(
  vuelo: { flightNumber?: string | null; arrivalTime?: string | null },
  pasajeroIds: string[],
  viajes: T[],
): T[] {
  const ids = new Set(pasajeroIds);
  const numero = normalizarVuelo(vuelo.flightNumber);
  const dia = vuelo.arrivalTime ? claveDiaEvento(vuelo.arrivalTime) : '';
  return viajes.filter((v) => {
    if (!esLlegada(v)) return false;
    if (estadoDe(v) === 'CANCELLED') return false;
    if (v.requesterAthleteId && ids.has(v.requesterAthleteId)) return true;
    const meta = v.metadata ?? {};
    const suyo = normalizarVuelo(
      v.flightNumber ||
        (typeof meta.flightNumber === 'string' ? meta.flightNumber : ''),
    );
    if (!numero || suyo !== numero) return false;
    const hora =
      typeof meta.flightTime === 'string' ? meta.flightTime : v.scheduledAt;
    return !dia || !hora || claveDiaEvento(hora) === dia;
  });
}
