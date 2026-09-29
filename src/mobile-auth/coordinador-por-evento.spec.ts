import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { MobileAuthService } from './mobile-auth.service';

/**
 * 28-09-2026: todo por evento. El contacto "Coordinador general" de la app
 * era el primero por orden alfabético de toda la plataforma; ahora es el del
 * evento de quien pregunta (user_metadata.eventIds; vacío = todos).
 */
const JDE = 'jde';
const RUGBY = 'rugby';

const usuario = (name: string, eventIds?: string[]) => ({
  email: `${name.toLowerCase()}@x.cl`,
  user_metadata: {
    role: 'Coordinador General',
    name,
    phone: '+56911112222',
    eventIds,
  },
});

function servicioCon(users: unknown[]) {
  const supabase = {
    auth: {
      admin: {
        listUsers: jest
          .fn()
          .mockResolvedValue({ data: { users }, error: null }),
      },
    },
  } as unknown as SupabaseClient;
  return new MobileAuthService(
    new Logger('test'),
    supabase,
    {} as ConfigService,
  );
}

describe('Coordinador General por evento', () => {
  const users = [
    usuario('Ana', [JDE]),
    usuario('Bruno'), // sin eventos: vale para todos
    usuario('Carla', [RUGBY]),
  ];

  it('en Rugby, el que tiene Rugby anotado', async () => {
    expect((await servicioCon(users).findGeneralCoordinator(RUGBY))?.name).toBe(
      'Carla',
    );
  });

  it('en JDE, el de JDE; nunca el de otro evento', async () => {
    expect((await servicioCon(users).findGeneralCoordinator(JDE))?.name).toBe(
      'Ana',
    );
    const soloRugby = [usuario('Carla', [RUGBY])];
    expect(await servicioCon(soloRugby).findGeneralCoordinator(JDE)).toBeNull();
  });

  it('sin coordinador del evento, uno que vale para todos', async () => {
    const sinRugby = [usuario('Ana', [JDE]), usuario('Bruno')];
    expect(
      (await servicioCon(sinRugby).findGeneralCoordinator(RUGBY))?.name,
    ).toBe('Bruno');
  });
});
