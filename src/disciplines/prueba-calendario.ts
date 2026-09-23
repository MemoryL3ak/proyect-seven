/**
 * Fila de core.sports_calendar_events que refleja una prueba. Está aparte del
 * servicio para poder probarla sin Supabase: es la única pieza con lógica.
 */
export type PruebaRow = {
  id: string;
  name: string;
  event_id?: string | null;
  category?: string | null;
  gender?: string | null;
  parent_id?: string | null;
  scheduled_at?: string | null;
  venue_name?: string | null;
  delegation_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type DelegacionNombre = { id: string; nombre: string };

export function calendarExternalId(disciplineId: string): string {
  return `prueba:${disciplineId}`;
}

/**
 * @param delegaciones nombres de las delegaciones que participan, en el orden
 * de `row.delegation_ids`: las dos primeras van como equipos del evento y
 * todas quedan en `delegation_ids`, que es por donde el Jefe de Misión ve sólo
 * lo de su región.
 */
export function filaCalendarioDePrueba(
  row: PruebaRow,
  parentName: string | null,
  delegaciones: DelegacionNombre[],
) {
  const ids = row.delegation_ids ?? [];
  const nombres = ids
    .map((id) => delegaciones.find((d) => d.id === id)?.nombre ?? null)
    .filter((n): n is string => Boolean(n));
  return {
    event_id: row.event_id ?? null,
    sport: parentName || 'Prueba',
    league: 'Pruebas',
    home_team: nombres[0] ?? null,
    away_team: nombres[1] ?? null,
    venue: row.venue_name ?? null,
    start_at_utc: row.scheduled_at,
    status: 'SCHEDULED',
    external_id: calendarExternalId(row.id),
    source: 'PRUEBAS',
    delegation_ids: ids,
    metadata: {
      ...(row.metadata ?? {}),
      title: `🏁 ${row.name}`,
      scheduleType: 'COMPETITION',
      disciplineId: row.id,
      parentDisciplineId: row.parent_id ?? null,
      category: row.category ?? null,
      gender: row.gender ?? null,
      delegationNames: nombres,
    },
  };
}
