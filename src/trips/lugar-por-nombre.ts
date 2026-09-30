/**
 * Sede, hotel o comedor que nombra un extremo de un viaje de la planilla.
 *
 * La planilla trae el lugar como texto ("Gimnasio UTFSM") y el catálogo
 * puede tener el nombre más largo ("Gimnasio UTFSM - José Miguel Carrera"):
 * el 21-09-2026 se renombró esa sede y los 33 viajes importados después
 * quedaron con el texto viejo y sin id, fuera del filtro de sede.
 *
 * Rugby, 30-09-2026: la planilla de buses dice "CARR", "PWCC", "Hotel
 * Sheraton" y "UC San Carlos de Apoquindo"; el catálogo, "Parque Mahuida
 * CARR", "PWCC · Prince of Wales Country Club", "Hotel Sheraton Santiago" y
 * "Estadio san Carlos de Apoquindo". Ninguno calzaba, los viajes quedaban
 * sin lugar y la app del conductor mandaba el texto pelado a Waze, que
 * resolvía "CARR" o "PWCC" en cualquier parte de la ciudad.
 *
 * Reglas, en orden, y sólo si dejan un único candidato:
 *   1. el mismo nombre (sin tildes, mayúsculas, puntuación ni dobles
 *      espacios: "Gimnasio PUCV Campus Curauma" = "Gimnasio PUCV, Campus
 *      Curauma", que dejaba 32 viajes de JDE sin sede);
 *   2. un alias del catálogo: cada parte del nombre separada por " - ",
 *      " · ", " | " o " (" ("PWCC · Prince of Wales Country Club" vale como
 *      "PWCC" y como "Prince of Wales Country Club");
 *   3. una sigla del nombre del catálogo: una palabra de 3 a 6 mayúsculas
 *      ("Parque Mahuida CARR" → "CARR");
 *   4. el texto es el comienzo del nombre del catálogo (mínimo 8 letras);
 *   5. el núcleo —el nombre sin su primera palabra genérica (hotel, estadio,
 *      gimnasio, club, UC…) ni un "hotel" al final— es el mismo en ambos
 *      lados ("UC San Carlos de Apoquindo" ≈ "Estadio san Carlos de
 *      Apoquindo", "Magic hotel" ≈ "Hotel Magic");
 *   6. el núcleo del texto es el comienzo del núcleo del catálogo (mínimo 8
 *      letras): "Hotel Sheraton" → "Hotel Sheraton Santiago";
 *   7. abreviaturas palabra por palabra, sin "de/del/la/el": cada palabra
 *      del texto es el comienzo de la palabra del catálogo en la misma
 *      posición ("UC San Carlos Ap." ≈ "Estadio san Carlos de Apoquindo",
 *      "OLD GRAN." ≈ "Old Grangonian Club"; así vienen en el Plan de
 *      Operación de Rugby, Rev_01-sep).
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
  // "§" es un "&" mal codificado en planillas antiguas: se comparan iguales.
  return String(raw ?? '')
    .replace(/§/g, '&')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "gimnasio pucv, campus curauma" → "gimnasio pucv campus curauma". */
