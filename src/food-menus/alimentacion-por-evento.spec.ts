import { DataSource } from 'typeorm';
import { StaffScope, StaffScopeService } from '../auth/staff-scope.service';
import { ApiRequest } from '../auth/api-auth.guard';
import { FoodLocationsController } from '../food-locations/food-locations.controller';
import { FoodLocationsService } from '../food-locations/food-locations.service';
import { FoodMenusController } from './food-menus.controller';
import { FoodMenusService } from './food-menus.service';

/**
 * 28-09-2026: Claribel Fonseca (World Rugby) veía en la app los 141 menús de
 * los Juegos Escolares. Menús y comedores guardan su evento: la app ve los
 * de la ficha y el panel los del evento elegido arriba.
 */
const JDE = '0e168c10-a7d1-47ae-9784-265a5fc25d9d';
const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';

const alcance = (kind: StaffScope['kind']): StaffScope => ({
  kind,
  userId: 'claribel',
  name: null,
  role: null,
  delegationId: null,
  delegationName: null,
});

const scopeCon = (kind: StaffScope['kind'], eventoFicha: string | null) =>
  ({
    forRequest: jest.fn().mockResolvedValue(alcance(kind)),
    eventoDelPortal: jest.fn().mockResolvedValue(eventoFicha),
  }) as unknown as StaffScopeService;

function baseQueGuarda() {
  const llamadas: Array<{ sql: string; params: unknown[] }> = [];
  const ds = {
    query: jest.fn((sql: string, params: unknown[]) => {
      llamadas.push({ sql, params });
      return Promise.resolve([]);
    }),
  } as unknown as DataSource;
  return { ds, llamadas };
}

describe('alimentación por evento', () => {
  it('la app de Rugby pide sólo los menús de Rugby (y los sin evento)', async () => {
    const { ds, llamadas } = baseQueGuarda();
    const controller = new FoodMenusController(
      new FoodMenusService(ds),
      scopeCon('committee', RUGBY),
    );
    // Aunque la app pidiera otro evento, manda el de su ficha.
    await controller.findAll({} as ApiRequest, undefined, undefined, JDE);
    expect(llamadas[0].sql).toContain(
      '(event_id is null or event_id = $1::uuid)',
    );
    expect(llamadas[0].params).toEqual([RUGBY]);
  });

  it('el panel ve los menús del evento elegido arriba', async () => {
    const { ds, llamadas } = baseQueGuarda();
    const controller = new FoodMenusController(
      new FoodMenusService(ds),
      scopeCon('staff', null),
    );
    await controller.findAll({} as ApiRequest, undefined, undefined, JDE);
    expect(llamadas[0].params).toEqual([JDE]);
  });

  it('los comedores de la app también quedan en su evento', async () => {
    const { ds, llamadas } = baseQueGuarda();
    const controller = new FoodLocationsController(
      new FoodLocationsService(ds),
      scopeCon('committee', RUGBY),
    );
    await controller.findAll({} as ApiRequest);
    expect(llamadas[0].sql).toContain(
      '($2::uuid is null or event_id is null or event_id = $2::uuid)',
    );
    expect(llamadas[0].params).toEqual([null, RUGBY]);
  });

  it('un menú nuevo se guarda con su evento', async () => {
    const { ds } = baseQueGuarda();
    (ds.query as jest.Mock).mockResolvedValueOnce([
      { id: 'm', event_id: RUGBY, date: '2026-10-01', client_types: [] },
    ]);
    const menu = await new FoodMenusService(ds).create({
      date: '2026-10-01',
      mealType: 'ALMUERZO',
      title: 'Almuerzo',
      eventId: RUGBY,
    });
    const [, params] = (ds.query as jest.Mock).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(params[9]).toBe(RUGBY);
    expect(menu.eventId).toBe(RUGBY);
  });
});
