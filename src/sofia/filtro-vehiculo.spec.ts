import { filtroConSin, filtroVehiculo } from './filtro-vehiculo';

describe('filtros con / sin', () => {
  it('false, que el modelo manda por defecto, no filtra', () => {
    expect(filtroVehiculo({ hasVehicle: false })).toBeNull();
    expect(filtroVehiculo({})).toBeNull();
    expect(filtroVehiculo({ vehiculo: '' })).toBeNull();
    expect(filtroConSin(undefined, false)).toBeNull();
  });

  it('"con" y "sin" sí filtran; true sigue valiendo como "con"', () => {
    expect(filtroVehiculo({ vehiculo: 'con' })).toBe(true);
    expect(filtroVehiculo({ vehiculo: ' SIN ' })).toBe(false);
    expect(filtroVehiculo({ hasVehicle: true })).toBe(true);
    expect(filtroConSin('sin', true)).toBe(false);
  });
});
