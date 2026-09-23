/**
 * Listas largas del portal (traslados del evento, viajes de la delegación):
 * se muestran de a tandas y un botón trae la siguiente. Antes la lista se
 * cortaba en 50 con un aviso que parecía un botón y no hacía nada, así que
 * el resto de los traslados no se podía ver desde la app.
 */
export const TANDA_LISTA = 50;

export type TramoVisible = {
  /** Cuántos elementos van en pantalla. */
  mostrados: number;
  /** Cuántos faltan por traer. 0 = ya está toda la lista. */
  restantes: number;
  /** Cuántos trae el próximo toque del botón (a lo más una tanda). */
  proximaTanda: number;
};

/** Qué tramo de la lista se ve con `tandas` tandas pedidas. */
export function tramoVisible(total: number, tandas: number, tamano = TANDA_LISTA): TramoVisible {
  const pedidas = Math.max(1, Math.floor(tandas));
  const mostrados = Math.min(Math.max(0, total), pedidas * tamano);
  const restantes = Math.max(0, total - mostrados);
  return { mostrados, restantes, proximaTanda: Math.min(tamano, restantes) };
}
