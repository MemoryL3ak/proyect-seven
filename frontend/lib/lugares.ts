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
  /** Comedores de Alimentación: el viaje puede apuntar a ellos por id. */
  comedores?: LugarHotel[] | null,
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
  for (const c of comedores ?? []) {
    if (!c?.id) continue;
    const etiqueta = conTipo("Comedor", c.name);
    if (etiqueta) mapa.set(c.id, etiqueta);
  }
  return mapa;
}

/**
 * Nombre de lugar comparable: sin tildes, sin mayúsculas, sin dobles espacios.
 * Los viajes de planilla traen origen y destino escritos a mano, así que
 * "Comedor LRH (EX GALA)" y "comedor lrh  (ex gala)" tienen que calzar.
 */
export const normalizarLugar = (valor?: string | null) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Lo que un viaje sabe de sus dos extremos. */
export type ViajeConLugares = {
  origin?: string | null;
  destination?: string | null;
  originVenueId?: string | null;
  originHotelId?: string | null;
  destinationVenueId?: string | null;
  destinationHotelId?: string | null;
  originFoodLocationId?: string | null;
  destinationFoodLocationId?: string | null;
};

/** Nombre del catálogo para un id de sede, hotel o comedor, si se conoce. */
export type NombreDeLugar = (id: string) => string | null | undefined;

/**
 * Los dos lugares de un viaje, tal como los muestra su fila: origen y
 * destino. El texto manda; si un extremo no lo trae, se usa el nombre del
 * catálogo de la sede o el hotel al que apunta por id.
 */
export function lugaresDeViaje(viaje: ViajeConLugares, nombreDe?: NombreDeLugar): string[] {
  const porId = (id?: string | null) => (id && nombreDe ? String(nombreDe(id) ?? "").trim() : "");
  const origen =
    String(viaje.origin ?? "").trim() ||
    porId(viaje.originVenueId) ||
    porId(viaje.originHotelId) ||
    porId(viaje.originFoodLocationId);
  const destino =
    String(viaje.destination ?? "").trim() ||
    porId(viaje.destinationVenueId) ||
    porId(viaje.destinationHotelId) ||
    porId(viaje.destinationFoodLocationId);
  return [origen, destino].filter((valor) => valor.length > 0);
}

/** Un viaje "toca" un lugar si sale de él o llega a él. */
export function tocaLugar(viaje: ViajeConLugares, nombre: string, nombreDe?: NombreDeLugar): boolean {
  const objetivo = normalizarLugar(nombre);
  if (!objetivo) return false;
  return lugaresDeViaje(viaje, nombreDe).some((texto) => normalizarLugar(texto) === objetivo);
}

export type LugarConCarga = { texto: string; esHotel: boolean; total: number };

/** Nombres que delatan un hotel cuando el lugar no está en el maestro. */
const SUENA_A_HOTEL = /(hotel|hostal|apart|aparthotel|resort|cabana|cabanas|hosteria|residencial)/;

/**
 * Hoteles y sedes para un filtro, sacados de los propios viajes y no de los
 * maestros: la planilla escribe "Hotel Hippocampus" y el maestro lo tiene
 * como "Hippocampus Concón Resort & Club", así que al cruzarlos por nombre el
 * hotel no aparecía en el filtro aunque estuviera en decenas de viajes. Con
 * esto cada opción existe porque algún viaje la nombra, y el filtro calza
 * exacto contra ese mismo texto. Es la regla del tracking del panel; el
 * portal del coordinador usa la misma para ver lo mismo.
 *
 * La separación hotel/sede se decide por el maestro de Hoteles y, si el
 * lugar no está ahí, por cómo se llama.
 */
export function lugaresDeViajes(
  viajes: ViajeConLugares[],
  hoteles: LugarHotel[] | null | undefined,
  nombreDe?: NombreDeLugar,
): LugarConCarga[] {
  const nombresDeHotel = new Set(
    (hoteles ?? []).map((h) => normalizarLugar(h.name)).filter((valor) => valor.length > 0),
  );
  const porLugar = new Map<string, LugarConCarga>();
  for (const viaje of viajes) {
    // Un viaje que sale y llega al mismo lugar cuenta una sola vez.
    const clavesDelViaje = new Set<string>();
    for (const texto of lugaresDeViaje(viaje, nombreDe)) {
      const clave = normalizarLugar(texto);
      if (!clave || clavesDelViaje.has(clave)) continue;
      clavesDelViaje.add(clave);
      const actual = porLugar.get(clave);
      if (actual) {
        actual.total += 1;
        continue;
      }
      porLugar.set(clave, {
        texto,
        esHotel: nombresDeHotel.has(clave) || SUENA_A_HOTEL.test(clave),
        total: 1,
      });
    }
  }
  return [...porLugar.values()].sort((a, b) => a.texto.localeCompare(b.texto, "es"));
}
