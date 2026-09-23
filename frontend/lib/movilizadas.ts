/**
 * Estados en los que el viaje ya movió gente: alguien subió al vehículo o el
 * traslado terminó. Un viaje programado, en cola o cancelado todavía no
 * movilizó a nadie.
 */
const ESTADOS_MOVILIZADOS = new Set(["PICKED_UP", "DROPPED_OFF", "COMPLETED"]);

type ViajeConPasajeros = { status?: string | null; passengerCount?: number | null };

/**
 * Personas movilizadas: suma de pasajeros de los viajes que ya recogieron o
 * dejaron a su gente. Antes se sumaban todos los viajes del filtro, y con
 * cientos de traslados programados la ficha mostraba miles de personas
 * "movilizadas" sin que hubiera salido ningún vehículo.
 */
export function personasMovilizadas(viajes: ViajeConPasajeros[]): number {
  return viajes.reduce(
    (total, viaje) =>
      ESTADOS_MOVILIZADOS.has(viaje.status || "") ? total + (viaje.passengerCount || 0) : total,
    0,
  );
}
