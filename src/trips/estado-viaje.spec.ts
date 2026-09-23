import { marcasAlCambiarEstado, retrocedeASinIniciar } from './estado-viaje';

describe('retrocedeASinIniciar', () => {
  it('de Completado a Programado es un retroceso', () => {
    expect(retrocedeASinIniciar('DROPPED_OFF', 'SCHEDULED')).toBe(true);
    expect(retrocedeASinIniciar('EN_ROUTE', 'REQUESTED')).toBe(true);
  });

  it('avanzar o quedarse igual no lo es', () => {
    expect(retrocedeASinIniciar('REQUESTED', 'SCHEDULED')).toBe(false);
    expect(retrocedeASinIniciar('SCHEDULED', 'SCHEDULED')).toBe(false);
    expect(retrocedeASinIniciar('SCHEDULED', 'EN_ROUTE')).toBe(false);
    expect(retrocedeASinIniciar('DROPPED_OFF', undefined)).toBe(false);
  });
});

describe('marcasAlCambiarEstado', () => {
  const ahora = new Date('2026-09-23T10:37:00.000Z');
  const vacio = { startedAt: null, completedAt: null };

  it('"En ruta" arranca el inicio: la jornada empieza cuando el conductor sale, no cuando sube el pasajero', () => {
    expect(marcasAlCambiarEstado('SCHEDULED', 'EN_ROUTE', vacio, {}, ahora)).toEqual({
      started_at: '2026-09-23T10:37:00.000Z',
    });
  });

  it('"Pasajero a bordo" no pisa el inicio que ya tenía el viaje', () => {
    expect(
      marcasAlCambiarEstado('EN_ROUTE', 'PICKED_UP', { startedAt: '2026-09-23T10:30:00.000Z' }, {}, ahora),
    ).toEqual({});
  });

  it('cerrar desde el panel sin haber pasado por "En ruta" estampa inicio y cierre', () => {
    expect(marcasAlCambiarEstado('SCHEDULED', 'DROPPED_OFF', vacio, {}, ahora)).toEqual({
      started_at: '2026-09-23T10:37:00.000Z',
      completed_at: '2026-09-23T10:37:00.000Z',
    });
  });

  it('lo que manda el portal manda: no se reemplaza', () => {
    expect(
      marcasAlCambiarEstado('PICKED_UP', 'DROPPED_OFF', { startedAt: '2026-09-23T10:00:00.000Z' }, { completedAt: '2026-09-23T10:36:00.000Z' }, ahora),
    ).toEqual({});
  });

  it('volver a Programado o editar sin cambiar de estado no estampa nada', () => {
    expect(marcasAlCambiarEstado('EN_ROUTE', 'SCHEDULED', vacio, {}, ahora)).toEqual({});
    expect(marcasAlCambiarEstado('EN_ROUTE', 'EN_ROUTE', vacio, {}, ahora)).toEqual({});
    expect(marcasAlCambiarEstado('EN_ROUTE', undefined, vacio, {}, ahora)).toEqual({});
  });
});
