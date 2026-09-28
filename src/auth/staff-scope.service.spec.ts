import { SupabaseClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { StaffScopeService } from './staff-scope.service';

/**
 * Alcance de un participante del portal. Fija lo que separa a los tres
 * perfiles con trabajo operativo: el Jefe de Misión queda amarrado a su
 * región, y los dos coordinadores de evento —Comité y Transporte— ven el
 * evento entero sin delegación. Al de Transporte lo distingue el rol, que es
 * de donde cuelga el contacto con los conductores.
 */
describe('StaffScopeService.forAthlete', () => {
  const build = (row: Record<string, unknown>) => {
    const dataSource = { query: jest.fn(() => Promise.resolve([row])) };
    const supabase = {} as unknown as SupabaseClient;
    return new StaffScopeService(supabase, dataSource as unknown as DataSource);
  };

  it('Coordinador de Transporte: ve el evento entero y se anuncia con su rol', async () => {
    const svc = build({
      id: 'a1',
      full_name: 'Paula Soto',
      delegation_id: null,
      is_delegation_lead: false,
      user_type: 'COORDINADOR_TRANSPORTE',
    });
    await expect(svc.forAthlete('a1')).resolves.toMatchObject({
      kind: 'committee',
      role: 'Coordinador de Transporte',
      delegationId: null,
    });
  });

  it('el tipo viene como lo escribió el panel: minúsculas y espacios no lo degradan a participante', async () => {
    const svc = build({
      id: 'a2',
      full_name: 'Paula Soto',
      delegation_id: null,
      is_delegation_lead: false,
      user_type: '  coordinador_transporte ',
    });
    await expect(svc.forAthlete('a2')).resolves.toMatchObject({
      kind: 'committee',
    });
  });

  it('Coordinador de Comité conserva su rol', async () => {
    const svc = build({
      id: 'a3',
      full_name: 'Luis Vera',
      delegation_id: null,
      is_delegation_lead: false,
      user_type: 'COORDINADOR_COMITE',
    });
    await expect(svc.forAthlete('a3')).resolves.toMatchObject({
      kind: 'committee',
      role: 'Coordinador de Comité',
    });
  });

  it('un participante común sigue sin alcance operativo', async () => {
    const svc = build({
      id: 'a4',
      full_name: 'Ana Díaz',
      delegation_id: 'd1',
      is_delegation_lead: false,
      user_type: 'TA',
    });
    await expect(svc.forAthlete('a4')).resolves.toMatchObject({
      kind: 'participant',
      role: 'Participante',
      delegationId: null,
    });
  });
});

/**
 * 28-09-2026: el Coordinador de Sede de World Rugby ve en la app los vuelos
 * del evento y el directorio de conductores, sin volverse comité (no recibe
 * la nómina) y sólo de su evento.
 */
describe('StaffScopeService: Coordinador de Sede', () => {
  const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';
  const build = () => {
    const dataSource = {
      query: jest.fn((sql: string) =>
        Promise.resolve(
          sql.includes('select event_id')
            ? [{ event_id: RUGBY }]
            : [{ id: 'almendra', full_name: 'Almendra Moraga', delegation_id: null, is_delegation_lead: false, user_type: 'COORDINADOR_SEDE' }],
        ),
      ),
    };
    const svc = new StaffScopeService({} as unknown as SupabaseClient, dataSource as unknown as DataSource);
    const req = {
      method: 'GET',
      headers: {},
      apiCaller: { type: 'portal', kind: 'athlete', userId: 'almendra' },
    } as never;
    return { svc, req };
  };

  it('es participante con su rol, no comité', async () => {
    const { svc } = build();
    await expect(svc.forAthlete('almendra')).resolves.toMatchObject({
      kind: 'participant',
      role: 'Coordinador de Sede',
    });
  });

  it('ve el directorio de conductores', async () => {
    const { svc, req } = build();
    await expect(svc.requireFleetViewer(req)).resolves.toMatchObject({ role: 'Coordinador de Sede' });
  });

  it('ve los vuelos de SU evento, no el que pida', async () => {
    const { svc, req } = build();
    await expect(svc.requireMonitorVuelos(req)).resolves.toMatchObject({ eventId: RUGBY });
  });
});
