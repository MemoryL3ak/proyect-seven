import { clavesDelConductor } from './viajes-del-conductor';

const PROVEEDOR = '22692ea7-fde3-4731-a515-3ae7a7c0024f'; // Alexander Bustamante (chofer de proveedor)
const FLOTA = 'aaaaaaaa-1111-4222-8333-444444444444';
const CUENTA = 'bbbbbbbb-1111-4222-8333-444444444444';

describe('viajes que recibe un conductor del portal (15-10-2026: "Seven Arena no responde")', () => {
  it('un chofer de proveedor: sólo su id', () => {
    expect(clavesDelConductor(PROVEEDOR, [])).toEqual([PROVEEDOR]);
  });

  it('un chofer de flota propia: su id y el de su cuenta, sin repetir', () => {
    expect(clavesDelConductor(FLOTA, [{ id: FLOTA, user_id: CUENTA }]).sort()).toEqual([FLOTA, CUENTA].sort());
    expect(clavesDelConductor(CUENTA, [{ id: FLOTA, user_id: CUENTA }]).sort()).toEqual([FLOTA, CUENTA].sort());
  });

  it('lo que no es uuid no entra a la consulta', () => {
    expect(clavesDelConductor('c0024f', [{ id: null, user_id: 'x' }])).toEqual([]);
  });
});
