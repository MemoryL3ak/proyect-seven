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

/**
 * list() recibía eventId y lo cruzaba contra el evento del ÚLTIMO fix GPS del
 * chofer. El shell nativo transmite sin eventId, así que ese campo viene null
 * en casi todas las posiciones y la condición no se cumplía nunca: el portal
 * del Jefe de Misión —el único que manda eventId— se quedaba sin un solo
 * conductor, sin mapa y sin nadie a quien seguir, mientras el KPI "Conductores
 * en línea" (que sale de stats(), sin ese filtro) seguía contándolos.
 */
describe('DriverPresenceService.list', () => {
  const sqlDe = async (
    eventId?: string,
    date?: string,
    delegationId?: string | null,
  ): Promise<[string, unknown[]]> => {
    const query = jest.fn<
      Promise<Array<Record<string, unknown>>>,
      [string, unknown[]]
    >(() => Promise.resolve([]));
    const service = new DriverPresenceService({
      query,
    } as unknown as DataSource);
    await service.list(eventId, date, delegationId);
    return query.mock.calls[0];
  };

  it('pasar eventId no filtra por el evento del último fix GPS', async () => {
    const [sql] = await sqlDe('0e168c10-a7d1-47ae-9784-265a5fc25d9d');
    expect(sql).not.toMatch(/g\.event_id\s*=/);
  });

  it('devuelve los mismos conductores con y sin eventId', async () => {
    const [conEvento] = await sqlDe(
      '0e168c10-a7d1-47ae-9784-265a5fc25d9d',
      undefined,
      null,
    );
    const [sinEvento] = await sqlDe(undefined, undefined, null);
    expect(conEvento).toBe(sinEvento);
  });

  it('los parámetros enviados calzan con los placeholders de la consulta', async () => {
    const [sql, params] = await sqlDe(
      '0e168c10-a7d1-47ae-9784-265a5fc25d9d',
      '2026-09-22',
      '8c247a7b-ed52-44db-8558-b27969da24e1',
    );
    // Postgres rechaza el bind si sobran parámetros ("bind message supplies N
    // parameters, but prepared statement requires M").
    const marcas: string[] = sql.match(/\$\d+/g) ?? [];
    const usados = new Set(marcas.map((m) => Number(m.slice(1))));
    expect(Math.max(...usados)).toBe(params.length);
    expect(params).toEqual([
      '2026-09-22',
      '8c247a7b-ed52-44db-8558-b27969da24e1',
    ]);
  });
});
