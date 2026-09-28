import { filasDe } from './filas-de';

/**
 * 28-09-2026: un `update … returning *` devuelve [filas, afectadas] en
 * TypeORM/Postgres; se leía como si fueran las filas.
 */
describe('filasDe', () => {
  const fila = { id: 'sergio', status: 'PERSONAL_DATA_VALIDATED' };

  it('UPDATE/DELETE: [filas, afectadas] → filas', () => {
    expect(filasDe([[fila], 1])).toEqual([fila]);
    expect(filasDe([[], 0])).toEqual([]);
  });

  it('SELECT/INSERT: las filas tal cual', () => {
    expect(filasDe([fila])).toEqual([fila]);
    expect(filasDe([])).toEqual([]);
  });

  it('una sola fila que por casualidad es un par no se confunde', () => {
    // Dos filas donde la segunda no es número: son filas.
    expect(filasDe([fila, fila])).toEqual([fila, fila]);
  });

  it('nada → sin filas', () => {
    expect(filasDe(undefined)).toEqual([]);
  });
});
