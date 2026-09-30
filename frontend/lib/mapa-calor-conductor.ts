import { horaEvento } from "@/lib/hora-evento";

/**
 * Mapa de calor de conductores (30-09-2026): "que aparezca la hora real del
 * traslado para visualizar mejor choques de horario". Cada casilla decía sólo
 * cuántos viajes había en esa hora ("1") y el detalle, "10:00": la hora de la
 * columna, no la del viaje.
 */

export type ViajeDelMapa = {
  id: string;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  travelTimeMinutes?: number | null;
};

/** Sin tiempo de viaje cargado ni viaje terminado, se supone esto. */
export const DURACION_SUPUESTA_MIN = 60;

const inicio = (v: ViajeDelMapa) => v.scheduledAt || v.startedAt || null;

/** "10:20" en hora del evento. */
export const horaDelViaje = (v: ViajeDelMapa) => horaEvento(inicio(v), "");

/** Columna del mapa (hora 0-23 en hora del evento, no del navegador). */
export function columnaDelViaje(v: ViajeDelMapa): number | null {
  const h = horaDelViaje(v);
  return h ? Number(h.slice(0, 2)) : null;
}

/** Minutos que ocupa el viaje: el tiempo cargado, el real si terminó, o el supuesto. */
export function duracionDelViaje(v: ViajeDelMapa): number {
  if (v.travelTimeMinutes && v.travelTimeMinutes > 0) return v.travelTimeMinutes;
  if (v.startedAt && v.completedAt) {
    const real = (new Date(v.completedAt).getTime() - new Date(v.startedAt).getTime()) / 60000;
    if (real > 0) return real;
  }
  return DURACION_SUPUESTA_MIN;
}

/**
 * Choques de un conductor: un viaje que empieza antes de que termine otro.
 * Devuelve, por viaje, las horas de los viajes con que choca. Los cancelados
 * no cuentan.
 */
export function choquesDelConductor(viajes: ViajeDelMapa[]): Map<string, string[]> {
  const vivos = viajes
    .filter((v) => inicio(v) && v.status !== "CANCELLED")
    .map((v) => {
      const desde = new Date(inicio(v)!).getTime();
      return { v, desde, hasta: desde + duracionDelViaje(v) * 60000 };
    })
    .sort((a, b) => a.desde - b.desde);
  const choques = new Map<string, string[]>();
  const anotar = (id: string, hora: string) => choques.set(id, [...(choques.get(id) ?? []), hora]);
  for (let i = 0; i < vivos.length; i += 1) {
    for (let j = i + 1; j < vivos.length && vivos[j].desde < vivos[i].hasta; j += 1) {
      anotar(vivos[i].v.id, horaDelViaje(vivos[j].v));
      anotar(vivos[j].v.id, horaDelViaje(vivos[i].v));
    }
  }
  return choques;
}
