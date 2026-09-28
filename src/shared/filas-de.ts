/**
 * Filas que devolvió una consulta hecha con DataSource.query.
 *
 * TypeORM (driver de Postgres) devuelve las filas tal cual en un SELECT o un
 * INSERT, pero en un UPDATE o DELETE devuelve el par [filas, filasAfectadas].
 * Varios servicios leían `rows[0]` de un `update … returning *` como si fuera
 * la fila: era el arreglo entero, y la entidad salía vacía (28-09-2026). Al
 * validar una ficha no se mandaba el código de acceso y no se generaban los
 * traslados de AND, y la respuesta de cada edición venía sin datos.
 */
export function filasDe<T = Record<string, unknown>>(resultado: unknown): T[] {
  if (
    Array.isArray(resultado) &&
    resultado.length === 2 &&
    Array.isArray(resultado[0]) &&
    typeof resultado[1] === 'number'
  ) {
    return resultado[0] as T[];
  }
  return Array.isArray(resultado) ? (resultado as T[]) : [];
}
