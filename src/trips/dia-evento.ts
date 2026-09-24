/**
 * Día operativo (YYYY-MM-DD en hora de Chile) de una fecha. `trip_date`
 * agrupa Operatividad Diaria, el panel financiero y las horas extra, así
 * que tiene que decir lo mismo que `scheduled_at`: el 24-09-2026 un viaje
 * editado quedó con trip_date en 2025 y desapareció de su día.
 */
export const ZONA_EVENTO = 'America/Santiago';

const FORMATO = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_EVENTO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function diaEvento(
  valor: Date | string | null | undefined,
): string | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return FORMATO.format(d);
}
