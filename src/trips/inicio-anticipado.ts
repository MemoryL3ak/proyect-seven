/**
 * El conductor puede iniciar un viaje desde una hora antes de su hora
 * programada, no antes (Ariel, 24-09-2026). La app deshabilita el botón
 * (frontend/lib/inicio-viaje.ts) y el API rechaza el cambio de estado
 * aunque venga por otra vía. Si cambia acá, cambia allá.
 */
export const VENTANA_INICIO_MIN = 60;

const EN_MARCHA = new Set(['EN_ROUTE', 'PICKED_UP']);
const SIN_INICIAR = new Set([
  'SCHEDULED',
  'REQUESTED',
  'CONFIRMED',
  'ASSIGNED',
]);

const HORA_CHILE = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Motivo por el que no se puede iniciar todavía, o null si se puede. Sólo
 * aplica a un viaje sin iniciar que pasa a en marcha; el resto de cambios
 * (cerrar, devolver a programado, editar) no se toca.
 */
export function motivoInicioAnticipado(
  estadoActual: string | null | undefined,
  estadoNuevo: string | null | undefined,
  scheduledAt: Date | string | null | undefined,
  ahora: Date = new Date(),
  ventanaMin = VENTANA_INICIO_MIN,
): string | null {
  if (!estadoNuevo || !EN_MARCHA.has(estadoNuevo)) return null;
  if (!SIN_INICIAR.has(estadoActual ?? '')) return null;
  if (!scheduledAt) return null;
  const hora =
    scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(hora.getTime())) return null;
  const desde = new Date(hora.getTime() - ventanaMin * 60_000);
  if (ahora.getTime() >= desde.getTime()) return null;
  return `El viaje se puede iniciar desde las ${HORA_CHILE.format(desde)} (una hora antes de la hora programada).`;
}
