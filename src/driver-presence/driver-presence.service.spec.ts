import { DataSource } from 'typeorm';
import { DriverPresenceService } from './driver-presence.service';

/**
 * Fija la forma con que TypeORM (driver pg) devuelve cada sentencia en
 * dataSource.query(): UPDATE/DELETE -> [filas, cantidad]; SELECT/INSERT -> filas.
 * heartbeat() leyó durante meses el UPDATE como filas, con lo que "continuaba"
 * una sesión inexistente y nunca insertaba: la tabla quedó vacía sin que
 * ningún error lo delatara.
 */
describe('DriverPresenceService.heartbeat', () => {
  const driverId = 'e11f3a2c-a98d-49a2-ab6b-68d23c588ba7';

  function build(updateResult: [Array<{ id: string }>, number]) {
    const query = jest.fn(async (sql: string) => {
      const s = sql.trim().toLowerCase();
      if (s.startsWith('update') && s.includes('returning id')) return updateResult;
      if (s.startsWith('update')) return [[], 0]; // cierre de zombis, sin RETURNING
      if (s.startsWith('insert')) return [{ id: 'nueva' }];
      throw new Error(`sql inesperado: ${sql}`);
    });
    const service = new DriverPresenceService({ query } as unknown as DataSource);
    return { service, query };
  }

  it('sin sesión abierta: el UPDATE devuelve [[], 0] y debe INSERTAR', async () => {
    const { service, query } = build([[], 0]);
    const out = await service.heartbeat({ driverId, platform: 'web' });
    expect(out).toEqual({ sessionId: 'nueva', status: 'started' });
    const inserts = query.mock.calls.filter(([sql]) => /^\s*insert/i.test(sql));
    expect(inserts).toHaveLength(1);
  });

  it('con sesión abierta: continúa la existente y no inserta', async () => {
    const { service, query } = build([[{ id: 'abierta' }], 1]);
    const out = await service.heartbeat({ driverId, platform: 'web' });
    expect(out).toEqual({ sessionId: 'abierta', status: 'continued' });
    const inserts = query.mock.calls.filter(([sql]) => /^\s*insert/i.test(sql));
    expect(inserts).toHaveLength(0);
  });
});

/**
 * stats() compara "hoy" como rango sobre columnas indexadas. Con
 * `columna::date = now()::date` Postgres no usa índices ni poda particiones y
 * recorre todo el historial de cada chofer: 2,5 s de media y picos de 55 s en
 * producción (89 % del tiempo de CPU de la base). Con el rango, < 1 ms.
 */
describe('DriverPresenceService.stats', () => {
  it('no castea columnas de posiciones/sesiones a ::date', async () => {
    const query = jest.fn<Promise<Array<Record<string, number>>>, [string]>(() =>
      Promise.resolve([{ total_drivers: 8, online_now: 1, drivers_today: 3, sessions_today: 13 }]),
    );
    const service = new DriverPresenceService({ query } as unknown as DataSource);
    const out = await service.stats();
    expect(out).toEqual({ totalDrivers: 8, onlineNow: 1, driversToday: 3, sessionsToday: 13 });
    const [sql] = query.mock.calls[0];
    expect(sql).not.toMatch(/created_at::date|started_at::date/);
    expect(sql).toMatch(/vp\.timestamp >= hoy\.desde/);
    expect(sql).toMatch(/started_at >= hoy\.desde/);
  });
});
