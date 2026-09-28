import { esDeProveedorDelEvento } from './proveedores-del-evento';

/**
 * 28-09-2026: los proveedores se asocian a eventos. La auto-asignación de un
 * evento sólo toma conductores de sus proveedores.
 */
describe('esDeProveedorDelEvento', () => {
  const delEvento = new Set(['bvan', 'camir']);

  it('el conductor de un proveedor del evento entra', () => {
    expect(esDeProveedorDelEvento(delEvento, 'bvan')).toBe(true);
  });

  it('el de un proveedor de otro evento no', () => {
    expect(esDeProveedorDelEvento(delEvento, 'rugby-transportes')).toBe(false);
    expect(esDeProveedorDelEvento(delEvento, null)).toBe(false);
  });

  it('sin filtro (sin evento o consulta fallida) entran todos', () => {
    expect(esDeProveedorDelEvento(null, 'cualquiera')).toBe(true);
  });
});
