import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { TripMessage } from './entities/trip-message.entity';
import { ProviderRate } from '../providers/entities/provider-rate.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

describe('TripsService', () => {
  let service: TripsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {} as SupabaseClient,
        },
        { provide: getRepositoryToken(Trip), useValue: {} },
        { provide: getRepositoryToken(TripMessage), useValue: {} },
        { provide: getRepositoryToken(ProviderRate), useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

/**
 * Alcance del Jefe de Misión. El filtro era `delegation_id = X` a secas, así
 * que un traslado sin delegación cargada —a mano o por la planilla de
 * operatividad, que no trae esa columna— no le llegaba nunca, aunque fueran
 * sus participantes los que viajaban. El portal ya lo daba por hecho:
 * MissionLiveTrips mira también solicitante y pasajeros para decidir qué
 * traslado es suyo.
 */
describe('TripsService.findAll · alcance del Jefe de Misión', () => {
  const delegationId = '8c247a7b-ed52-44db-8558-b27969da24e1';

  /** Arma el servicio sobre un query builder real (sin conexión) y devuelve el SQL. */
  async function sqlDe(
    requesterAthleteId?: string,
    delegacion?: string | null,
  ) {
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
    await service.findAll(requesterAthleteId, delegacion);
    // Sólo el WHERE: la lista de columnas nombra delegation_id siempre.
    return qb.getQuery().split(/\sWHERE\s/)[1] ?? '';
  }

  it('incluye los viajes sin delegación cuyos pasajeros son de su región', async () => {
    const sql = await sqlDe(undefined, delegationId);
    expect(sql).toMatch(/"t"\."delegation_id" = :delegationId/);
    expect(sql).toMatch(/transport\.trip_athletes/);
    expect(sql).toMatch(/"t"\."requester_athlete_id" in/);
  });

  it('sin delegación no agrega ningún recorte por región', async () => {
    expect(await sqlDe(undefined, null)).toBe('');
  });

  it('el filtro por solicitante sigue siendo exacto', async () => {
    const sql = await sqlDe('49370e4f-7f0a-4eea-ae76-e0b3d7ae162d', null);
    expect(sql).toMatch(/"t"\."requester_athlete_id" = :requesterAthleteId/);
  });
});
