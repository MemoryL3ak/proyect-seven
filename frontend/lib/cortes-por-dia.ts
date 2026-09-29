/**
 * Encabezado de día en una lista de viajes ordenada por hora (28-09-2026).
 * Con "Todas las jornadas", Viajes mostraba sólo la hora: después de los
 * traslados del aeropuerto del 29-09 (02:00 a 23:39) venían los
 * entrenamientos del 30-09 desde las 13:05, y parecía que la lista no estaba
 * en orden.
 */

/** ¿En la posición i empieza un día distinto al de la fila anterior? */
export function empiezaDia<T>(lista: T[], i: number, claveDia: (fila: T) => string): boolean {
  if (i < 0 || i >= lista.length) return false;
  return i === 0 || claveDia(lista[i]) !== claveDia(lista[i - 1]);
}

/** Cuántas filas tiene cada día en la lista completa (no sólo la página). */
export function contarPorDia<T>(lista: T[], claveDia: (fila: T) => string): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const fila of lista) {
    const clave = claveDia(fila);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return cuenta;
}
