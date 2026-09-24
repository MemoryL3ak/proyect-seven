import { claveDiaEvento } from "./hora-evento";

/**
 * Historial de viajes del panel (pestaña Historial de Viajes): los cerrados
 * se pueden mirar por jornada. Pedido de Ariel del 23-09-2026: "hoy es 23,
 * tener filtro de los del 22".
 *
 * La jornada de un viaje cerrado es su día programado, igual que en el filtro
 * "Jornada" de En curso; si no tiene hora programada, el día en que se cerró.
 * Los días se cuentan en la zona del evento (America/Santiago).
 */
export const SIN_FECHA = "sin-fecha";

export type ViajeCerrado = {
  scheduledAt?: string | Date | null;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export const jornadaDeCierre = (v: ViajeCerrado): string =>
  claveDiaEvento(v.scheduledAt ?? v.completedAt ?? v.updatedAt) || SIN_FECHA;

const marcaDeCierre = (v: ViajeCerrado): number => {
  const t = new Date((v.completedAt ?? v.updatedAt ?? v.scheduledAt ?? 0) as string | Date).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Jornadas presentes en el historial, de la más reciente a la más antigua, con su cuenta. */
export function jornadasDelHistorial(viajes: readonly ViajeCerrado[]): { key: string; count: number }[] {
  const porDia = new Map<string, number>();
  for (const v of viajes) {
    const k = jornadaDeCierre(v);
    porDia.set(k, (porDia.get(k) ?? 0) + 1);
  }
  return [...porDia.entries()]
    .sort((a, b) => (a[0] === SIN_FECHA ? 1 : b[0] === SIN_FECHA ? -1 : b[0].localeCompare(a[0])))
    .map(([key, count]) => ({ key, count }));
}

/** Los cerrados de una jornada ("" = todas), del cierre más reciente al más antiguo. */
export function historialDeJornada<T extends ViajeCerrado>(viajes: readonly T[], jornada: string): T[] {
  const lista = jornada ? viajes.filter((v) => jornadaDeCierre(v) === jornada) : [...viajes];
  return lista.sort((a, b) => marcaDeCierre(b) - marcaDeCierre(a));
}
