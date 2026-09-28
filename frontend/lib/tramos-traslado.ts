/**
 * Llegada y salida de un traslado de aeropuerto (28-09-2026). Desde ese día
 * AND crea UN viaje "Transfer In Out" por persona: la llegada es el viaje y
 * la salida su tramo de regreso, que /trips entrega anidado en `childTrips`.
 * Los monitores de llegadas y salidas, la línea de tiempo y la app del
 * conductor necesitan cada tramo por separado y saber cuál es cuál; también
 * reconocen los Transfer In y Transfer Out sueltos de antes.
 */
export type TramoTraslado = {
  id: string;
  tripType?: string | null;
  legType?: string | null;
  parentTripId?: string | null;
  metadata?: Record<string, unknown> | null;
  childTrips?: TramoTraslado[] | null;
};

/** Cada viaje y sus tramos de regreso, en una sola lista y sin repetir. */
export function aplanarTramos<T extends { id: string; childTrips?: T[] | null }>(viajes: T[]): T[] {
  const vistos = new Set<string>();
  const salida: T[] = [];
  for (const viaje of viajes) {
    for (const tramo of [viaje, ...(viaje.childTrips ?? [])]) {
      if (vistos.has(tramo.id)) continue;
      vistos.add(tramo.id);
      salida.push(tramo);
    }
  }
  return salida;
}

export type SentidoTraslado = "LLEGADA" | "SALIDA";

/** ¿El tramo recoge en el aeropuerto (llegada) o lleva al aeropuerto (salida)? */
export function sentidoTraslado(tramo: Omit<TramoTraslado, "id" | "childTrips">): SentidoTraslado | null {
  const tipo = String(tramo.tripType ?? "").toUpperCase();
  if (tipo === "TRANSFER_IN") return "LLEGADA";
  if (tipo === "TRANSFER_OUT") return "SALIDA";
  if (tipo !== "TRANSFER_IN_OUT") return null;
  const clave = typeof tramo.metadata?.andKey === "string" ? tramo.metadata.andKey : "";
  if (clave.endsWith(":LLEGADA")) return "LLEGADA";
  if (clave.endsWith(":SALIDA")) return "SALIDA";
  // Transfer In Out cargado a mano: la ida es la llegada y el regreso la salida.
  return String(tramo.legType ?? "").toUpperCase() === "RETURN" || tramo.parentTripId ? "SALIDA" : "LLEGADA";
}

export const esLlegada = (tramo: Omit<TramoTraslado, "id" | "childTrips">) => sentidoTraslado(tramo) === "LLEGADA";
export const esSalida = (tramo: Omit<TramoTraslado, "id" | "childTrips">) => sentidoTraslado(tramo) === "SALIDA";
