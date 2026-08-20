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
