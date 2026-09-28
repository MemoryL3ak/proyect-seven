/**
 * Nombres de personas con la inicial en mayúscula (28-09-2026, pedido de
 * Ariel): las fichas de Víctor González, Fernando Ginzo y Sergio Alvarenga
 * se cargaron TODO EN MAYÚSCULAS y así salían en la app, los monitores y los
 * correos, al lado de "Victoria Alexandra Alvear Merino".
 *
 * Sólo se corrige lo que está escrito parejo (todo en mayúsculas o todo en
 * minúsculas): un nombre ya escrito a mano con su forma ("McDonald",
 * "DeLaCruz") se respeta. Misma regla que frontend/lib/nombres.ts.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);

export function nombrePropio(valor?: string | null): string {
  const texto = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) return '';
  return texto
    .toLocaleLowerCase('es')
    .split(' ')
    .map((palabra, indice) => {
      if (indice > 0 && PARTICULAS.has(palabra)) return palabra;
      return palabra
        .split(/([-'’])/)
        .map((tramo) =>
          /^[-'’]$/.test(tramo) || !tramo
            ? tramo
            : tramo.charAt(0).toLocaleUpperCase('es') + tramo.slice(1),
        )
        .join('');
    })
    .join(' ');
}

/** Nombre a guardar: el mismo, salvo que venga todo en mayúsculas o minúsculas. */
export function normalizarNombrePersona(valor: string): string {
  const texto = String(valor ?? '').trim().replace(/\s+/g, ' ');
  if (!/\p{L}/u.test(texto)) return texto;
  const parejo =
    texto === texto.toLocaleUpperCase('es') || texto === texto.toLocaleLowerCase('es');
  return parejo ? nombrePropio(texto) : texto;
}
