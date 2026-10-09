import * as net from 'net';
import { GpsTrackersService, normalizarPatente } from './gps-trackers.service';
import { respuesta } from './gt06';

/**
 * El receptor de punta a punta, con un equipo simulado por TCP: contesta el
 * login y el latido, y una posición de un IMEI asignado a una patente entra
 * a telemetry.vehicle_positions con el conductor del viaje en curso que
 * lleva esa patente.
 */
const hex = (s: string) => Buffer.from(s.replace(/\s+/g, ''), 'hex');
const LOGIN = hex('78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A');
const LOGIN_RESPUESTA = hex('78 78 05 01 00 01 D9 DC 0D 0A');
const LATIDO = hex('78 78 0A 13 40 06 04 00 01 00 0F DC EE 0D 0A');

const bloqueGps = (fecha: Date, lat: number, lng: number, vel: number, rumbo: number) => {
  const b = Buffer.alloc(18);
  b[0] = fecha.getUTCFullYear() - 2000; b[1] = fecha.getUTCMonth() + 1; b[2] = fecha.getUTCDate();
  b[3] = fecha.getUTCHours(); b[4] = fecha.getUTCMinutes(); b[5] = fecha.getUTCSeconds();
  b[6] = 0xc9;
  b.writeUInt32BE(Math.round(Math.abs(lat) * 1800000), 7);
  b.writeUInt32BE(Math.round(Math.abs(lng) * 1800000), 11);
  b[15] = vel;
  b.writeUInt16BE((rumbo & 0x3ff) | 0x1000 | (lat >= 0 ? 0x0400 : 0) | (lng < 0 ? 0x0800 : 0), 16);
  return b;
};

const PUERTO = 17018 + Math.floor(Math.random() * 1000);

describe('normalizarPatente', () => {
  it('"JJ JC 74", "jjjc-74" y "JJJC74" son la misma patente (así vienen en los viajes de Rugby)', () => {
    expect(normalizarPatente('JJ JC 74')).toBe('JJJC74');
    expect(normalizarPatente('jjjc-74')).toBe('JJJC74');
    expect(normalizarPatente('  ')).toBeNull();
    expect(normalizarPatente(null)).toBeNull();
  });
});

describe('GpsTrackersService', () => {
  const inserts: Array<Record<string, unknown>> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const supabase = {
    schema: () => ({
      from: () => ({
        upsert: (fila: Record<string, unknown>) => { upserts.push(fila); return Promise.resolve({ error: null }); },
        insert: (fila: Record<string, unknown>) => { inserts.push(fila); return Promise.resolve({ error: null }); },
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { plate: 'kbgb-58' }, error: null }) }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  };
  const consultas: string[] = [];
  const dataSource = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      consultas.push(sql);
      if (sql.includes('transport.trips')) {
        expect(params?.[0]).toBe('KBGB58');
        return Promise.resolve([{ id: 'trip-1', driver_id: 'drv-1', event_id: 'ev-1', status: 'PICKED_UP' }]);
      }
      if (sql.includes('full_name')) return Promise.resolve([{ id: 'drv-1', full_name: 'juan villegas' }]);
      return Promise.resolve([]);
    }),
  };
  let service: GpsTrackersService;
  let socket: net.Socket;
  const recibido: Buffer[] = [];

  const esperar = (cond: () => boolean, ms = 3000) =>
    new Promise<void>((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => (cond() ? resolve() : Date.now() - t0 > ms ? reject(new Error('tiempo agotado')) : setTimeout(tick, 20));
      tick();
    });

  beforeAll(async () => {
    process.env.GPS_TCP_PORT = String(PUERTO);
    service = new GpsTrackersService(supabase as never, dataSource as never);
    service.onApplicationBootstrap();
    await new Promise<void>((resolve, reject) => {
      const intentar = (n: number) => {
        const s = net.createConnection({ host: '127.0.0.1', port: PUERTO }, () => { socket = s; resolve(); });
        s.on('data', (d) => recibido.push(d));
        s.on('error', () => (n > 0 ? setTimeout(() => intentar(n - 1), 100) : reject(new Error('no escucha'))));
      };
      intentar(30);
    });
  });

  afterAll(() => {
    socket?.destroy();
    service.onApplicationShutdown();
  });

  it('contesta el login con la trama del documento y registra el equipo', async () => {
    socket.write(LOGIN);
    await esperar(() => recibido.length >= 1);
    expect(recibido[0]).toEqual(LOGIN_RESPUESTA);
    await esperar(() => upserts.length >= 1);
    expect(upserts[0]).toMatchObject({ imei: '123456789012345' });
    const lista = await service.listar();
    expect(lista.equipos.map((e) => e.imei)).toEqual(['123456789012345']);
    expect(lista.equipos[0].conectado).toBe(true);
  });

  it('una posición entra como posición del conductor del viaje en curso con esa patente', async () => {
    const fecha = new Date('2026-10-09T15:04:05Z');
    const pos = respuesta(0x12, 2, Buffer.concat([bloqueGps(fecha, -33.4543, -70.5186, 42, 143), Buffer.alloc(8)]));
    socket.write(pos);
    await esperar(() => inserts.length >= 1);
    const fila = inserts[0] as { location: { coordinates: number[] }; speed: number };
    expect(fila).toMatchObject({ event_id: 'ev-1', vehicle_id: null, driver_id: 'drv-1', trip_id: 'trip-1', timestamp: '2026-10-09T15:04:05.000Z', heading: 143 });
    expect(fila.location.coordinates[0]).toBeCloseTo(-70.5186, 5);
    expect(fila.location.coordinates[1]).toBeCloseTo(-33.4543, 5);
    expect(fila.speed).toBeCloseTo(42 / 3.6, 3);
    // La última posición también queda en la tabla del equipo (sobrevive a reinicios).
    expect(upserts.some((u) => u.last_lat === -33.4543 || Math.abs(Number(u.last_lat) + 33.4543) < 1e-5)).toBe(true);
    await esperar(() => recibido.length >= 2);
    expect(recibido[1]).toEqual(respuesta(0x12, 2));
    const [equipo] = (await service.listar()).equipos;
    expect(equipo.posicionesGuardadas).toBe(1);
    expect(equipo.vehiclePlate).toBe('KBGB58');
    expect(equipo.conductorId).toBe('drv-1');
    expect(equipo.conductorNombre).toBe('juan villegas');
    expect(equipo.tripId).toBe('trip-1');
    expect(service.ultimosPaquetes('123456789012345').map((p) => p.tipo)).toEqual(['posicion', 'login']);
  });

  it('el latido se contesta y la trama queda registrada', async () => {
    socket.write(LATIDO);
    await esperar(() => recibido.length >= 3);
    expect(recibido[2]).toEqual(respuesta(0x13, 0x000f));
  });
});
