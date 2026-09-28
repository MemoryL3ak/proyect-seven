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
