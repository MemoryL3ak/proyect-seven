import { VehiclePositionsService } from './vehicle-positions.service';

/**
 * 30-09-2026: de 189.274 fijos GPS del día, 167.822 eran el mismo chofer
 * con la misma marca de tiempo. El shell reenvía desde su cola el fijo cuyo
 * POST expiró aunque el servidor ya lo tuviera, y como llega más viejo que el
 * último, la ingesta lo guardaba sin comparar.
 */
describe('VehiclePositionsService: el mismo fijo no se guarda dos veces', () => {
  const CHOFER = 'chofer-1';

  const armar = (yaGuardados: string[] = []) => {
    const inserts: Array<Record<string, unknown>> = [];
    const supabase = {
      schema: () => ({
        from: () => ({
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: `id-${inserts.length}`, created_at: new Date().toISOString(), ...row },
                  error: null,
                }),
              }),
            };
          },
        }),
      }),
    };
    const repo = {
      query: jest.fn(async (sql: string) =>
        sql.includes('transport.trips')
          ? []
          : yaGuardados.map((ts) => ({ lat: -33.4, lng: -70.6, timestamp: ts, created_at: ts })),
      ),
    };
    const proximity = { check: jest.fn() };
    const service = new VehiclePositionsService(supabase as never, repo as never, proximity as never);
    return { service, inserts };
  };

  const fijo = (timestamp: string, lat = -33.45, lng = -70.65) => ({
    driverId: CHOFER,
    timestamp,
    location: { type: 'Point', coordinates: [lng, lat] },
  });

  it('el reenvío de la cola del shell (misma marca de tiempo) se responde OK sin guardar', async () => {
    const { service, inserts } = armar();
    const primero = await service.create(fijo('2026-09-30T12:00:00.000Z') as never);
    expect(primero).toMatchObject({ driverId: CHOFER });
    const otraVez = await service.create(fijo('2026-09-30T12:00:00.000Z') as never);
    expect(otraVez).toEqual({ skipped: true, reason: 'repetido' });
    expect(inserts).toHaveLength(1);
  });

  it('un fijo más viejo que el último, pero nuevo, sí se guarda (relleno de un corte de señal)', async () => {
    const { service, inserts } = armar();
    await service.create(fijo('2026-09-30T12:10:00.000Z') as never);
    const atrasado = await service.create(fijo('2026-09-30T12:05:00.000Z', -33.5, -70.7) as never);
    expect(atrasado).toMatchObject({ driverId: CHOFER });
    expect(inserts).toHaveLength(2);
  });

  it('tras un reinicio, las marcas ya guardadas en la base también cuentan', async () => {
    const { service, inserts } = armar(['2026-09-30T12:00:03.000Z', '2026-09-30T12:00:00.000Z']);
    const repetido = await service.create(fijo('2026-09-30T12:00:00.000Z') as never);
    expect(repetido).toEqual({ skipped: true, reason: 'repetido' });
    expect(inserts).toHaveLength(0);
  });
});
