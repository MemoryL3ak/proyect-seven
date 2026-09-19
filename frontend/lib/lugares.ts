/**
 * Nombre de un lugar con lo que es delante: "Hotel Mahía", "Sede Elías
 * Figueroa", "Comedor LRH (ex Gala)".
 *
 * En las tarjetas de viaje se veía "LRH (ex Gala) → 2 Norte 65", y había que
 * saberse de memoria que lo primero es el comedor y lo segundo una sede. El
 * tipo va delante del nombre, y si el nombre ya lo dice no se repite.
 */

export type LugarVenue = { id: string; name?: string | null; venueType?: string | null };
export type LugarHotel = { id: string; name?: string | null };

/** Palabras que ya dicen qué es el lugar: no se les antepone nada. */
const YA_LO_DICE: Record<string, RegExp> = {
  Hotel: /^(hotel|hostal|residencial|apart|cabañ|hosteri|hostería)/i,
  Comedor: /^(comedor|casino|restaurant)/i,
  Sede: /^(sede|recinto|estadio|gimnasio|coliseo|complejo|polideportivo|piscina|cancha|pista|vel[óo]dromo|court|arena)/i,
};

/** Antepone el tipo al nombre, sin repetirlo si el nombre ya lo trae. */
export function conTipo(tipo: "Hotel" | "Sede" | "Comedor", nombre?: string | null): string | null {
  const limpio = String(nombre ?? "").trim();
  if (!limpio) return null;
  if (YA_LO_DICE[tipo]?.test(limpio)) return limpio;
  return `${tipo} ${limpio}`;
}

/**
 * Diccionario id → nombre con su tipo, para sedes, comedores y hoteles del
 * evento. Los viajes guardan el id del recinto o del hotel, así que con este
 * mapa cualquier pantalla puede escribir el nombre completo.
 */
export function mapaDeLugares(
  venues: LugarVenue[] | null | undefined,
  hoteles: LugarHotel[] | null | undefined,
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const v of venues ?? []) {
    if (!v?.id) continue;
    const tipo = String(v.venueType ?? "").toUpperCase() === "COMEDOR" ? "Comedor" : "Sede";
    const etiqueta = conTipo(tipo, v.name);
    if (etiqueta) mapa.set(v.id, etiqueta);
  }
  for (const h of hoteles ?? []) {
    if (!h?.id) continue;
    const etiqueta = conTipo("Hotel", h.name);
    if (etiqueta) mapa.set(h.id, etiqueta);
  }
  return mapa;
}
