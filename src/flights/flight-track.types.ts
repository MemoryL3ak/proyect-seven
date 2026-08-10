/**
 * Forma canónica que devuelve el rastreo de vuelos, independiente del
 * proveedor de datos configurado (AeroDataBox o AviationStack).
 *
 * En todas las horas la parte literal del string es la hora local del
 * aeropuerto correspondiente (ej: "2026-08-10T20:44:00-04:00" son las 20:44 en
 * SCL). AeroDataBox entrega el offset real; AviationStack devuelve siempre
 * "+00:00" aunque la hora sea local, así que el offset NO es confiable: hay
 * que leer la hora literal y nunca convertirla a otra zona horaria.
 */
export type FlightTrackResult = {
  flightNumber: string;
  flightIcao: string | null;
  airlineName: string | null;
  airlineIata: string | null;
  flightStatus: string | null;
  flightDate: string | null;
  /** Fecha solicitada por el cliente; si difiere de flightDate no hubo datos de ese día. */
  requestedDate: string | null;
  /** Los horarios vienen en hora local de cada aeropuerto. */
  timesAreAirportLocal: true;
  provider: 'aerodatabox' | 'aviationstack';

  depAirport: string | null;
  depIata: string | null;
  depCity: string | null;
  depCountry: string | null;
  depTimezone: string | null;
  depTerminal: string | null;
  depScheduled: string | null;
  depEstimated: string | null;
  depActual: string | null;
  depGate: string | null;
  depCheckInDesk: string | null;
  depDelayMinutes: number | null;

  arrAirport: string | null;
  arrIata: string | null;
  arrCity: string | null;
  arrCountry: string | null;
  arrTimezone: string | null;
  arrTerminal: string | null;
  arrScheduled: string | null;
  arrEstimated: string | null;
  arrActual: string | null;
  arrBaggage: string | null;
  arrDelayMinutes: number | null;

  aircraftModel: string | null;
  aircraftReg: string | null;

  liveUpdated: string | null;
  liveLatitude: number | null;
  liveLongitude: number | null;
  liveAltitude: number | null;
  liveDirection: number | null;
  liveSpeedHorizontal: number | null;
  liveIsGround: boolean | null;
};

export type AirlineLookupResult = {
  flightNumber: string;
  airlineName: string | null;
  airlineIata: string | null;
  airlineIcao: string | null;
  origin: string | null;
  originCity: string | null;
  originCountry: string | null;
  departureGate: string | null;
  arrivalBaggage: string | null;
};

/** Una llegada del monitor de aeropuerto (FIDS). */
export type AirportArrival = {
  flightNumber: string;
  airlineName: string | null;
  status: string | null;
  originIata: string | null;
  originName: string | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  terminal: string | null;
  baggage: string | null;
  aircraftModel: string | null;
  delayMinutes: number | null;
};
