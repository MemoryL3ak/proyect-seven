/**
 * Consultas a Supabase con listas largas de ids.
 *
 * `.in('trip_id', ids)` mete todos los ids en la URL. Con 467 viajes la URL
 * pasó de 16 KB y la librería falló con "TypeError: fetch failed"
 * (UND_ERR_HEADERS_OVERFLOW): el 23-09-2026 GET /trips devolvió 500 para el
 * panel y para todos los conductores. Se consulta por lotes y se juntan las
 * filas.
 */
export const TAMANO_LOTE = 100;

export function enLotes<T>(items: readonly T[], tamano = TAMANO_LOTE): T[][] {
  if (tamano < 1) throw new Error('tamano debe ser al menos 1');
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano)
    lotes.push(items.slice(i, i + tamano));
  return lotes;
}

/**
 * Ejecuta `consulta` por cada lote de ids y concatena las filas. Los lotes
 * van en paralelo: son lecturas y el pooler las atiende juntas.
 */
export async function consultarPorLotes<Id, Fila>(
  ids: readonly Id[],
  // PromiseLike: el builder de Supabase es un "thenable", no una Promise.
  consulta: (
    lote: Id[],
  ) => PromiseLike<{ data: Fila[] | null; error: { message: string } | null }>,
  tamano = TAMANO_LOTE,
): Promise<{ data: Fila[]; error: { message: string } | null }> {
  const unicos = Array.from(new Set(ids));
  if (unicos.length === 0) return { data: [], error: null };
  const resultados = await Promise.all(
    enLotes(unicos, tamano).map((lote) => consulta(lote)),
  );
  const conError = resultados.find((r) => r.error);
  if (conError?.error) return { data: [], error: conError.error };
  return { data: resultados.flatMap((r) => r.data ?? []), error: null };
}
