import { claveLugar, LugarCatalogo, resolverLugar } from './lugar-por-nombre';

const sede = (nombre: string, venueId: string): LugarCatalogo => ({
  clave: claveLugar(nombre),
  nombre,
  venueId,
  hotelId: null,
  foodLocationId: null,
});

const hotel = (nombre: string, hotelId: string): LugarCatalogo => ({
  clave: claveLugar(nombre),
  nombre,
  venueId: null,
  hotelId,
  foodLocationId: null,
});

const catalogo: LugarCatalogo[] = [
  sede('Gimnasio UTFSM - José Miguel Carrera', 'utfsm'),
  sede('Gimnasio Universidad Viña del Mar', 'uvm'),
  sede('Polideportivo Renato Raggio', 'poli-raggio'),
  sede('Piscina Polideportivo Renato Raggio', 'piscina-raggio'),
  sede('Gimnasio PUCV, Campus Curauma', 'pucv'),
];

describe('resolverLugar', () => {
  it('por nombre exacto, sin tildes ni mayúsculas', () => {
    expect(
      resolverLugar('GIMNASIO UNIVERSIDAD VINA DEL MAR', catalogo),
    ).toMatchObject({
      venueId: 'uvm',
      nombre: 'Gimnasio Universidad Viña del Mar',
    });
  });

  it('por el alias corto: lo que va antes de " - " en el catálogo', () => {
    // Caso del 21-09-2026: la sede se renombró y la planilla siguió con el corto.
    expect(resolverLugar('Gimnasio UTFSM', catalogo)).toMatchObject({
      venueId: 'utfsm',
      nombre: 'Gimnasio UTFSM - José Miguel Carrera',
    });
  });

  it('la puntuación no cuenta: "Gimnasio PUCV Campus Curauma" es "Gimnasio PUCV, Campus Curauma"', () => {
    // JDE, 30-09-2026: 32 viajes de la planilla sin sede por esa coma.
    expect(resolverLugar('Gimnasio PUCV Campus Curauma', catalogo).venueId).toBe('pucv');
  });

  it('"Magic hotel" es "Hotel Magic"', () => {
    const conMagic = [...catalogo, hotel('Hotel Magic', 'magic')];
    expect(resolverLugar('Magic hotel', conMagic).hotelId).toBe('magic');
  });

  it('por comienzo del nombre cuando sólo un lugar empieza así', () => {
    expect(resolverLugar('Gimnasio PUCV', catalogo).venueId).toBe('pucv');
  });

  it('ante dos calces no adivina', () => {
    // "Polideportivo Renato Raggio" es exacto de uno: gana el exacto.
    expect(resolverLugar('Polideportivo Renato Raggio', catalogo).venueId).toBe(
      'poli-raggio',
    );
    // "Gimnasio U" empieza dos nombres y además es muy corto.
    expect(resolverLugar('Gimnasio U', catalogo).venueId).toBeNull();
  });

  it('"Hotel X" calza con el hotel del catálogo que empieza por X', () => {
    const conHotel = [...catalogo, hotel('Hippocampus Resort § Club', 'hippo')];
    expect(resolverLugar('Hotel Hippocampus', conHotel)).toMatchObject({
      hotelId: 'hippo',
      nombre: 'Hippocampus Resort § Club',
    });
  });

  it('un texto corto no enlaza por prefijo', () => {
    expect(resolverLugar('Piscina', catalogo).venueId).toBeNull();
  });

  it('sin texto o sin calce queda sin id y sin nombre', () => {
    expect(resolverLugar('', catalogo)).toMatchObject({
      venueId: null,
      nombre: null,
    });
    expect(resolverLugar('ESC.NAVAL 2', catalogo)).toMatchObject({
      venueId: null,
      nombre: null,
    });
  });
});

/**
 * Rugby, 30-09-2026: la planilla de buses y el catálogo de Santiago. Los
 * cuatro primeros no calzaban y la app mandaba "CARR" o "PWCC" a Waze.
 */
describe('resolverLugar con la planilla de buses de Rugby', () => {
  const rugby: LugarCatalogo[] = [
    sede('CDA · Club Deportivo Alimni', 'cda'),
    sede('Cenco Costanera', 'cenco'),
    sede('Estadio san Carlos de Apoquindo', 'san-carlos'),
    sede('Oficinas Central INSTITUTO NACIONAL DE DEPORTES CHILE', 'ind'),
    sede('Old Grangonian Club', 'ogc'),
    sede('Parque Mahuida CARR', 'carr'),
    sede('Polideportivo Estadio Nacional', 'poli-en'),
    sede('PWCC · Prince of Wales Country Club', 'pwcc'),
    hotel('Hotel Sheraton Santiago', 'sheraton'),
    hotel('Hotel Torremayor', 'torremayor'),
  ];

  it('"CARR" es la sigla de "Parque Mahuida CARR"', () => {
    expect(resolverLugar('CARR', rugby)).toMatchObject({ venueId: 'carr', nombre: 'Parque Mahuida CARR' });
  });

  it('"PWCC" y "Prince of Wales Country Club" son alias de "PWCC · Prince of Wales Country Club"', () => {
    expect(resolverLugar('PWCC', rugby).venueId).toBe('pwcc');
    expect(resolverLugar('Prince of Wales Country Club', rugby).venueId).toBe('pwcc');
    expect(resolverLugar('CDA', rugby).venueId).toBe('cda');
  });

  it('"Hotel Sheraton" enlaza con "Hotel Sheraton Santiago"', () => {
    expect(resolverLugar('Hotel Sheraton', rugby)).toMatchObject({ hotelId: 'sheraton', nombre: 'Hotel Sheraton Santiago' });
  });

  it('"UC San Carlos de Apoquindo" enlaza con "Estadio san Carlos de Apoquindo"', () => {
    expect(resolverLugar('UC San Carlos de Apoquindo', rugby).venueId).toBe('san-carlos');
  });

  it('los nombres exactos siguen calzando', () => {
    expect(resolverLugar('Old Grangonian Club', rugby).venueId).toBe('ogc');
    expect(resolverLugar('Polideportivo Estadio Nacional', rugby).venueId).toBe('poli-en');
    expect(resolverLugar('Cenco Costanera', rugby).venueId).toBe('cenco');
    expect(resolverLugar('Hotel Torremayor', rugby).hotelId).toBe('torremayor');
  });

  it('lo que no es un lugar queda sin enlace', () => {
    for (const texto of ['x confirmar', 'Hotel por confirmar', 'Por confirmar', 'Aeropuerto Internacional Arturo Merino Benítez', 'Chile']) {
      expect(resolverLugar(texto, rugby).nombre).toBeNull();
    }
  });

  it('"Hotel Sheraton" con dos Sheraton en el catálogo no adivina', () => {
    const dos = [...rugby, hotel('Hotel Sheraton Miramar', 'miramar')];
    expect(resolverLugar('Hotel Sheraton', dos).hotelId).toBeNull();
  });
});
