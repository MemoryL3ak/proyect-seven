import { SupabaseClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { StaffScope, StaffScopeService } from '../auth/staff-scope.service';
import { ApiRequest } from '../auth/api-auth.guard';
import { Trip } from './entities/trip.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

/**
 * 28-09-2026: Claribel Fonseca (Coordinadora de Transporte de World Rugby)
 * abría la app y veía "596 traslados" de los Juegos Escolares en Viña. El
 * comité recibía los viajes de todos los eventos; ahora sólo los del evento
 * de su ficha.
 */
const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';

const alcance = (kind: StaffScope['kind']): StaffScope => ({
  kind,
  userId: 'claribel',
  name: 'Claribel Angela Fonseca Proboste',
  role: null,
  delegationId: kind === 'mission_head' ? 'region' : null,
  delegationName: null,
});

function controladorCon(scope: StaffScope) {
  const findAll = jest.fn().mockResolvedValue([]);
  const scopeService = {
    forRequest: jest.fn().mockResolvedValue(scope),
    eventoDelPortal: jest.fn().mockResolvedValue(RUGBY),
  } as unknown as StaffScopeService;
  const controller = new TripsController(
    { findAll } as unknown as TripsService,
    {} as never,
    {} as never,
    scopeService,
  );
  return { controller, findAll };
}

describe('GET /trips desde la app: sólo el evento de la ficha', () => {
  it('la Coordinadora de Transporte recibe sólo los viajes de Rugby', async () => {
    const { controller, findAll } = controladorCon(alcance('committee'));
    await controller.findAll({} as ApiRequest);
    expect(findAll).toHaveBeenCalledWith(undefined, null, RUGBY);
  });

  it('el Jefe de Misión, los de su región y su evento', async () => {
    const { controller, findAll } = controladorCon(alcance('mission_head'));
    await controller.findAll({} as ApiRequest);
    expect(findAll).toHaveBeenCalledWith(undefined, 'region', RUGBY);
  });

  it('el panel sigue recibiendo todo (elige el evento arriba)', async () => {
    const { controller, findAll } = controladorCon(alcance('staff'));
    await controller.findAll({} as ApiRequest);
    expect(findAll).toHaveBeenCalledWith(undefined, null, null);
  });

  it('el servicio filtra por event_id', async () => {
    const ds = new DataSource({ type: 'postgres', entities: [Trip] });
    await (
      ds as unknown as { buildMetadatas: () => Promise<void> }
    ).buildMetadatas();
    const qb = ds.createQueryBuilder(Trip, 't');
    qb.getMany = (() => Promise.resolve([])) as typeof qb.getMany;
    const service = new TripsService(
      {} as SupabaseClient,
      { createQueryBuilder: () => qb } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.findAll(undefined, null, RUGBY);
    expect(qb.getQuery().split(/\sWHERE\s/)[1]).toMatch(
      /"t"\."event_id" = :eventId/,
    );
  });
});
