import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { VehiclePositionsAccessService } from './vehicle-positions.access.service';
import { VehiclePositionsGuard } from './vehicle-positions.guard';

/**
 * Ingesta GPS en modo transicional (shell sin credenciales): un POST sin
 * sesión entra; uno con una sesión que ya no vale (otro teléfono entró con
 * el mismo código) se rechaza, para que el mapa no mezcle los dos teléfonos.
 */
describe('VehiclePositionsGuard · ingesta con sesión de portal', () => {
  function build(sesionValida: boolean) {
    const access = new VehiclePositionsAccessService(
      {} as never,
      { query: jest.fn(() => Promise.resolve([])) } as never,
      { validateSessionStrict: jest.fn(() => Promise.resolve(sesionValida)) } as never,
      { get: () => 'log' } as never,
    );
    return new VehiclePositionsGuard(access);
  }
  const contexto = (headers: Record<string, string>) => {
    const req = { method: 'POST', headers } as { method: string; headers: Record<string, string>; vpCaller?: unknown };
    return {
      ctx: {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => ({ name: 'create' }),
      } as unknown as ExecutionContext,
      req,
    };
  };
  const conSesion = { 'x-portal-kind': 'driver', 'x-portal-user': 'juan', 'x-portal-session': 's-1' };

  it('sin credenciales (shell antiguo) el fijo entra en modo log', async () => {
    const { ctx, req } = contexto({});
    await expect(build(false).canActivate(ctx)).resolves.toBe(true);
    expect(req.vpCaller).toBeNull();
  });

  it('con la sesión vigente el fijo entra identificado como el conductor', async () => {
    const { ctx, req } = contexto(conSesion);
    await expect(build(true).canActivate(ctx)).resolves.toBe(true);
    expect(req.vpCaller).toEqual({ type: 'portal', kind: 'driver', userId: 'juan' });
  });

  it('con una sesión que otro teléfono ya tomó, el fijo se rechaza aunque siga el modo log', async () => {
    const { ctx } = contexto(conSesion);
    await expect(build(false).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
