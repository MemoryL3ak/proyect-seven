/**
 * Estado de un vuelo en el Monitoreo de Llegadas (28-09-2026). Lo calcula la
 * pantalla, no la API de vuelos: la API sólo se consulta al tocar "Rastrear".
 *
 * Antes un vuelo de hoy decía "Hoy" todo el día, aunque ya hubiera
 * aterrizado: el LA1324 de Sergio Alvarenga (14:15) seguía en "Hoy" a las
 * 15:45, con el pasajero ya recogido. Ahora:
 *  - Arribado: pasó la hora de llegada, o el conductor ya recogió a alguno
 *    de sus pasajeros (aterrizó antes de hora).
 *  - Hoy: llega hoy y todavía no.
 *  - Programado: llega otro día.
 */
import { claveDiaEvento } from "@/lib/hora-evento";

export type EstadoVuelo = "ARRIBADO" | "HOY" | "PROGRAMADO";

const RECOGIDO = new Set(["PICKED_UP", "DROPPED_OFF", "COMPLETED"]);

export function estadoVuelo(
  llegada: string | null | undefined,
  ahora: Date,
  estadosTraslado: Array<string | null | undefined> = [],
): EstadoVuelo {
  if (estadosTraslado.some((s) => RECOGIDO.has(String(s ?? "").toUpperCase()))) return "ARRIBADO";
  if (!llegada) return "PROGRAMADO";
  const t = new Date(llegada).getTime();
  if (Number.isFinite(t) && t <= ahora.getTime()) return "ARRIBADO";
  return claveDiaEvento(llegada) === claveDiaEvento(ahora) ? "HOY" : "PROGRAMADO";
}
