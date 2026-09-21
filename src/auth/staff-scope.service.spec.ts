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
