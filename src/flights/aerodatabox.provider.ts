import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AirlineLookupResult,
  AirportArrival,
  FlightTrackResult,
} from './flight-track.types';

/**
 * Cliente de AeroDataBox.
 *
 * Por defecto apunta al gateway de API.market (cabecera x-magicapi-key). Para
 * usar RapidAPI u otro gateway basta cambiar AERODATABOX_BASE_URL y
 * AERODATABOX_KEY_HEADER en el entorno, sin tocar código.
 */
const DEFAULT_BASE_URL =
  'https://api.magicapi.dev/api/v1/aedbx/aerodatabox';
const DEFAULT_KEY_HEADER = 'x-magicapi-key';

/** AeroDataBox usa "2026-08-10 20:44-04:00"; lo pasamos a ISO-8601 válido. */
function toIso(time?: { local?: string; utc?: string } | null): string | null {
  const local = time?.local;
  if (!local) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|Z)?$/.exec(
    local.trim(),
  );
  if (!m) return null;
  const [, date, hhmm, ss, rawOffset] = m;
  let offset = rawOffset ?? '';
  if (offset && offset !== 'Z' && !offset.includes(':')) {
    offset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  }
  return `${date}T${hhmm}:${ss ?? '00'}${offset}`;
}

function minutesBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const diff = Math.round((b - a) / 60000);
  return diff > 0 ? diff : null;
}

/**
 * Traduce el estado de AeroDataBox al vocabulario que ya usa el frontend
 * (heredado de AviationStack) para que ambos proveedores se pinten igual.
 */
const STATUS_MAP: Record<string, string> = {
  expected: 'scheduled',
  unknown: 'scheduled',
  checkin: 'scheduled',
  boarding: 'boarding',
  gateclosed: 'boarding',
  departed: 'active',
  enroute: 'active',
  approaching: 'approaching',
  delayed: 'delayed',
  arrived: 'landed',
  landed: 'landed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  canceleduncertain: 'cancelled',
  diverted: 'diverted',
};

type AdbTime = { local?: string; utc?: string };
type AdbEndpoint = {
  airport?: {
    iata?: string;
    icao?: string;
    name?: string;
    shortName?: string;
    municipalityName?: string;
    countryCode?: string;
    timeZone?: string;
  };
  scheduledTime?: AdbTime;
  revisedTime?: AdbTime;
  predictedTime?: AdbTime;
  runwayTime?: AdbTime;
  actualTime?: AdbTime;
  terminal?: string;
  gate?: string;
  checkInDesk?: string;
  baggageBelt?: string;
};
type AdbFlight = {
  number?: string;
  callSign?: string;
  status?: string;
  departure?: AdbEndpoint;
  arrival?: AdbEndpoint;
  airline?: { name?: string; iata?: string; icao?: string };
  aircraft?: { model?: string; reg?: string };
  location?: {
    lat?: number;
    lon?: number;
    altitude?: { meter?: number };
    pressureAltitude?: { meter?: number };
    groundSpeed?: { kmPerHour?: number };
    trueTrack?: { degree?: number };
    reportedAtUtc?: string;
  };
  lastUpdatedUtc?: string;
};

@Injectable()
export class AeroDataBoxProvider {
  private get apiKey() {
    const key = process.env.AERODATABOX_API_KEY;
    if (!key)
      throw new InternalServerErrorException(
        'Missing AERODATABOX_API_KEY configuration',
      );
    return key;
  }

  static isConfigured() {
    return Boolean(process.env.AERODATABOX_API_KEY);
  }

  private async request<T>(path: string): Promise<T> {
    const base = (process.env.AERODATABOX_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    const header = process.env.AERODATABOX_KEY_HEADER || DEFAULT_KEY_HEADER;
    const response = await fetch(`${base}${path}`, {
      headers: { [header]: this.apiKey, Accept: 'application/json' },
    });
    if (response.status === 204 || response.status === 404)
      return [] as unknown as T;
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new InternalServerErrorException(
        `AeroDataBox request failed (${response.status}) ${body.slice(0, 200)}`,
      );
    }
    return (await response.json()) as T;
  }

  private normalizeNumber(flightNumber: string) {
    const normalized = (flightNumber ?? '').replace(/\s+/g, '').toUpperCase();
    if (!normalized)
      throw new InternalServerErrorException('Flight number is required');
    return normalized;
  }

  private async fetchFlights(
    flightNumber: string,
    flightDate?: string,
  ): Promise<AdbFlight[]> {
    const normalized = this.normalizeNumber(flightNumber);
    const suffix = flightDate ? `/${flightDate}` : '';
    const data = await this.request<AdbFlight[] | AdbFlight>(
      `/flights/number/${encodeURIComponent(normalized)}${suffix}` +
        '?withAircraftImage=false&withLocation=true',
    );
    const list = Array.isArray(data) ? data : data ? [data] : [];
    // Con codeshares puede venir más de un registro: preferimos al operador.
    return list.filter(f => f && (f.departure || f.arrival));
  }

  async lookupAirline(flightNumber: string): Promise<AirlineLookupResult> {
    const normalized = this.normalizeNumber(flightNumber);
    const [first] = await this.fetchFlights(flightNumber);
    if (!first?.airline)
      throw new NotFoundException('Airline not found for flight number');

    const depAirport = first.departure?.airport;
    const originCity = depAirport?.municipalityName ?? null;
    const originCountry = depAirport?.countryCode?.toUpperCase() ?? null;

    return {
      flightNumber: first.number?.replace(/\s+/g, '') || normalized,
      airlineName: first.airline.name ?? null,
      airlineIata: first.airline.iata ?? null,
      airlineIcao: first.airline.icao ?? null,
      origin:
        originCity && originCountry
          ? `${originCity}, ${originCountry}`
          : originCity || depAirport?.name || null,
      originCity,
      originCountry,
      departureGate: first.departure?.gate ?? null,
      arrivalBaggage: first.arrival?.baggageBelt ?? null,
    };
  }

