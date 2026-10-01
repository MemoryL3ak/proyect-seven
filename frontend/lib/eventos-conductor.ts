/**
 * Eventos en que trabaja un conductor: los de su proveedor (/drivers trae
 * `eventIds`) o, en la flota propia, su `eventId`. 28-09-2026: la app del
 * conductor de World Rugby mostraba las sedes, hoteles y documentos de los
 * Juegos Escolares.
 */
export type ConductorConEventos =
  | { eventIds?: string[] | null; eventId?: string | null }
  | null
  | undefined;

export function eventosDelConductor(conductor: ConductorConEventos): string[] {
  const lista = conductor?.eventIds;
  const ids = Array.isArray(lista) ? lista.filter(Boolean) : [];
  if (ids.length) return ids;
  return conductor?.eventId ? [conductor.eventId] : [];
}

/**
 * ¿La sede, hotel o documento es de un evento del conductor? Sin eventos
 * conocidos no se filtra (mejor ver de más que no ver su hotel), y lo que no
 * es de ningún evento (documentos generales) se ve siempre.
 */
export function enEventosDelConductor(
  eventos: string[],
  filaEventId: string | null | undefined,
): boolean {
  if (eventos.length === 0) return true;
  if (!filaEventId) return true;
  return eventos.includes(filaEventId);
}

/**
 * Eventos entre los que elige un conductor que trabaja en más de uno
 * (28-09-2026, pedido de Ariel: "en el caso de que se repita, que tenga un
 * filtro de evento"). Sólo cuentan los eventos donde tiene viajes no
 * cancelados: su proveedor puede estar en dos eventos (Alex Arévalo, en JDE
 * y Rugby) y eso le ponía el selector a choferes que manejan en uno solo
 * (30-09-2026: "si un conductor está asociado a un solo evento, que no
 * figure el selector"). Van primero los de su proveedor, después los de sus
 * viajes, sin repetir. Con uno solo no hay nada que elegir.
 */
export function eventosParaFiltro(
  eventosConductor: string[],
  viajes: Array<{ eventId?: string | null; status?: string | null }>,
): string[] {
  const conViajes = new Set(
    viajes
      .filter((v) => v.eventId && String(v.status ?? "").toUpperCase() !== "CANCELLED")
      .map((v) => v.eventId as string),
  );
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const id of [...eventosConductor, ...viajes.map((v) => v.eventId ?? "")]) {
    if (!id || vistos.has(id) || !conViajes.has(id)) continue;
    vistos.add(id);
    lista.push(id);
  }
  return lista;
}

/**
 * ¿Se ve la fila con el evento elegido? Sin elegir ("") se ve lo de todos sus
 * eventos, como hasta ahora. Una fila sin evento (documento general) se ve
 * siempre.
 */
export function enEventoElegido(
  elegido: string,
  eventosConductor: string[],
  filaEventId: string | null | undefined,
): boolean {
  if (!elegido) return enEventosDelConductor(eventosConductor, filaEventId);
  return !filaEventId || filaEventId === elegido;
}

/** Sus viajes del evento elegido ("" = todos sus viajes). */
export function viajesDelEventoElegido<T extends { eventId?: string | null }>(viajes: T[], elegido: string): T[] {
  return elegido ? viajes.filter((v) => v.eventId === elegido) : viajes;
}
