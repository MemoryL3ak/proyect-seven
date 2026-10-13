/**
 * Identificador de un equipo GPS en las rutas del panel: el IMEI de 15 dígitos
 * de los GT06 (G500LS, SZCS) o el teléfono BCD de 12 dígitos con que se
 * identifica un terminal JT808 (SEG-9888G: 019210285072). 12-10-2026: la
 * ruta exigía 14–16 dígitos y al SEG no se le podía asignar patente ("no se
 * cambia"): el servidor contestaba "IMEI inválido".
 */
export const ID_EQUIPO = /^\d{10,20}$/;

export function esIdDeEquipo(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_EQUIPO.test(valor.trim());
}
