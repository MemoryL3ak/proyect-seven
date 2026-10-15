/**
 * Qué viajes recibe un conductor del portal en GET /trips (15-10-2026).
 *
 * Antes el servidor le mandaba los 2.058 tramos de todos los eventos (4,1 MB)
 * y el teléfono filtraba los suyos: en Android, dentro de la app, procesar
 * eso trababa la pantalla y salía "Seven Arena no responde" (Juan Fernández,
 * en pleno viaje). El conductor con más viajes tiene 60.
 *
 * El portal se queda con los tramos cuyo driverId es el id del conductor o,
 * si es de flota propia, el id de su cuenta (user_id): son las mismas claves.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clavesDelConductor(id: string, flota: Array<{ id: string | null; user_id: string | null }>): string[] {
  const claves = new Set<string>();
  if (UUID.test(id)) claves.add(id.toLowerCase());
  for (const f of flota) {
    for (const v of [f.id, f.user_id]) if (v && UUID.test(v)) claves.add(v.toLowerCase());
  }
  return Array.from(claves);
}
