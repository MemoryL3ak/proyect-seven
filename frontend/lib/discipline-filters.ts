// Género y categoría de disciplinas: normalización, etiquetas en español y
// desambiguación de nombres para los filtros de calendario de los portales.
// El mismo deporte existe una vez por variante (p. ej. "Atletismo" Masculino /
// Femenino / Paralímpico), así que mostrar solo `name` produce duplicados.

export function normalizeGender(value?: string | null): string {
  const v = (value || "").trim().toUpperCase();
  if (v === "MALE" || v === "M") return "MALE";
  if (v === "FEMALE" || v === "F") return "FEMALE";
  if (v === "MIXED" || v === "X") return "MIXED";
  return v;
}

export function genderLabel(value?: string | null): string {
  const v = normalizeGender(value);
  if (v === "MALE") return "Masculino";
  if (v === "FEMALE") return "Femenino";
  if (v === "MIXED") return "Mixto";
  return (value || "").trim();
}

export function normalizeCategory(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

export function categoryLabel(value?: string | null): string {
  const v = normalizeCategory(value);
  if (v === "CONVENTIONAL") return "Convencional";
  if (v === "PARALYMPIC") return "Paralímpica";
  return (value || "").trim();
}

export type DisciplineLike = {
  id: string;
  name?: string | null;
  category?: string | null;
  gender?: string | null;
};

/**
 * Etiquetas únicas por disciplina: cuando el mismo nombre existe en más de
 * una variante se agrega el género (y la categoría si aún hay empate), p. ej.
 * "Atletismo · Femenino · Paralímpica" en vez de cuatro "Atletismo" iguales.
 */
export function buildDisciplineLabelMap(parents: DisciplineLike[]): Map<string, string> {
  const byName = new Map<string, number>();
  const byNameGender = new Map<string, number>();
  parents.forEach((p) => {
    const n = (p.name || "").trim();
    byName.set(n, (byName.get(n) || 0) + 1);
    const ng = `${n}|${normalizeGender(p.gender)}`;
    byNameGender.set(ng, (byNameGender.get(ng) || 0) + 1);
  });
  return new Map(
    parents.map((p) => {
      const n = (p.name || "").trim() || p.id;
      const parts = [n];
      if ((byName.get(n) || 0) > 1) {
        const g = genderLabel(p.gender);
        if (g) parts.push(g);
        if (!g || (byNameGender.get(`${n}|${normalizeGender(p.gender)}`) || 0) > 1) {
          const c = categoryLabel(p.category);
          if (c) parts.push(c);
        }
      }
      return [p.id, parts.join(" · ")];
    }),
  );
}

/**
 * Clave de un nombre de deporte para compararlo con otro: sin tildes, sin
 * mayúsculas y sin puntuación. "Vóleibol", "VOLEIBOL" y "Voleibol" son lo mismo.
 */
export function claveDisciplina(valor?: string | null): string {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ¿El texto de disciplina de un viaje corresponde a este deporte del catálogo?
 *
 * Los viajes que entran por la planilla de operatividad traen la disciplina
 * como texto ("ATLETISMO", "Voleibol", "PARATLETISMO") y sin id: hoy son 330
 * de 333. El filtro de deporte del coordinador comparaba por id y se quedaba
 * con tres viajes. El prefijo "para" es la categoría paralímpica del mismo
 * deporte: "PARATLETISMO" calza con Atletismo · Paralímpica y no con la
 * convencional. Un texto sin género ("Futsal") calza con las dos variantes.
 */
export function coincideDisciplinaPorNombre(
  texto: string | null | undefined,
  disciplina: DisciplineLike,
): boolean {
  const clave = claveDisciplina(texto);
  const nombre = claveDisciplina(disciplina.name);
  if (!clave || !nombre) return false;
  const paralimpica = normalizeCategory(disciplina.category) === "PARALYMPIC";
  if (clave === nombre) return !paralimpica || clave.startsWith("para");
  if (!paralimpica) return false;
  // "paratletismo": el "para" se come la "a" inicial del deporte.
  const variantes = [`para ${nombre}`, `para${nombre}`, nombre.startsWith("a") ? `par${nombre}` : ""];
  return variantes.includes(clave);
}

/** Palabras de género que la planilla a veces pega al deporte: "Voleibol Masculino". */
const GENERO_AL_FINAL = /\s+(masculin[oa]s?|femenin[oa]s?|damas|varones|mixt[oa]s?|hombres|mujeres)$/;

/** Clave comparable del texto de disciplina de un viaje, sin el género pegado. */
export const claveSinGenero = (texto?: string | null) => claveDisciplina(texto).replace(GENERO_AL_FINAL, "");

/**
 * ¿El id de disciplina del viaje concuerda con lo que dice su texto? La carga
 * a veces deja un viaje de "PARATLETISMO" o "Lanzamiento de Martillo"
 * apuntando a Atletismo; el texto es lo que la operación escribió y manda.
 * Sin texto, el id se toma como bueno.
 */
export function idConcuerdaConTexto(
  viaje: { discipline?: string | null },
  disciplina: DisciplineLike,
): boolean {
  const clave = claveSinGenero(viaje.discipline);
  return !clave || coincideDisciplinaPorNombre(clave, disciplina);
}

const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
/** "LANZAMIENTO DE MARTILLO" → "Lanzamiento de Martillo"; un texto con minúsculas se respeta. */
function textoLegible(texto: string): string {
  const sinGenero = texto.replace(new RegExp(GENERO_AL_FINAL.source, "i"), "").trim();
  if (sinGenero !== sinGenero.toUpperCase()) return sinGenero;
  return sinGenero
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && PALABRAS_MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/**
 * Deporte de un viaje tal como lo muestra el filtro de Viajes en curso.
 *
 * El filtro agrupaba por el texto de la planilla tal cual, así que "ATLETISMO",
 * "Voleibol" y "Voleibol Masculino" salían como deportes distintos, cada uno con
 * su cuenta, y los viajes creados a mano (que traen id y no texto) quedaban
 * fuera. Acá manda el catálogo: el id si el viaje lo trae, y si no el texto
 * calzado por nombre con la misma regla del coordinador. El género no separa
 * (la planilla va por hoja de deporte, "Futsal" cubre a damas y varones), la
 * categoría paralímpica sí: "PARATLETISMO" es Atletismo · Paralímpica. Un
 * texto que no calza con nada queda como está escrito, con mayúscula inicial.
 *
 * El id sólo manda cuando concuerda con el texto: un viaje de "PARATLETISMO"
 * o "Lanzamiento de Martillo" que la carga dejó apuntando a Atletismo se
 * agrupa por lo que dice, no por el id. Son disciplinas distintas.
 */
export function deporteDeViaje(
  viaje: { discipline?: string | null; disciplineId?: string | null },
  catalogo: DisciplineLike[],
): string | null {
  const etiqueta = (d: DisciplineLike) => {
    const nombre = (d.name || "").trim() || d.id;
    return normalizeCategory(d.category) === "PARALYMPIC" ? `${nombre} · ${categoryLabel(d.category)}` : nombre;
  };
  const porId = viaje.disciplineId ? catalogo.find((d) => d.id === viaje.disciplineId) : undefined;
  if (porId && idConcuerdaConTexto(viaje, porId)) return etiqueta(porId);
  const texto = String(viaje.discipline ?? "").trim();
  if (!texto) return null;
  const porNombre = catalogo.find((d) => coincideDisciplinaPorNombre(claveSinGenero(texto), d));
  return porNombre ? etiqueta(porNombre) : textoLegible(texto);
}
