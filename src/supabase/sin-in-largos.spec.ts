import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Guardia de regresión: ninguna consulta a Supabase mete una lista variable
 * de ids en `.in()` sin pasar por lotes.
 *
 * El 23-09-2026, con 467 viajes, `.in('trip_id', tripIds)` armó una URL de
 * más de 16 KB, la librería falló con "TypeError: fetch failed" y el panel
 * y el portal del conductor quedaron sin viajes. La lista de ids crece con
 * el evento; el único `.in()` seguro es el que recibe un lote de
 * consultarPorLotes / enLotes (la variable se llama `lote`) o una lista
 * literal corta (estados, tipos).
 */
const RAIZ = join(__dirname, '..');

function archivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosTs(ruta);
    return ruta.endsWith('.ts') && !ruta.endsWith('.spec.ts') ? [ruta] : [];
  });
}

/** `.in('columna', X)` donde X no es una lista literal ni un lote. */
const IN_VARIABLE = /\.in\(\s*'[^']+'\s*,\s*([^)\]]+?)\s*\)/g;

describe('consultas .in() de Supabase', () => {
  it('toda lista variable de ids va por lotes (consultarPorLotes / enLotes)', () => {
    const infractores: string[] = [];
    for (const ruta of archivosTs(RAIZ)) {
      const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);
      lineas.forEach((linea, i) => {
        // Los comentarios pueden citar el patrón prohibido al explicarlo.
        if (/^\s*(\*|\/\/)/.test(linea)) return;
        for (const m of linea.matchAll(IN_VARIABLE)) {
          const arg = m[1].trim();
          const esLiteral = arg.startsWith('[');
          const esLote = /^lote\b/.test(arg);
          if (!esLiteral && !esLote) {
            infractores.push(
              `${relative(RAIZ, ruta)}:${i + 1}  .in(..., ${arg})`,
            );
          }
        }
      });
    }
    expect(infractores).toEqual([]);
  });
});
