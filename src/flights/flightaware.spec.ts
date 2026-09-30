import { FlightAwareProvider, elegirVueloFa, estadoFa, horaDelAeropuerto, type FaVuelo } from './flightaware.provider';
import { FlightsService } from './flights.service';

/**
 * 30-09-2026: el rastreo decía "Programado" para el CM497 que ya había
 * aterrizado. Medido con los 15 vuelos de Rugby, FlightAware es el único que
 * tiene la llegada real a Santiago de todos; pasa a ser la fuente del rastreo.
 */
const PTY = { code_iata: 'PTY', name: 'Tocumen Int\'l', city: 'Panama City', timezone: 'America/Panama' };
const SCL = { code_iata: 'SCL', name: 'Arturo Merino Benitez Int\'l', city: 'Santiago', timezone: 'America/Santiago' };
const cm497 = (dia: string, extra: Partial<FaVuelo> = {}): FaVuelo => ({
  ident: 'CMP497',
  ident_iata: 'CM497',
  operator_iata: 'CM',
  origin: PTY,
  destination: SCL,
  scheduled_out: `${dia}T20:08:00Z`,
  scheduled_in: new Date(new Date(`${dia}T20:08:00Z`).getTime() + (6 * 60 + 31) * 60_000).toISOString().replace('.000', ''),
  status: 'Scheduled',
  ...extra,
});
const aterrizado = cm497('2026-09-29', {
  actual_off: '2026-09-29T20:21:17Z',
  actual_on: '2026-09-30T02:29:03Z',
  actual_in: '2026-09-30T02:36:00Z',
  gate_origin: '201',
  arrival_delay: -180,
  status: 'Arrived / Gate Arrival',
});

describe('FlightAware', () => {
  afterAll(() => {
    delete process.env.FLIGHTAWARE_API_KEY;
  });
  it('pasa las horas a la hora de cada aeropuerto, con su desfase', () => {
    expect(horaDelAeropuerto('2026-09-30T02:29:03Z', 'America/Santiago')).toBe('2026-09-29T23:29:03-03:00');
    expect(horaDelAeropuerto('2026-09-29T20:08:00Z', 'America/Panama')).toBe('2026-09-29T15:08:00-05:00');
  });

  it('elige el vuelo que llega el día pedido y, si hay dos tramos, el que toca Chile', () => {
    const hoy = cm497('2026-09-30');
    expect(elegirVueloFa([aterrizado, hoy], '2026-09-29')).toBe(aterrizado);
    expect(elegirVueloFa([aterrizado, hoy], '2026-09-30')).toBe(hoy);
    const brasil: FaVuelo = { ...cm497('2026-09-29'), origin: { code_iata: 'MVD', timezone: 'America/Montevideo' }, destination: { code_iata: 'GRU', timezone: 'America/Sao_Paulo' }, scheduled_in: '2026-09-29T15:00:00Z' };
    const chile: FaVuelo = { ...cm497('2026-09-29'), origin: { code_iata: 'GRU', timezone: 'America/Sao_Paulo' }, scheduled_in: '2026-09-29T21:00:00Z' };
    expect(elegirVueloFa([brasil, chile], '2026-09-29')).toBe(chile);
  });

  it('estado: aterrizado, en vuelo, retrasado, cancelado', () => {
    expect(estadoFa(aterrizado)).toBe('landed');
    expect(estadoFa({ actual_off: 'x' })).toBe('active');
    expect(estadoFa({ departure_delay: 20 * 60 })).toBe('delayed');
    expect(estadoFa({ cancelled: true })).toBe('cancelled');
    expect(estadoFa({})).toBe('scheduled');
  });

  describe('consulta', () => {
    const fetchOriginal = global.fetch;
    afterEach(() => {
      global.fetch = fetchOriginal;
    });
    beforeEach(() => {
      process.env.FLIGHTAWARE_API_KEY = 'prueba';
    });

    it('el CM497 del 29-09: aterrizó 23:29, en puerta 23:36; la segunda vez no vuelve a cobrar', async () => {
      const fetchMock = jest.fn(async () => new Response(JSON.stringify({ flights: [cm497('2026-09-30'), aterrizado] }), { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const p = new FlightAwareProvider();
      const r = await p.trackFlight('CM 497', '2026-09-29');
      expect(r).toMatchObject({
        provider: 'flightaware',
        flightStatus: 'landed',
        flightDate: '2026-09-29',
        depIata: 'PTY',
        arrIata: 'SCL',
        arrScheduled: '2026-09-29T23:39:00-03:00',
        arrActual: '2026-09-29T23:29:03-03:00',
        arrGateActual: '2026-09-29T23:36:00-03:00',
        depGate: '201',
        arrDelayMinutes: -3,
      });
      const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
      expect(url).toContain('/flights/CM497?ident_type=designator');
      await p.trackFlight('CM497', '2026-09-29');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sin cupo (429) avisa con error, para que el servicio use el proveedor de antes', async () => {
      global.fetch = jest.fn(async () => new Response('{"title":"Rate limit error"}', { status: 429 })) as unknown as typeof fetch;
      await expect(new FlightAwareProvider().trackFlight('LA715', '2026-09-30')).rejects.toThrow('FlightAware 429');
    });
  });

  it('el servicio usa FlightAware y, si falla, AeroDataBox', async () => {
    process.env.FLIGHTAWARE_API_KEY = 'prueba';
    process.env.FLIGHT_DATA_PROVIDER = 'aerodatabox';
    const fa = { trackFlight: jest.fn(async () => ({ provider: 'flightaware' })) };
    const adb = { trackFlight: jest.fn(async () => ({ provider: 'aerodatabox' })) };
    const svc = new FlightsService({} as never, {} as never, adb as never, fa as never);
    await expect(svc.trackFlight('CM497', '2026-09-29')).resolves.toEqual({ provider: 'flightaware' });
    fa.trackFlight.mockRejectedValueOnce(new Error('FlightAware 429'));
    await expect(svc.trackFlight('CM497', '2026-09-29')).resolves.toEqual({ provider: 'aerodatabox' });
    delete process.env.FLIGHT_DATA_PROVIDER;
  });
});
