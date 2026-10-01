import { unificarConductores } from './unificar-conductores';

describe('unificarConductores', () => {
  it('dos personas distintas del mismo proveedor con el mismo nombre se conservan las dos', () => {
    // Alex Arévalo, 30-09-2026: el Manuel Gonzales viejo (quitado de Rugby) y el nuevo (código 43c32f).
    const proveedores = [
      { id: '35fd780c-0000-0000-0000-000000000001', fullName: 'Manuel Gonzales', source: 'provider' },
      { id: 'd9ac6941-c2d0-4cd8-b405-ceb2a143c32f', fullName: 'Manuel Gonzales', source: 'provider' },
      { id: '8471e671-0000-0000-0000-00000e985e3a', fullName: 'Juan Fernandez', source: 'provider' },
    ];
    const lista = unificarConductores(proveedores, []);
    expect(lista.map((d) => d.id)).toContain('d9ac6941-c2d0-4cd8-b405-ceb2a143c32f');
    expect(lista).toHaveLength(3);
  });

  it('la flota propia cede ante el proveedor: mismo id o mismo nombre', () => {
    const proveedores = [{ id: 'add61e36', fullName: 'Alex Arevalo', source: 'provider' }];
    const flota = [
      { id: 'add61e36', fullName: 'Alex Arevalo', source: 'fleet' },
      { id: 'otro-id', fullName: '  alex arevalo ', source: 'fleet' },
      { id: 'flota-2', fullName: 'Pedro Soto', source: 'fleet' },
    ];
    const lista = unificarConductores(proveedores, flota);
    expect(lista.map((d) => `${d.source}:${d.id}`)).toEqual(['provider:add61e36', 'fleet:flota-2']);
  });

  it('un id repetido dentro de una misma fuente sólo entra una vez', () => {
    const lista = unificarConductores([{ id: 'x', fullName: 'A' }, { id: 'x', fullName: 'A' }], [{ id: 'y', fullName: 'B' }, { id: 'y', fullName: 'B' }]);
    expect(lista.map((d) => d.id)).toEqual(['x', 'y']);
  });
});
