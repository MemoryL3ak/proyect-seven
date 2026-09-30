import { AeroDataBoxProvider, elegirVuelo } from './aerodatabox.provider';

/**
 * 30-09-2026, CM497 Panamá → Santiago: el rastreo mostraba "Programado ·
 * 2026-09-30 · Est: 23:28" cuando el vuelo del 29 ya había aterrizado a las
 * 23:36. Dos causas: se pedía el día en UTC (el 30) y el proveedor sólo tiene
 * el itinerario de ese vuelo (calidad "Basic", estado "Unknown").
 */
const vuelo = (dia: string, calidad = ['Basic']) => ({
  number: 'CM 497',
  status: 'Unknown',
  airline: { name: 'Copa Airlines', iata: 'CM' },
  departure: { airport: { iata: 'PTY' }, scheduledTime: { local: `${dia} 15:08-05:00` }, quality: calidad },
  arrival: {
    airport: { iata: 'SCL' },
    scheduledTime: { local: `${dia} 23:39-03:00` },
    predictedTime: { local: `${dia} 23:28-03:00` },
    quality: calidad,
  },
});

describe('rastreo de vuelos', () => {
  it('con varios vuelos, elige el que llega el día pedido (no el último)', () => {
    const nocturno = [
      { arrival: { scheduledTime: { local: '2026-09-29 06:00-03:00' } }, departure: { scheduledTime: { local: '2026-09-28 22:00-05:00' } } },
      { arrival: { scheduledTime: { local: '2026-09-30 06:00-03:00' } }, departure: { scheduledTime: { local: '2026-09-29 22:00-05:00' } } },
    ];
    expect(elegirVuelo(nocturno, '2026-09-29')).toBe(nocturno[0]);
    expect(elegirVuelo(nocturno, '2026-09-28')).toBe(nocturno[0]); // sale ese día
    expect(elegirVuelo(nocturno)).toBe(nocturno[1]);
  });

  function proveedor(respuesta: unknown) {
    process.env.AERODATABOX_API_KEY = 'prueba';
    const p = new AeroDataBoxProvider() as unknown as { request: jest.Mock; trackFlight: AeroDataBoxProvider['trackFlight'] };
    p.request = jest.fn(async () => respuesta);
    return p;
  }

  it('sin seguimiento en vivo no dice "Programado" ni muestra el pronóstico como estimada', async () => {
    const p = proveedor([vuelo('2026-09-29')]);
    const r = await p.trackFlight('CM497', '2026-09-29');
    expect(p.request.mock.calls[0][0]).toContain('/flights/number/CM497/2026-09-29');
    expect(r).toMatchObject({ flightDate: '2026-09-29', flightStatus: 'unknown', liveData: false, arrEstimated: null });
  });

  it('con seguimiento en vivo, la estimación del proveedor sí se muestra', async () => {
    const p = proveedor([{ ...vuelo('2026-09-29', ['Basic', 'Live']), status: 'EnRoute' }]);
    const r = await p.trackFlight('CM497', '2026-09-29');
    expect(r).toMatchObject({ flightStatus: 'active', liveData: true });
    expect(r.arrEstimated).toContain('2026-09-29T23:28');
  });
});
