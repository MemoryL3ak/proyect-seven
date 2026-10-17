/**
 * Lista de traslados del Monitoreo de Llegadas (17-10-2026, pedido de Ariel).
 * Un traslado de AND lleva a toda la delegación: la fila muestra hasta cinco
 * nombres y el resto se abre en una ventana; la lista va del traslado más
 * reciente al más antiguo.
 */
export const PASAJEROS_VISIBLES = 5;

/** Los que caben en la fila y cuántos quedan para la ventana. */
export function recortarPasajeros(nombres: string[], maximo = PASAJEROS_VISIBLES): { visibles: string[]; restantes: number } {
  if (nombres.length <= maximo) return { visibles: nombres, restantes: 0 };
  return { visibles: nombres.slice(0, maximo), restantes: nombres.length - maximo };
}

const instante = (valor?: string | null) => {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Del más reciente al más antiguo; los sin hora quedan al final. */
export function masRecientePrimero(a: { scheduledAt?: string | null }, b: { scheduledAt?: string | null }): number {
  const ta = instante(a.scheduledAt);
  const tb = instante(b.scheduledAt);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}
