/**
 * Inicio de la jornada de un conductor: el primer viaje iniciado del día.
 *
 * Sólo cuenta un viaje que de verdad está o estuvo en marcha. Un viaje que
 * volvió a Programado conserva `startedAt` de cuando se inició por error (el
 * 22-09 un conductor pasó dos viajes de Programado a Completado en un minuto
 * y el panel los devolvió a Programado), y ese dato viejo arrancaba el reloj
 * de 13 h desde la tarde anterior.
 */
const SIN_INICIAR = new Set(["SCHEDULED", "REQUESTED", "CANCELLED"]);

export type ViajeJornada = {
  status?: string | null;
  startedAt?: string | Date | null;
};

/** Fechas de inicio válidas, de la más antigua a la más nueva. */
export function iniciosDeJornada(viajes: ViajeJornada[]): Date[] {
  return viajes
    .filter((v) => !SIN_INICIAR.has(v.status ?? ""))
    .map((v) => (v.startedAt ? new Date(v.startedAt) : null))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

export function inicioDeJornada(viajes: ViajeJornada[]): Date | null {
  return iniciosDeJornada(viajes)[0] ?? null;
}
