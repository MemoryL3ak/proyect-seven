import { claveDiaEvento } from "@/lib/hora-evento";

/**
 * Día de un vuelo para rastrearlo (30-09-2026). Se pedía con la fecha en UTC
 * (`toISOString().slice(0, 10)`): el CM497 que aterriza el 29-09 a las 23:39
 * en Santiago son las 02:39 del 30 en UTC, así que el rastreo mostraba el
 * vuelo del 30 ("Programado") en vez del que ya había llegado. El día va en
 * la hora del evento (Santiago), que es la hora local del aeropuerto.
 */
export const fechaDelVuelo = (horaLlegada?: string | null): string => (horaLlegada ? claveDiaEvento(horaLlegada) : "");

/** Consulta de rastreo: número de vuelo y, si se sabe, su día. */
export function consultaRastreo(numeroVuelo: string, horaLlegada?: string | null): string {
  const dia = fechaDelVuelo(horaLlegada);
  return `/flights/track?flightNumber=${encodeURIComponent(numeroVuelo)}${dia ? `&flightDate=${dia}` : ""}`;
}
