/**
 * Pruebas enlazadas a delegaciones. Un partido guarda las dos regiones en
 * `delegationIds`; una prueba sin delegaciones es general y la ve todo el mundo.
 */
export type PruebaConDelegaciones = { delegationIds?: string[] | null };

/**
 * Si la prueba la ve alguien de esa delegación. Sin delegación conocida
 * (staff, filtro en "todas") se ve todo.
 */
export function pruebaVisiblePara(prueba: PruebaConDelegaciones, delegationId?: string | null): boolean {
  const ids = prueba.delegationIds ?? [];
  if (ids.length === 0 || !delegationId) return true;
  return ids.includes(delegationId);
}

/**
 * Nombre corto de una región para chips y títulos: "Región del Maule" →
 * "Maule", "Región Metropolitana de Santiago" → "Metropolitana".
 */
export function nombreCortoRegion(nombre?: string | null): string {
  const s = String(nombre ?? "").trim();
  if (!s) return "";
  const sin = s
    .replace(/^regi[oó]n\s+(de\s+la|del|de)\s+/i, "")
    .replace(/^regi[oó]n\s+/i, "");
  const cortes: Array<[RegExp, string]> = [
    [/^ays[eé]n\b/i, "Aysén"],
    [/^magallanes\b/i, "Magallanes"],
    [/^libertador\b.*o'?higgins/i, "O'Higgins"],
    [/^metropolitana\b/i, "Metropolitana"],
    [/^arica\b/i, "Arica y Parinacota"],
  ];
  for (const [re, corto] of cortes) if (re.test(sin)) return corto;
  return sin;
}

/** "Maule vs Coquimbo" a partir de los nombres largos, o "" si no hay dos. */
export function tituloEnfrentamiento(nombres: Array<string | null | undefined>): string {
  const cortos = nombres.map(nombreCortoRegion).filter(Boolean);
  return cortos.length >= 2 ? `${cortos[0]} vs ${cortos[1]}` : cortos[0] ?? "";
}
