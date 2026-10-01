/**
 * Filtros "con / sin" de las herramientas de consulta (01-10-2026).
 *
 * El modelo rellena todos los parámetros aunque el usuario no los pida y
 * mandaba hasVehicle:false, hasHotel:false y hasTrip:false: Sofía filtraba
 * "sólo sin vehículo" y decía que los Juegos tenían 1 conductor y Rugby 0,
 * donde hay 80 y 14; con participantes pasaba lo mismo. Un booleano no
 * distingue "no lo pidieron" de "sin"; el parámetro pasa a ser texto
 * explícito ("con" | "sin") y false ya no filtra.
 */
export function filtroConSin(texto: unknown, booleano: unknown): boolean | null {
  const v = typeof texto === 'string' ? texto.trim().toLowerCase() : '';
  if (v === 'con') return true;
  if (v === 'sin') return false;
  if (booleano === true) return true;
  return null;
}

export function filtroVehiculo(args: { vehiculo?: unknown; hasVehicle?: unknown }): boolean | null {
  return filtroConSin(args.vehiculo, args.hasVehicle);
}
