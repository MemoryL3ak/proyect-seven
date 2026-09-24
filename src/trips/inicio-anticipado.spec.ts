import { motivoInicioAnticipado } from './inicio-anticipado';

/** Ariel, 24-09-2026: el conductor inicia desde 1 hora antes, no antes. */
describe('motivoInicioAnticipado', () => {
  const programado = new Date('2026-09-24T18:30:00-03:00');

  it('rechaza iniciar antes de la hora previa y dice desde cuándo', () => {
    const motivo = motivoInicioAnticipado(
      'SCHEDULED',
      'EN_ROUTE',
      programado,
      new Date('2026-09-24T17:29:00-03:00'),
    );
    expect(motivo).toBe(
      'El viaje se puede iniciar desde las 17:30 (una hora antes de la hora programada).',
    );
  });

  it('permite desde una hora antes, y después de la hora', () => {
    expect(
      motivoInicioAnticipado(
        'SCHEDULED',
        'EN_ROUTE',
        programado,
        new Date('2026-09-24T17:30:00-03:00'),
      ),
    ).toBeNull();
    expect(
      motivoInicioAnticipado(
        'SCHEDULED',
        'PICKED_UP',
        programado,
        new Date('2026-09-24T19:00:00-03:00'),
      ),
    ).toBeNull();
  });

  it('no toca otros cambios: cerrar, devolver a programado, un viaje ya en ruta', () => {
    const temprano = new Date('2026-09-24T08:00:00-03:00');
    expect(
      motivoInicioAnticipado('EN_ROUTE', 'PICKED_UP', programado, temprano),
    ).toBeNull();
    expect(
      motivoInicioAnticipado('EN_ROUTE', 'COMPLETED', programado, temprano),
    ).toBeNull();
    expect(
      motivoInicioAnticipado('SCHEDULED', 'CANCELLED', programado, temprano),
    ).toBeNull();
    expect(
      motivoInicioAnticipado('SCHEDULED', undefined, programado, temprano),
    ).toBeNull();
  });

  it('sin hora programada no hay con qué medir', () => {
    expect(
      motivoInicioAnticipado('SCHEDULED', 'EN_ROUTE', null, new Date()),
    ).toBeNull();
  });
});
