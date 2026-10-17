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

const instante = (valor?: string | Date | null) => {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Comparador: del más nuevo al más antiguo por la fecha que se indique; los sin fecha al final. */
export function masNuevoPrimero<T>(fecha: (x: T) => string | Date | null | undefined) {
  return (a: T, b: T): number => {
    const ta = instante(fecha(a));
    const tb = instante(fecha(b));
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  };
}

/** Traslados: del más reciente al más antiguo por su hora programada. */
export const masRecientePrimero = masNuevoPrimero<{ scheduledAt?: string | null }>((v) => v.scheduledAt);

/** Vuelos: del que llega más tarde al más antiguo. */
export const vueloMasNuevoPrimero = masNuevoPrimero<{ arrivalTime?: string | Date | null }>((f) => f.arrivalTime);
