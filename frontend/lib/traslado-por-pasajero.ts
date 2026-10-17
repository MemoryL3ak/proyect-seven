/**
 * Qué traslado le toca a cada persona (16-10-2026). Un traslado de AND lleva
 * a todo un grupo: sus pasajeros van en `athleteIds` y sólo uno de ellos
 * figura como solicitante. Antes los monitores buscaban el viaje de cada
 * persona por el solicitante y al resto del grupo no les encontraban nada.
 */
export type ViajeConPasajeros = {
  requesterAthleteId?: string | null;
  athleteIds?: string[] | null;
};

/** El solicitante y los pasajeros, sin repetir. */
export function pasajerosDe(viaje: ViajeConPasajeros): string[] {
  const ids = new Set<string>();
  if (viaje.requesterAthleteId) ids.add(viaje.requesterAthleteId);
  for (const id of viaje.athleteIds ?? []) if (id) ids.add(id);
  return Array.from(ids);
}

/** Persona → su viaje (el primero de la lista, si tuviera más de uno). */
export function trasladoPorPasajero<T extends ViajeConPasajeros>(viajes: T[]): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const viaje of viajes) {
    for (const id of pasajerosDe(viaje)) {
      if (!mapa.has(id)) mapa.set(id, viaje);
    }
  }
  return mapa;
}
