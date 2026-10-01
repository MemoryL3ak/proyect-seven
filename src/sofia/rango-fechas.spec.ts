import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { ahoraEn, limitesDelDia, rangoDeFechas } from './rango-fechas';

describe('rangoDeFechas', () => {
  const desde = '2026-10-01T03:00:00.000Z';
  const hasta = '2026-10-02T02:59:59.000Z';

  it('con desde y hasta es un rango, no sólo "hasta"', () => {
    expect(rangoDeFechas(desde, hasta)).toEqual(Between(new Date(desde), new Date(hasta)));
  });

  it('con uno solo, el operador que corresponde', () => {
    expect(rangoDeFechas(desde, undefined)).toEqual(MoreThanOrEqual(new Date(desde)));
    expect(rangoDeFechas('', hasta)).toEqual(LessThanOrEqual(new Date(hasta)));
  });

  it('fechas inválidas o vacías no filtran; invertidas se ordenan', () => {
    expect(rangoDeFechas('ayer', undefined)).toBeNull();
    expect(rangoDeFechas(null, null)).toBeNull();
    expect(rangoDeFechas(hasta, desde)).toEqual(Between(new Date(desde), new Date(hasta)));
  });
});

describe('hoy en la zona del evento', () => {
  // 02:30 UTC del 2 de octubre es 23:30 del 1 de octubre en Chile (UTC-3).
  const instante = new Date('2026-10-02T02:30:00.000Z');

  it('ahoraEn da el día local, no el UTC', () => {
    const texto = ahoraEn('America/Santiago', instante);
    expect(texto).toContain('2026-10-01 23:30');
    expect(texto).toContain('America/Santiago');
  });

  it('limitesDelDia cubre el día chileno completo: un viaje a las 22:30 entra', () => {
    expect(limitesDelDia('America/Santiago', instante)).toEqual({
      desde: '2026-10-01T03:00:00.000Z',
      hasta: '2026-10-02T02:59:59.999Z',
    });
    // Un instante con milisegundos no corre los límites.
    expect(limitesDelDia('America/Santiago', new Date('2026-10-01T07:22:13.841Z'))).toEqual({
      desde: '2026-10-01T03:00:00.000Z',
      hasta: '2026-10-02T02:59:59.999Z',
    });
    const viaje = new Date('2026-10-02T01:30:00.000Z'); // 22:30 de Chile
    const { desde, hasta } = limitesDelDia('America/Santiago', instante);
    expect(viaje >= new Date(desde) && viaje <= new Date(hasta)).toBe(true);
  });
});