  async trackFlight(
    flightNumber: string,
    flightDate?: string,
  ): Promise<FlightTrackResult> {
    const normalized = this.normalizeNumber(flightNumber);
    let flights = await this.fetchFlights(flightNumber, flightDate);
    // Si no hay datos del día pedido, mostramos al menos la operación vigente.
    if (!flights.length && flightDate) {
      flights = await this.fetchFlights(flightNumber);
    }
    if (!flights.length)
      throw new NotFoundException(
        `No se encontró información para el vuelo ${normalized}. Verifica que el número de vuelo sea correcto (ej: LA180, AA900).`,
      );

    const row = flights[flights.length - 1];
    const dep = row.departure ?? {};
    const arr = row.arrival ?? {};

    const depScheduled = toIso(dep.scheduledTime);
    const depEstimated = toIso(dep.revisedTime) ?? toIso(dep.predictedTime);
    const depActual = toIso(dep.runwayTime) ?? toIso(dep.actualTime);
    const arrScheduled = toIso(arr.scheduledTime);
    const arrEstimated = toIso(arr.revisedTime) ?? toIso(arr.predictedTime);
    const arrActual = toIso(arr.runwayTime) ?? toIso(arr.actualTime);

    const loc = row.location;
    const status = STATUS_MAP[(row.status ?? '').toLowerCase()] ?? null;

    return {
      flightNumber: row.number?.replace(/\s+/g, '') || normalized,
      flightIcao: row.callSign ?? null,
      airlineName: row.airline?.name ?? null,
      airlineIata: row.airline?.iata ?? null,
      flightStatus: status,
      flightDate: (depScheduled ?? arrScheduled)?.slice(0, 10) ?? null,
      requestedDate: flightDate ?? null,
      timesAreAirportLocal: true,
      provider: 'aerodatabox',

      depAirport: dep.airport?.name ?? null,
      depIata: dep.airport?.iata ?? null,
      depCity: dep.airport?.municipalityName ?? null,
      depCountry: dep.airport?.countryCode?.toUpperCase() ?? null,
      depTimezone: dep.airport?.timeZone ?? null,
      depTerminal: dep.terminal ?? null,
      depScheduled,
      depEstimated,
      depActual,
      depGate: dep.gate ?? null,
      depCheckInDesk: dep.checkInDesk ?? null,
      depDelayMinutes: minutesBetween(depScheduled, depActual ?? depEstimated),

      arrAirport: arr.airport?.name ?? null,
      arrIata: arr.airport?.iata ?? null,
      arrCity: arr.airport?.municipalityName ?? null,
      arrCountry: arr.airport?.countryCode?.toUpperCase() ?? null,
      arrTimezone: arr.airport?.timeZone ?? null,
      arrTerminal: arr.terminal ?? null,
      arrScheduled,
      arrEstimated,
      arrActual,
      arrBaggage: arr.baggageBelt ?? null,
      arrDelayMinutes: minutesBetween(arrScheduled, arrActual ?? arrEstimated),

      aircraftModel: row.aircraft?.model ?? null,
      aircraftReg: row.aircraft?.reg ?? null,

      liveUpdated: loc?.reportedAtUtc ?? row.lastUpdatedUtc ?? null,
      liveLatitude: loc?.lat ?? null,
      liveLongitude: loc?.lon ?? null,
      liveAltitude:
        loc?.altitude?.meter ?? loc?.pressureAltitude?.meter ?? null,
      liveDirection: loc?.trueTrack?.degree ?? null,
      liveSpeedHorizontal: loc?.groundSpeed?.kmPerHour ?? null,
      liveIsGround: null,
    };
  }

  /**
   * Monitor de llegadas de un aeropuerto (FIDS), en una ventana relativa a
   * ahora. Una sola llamada trae todos los vuelos, sin depender de que el
   * número esté cargado a mano en la plataforma.
   */
  async airportArrivals(
    iata: string,
    offsetMinutes = -60,
    durationMinutes = 720,
  ): Promise<AirportArrival[]> {
    const code = (iata ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code))
      throw new InternalServerErrorException('Invalid airport IATA code');
    // La API acepta ventanas de hasta 12 horas.
    const duration = Math.min(Math.max(durationMinutes, 30), 720);

    const payload = await this.request<{ arrivals?: AdbFlight[] }>(
      `/flights/airports/iata/${code}` +
        `?offsetMinutes=${offsetMinutes}&durationMinutes=${duration}` +
        '&direction=Arrival&withLeg=true&withCancelled=true' +
        '&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false',
    );

    return (payload?.arrivals ?? []).map(f => {
      const arr = f.arrival ?? {};
      const dep = f.departure ?? {};
      const scheduled = toIso(arr.scheduledTime);
      const estimated = toIso(arr.revisedTime) ?? toIso(arr.predictedTime);
      const actual = toIso(arr.runwayTime) ?? toIso(arr.actualTime);
      return {
        flightNumber: f.number?.replace(/\s+/g, '') ?? '',
        airlineName: f.airline?.name ?? null,
        status: STATUS_MAP[(f.status ?? '').toLowerCase()] ?? null,
        originIata: dep.airport?.iata ?? null,
        originName:
          dep.airport?.municipalityName ?? dep.airport?.name ?? null,
        scheduled,
        estimated,
        actual,
        terminal: arr.terminal ?? null,
        baggage: arr.baggageBelt ?? null,
        aircraftModel: f.aircraft?.model ?? null,
        delayMinutes: minutesBetween(scheduled, actual ?? estimated),
      };
    });
  }
}
