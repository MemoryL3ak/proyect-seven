/**
 * Inicio de la jornada de un conductor: el primer viaje iniciado del día.
 *
 * Sólo cuenta un viaje que de verdad está o estuvo en marcha. Un viaje que
 * volvió a Programado conserva `startedAt` de cuando se inició por error (el
 * 22-09 un conductor pasó dos viajes de Programado a Completado en un minuto
 * y el panel los devolvió a Programado), y ese dato viejo arrancaba el reloj
 * de 13 h desde la tarde anterior.
 *
 * Un viaje en marcha o cerrado SIN `startedAt` también cuenta: hasta el
 * 23-09 el portal sólo marcaba el inicio al subir el pasajero, así que un
 * viaje "En ruta" no tenía inicio y el conductor figuraba "Sin iniciar" con
 * el bus andando. Para esos se toma la mejor marca que haya: cierre, última
 * modificación o, si no hay otra, la hora programada.
 */
const SIN_INICIAR = new Set(["SCHEDULED", "REQUESTED", "CANCELLED"]);

export type ViajeJornada = {
  status?: string | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  scheduledAt?: string | Date | null;
};

const fecha = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Inicio de un viaje en marcha o cerrado; sin `startedAt`, la marca más temprana disponible. */
export function inicioDeViaje(v: ViajeJornada): Date | null {
  const directo = fecha(v.startedAt);
  if (directo) return directo;
  const candidatos = [fecha(v.completedAt), fecha(v.updatedAt), fecha(v.scheduledAt)].filter(
    (d): d is Date => !!d,
  );
  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) => a.getTime() - b.getTime())[0];
}

/** Fechas de inicio válidas, de la más antigua a la más nueva. */
export function iniciosDeJornada(viajes: ViajeJornada[]): Date[] {
  return viajes
    .filter((v) => !SIN_INICIAR.has(v.status ?? ""))
    .map(inicioDeViaje)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function inicioDeJornada(viajes: ViajeJornada[]): Date | null {
  return iniciosDeJornada(viajes)[0] ?? null;
}
