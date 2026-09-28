/**
 * ¿El formulario completa aerolínea y origen al escribir un número de vuelo?
 *
 * En Participantes, Delegaciones y Vuelos "origen" es la ciudad de donde
 * viene el vuelo, y sí se completa. En Viajes no: ahí "origen" es el lugar de
 * recogida del conductor. 28-09-2026: al abrir el Transfer In de Sergio
 * Alvarenga para cambiar el vehículo, la búsqueda del LA1324 cambió el origen
 * del viaje de "Aeropuerto…" a "Asunción, PY", y así se guardó.
 */
export function autocompletaConVuelo(endpoint: string): boolean {
  return endpoint !== "/trips";
}
