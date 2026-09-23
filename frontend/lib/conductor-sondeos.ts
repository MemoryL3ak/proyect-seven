/**
 * Sondeos periódicos del portal del conductor: qué se pide, cuándo y cuándo
 * no hace falta. Todo lo que corre en un temporizador dentro del teléfono
 * pasa por acá, para que se pueda medir sin abrir la pantalla.
 */

/** Cada cuánto se consulta si llegó una calificación nueva. */
export const SONDEO_CALIFICACIONES_MS = 60_000;
/** Sólo viajes cerrados en este lapso: los de días anteriores ya no van a cambiar. */
export const VENTANA_CALIFICACION_MS = 24 * 60 * 60 * 1000;
/**
 * Tope por petición periódica. Sin tope, con señal mala cada petición queda
 * colgada minutos y las siguientes se apilan encima.
 */
export const TIMEOUT_SONDEO_MS = 15_000;

export type ViajeCalificable = {
  id: string;
  status?: string | null;
  driverRating?: number | null;
  completedAt?: string | null;
  startedAt?: string | null;
};

/**
 * Ids de viajes cuya calificación vale la pena consultar: cerrados hace
 * menos de un día, sin calificación y no consultados ya con éxito. Antes se
 * consultaban TODOS los cerrados del conductor, uno por uno, cada 8 s.
 */
export function viajesPorCalificar(
  trips: ViajeCalificable[],
  yaCalificados: Set<string>,
  ahora: number,
  ventanaMs = VENTANA_CALIFICACION_MS,
): string[] {
  return trips
    .filter((t) => ["COMPLETED", "DROPPED_OFF"].includes(t.status ?? ""))
    .filter((t) => !t.driverRating && !yaCalificados.has(t.id))
    .filter((t) => {
      const cierre = new Date(t.completedAt ?? t.startedAt ?? "").getTime();
      return Number.isFinite(cierre) && ahora - cierre <= ventanaMs;
    })
    .map((t) => t.id);
}

export type EstadoRastreoShell = { running?: boolean; backgroundOk?: boolean } | null | undefined;

/**
 * Si el portal web tiene que mandar GPS por su cuenta. Dentro de la app, con
 * el rastreo del shell andando y permiso de segundo plano, ya sale un fijo
 * cada 3 s por la vía nativa: mandarlo también desde la web duplica las
 * peticiones del teléfono (el servidor descarta el duplicado igual).
 */
export function gpsWebNecesario(shell: EstadoRastreoShell, dentroDeLaApp: boolean): boolean {
  if (!dentroDeLaApp) return true;
  return !(shell?.running === true && shell.backgroundOk === true);
}

/** Señal de corte para una petición periódica; sin soporte del navegador, ninguna. */
export function senalDeCorte(ms = TIMEOUT_SONDEO_MS): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined;
  } catch {
    return undefined;
  }
}
