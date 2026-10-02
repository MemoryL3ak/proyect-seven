/**
 * El viaje que el conductor tiene en curso y el paso que le falta.
 *
 * 02-10-2026, Juan Villegas (Android): "no le apareció el último paso". El
 * botón "Llegamos al destino" sólo existe dentro de la tarjeta abierta del
 * viaje, y la pantalla recién cargada no abría ninguna: al volver a la app
 * (o al reingresar porque otro teléfono le tomó la sesión) el viaje en curso
 * quedaba plegado. Sus latidos muestran la app a la vista de 08:35 a 08:43,
 * con sesión válida y el viaje en "Pasajero recogido", sin cerrarlo. Ahora el
 * viaje en curso queda abierto al cargar y el aviso "En viaje" dice cuál es
 * el paso que falta y lleva hasta el botón.
 */

export type ViajeEnCurso = {
  id: string;
  status?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
};

const EN_CURSO = new Set(["EN_ROUTE", "PICKED_UP"]);

/**
 * El viaje en curso de hoy: agendado hoy o iniciado hoy (un viaje de mañana
 * que el conductor ya arrancó sigue en curso). Uno que quedó abierto hace
 * días no cuenta: bloqueaba el inicio de todos los demás sin estar a la vista.
 * `diaDe` devuelve el día (YYYY-MM-DD) en la zona del evento.
 */
export function viajeEnCursoDeHoy<T extends ViajeEnCurso>(
  trips: T[],
  hoy: string,
  diaDe: (iso?: string | null) => string,
): T | null {
  return (
    trips.find((trip) => {
      if (!EN_CURSO.has(trip.status ?? "")) return false;
      if (!trip.scheduledAt && !trip.startedAt) return true;
      return diaDe(trip.scheduledAt) === hoy || diaDe(trip.startedAt) === hoy;
    }) ?? null
  );
}

/**
 * Texto del botón que le falta apretar al conductor en un viaje en curso, o
 * null si el viaje no está en curso. Son los mismos rótulos de la tarjeta.
 */
export function siguientePasoDelViaje(
  status: string | null | undefined,
  tipo: { disposicion?: boolean; solicitudPortal?: boolean } = {},
): string | null {
  if (!EN_CURSO.has(status ?? "")) return null;
  if (tipo.disposicion) return "Finalizar servicio";
  if (status === "EN_ROUTE") return "Pasajero recogido";
  return tipo.solicitudPortal ? "Finalizar viaje" : "Llegamos al destino";
}
