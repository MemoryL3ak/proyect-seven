/**
 * Hora del tramo de regreso de un viaje de ida y vuelta, para el campo
 * "Fecha hora regreso" del editor.
 *
 * No es una columna del viaje: el regreso es otro registro (`childTrips`,
 * tramo RETURN) cuya `scheduledAt` es la hora buscada. La planilla de
 * operatividad además deja `returnAt` en la ida; sirve de respaldo cuando el
 * tramo de regreso no vino anidado.
 */
export type ViajeConRegreso = {
  returnAt?: string | Date | null;
  childTrips?: Array<{
    legType?: string | null;
    scheduledAt?: string | Date | null;
  }> | null;
};

export function horaRegresoDeViaje(viaje: ViajeConRegreso | null | undefined): string | Date | null {
  if (!viaje) return null;
  const tramos = Array.isArray(viaje.childTrips) ? viaje.childTrips : [];
  const regreso = tramos.find((t) => t.legType === "RETURN") ?? tramos[0];
  if (regreso?.scheduledAt) return regreso.scheduledAt;
  return viaje.returnAt ?? null;
}
