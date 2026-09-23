import { ForbiddenException } from '@nestjs/common';
import { VehiclePositionsAccessService } from './vehicle-positions.access.service';
import type { StaffScope } from '../auth/staff-scope.service';

/**
 * Quién puede ver el bus de un viaje desde el portal sin viajar en él: el
 * Jefe de Misión para los viajes de su región (o de todas las regiones) y
 * los coordinadores para cualquiera. Un participante común, no.
 */
describe('VehiclePositionsAccessService.assertOperatorCanReadTrip', () => {
  const scope = (kind: StaffScope['kind'], delegationId: string | null = null): StaffScope => ({
    kind,
    userId: 'u',
    name: null,
    role: null,
    delegationId,
    delegationName: null,
  });

  function build(filasDelViaje: unknown[]) {
    const query = jest.fn(() => Promise.resolve(filasDelViaje));
    const service = new VehiclePositionsAccessService(
      {} as never,
      { query } as never,
      {} as never,
      {} as never,
    );
    return { service, query };
  }

  it('los coordinadores (comité y transporte) ven cualquier viaje, sin consultar', async () => {
    const { service, query } = build([]);
    await expect(service.assertOperatorCanReadTrip(scope('committee'), 'v1')).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('el jefe ve el viaje si es de su región, de su gente o de todas las regiones', async () => {
    const { service, query } = build([{ '?column?': 1 }]);
    await expect(
      service.assertOperatorCanReadTrip(scope('mission_head', 'reg-1'), 'v1'),
    ).resolves.toBeUndefined();
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/all_delegations/);
    expect(sql).toMatch(/delegation_id = \$2/);
    expect(params).toEqual(['v1', 'reg-1']);
  });

  it('el jefe no ve un viaje de otra región', async () => {
    const { service } = build([]);
    await expect(
      service.assertOperatorCanReadTrip(scope('mission_head', 'reg-1'), 'v1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un participante común o sin alcance no ve nada', async () => {
    const { service } = build([{ '?column?': 1 }]);
    await expect(service.assertOperatorCanReadTrip(scope('participant'), 'v1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.assertOperatorCanReadTrip(null, 'v1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
