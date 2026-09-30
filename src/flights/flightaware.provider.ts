import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { FlightTrackResult } from './flight-track.types';

/**
 * FlightAware AeroAPI: estado en vivo de un vuelo (30-09-2026).
 *
 * Se midió con los 15 vuelos de Rugby: AeroDataBox tenía la hora real de
 * llegada a Santiago de 1, AviationStack de 6 y FlightAware de todos los que
 * ya habían aterrizado (CM497: aterrizó 23:29, puerta 23:36, igual que
 * Google). AeroDataBox sigue para el tablero de llegadas del aeropuerto y
 * como respaldo si FlightAware falla o se queda sin cupo.
 *
 * Cada consulta se cobra: la respuesta se guarda en memoria según el momento
 * del vuelo (2 min en el aire o cerca de llegar, 30 min si falta, 6 h si ya
 * llegó), y dos pantallas que piden el mismo vuelo a la vez hacen una sola
 * consulta.
 */

const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';
const ZONA_EVENTO = process.env.EVENT_TIME_ZONE || 'America/Santiago';

type FaAeropuerto = { code_iata?: string | null; name?: string | null; city?: string | null; timezone?: string | null };

export type FaVuelo = {
  ident?: string | null;
  ident_iata?: string | null;
  operator_iata?: string | null;
  registration?: string | null;
  aircraft_type?: string | null;
  origin?: FaAeropuerto | null;
  destination?: FaAeropuerto | null;
  scheduled_out?: string | null;
  estimated_out?: string | null;
  actual_out?: string | null;
  actual_off?: string | null;
  scheduled_in?: string | null;
  estimated_in?: string | null;
  estimated_on?: string | null;
  actual_on?: string | null;
  actual_in?: string | null;
  departure_delay?: number | null;
  arrival_delay?: number | null;
  status?: string | null;
  cancelled?: boolean | null;
  diverted?: boolean | null;
  gate_origin?: string | null;
  gate_destination?: string | null;
  terminal_origin?: string | null;
  terminal_destination?: string | null;
  baggage_claim?: string | null;
};

