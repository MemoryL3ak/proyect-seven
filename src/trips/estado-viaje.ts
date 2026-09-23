/**
 * Un viaje que vuelve a Programado o Solicitado deja de haber empezado: hay
 * que borrar inicio y cierre. Antes el retroceso sólo cambiaba el estado y
 * `started_at` / `completed_at` quedaban con la hora del inicio equivocado,
 * y el control de jornada contaba desde ahí.
 */
const SIN_INICIAR = new Set(['SCHEDULED', 'REQUESTED']);

export function retrocedeASinIniciar(
  estadoAnterior: string | null | undefined,
  estadoNuevo: string | null | undefined,
): boolean {
  if (!estadoNuevo || estadoNuevo === estadoAnterior) return false;
  return SIN_INICIAR.has(estadoNuevo) && !SIN_INICIAR.has(estadoAnterior ?? '');
}
