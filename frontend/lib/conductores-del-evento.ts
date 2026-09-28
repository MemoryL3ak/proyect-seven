/**
 * Conductores y proveedores del evento (28-09-2026). Los proveedores quedaron
 * asociados a los eventos en que trabajan: /providers trae `eventIds`, cada
 * conductor de proveedor trae los eventos de su proveedor (`eventIds`) y los
 * de la flota propia su `eventId`. Hasta ahora cada desplegable de conductor
 * ofrecía los 80 de los Juegos Escolares aunque se trabajara en World Rugby.
 *
 * Sólo para las listas donde alguien ELIGE: los mapas id → nombre no se
 * filtran, o un viaje ya asignado se quedaría sin el nombre de su conductor.
 */

export type ConEventos = { eventIds?: string[] | null; eventId?: string | null };

/**
 * ¿El conductor trabaja en el evento? Sin evento no se filtra. Un conductor
 * sin datos de evento (proveedor sin eventos, registro antiguo) se conserva:
 * mejor que sobre a que falte uno que sí trabaja.
 */
export function conductorEnEvento(driver: ConEventos | null | undefined, eventoId: string | null | undefined): boolean {
  if (!eventoId) return true;
  if (!driver) return true;
  if (Array.isArray(driver.eventIds) && driver.eventIds.length > 0) return driver.eventIds.includes(eventoId);
  if (driver.eventId) return driver.eventId === eventoId;
  return true;
}

/**
 * ¿Sale el conductor en el tracking en vivo del evento elegido? Sí si trabaja
 * en el evento o si va en un viaje del evento (aunque su proveedor sea de
 * otro). 28-09-2026: con World Rugby elegido, el mapa mostraba a los seis
 * conductores de Valparaíso conectados a los Juegos Escolares.
 */
export function conductorEnTracking(
  driver: ConEventos | null | undefined,
  eventoId: string | null | undefined,
  conViajeDelEvento: boolean,
): boolean {
  return conViajeDelEvento || conductorEnEvento(driver, eventoId);
}

/** ¿El proveedor trabaja en el evento? Sin eventos asociados vale para todos. */
export function proveedorEnEvento(
  provider: { eventIds?: string[] | null } | null | undefined,
  eventoId: string | null | undefined,
): boolean {
  if (!eventoId) return true;
  if (!provider) return true;
  if (Array.isArray(provider.eventIds) && provider.eventIds.length > 0) return provider.eventIds.includes(eventoId);
  return true;
}
