/**
 * Filtro "Por realizar" de los traslados del portal (Jefe de Misión y
 * Comité). Es lo que queda por hacer desde la hora actual hacia adelante:
 * los programados cuya hora ya pasó y nadie inició salen de la vista apenas
 * pasa la hora (siguen en "Todos"), y los que van andando se quedan aunque
 * hayan salido tarde.
 */
export const ESTADOS_ACTIVOS = new Set(["SCHEDULED", "REQUESTED", "EN_ROUTE", "PICKED_UP"]);
export const ESTADOS_EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);

export type TrasladoPendiente = {
  status?: string | null;
  scheduledAt?: string | null;
};

const estadoDe = (tr: TrasladoPendiente) => String(tr.status ?? "").trim().toUpperCase();

export function esEnCurso(tr: TrasladoPendiente): boolean {
  return ESTADOS_EN_CURSO.has(estadoDe(tr));
}

/** Activo por estado, sin mirar la hora (lo que era "Por realizar" antes). */
export function esActivo(tr: TrasladoPendiente): boolean {
  return ESTADOS_ACTIVOS.has(estadoDe(tr));
}

/**
 * Por realizar a la hora `ahora` (ms): activo y con hora igual o posterior a
 * ahora, o en curso. Un traslado sin hora se deja ver: no hay con qué
 * descartarlo.
 */
export function esPorRealizar(tr: TrasladoPendiente, ahora: number): boolean {
  if (!esActivo(tr)) return false;
  if (esEnCurso(tr)) return true;
  if (!tr.scheduledAt) return true;
  const hora = new Date(tr.scheduledAt).getTime();
  if (Number.isNaN(hora)) return true;
  return hora >= ahora;
}
