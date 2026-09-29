import { ForbiddenException } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsFinanceService } from './trips-finance.service';

/**
 * 29-09-2026: "al proveedor debería aparecer lo que dice valor proveedor, no
 * valor cliente ni valor licitado". La app del conductor mostraba trip_cost
 * (lo que se cobra al cliente); ahora pide el valor proveedor de sus viajes.
 */
const CONDUCTOR = '3fadd159-16d3-4dad-a996-280051644a47';

describe('valor proveedor de los viajes del conductor', () => {
  it('se calcula sólo con la tarifa de su proveedor, para sus viajes', async () => {
    const query = jest.fn(async () => [
      { id: 'ida', valor: '35000' },
      { id: 'sin-tarifa', valor: null },
    ]);
    const svc = new TripsFinanceService({ query } as never);
    await expect(svc.valoresProveedor(CONDUCTOR)).resolves.toEqual({ ida: 35000, 'sin-tarifa': null });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('c.rate_provider');
    expect(sql).not.toContain('c.ref_provider'); // sin el promedio de mercado
    expect(sql).toContain('where c.driver_id = $8');
    expect(params[7]).toBe(CONDUCTOR);
    await expect(svc.valoresProveedor('no-es-uuid')).resolves.toEqual({});
  });

  function controlador() {
    const finance = { valoresProveedor: jest.fn(async (id: string) => ({ [id]: 1 })), summary: jest.fn() };
    const ctrl = new TripsController({} as never, {} as never, finance as never, {} as never);
    return { ctrl, finance };
  }

  it('el conductor sólo pide los suyos (su id sale de la sesión, no de la URL)', async () => {
    const { ctrl, finance } = controlador();
    const req = { apiCaller: { type: 'portal', kind: 'driver', userId: CONDUCTOR } };
    await ctrl.valoresProveedor(req as never, 'otro-conductor');
    expect(finance.valoresProveedor).toHaveBeenCalledWith(CONDUCTOR);
  });

  it('un participante no puede pedirlos, ni los informes de Finanzas', () => {
    const { ctrl } = controlador();
    const req = { apiCaller: { type: 'portal', kind: 'athlete', userId: 'x' } };
    expect(() => ctrl.valoresProveedor(req as never, CONDUCTOR)).toThrow(ForbiddenException);
    expect(() => ctrl.financeSummary(req as never)).toThrow(ForbiddenException);
  });
});
