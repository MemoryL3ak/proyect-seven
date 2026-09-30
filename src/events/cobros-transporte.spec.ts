import { cobrosDeConfig, configConCobros, normalizarCobros, totalLicitado } from './cobros-transporte';

describe('cobros de licitación de transporte', () => {
  const plan = [
    { sistema: 'Aeropuerto auto/SUV', modalidad: 'POR_VIAJE', flota: 'AUTO_SUV', clientPrice: 180000, cantidad: 17, providerIds: ['jorge', 'marcelo', 'jorge'] },
    { sistema: 'Bus dedicado delegaciones', modalidad: 'POR_VEHICULO_DIA', flota: 'BUS', clientPrice: '444500', cantidad: '63', providerIds: ['beltour'] },
    { sistema: '   ', clientPrice: 999, cantidad: 1 },
  ];

  it('normaliza: ids nuevos, números, proveedores sin repetir; descarta filas sin sistema', () => {
    const cobros = normalizarCobros(plan, 1000);
    expect(cobros).toHaveLength(2);
    expect(cobros[0]).toMatchObject({ id: 'cobro-rs-0', sistema: 'Aeropuerto auto/SUV', providerIds: ['jorge', 'marcelo'], clientPrice: 180000, cantidad: 17 });
    expect(cobros[1]).toMatchObject({ modalidad: 'POR_VEHICULO_DIA', flota: 'BUS', clientPrice: 444500, cantidad: 63 });
  });

  it('conserva el id de un cobro ya guardado y corrige modalidad o flota desconocidas', () => {
    const [c] = normalizarCobros([{ id: 'c1', sistema: 'X', modalidad: 'RARA', flota: 'NAVE', clientPrice: -5, cantidad: 'no' }]);
    expect(c).toMatchObject({ id: 'c1', modalidad: 'POR_VIAJE', flota: 'VAN', clientPrice: 0, cantidad: 0, providerIds: [] });
  });

  it('el total licitado es valor por cantidad', () => {
    // Rugby: $3.060.000 de autos de aeropuerto + $28.003.500 de bus dedicado.
    expect(totalLicitado(normalizarCobros(plan))).toBe(3060000 + 28003500);
  });

  it('vive en config.cobrosTransporte sin pisar el resto de la configuración', () => {
    const config = configConCobros({ zonaHoraria: 'America/Santiago' }, normalizarCobros(plan, 1));
    expect(config.zonaHoraria).toBe('America/Santiago');
    expect(cobrosDeConfig(config)).toHaveLength(2);
    expect(cobrosDeConfig(null)).toEqual([]);
    expect(cobrosDeConfig({ cobrosTransporte: 'basura' })).toEqual([]);
  });
});
