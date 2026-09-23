/**
 * A dónde mandar al conductor cuando toca Waze o Google Maps.
 *
 * El portal mandaba el texto del viaje tal cual ("Hotel Diego de Almagro",
 * "Comedor LRH (EX GALA)") como búsqueda libre. Waze y Google resuelven ese
 * nombre por su cuenta: hay un Hotel Diego de Almagro en media docena de
 * ciudades, y un comedor con nombre interno no existe para ellos. El viaje
 * guarda el id de la sede, el hotel o el comedor, y esos tienen la dirección
 * con la que se registraron: esa dirección es la que se manda.
 */
export type LugarConDireccion = { id: string; name?: string | null; address?: string | null };

export type ViajeNavegable = {
  origin?: string | null;
  destination?: string | null;
  originVenueId?: string | null;
  destinationVenueId?: string | null;
  originHotelId?: string | null;
  destinationHotelId?: string | null;
  originFoodLocationId?: string | null;
  destinationFoodLocationId?: string | null;
  passengerLat?: number | null;
  passengerLng?: number | null;
};

export type CatalogosDeLugares = {
  venues?: LugarConDireccion[] | null;
  hoteles?: LugarConDireccion[] | null;
  comedores?: LugarConDireccion[] | null;
};

export type DestinoNavegacion = {
  /** Lo que se le pide al navegador: coordenadas "lat,lng" o una dirección. */
  consulta: string;
  /** Lo que se le muestra al conductor. */
  etiqueta: string;
  fuente: "coordenadas" | "direccion" | "texto";
};

const buscar = (lista: LugarConDireccion[] | null | undefined, id?: string | null) =>
  id ? (lista ?? []).find((l) => l.id === id) ?? null : null;

/**
 * Destino de un extremo del viaje. Al ir a recoger, si hay posición del
 * pasajero (solicitudes desde el portal) manda ella; si no, la dirección
 * registrada del lugar; y sólo si el viaje no apunta a ningún lugar del
 * catálogo, el texto escrito.
 */
export function destinoDeNavegacion(
  viaje: ViajeNavegable,
  extremo: "pickup" | "dropoff",
  catalogos: CatalogosDeLugares,
): DestinoNavegacion | null {
  const texto = (extremo === "pickup" ? viaje.origin : viaje.destination)?.trim() || "";
  if (extremo === "pickup" && typeof viaje.passengerLat === "number" && typeof viaje.passengerLng === "number") {
    return {
      consulta: `${viaje.passengerLat},${viaje.passengerLng}`,
      etiqueta: texto || "Punto de recogida (posición del pasajero)",
      fuente: "coordenadas",
    };
  }
  const lugar =
    extremo === "pickup"
      ? buscar(catalogos.venues, viaje.originVenueId) ??
        buscar(catalogos.hoteles, viaje.originHotelId) ??
        buscar(catalogos.comedores, viaje.originFoodLocationId)
      : buscar(catalogos.venues, viaje.destinationVenueId) ??
        buscar(catalogos.hoteles, viaje.destinationHotelId) ??
        buscar(catalogos.comedores, viaje.destinationFoodLocationId);
  const nombre = lugar?.name?.trim() || "";
  const direccion = lugar?.address?.trim() || "";
  if (direccion) {
    return { consulta: direccion, etiqueta: nombre || texto || direccion, fuente: "direccion" };
  }
  const libre = nombre || texto;
  if (!libre) return null;
  return { consulta: libre, etiqueta: libre, fuente: "texto" };
}

/** Enlaces de navegación para un destino ya resuelto. */
export function enlacesDeNavegacion(destino: DestinoNavegacion): { waze: string; gmaps: string } {
  if (destino.fuente === "coordenadas") {
    return {
      waze: `https://waze.com/ul?ll=${destino.consulta}&navigate=yes`,
      gmaps: `https://www.google.com/maps/dir/?api=1&destination=${destino.consulta}`,
    };
  }
  const q = encodeURIComponent(destino.consulta);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    gmaps: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}
