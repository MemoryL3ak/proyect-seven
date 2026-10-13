import { esIdDeEquipo } from './id-equipo';

describe('identificador de equipo GPS en las rutas', () => {
  it('acepta el IMEI de 15 dígitos de los GT06 y el teléfono de 12 del SEG-9888G (JT808)', () => {
    expect(esIdDeEquipo('862667088669224')).toBe(true);
    expect(esIdDeEquipo('866557086849561')).toBe(true);
    // El SEG no recibía la patente (12-10-2026): 12 dígitos.
    expect(esIdDeEquipo('019210285072')).toBe(true);
  });

  it('rechaza lo que no es un número de equipo', () => {
    expect(esIdDeEquipo('')).toBe(false);
    expect(esIdDeEquipo('abc')).toBe(false);
    expect(esIdDeEquipo('123456789')).toBe(false);
    expect(esIdDeEquipo("1' or 1=1")).toBe(false);
    expect(esIdDeEquipo(undefined)).toBe(false);
  });
});
