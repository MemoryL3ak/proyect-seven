/**
 * Sede, hotel o comedor que nombra un extremo de un viaje de la planilla.
 *
 * La planilla trae el lugar como texto ("Gimnasio UTFSM") y el catálogo
 * puede tener el nombre más largo ("Gimnasio UTFSM - José Miguel Carrera"):
 * el 21-09-2026 se renombró esa sede y los 33 viajes importados después
 * quedaron con el texto viejo y sin id, fuera del filtro de sede.
 *
 * Reglas, en orden, y sólo si dejan un único candidato:
 *   1. el mismo nombre (sin tildes, mayúsculas ni dobles espacios);
 *   2. la parte del nombre del catálogo antes de " - " o " (" (el alias corto);
 *   3. el texto es el comienzo del nombre del catálogo (mínimo 8 letras).
 * Ante dos calces no se adivina.
 */
export type LugarCatalogo = {
  clave: string;
  nombre: string;
  venueId: string | null;
  hotelId: string | null;
  foodLocationId: string | null;
};

export type LugarResuelto = {
  venueId: string | null;
  hotelId: string | null;
  foodLocationId: string | null;
  /** Nombre del catálogo con el que se enlazó; null si no calzó con nada. */
  nombre: string | null;
};

const SIN_LUGAR: LugarResuelto = {
  venueId: null,
  hotelId: null,
  foodLocationId: null,
  nombre: null,
};

const MINIMO_PREFIJO = 8;

/** Clave de comparación: sin tildes, sin mayúsculas, sin dobles espacios. */
export function claveLugar(raw: string | undefined | null): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "gimnasio utfsm - jose miguel carrera" → "gimnasio utfsm". */
const aliasCorto = (clave: string): string => clave.split(/ - | \(/)[0].trim();

function unico(candidatos: LugarCatalogo[]): LugarResuelto {
  if (candidatos.length !== 1) return SIN_LUGAR;
  const [l] = candidatos;
  return {
    venueId: l.venueId,
    hotelId: l.hotelId,
    foodLocationId: l.foodLocationId,
    nombre: l.nombre,
  };
}

export function resolverLugar(
  raw: string | undefined | null,
  lugares: LugarCatalogo[],
): LugarResuelto {
  const clave = claveLugar(raw);
  if (!clave) return SIN_LUGAR;

  const exactos = lugares.filter((l) => l.clave === clave);
  if (exactos.length > 0) return unico(exactos);

  const porAlias = lugares.filter((l) => aliasCorto(l.clave) === clave);
  if (porAlias.length > 0) return unico(porAlias);

  // "Hotel Hippocampus" en la planilla, "Hippocampus Resort § Club" en el
  // catálogo: el "hotel" de adelante no es parte del nombre.
  const sinHotel = clave.replace(/^hotel /, '');
  if (sinHotel.length < MINIMO_PREFIJO) return SIN_LUGAR;
  const porPrefijo = lugares.filter((l) => l.clave.startsWith(sinHotel));
  return unico(porPrefijo);
}