export function claveCompacta(clave: string): string {
  return clave.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Partes del nombre del catálogo que valen como alias:
 * "gimnasio utfsm - jose miguel carrera" → ["gimnasio utfsm", "jose miguel carrera"],
 * "pwcc · prince of wales country club" → ["pwcc", "prince of wales country club"].
 */
export function aliasDelCatalogo(clave: string): string[] {
  return clave
    .split(/\s[-·|]\s|\s\(/)
    .map((parte) => parte.replace(/\)$/, '').trim())
    .filter(Boolean);
}

/**
 * Siglas del nombre original: "Parque Mahuida CARR" → ["carr"]. Una sigla es
 * una palabra de 3 a 6 mayúsculas que va sola: dentro de una frase en
 * mayúsculas ("INSTITUTO NACIONAL DE DEPORTES CHILE") ninguna palabra lo es.
 */
export function siglasDelNombre(nombre: string): string[] {
  const palabras = nombre.split(/\s+/).map((t) => t.replace(/[^\p{L}]/gu, ''));
  const enMayusculas = (t: string | undefined) =>
    !!t && t.length >= 2 && t === t.toUpperCase() && /\p{L}/u.test(t);
  return palabras
    .filter(
      (t, i) =>
        /^[A-ZÁÉÍÓÚÑ]{3,6}$/.test(t) && !enMayusculas(palabras[i - 1]) && !enMayusculas(palabras[i + 1]),
    )
    .map((t) => claveLugar(t));
}

const PALABRA_GENERICA =
  /^(hotel|hostal|hosteria|apart hotel|estadio|gimnasio|complejo|club|centro|parque|polideportivo|piscina|cancha|recinto|sede|uc|universidad|colegio|liceo|escuela)\s+/;

/**
 * "uc san carlos de apoquindo" → "san carlos de apoquindo"; "magic hotel" →
 * "magic". Sólo la primera palabra genérica y un "hotel" al final.
 */
export function nucleoLugar(clave: string): string {
  return claveCompacta(clave).replace(PALABRA_GENERICA, '').replace(/\s+hotel$/, '');
}

const PALABRA_VACIA = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', '&']);

/** Palabras del núcleo, sin las de relleno: "san carlos de apoquindo" → ["san","carlos","apoquindo"]. */
export function palabrasLugar(clave: string): string[] {
  return nucleoLugar(clave)
    .split(' ')
    .filter((p) => p && !PALABRA_VACIA.has(p));
}

/**
 * "uc san carlos ap" abrevia "estadio san carlos de apoquindo": al menos dos
 * palabras de dos letras o más, y cada una es el comienzo de la palabra del
 * catálogo en su misma posición.
 */
export function esAbreviatura(texto: string, catalogo: string): boolean {
  const t = palabrasLugar(texto);
  const c = palabrasLugar(catalogo);
  if (t.length < 2 || t.length > c.length) return false;
  if (t.join('').length < 6) return false;
  return t.every((p, i) => p.length >= 2 && c[i].startsWith(p));
}

function unico(candidatos: LugarCatalogo[]): LugarResuelto {
  const distintos = [...new Set(candidatos)];
  if (distintos.length !== 1) return SIN_LUGAR;
  const [l] = distintos;
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

  const compacta = claveCompacta(clave);
  const sinPuntuacion = lugares.filter((l) => claveCompacta(l.clave) === compacta);
  if (sinPuntuacion.length > 0) return unico(sinPuntuacion);

  const porAlias = lugares.filter((l) => aliasDelCatalogo(l.clave).includes(clave));
  if (porAlias.length > 0) return unico(porAlias);

  const porSigla = lugares.filter((l) => siglasDelNombre(l.nombre).includes(clave));
  if (porSigla.length > 0) return unico(porSigla);

  // "Hotel Hippocampus" en la planilla, "Hippocampus Resort § Club" en el
  // catálogo: el "hotel" de adelante no es parte del nombre.
  const sinHotel = claveCompacta(clave.replace(/^hotel /, ''));
  if (sinHotel.length >= MINIMO_PREFIJO) {
    const porPrefijo = lugares.filter((l) => claveCompacta(l.clave).startsWith(sinHotel));
    if (porPrefijo.length > 0) return unico(porPrefijo);
  }

  const nucleo = nucleoLugar(clave);
  if (!nucleo) return SIN_LUGAR;
  const porNucleo = lugares.filter((l) => nucleoLugar(l.clave) === nucleo);
  if (porNucleo.length > 0) return unico(porNucleo);

  if (nucleo.length >= MINIMO_PREFIJO) {
    const porNucleoPrefijo = lugares.filter((l) => nucleoLugar(l.clave).startsWith(nucleo));
    if (porNucleoPrefijo.length > 0) return unico(porNucleoPrefijo);
  }

  return unico(lugares.filter((l) => esAbreviatura(clave, l.clave)));
}
