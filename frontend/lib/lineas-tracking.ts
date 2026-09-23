/**
 * Qué líneas van al mapa de tracking en vivo.
 *
 * Con la ruta de Google y el rastro GPS de todos los conductores dibujados a
 * la vez, el mapa era una maraña de trazos y no se distinguía nada. Ahora sin
 * selección no hay líneas; al elegir un conductor van sólo las suyas.
 *
 * Las claves: la ruta y el destino llevan el id del viaje (o `driver-<id>` si
 * el conductor no va en ninguno); el rastro lleva esa misma base más `#n`,
 * un tramo por cada trozo continuo de GPS.
 */
type ConTripId = { tripId: string };

export function baseDeRastro(tripId: string): string {
  const corte = tripId.indexOf("#");
  return corte === -1 ? tripId : tripId.slice(0, corte);
}

export function lineasDelSeleccionado<R extends ConTripId, T extends ConTripId, D extends ConTripId>(
  seleccionado: string | null | undefined,
  rutas: R[],
  rastros: T[],
  destinos: D[],
): { rutasEnMapa: R[]; rastrosEnMapa: T[]; destinosEnMapa: D[] } {
  if (!seleccionado) return { rutasEnMapa: [], rastrosEnMapa: [], destinosEnMapa: [] };
  return {
    rutasEnMapa: rutas.filter((r) => r.tripId === seleccionado),
    rastrosEnMapa: rastros.filter((t) => baseDeRastro(t.tripId) === seleccionado),
    destinosEnMapa: destinos.filter((d) => d.tripId === seleccionado),
  };
}