/** Día local ("2026-09-29") de un instante en una zona horaria. */
export function diaLocal(iso: string | null | undefined, zona: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zona || 'UTC' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * "2026-09-30T02:29:00Z" en America/Santiago → "2026-09-29T23:29:00-03:00":
 * la hora del aeropuerto con su desfase, el mismo formato que AeroDataBox.
 */
export function horaDelAeropuerto(iso: string | null | undefined, zona: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: zona || 'UTC',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    const hora = partes.hour === '24' ? '00' : partes.hour;
    const local = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +hora, +partes.minute, +partes.second);
    const desfase = Math.round((local - d.getTime()) / 60000);
    const signo = desfase < 0 ? '-' : '+';
    const abs = Math.abs(desfase);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${partes.year}-${partes.month}-${partes.day}T${hora}:${partes.minute}:${partes.second}${signo}${hh}:${mm}`;
  } catch {
    return d.toISOString();
  }
}

/** El vuelo del día pedido: el que llega ese día y, entre ésos, el que toca Chile. */
export function elegirVueloFa(vuelos: FaVuelo[], fecha?: string, ahora = Date.now()): FaVuelo | undefined {
  if (!vuelos.length) return undefined;
  const tocaChile = (v: FaVuelo) => v.destination?.timezone === ZONA_EVENTO || v.origin?.timezone === ZONA_EVENTO;
  const preferir = (lista: FaVuelo[]) => lista.find(tocaChile) ?? lista[0];
  if (fecha) {
    const llegan = vuelos.filter((v) => diaLocal(v.scheduled_in, v.destination?.timezone) === fecha);
    if (llegan.length) return preferir(llegan);
    const salen = vuelos.filter((v) => diaLocal(v.scheduled_out, v.origin?.timezone) === fecha);
    if (salen.length) return preferir(salen);
  }
  // Sin fecha: el que está en curso o el más cercano a ahora.
  const distancia = (v: FaVuelo) => Math.abs(new Date(v.scheduled_in ?? v.scheduled_out ?? 0).getTime() - ahora);
  return [...vuelos].sort((a, b) => distancia(a) - distancia(b))[0];
}

/** Estado en el vocabulario de la app (el mismo de AeroDataBox). */
export function estadoFa(v: FaVuelo): string {
  if (v.cancelled) return 'cancelled';
  if (v.diverted) return 'diverted';
  if (v.actual_on || v.actual_in) return 'landed';
  if (v.actual_off || v.actual_out) return 'active';
  if ((v.departure_delay ?? 0) >= 15 * 60 || /delayed/i.test(v.status ?? '')) return 'delayed';
  return 'scheduled';
}

const minutos = (seg?: number | null) => (typeof seg === 'number' ? Math.round(seg / 60) : null);

export function aResultado(v: FaVuelo, numero: string, fechaPedida?: string): FlightTrackResult {
  const zo = v.origin?.timezone ?? null;
  const zd = v.destination?.timezone ?? null;
  const depScheduled = horaDelAeropuerto(v.scheduled_out, zo);
  const arrScheduled = horaDelAeropuerto(v.scheduled_in, zd);
  return {
    flightNumber: (v.ident_iata || v.ident || numero).replace(/\s+/g, ''),
    flightIcao: v.ident ?? null,
    airlineName: null,
    airlineIata: v.operator_iata ?? null,
    flightStatus: estadoFa(v),
    liveData: true,
    flightDate: diaLocal(v.scheduled_out, zo) || null,
    requestedDate: fechaPedida ?? null,
    timesAreAirportLocal: true,
    provider: 'flightaware',

    depAirport: v.origin?.name ?? null,
    depIata: v.origin?.code_iata ?? null,
    depCity: v.origin?.city ?? null,
    depCountry: null,
    depTimezone: zo,
    depTerminal: v.terminal_origin ?? null,
    depScheduled,
    depEstimated: horaDelAeropuerto(v.estimated_out, zo),
    depActual: horaDelAeropuerto(v.actual_off ?? v.actual_out, zo),
    depGate: v.gate_origin ?? null,
    depCheckInDesk: null,
    depDelayMinutes: minutos(v.departure_delay),

    arrAirport: v.destination?.name ?? null,
    arrIata: v.destination?.code_iata ?? null,
    arrCity: v.destination?.city ?? null,
    arrCountry: null,
    arrTimezone: zd,
    arrTerminal: v.terminal_destination ?? null,
    arrScheduled,
    // Puerta, igual que la programada (scheduled_in) y que Google; la de
    // pista (estimated_on) sólo si no hay otra.
    arrEstimated: horaDelAeropuerto(v.estimated_in ?? v.estimated_on, zd),
    // Aterrizaje (pista). La llegada a la puerta va aparte: es la que
    // muestra Google como "Llegó".
    arrActual: horaDelAeropuerto(v.actual_on ?? v.actual_in, zd),
    arrGateActual: horaDelAeropuerto(v.actual_in, zd),
    arrBaggage: v.baggage_claim ?? null,
    arrDelayMinutes: minutos(v.arrival_delay),

    aircraftModel: v.aircraft_type ?? null,
    aircraftReg: v.registration ?? null,

    liveUpdated: null,
    liveLatitude: null,
    liveLongitude: null,
    liveAltitude: null,
    liveDirection: null,
    liveSpeedHorizontal: null,
    liveIsGround: null,
  };
}

/**
 * Rango de búsqueda para el día pedido, dentro de lo que acepta AeroAPI en
 * /flights/{ident}: hasta 2 días hacia adelante y 10 hacia atrás. Pedir
 * "día + 48 h" para un vuelo de hoy pasaba el límite, FlightAware respondía
 * 400 y el rastreo caía en AeroDataBox (AA957, 30-09-2026). null si el día
 * queda fuera de lo que FlightAware tiene: lo responde el otro proveedor.
 */
export function ventanaConsulta(fecha: string, ahora = Date.now()): { start: string; end: string } | null {
  const base = new Date(`${fecha}T12:00:00Z`).getTime();
  if (Number.isNaN(base)) return null;
  const desde = Math.max(base - 36 * 3600_000, ahora - 10 * 24 * 3600_000 + 3600_000);
  const hasta = Math.min(base + 48 * 3600_000, ahora + 2 * 24 * 3600_000 - 3600_000);
  if (hasta <= desde) return null;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 19) + 'Z';
  return { start: iso(desde), end: iso(hasta) };
}

/** Cuánto sirve la respuesta guardada, según el momento del vuelo. */
export function duracionCache(v: FaVuelo | undefined, ahora = Date.now()): number {
  if (!v) return 10 * 60_000;
  const estado = estadoFa(v);
  if (estado === 'landed' || estado === 'cancelled' || estado === 'diverted') return 6 * 3600_000;
  if (estado === 'active') return 2 * 60_000;
  const llegada = new Date(v.estimated_in ?? v.scheduled_in ?? 0).getTime();
  const salida = new Date(v.estimated_out ?? v.scheduled_out ?? 0).getTime();
  const cerca = Math.min(Math.abs(llegada - ahora), Math.abs(salida - ahora)) <= 4 * 3600_000;
  return cerca ? 2 * 60_000 : 30 * 60_000;
}

@Injectable()
export class FlightAwareProvider {
  private readonly cache = new Map<string, { vence: number; valor: FaVuelo | undefined }>();
  private readonly enCurso = new Map<string, Promise<FaVuelo | undefined>>();

  static isConfigured() {
    return Boolean(process.env.FLIGHTAWARE_API_KEY);
  }

  private async pedir(numero: string, fecha?: string): Promise<FaVuelo[]> {
    const clave = process.env.FLIGHTAWARE_API_KEY;
    if (!clave) throw new InternalServerErrorException('Missing FLIGHTAWARE_API_KEY configuration');
    const url = new URL(`${BASE_URL}/flights/${encodeURIComponent(numero)}`);
    url.searchParams.set('ident_type', 'designator');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const ventana = ventanaConsulta(fecha);
      if (!ventana) throw new Error(`FlightAware no cubre el ${fecha} (sólo 10 días atrás y 2 adelante)`);
      url.searchParams.set('start', ventana.start);
      url.searchParams.set('end', ventana.end);
    }
    const res = await fetch(url, {
      headers: { 'x-apikey': clave, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detalle = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`FlightAware ${res.status}: ${detalle}`);
    }
    const data = (await res.json()) as { flights?: FaVuelo[] };
    return Array.isArray(data?.flights) ? data.flights : [];
  }

  async trackFlight(flightNumber: string, flightDate?: string): Promise<FlightTrackResult> {
    const numero = (flightNumber ?? '').replace(/\s+/g, '').toUpperCase();
    const clave = `${numero}|${flightDate ?? ''}`;
    const guardado = this.cache.get(clave);
    let vuelo: FaVuelo | undefined;
    if (guardado && guardado.vence > Date.now()) {
      vuelo = guardado.valor;
    } else {
      let promesa = this.enCurso.get(clave);
      if (!promesa) {
        promesa = this.pedir(numero, flightDate)
          .then((lista) => elegirVueloFa(lista, flightDate))
          .finally(() => this.enCurso.delete(clave));
        this.enCurso.set(clave, promesa);
      }
      vuelo = await promesa;
      this.cache.set(clave, { vence: Date.now() + duracionCache(vuelo), valor: vuelo });
    }
    if (!vuelo) {
      throw new NotFoundException(`FlightAware no tiene el vuelo ${numero}${flightDate ? ` del ${flightDate}` : ''}.`);
    }
    return aResultado(vuelo, numero, flightDate);
  }
}
