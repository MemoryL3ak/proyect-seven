import { LugarCatalogo, resolverLugar } from './lugar-por-nombre';

const sede = (nombre: string, venueId: string): LugarCatalogo => ({
  clave: nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim(),
  nombre,
  venueId,
  hotelId: null,
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
    const conHotel = [
      ...catalogo,
      {
        ...sede('Hippocampus Resort § Club', ''),
        venueId: null,
        hotelId: 'hippo',
      },
    ];
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
