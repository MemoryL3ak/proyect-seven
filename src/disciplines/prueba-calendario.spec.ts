import { filaCalendarioDePrueba } from './prueba-calendario';

const partido = {
  id: 'p1',
  name: 'Fecha 1 · P1 · Grupo A · Maule vs Coquimbo',
  event_id: 'ev',
  category: 'CONVENTIONAL',
  gender: 'FEMALE',
  parent_id: 'futsal-f',
  scheduled_at: '2026-09-23T12:00:00.000Z',
  venue_name: 'Gimnasio Universidad Viña del Mar',
  delegation_ids: ['maule', 'coquimbo'],
  metadata: { matchNumber: 1, group: 'A', hotelDepartureAt: '2026-09-23T10:45:00.000Z' },
};
const delegaciones = [
  { id: 'coquimbo', nombre: 'Región de Coquimbo' },
  { id: 'maule', nombre: 'Región del Maule' },
];

describe('filaCalendarioDePrueba', () => {
  it('un partido lleva las dos regiones como equipos y en delegation_ids, en el orden de la prueba', () => {
    const fila = filaCalendarioDePrueba(partido, 'Futsal', delegaciones);
    expect(fila).toMatchObject({
      sport: 'Futsal',
      league: 'Pruebas',
      home_team: 'Región del Maule',
      away_team: 'Región de Coquimbo',
      venue: 'Gimnasio Universidad Viña del Mar',
      start_at_utc: '2026-09-23T12:00:00.000Z',
      external_id: 'prueba:p1',
      source: 'PRUEBAS',
      delegation_ids: ['maule', 'coquimbo'],
    });
    // Lo que trae la programación oficial (partido, grupo, salida del hotel)
    // se conserva junto a lo que ya se guardaba.
    expect(fila.metadata).toMatchObject({
      matchNumber: 1,
      group: 'A',
      hotelDepartureAt: '2026-09-23T10:45:00.000Z',
      title: '🏁 Fecha 1 · P1 · Grupo A · Maule vs Coquimbo',
      scheduleType: 'COMPETITION',
      disciplineId: 'p1',
      parentDisciplineId: 'futsal-f',
      gender: 'FEMALE',
      delegationNames: ['Región del Maule', 'Región de Coquimbo'],
    });
  });

  it('una prueba sin delegaciones sigue siendo general: sin equipos y delegation_ids vacío', () => {
    const fila = filaCalendarioDePrueba(
      { ...partido, delegation_ids: null, metadata: null, name: '80 m planos' },
      'Atletismo',
      delegaciones,
    );
    expect(fila.home_team).toBeNull();
    expect(fila.away_team).toBeNull();
    expect(fila.delegation_ids).toEqual([]);
    expect(fila.metadata.delegationNames).toEqual([]);
    expect(fila.metadata.title).toBe('🏁 80 m planos');
  });

  it('una delegación que ya no existe no rompe la fila', () => {
    const fila = filaCalendarioDePrueba({ ...partido, delegation_ids: ['maule', 'borrada'] }, 'Futsal', delegaciones);
    expect(fila.home_team).toBe('Región del Maule');
    expect(fila.away_team).toBeNull();
    expect(fila.delegation_ids).toEqual(['maule', 'borrada']);
  });
});
