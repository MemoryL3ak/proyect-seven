/**
 * Reglas de la tabla "Detalle de conductores" del Monitoreo (13-10-2026,
 * Ariel: "esta otra tabla también se debe customizar"). En Rugby no hay
 * regiones ni disciplinas y quedaban dos columnas de "—" que empujaban GPS
 * fuera de la pantalla; un conductor con 8 tipos de cliente dejaba la fila de
 * seis líneas.
 */
type ConductorFila = { delegationName?: string | null; disciplines?: string[] | null };

/** Encabezados de la tabla: Región y Disciplinas sólo si algún conductor las tiene; "Última conexión" va bajo Estado. */
export function columnasConductores(conductores: ConductorFila[], nombreRegion: string, esHoy: boolean): string[] {
  const conRegion = conductores.some((d) => Boolean(d.delegationName));
  const conDisciplinas = conductores.some((d) => (d.disciplines || []).length > 0);
  return [
    "Conductor",
    ...(conRegion ? [nombreRegion] : []),
    "Estado",
    "Ocupación",
    esHoy ? "Viajes hoy" : "Viajes del día",
    "Tipo cliente",
    ...(conDisciplinas ? ["Disciplinas"] : []),
    "Sesión",
    "GPS",
  ];
}

/** Las primeras etiquetas que se muestran y cuántas quedan para el "+N". */
export function etiquetasVisibles<T>(lista: T[] | null | undefined, max = 3): { visibles: T[]; resto: T[] } {
  const l = lista ?? [];
  return { visibles: l.slice(0, max), resto: l.slice(max) };
}
