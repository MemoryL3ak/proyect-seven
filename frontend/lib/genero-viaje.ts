/**
 * Género del grupo que viaja. Vive aparte (y no en planilla.ts) porque lo
 * usan las tarjetas del portal y planilla.ts arrastra la librería de Excel,
 * que no tiene por qué entrar en el paquete de la app.
 */
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "damas", "F", "Masculino", "varones", "mixto" → Femenino | Masculino | Mixto | "". */
export function generoNormalizado(valor?: string | null): "Masculino" | "Femenino" | "Mixto" | "" {
  const v = sinTildes(String(valor ?? "").toLowerCase()).replace(/\s+/g, " ").trim();
  if (!v) return "";
  const femenino = /femenin|damas|mujer|^f$|^fem$/.test(v);
  // "maculino": errata real de la planilla (10 viajes de futsal el 25-09).
  const masculino = /masculin|maculin|varon|hombre|^m$|^masc$/.test(v);
  if (/mixt|ambos|^x$/.test(v) || (femenino && masculino)) return "Mixto";
  if (femenino) return "Femenino";
  if (masculino) return "Masculino";
  return "";
}

export type ViajeConGenero = {
  discipline?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * El género que dejó la planilla en los metadatos y, si no viene, el que va
 * al final del nombre de la disciplina ("FUTSAL FEMENINO"). Misma regla que
 * el panel de Viajes.
 */
export function generoDeViaje(viaje: ViajeConGenero): string {
  const meta = typeof viaje.metadata?.gender === "string" ? viaje.metadata.gender : "";
  // El texto completo y no sólo la última palabra: "ATLETISMO DAMAS Y
  // VARONES" terminaba en "varones" y salía Masculino.
  return generoNormalizado(meta) || generoNormalizado(String(viaje.discipline ?? ""));
}

/** "Futsal" + Femenino → "Futsal · Femenino"; si la etiqueta ya lo dice, se deja. */
export function conGenero(etiqueta: string | null, genero: string): string | null {
  if (!etiqueta) return etiqueta;
  if (!genero) return etiqueta;
  return sinTildes(etiqueta.toLowerCase()).includes(sinTildes(genero.toLowerCase())) ? etiqueta : `${etiqueta} · ${genero}`;
}
