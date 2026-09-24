import { horaEvento } from "./hora-evento";

/**
 * Cuándo puede el conductor iniciar un viaje: desde una hora antes de la
 * hora programada, no antes. Regla de Ariel del 24-09-2026; antes el botón
 * "Iniciar" estaba siempre disponible y hubo viajes de la tarde iniciados
 * en la mañana por error. El API aplica la misma regla
 * (src/trips/inicio-anticipado.ts).
 */
export const VENTANA_INICIO_MIN = 60;

export type PermisoInicio = {
  permitido: boolean;
  /** Desde cuándo se puede iniciar; null si el viaje no tiene hora. */
  desde: Date | null;
  /** "09:30", para el botón y el aviso. */
  desdeTexto: string;
};

export function permisoDeInicio(
  scheduledAt: string | Date | null | undefined,
  ahora: Date = new Date(),
  ventanaMin = VENTANA_INICIO_MIN,
): PermisoInicio {
  if (!scheduledAt) return { permitido: true, desde: null, desdeTexto: "" };
  const hora = new Date(scheduledAt);
  if (Number.isNaN(hora.getTime())) return { permitido: true, desde: null, desdeTexto: "" };
  const desde = new Date(hora.getTime() - ventanaMin * 60_000);
  return { permitido: ahora.getTime() >= desde.getTime(), desde, desdeTexto: horaEvento(desde) };
}
