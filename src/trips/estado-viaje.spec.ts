import { retrocedeASinIniciar } from './estado-viaje';

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
