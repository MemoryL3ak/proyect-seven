import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { MobileAuthService } from './mobile-auth.service';

/**
 * findGeneralCoordinator(): quien ven los portales como contacto de WhatsApp.
 * Fija el criterio: rol exacto "Coordinador General", activo, con telefono;
 * si hay varios, el primero por nombre; sin candidatos, null.
 */
describe('MobileAuthService.findGeneralCoordinator', () => {
  const build = (users: Array<Record<string, unknown>>, error: unknown = null) => {
    const supabase = { auth: { admin: { listUsers: jest.fn(async () => ({ data: { users }, error })) } } };
    const config = { get: () => undefined } as unknown as ConfigService;
    return new MobileAuthService(new Logger('test'), supabase as unknown as SupabaseClient, config);
  };

  it('devuelve nombre y telefono del Coordinador General activo', async () => {
    const svc = build([
      { email: 'ops@seven.cl', user_metadata: { name: 'Operador', role: 'Operador', phone: '+56911111111' } },
      { email: 'coord@seven.cl', user_metadata: { name: 'Mónica Ruiz', role: 'Coordinador General', phone: ' +56 9 2222 2222 ' } },
    ]);
    await expect(svc.findGeneralCoordinator()).resolves.toEqual({ name: 'Mónica Ruiz', phone: '+56 9 2222 2222' });
  });

  it('ignora al coordinador sin telefono y al deshabilitado', async () => {
    const svc = build([
      { email: 'a@seven.cl', user_metadata: { name: 'Sin Fono', role: 'Coordinador General' } },
      { email: 'b@seven.cl', user_metadata: { name: 'Baneado', role: 'Coordinador General', phone: '+56933333333' }, banned_until: '2099-01-01T00:00:00Z' },
    ]);
    await expect(svc.findGeneralCoordinator()).resolves.toBeNull();
  });

  it('con varios, manda el primero por nombre', async () => {
    const svc = build([
      { email: 'z@seven.cl', user_metadata: { name: 'Zoe', role: 'Coordinador General', phone: '+56944444444' } },
      { email: 'a@seven.cl', user_metadata: { name: 'Ana', role: 'Coordinador General', phone: '+56955555555' } },
    ]);
    await expect(svc.findGeneralCoordinator()).resolves.toEqual({ name: 'Ana', phone: '+56955555555' });
  });

  it('si Supabase falla, null en vez de romper el portal', async () => {
    const svc = build([], { message: 'boom' });
    await expect(svc.findGeneralCoordinator()).resolves.toBeNull();
  });
});
