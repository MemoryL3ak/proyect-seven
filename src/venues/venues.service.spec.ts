import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Venue } from './entities/venue.entity';
import { VenuesService } from './venues.service';

/**
 * El coordinador de sede se elige entre los participantes y la sede guarda
 * su nombre y teléfono copiados, que es lo que muestran la tarjeta y el
 * portal. Al editar la sede se guardaba el id sin copiar la ficha, y el
 * coordinador "desaparecía". Estas pruebas fijan el copiado en las dos vías.
 */
describe('VenuesService · coordinador de sede', () => {
  const participante = { full_name: 'María Pérez', phone: '+56 9 1111 2222' };
  const supabase = {
    schema: () => supabase,
    from: () => supabase,
    select: () => supabase,
    eq: () => supabase,
    maybeSingle: () => Promise.resolve({ data: participante }),
  };
  let service: VenuesService;
  let guardada: Partial<Venue> | null;

  beforeEach(async () => {
    guardada = null;
    const repo = {
      create: (v: Partial<Venue>) => ({ ...v }),
      save: (v: Partial<Venue>) => {
        guardada = v;
        return Promise.resolve(v);
      },
      findOne: () =>
        Promise.resolve({ id: 'sede-1', eventId: 'ev', name: 'Escuela Naval', coordinatorId: null } as Venue),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getRepositoryToken(Venue), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(VenuesService);
  });

  it('al editar la sede con un coordinador, copia su nombre y teléfono', async () => {
    await service.update('sede-1', { coordinatorId: 'part-1' });
    expect(guardada).toMatchObject({
      coordinatorId: 'part-1',
      coordinatorName: 'María Pérez',
      coordinatorPhone: '+56 9 1111 2222',
    });
  });

  it('al quitar el coordinador, limpia la ficha', async () => {
    await service.update('sede-1', { coordinatorId: null });
    expect(guardada).toMatchObject({ coordinatorId: null, coordinatorName: null, coordinatorPhone: null });
  });

  it('un cambio que no toca al coordinador no lo pisa', async () => {
    await service.update('sede-1', { name: 'Escuela Naval Arturo Prat' });
    expect(guardada).toMatchObject({ name: 'Escuela Naval Arturo Prat', coordinatorId: null });
    expect(guardada).not.toHaveProperty('coordinatorName');
  });

  it('al crear la sede con coordinador, también copia la ficha', async () => {
    await service.create({ eventId: 'ev', name: 'Polideportivo', coordinatorId: 'part-1' } as never);
    expect(guardada).toMatchObject({ coordinatorName: 'María Pérez', coordinatorPhone: '+56 9 1111 2222' });
  });
});
