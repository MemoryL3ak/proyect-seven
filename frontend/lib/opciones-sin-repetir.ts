/**
 * Un desplegable no muestra dos opciones con la misma etiqueta (17-10-2026,
 * pedido de Ariel: "¿por qué aparecen 2 estados Completado?"). El estado de
 * un viaje tiene dos códigos que se leen igual: DROPPED_OFF, que deja la app
 * del conductor al finalizar, y COMPLETED, el que elige el panel. Se ofrece
 * una sola "Completado": la que ya tiene el registro si es una de ellas y,
 * si no, la última declarada (en Viajes, COMPLETED).
 */
export type OpcionEtiquetada = { label: string; value: string };

export function sinEtiquetasRepetidas<T extends OpcionEtiquetada>(opciones: T[], elegido?: unknown): T[] {
  const elegidos = new Set(Array.isArray(elegido) ? elegido.map(String) : elegido ? [String(elegido)] : []);
  const porEtiqueta = new Map<string, T>();
  for (const opcion of opciones) {
    const actual = porEtiqueta.get(opcion.label);
    if (actual && elegidos.has(actual.value) && !elegidos.has(opcion.value)) continue;
    porEtiqueta.set(opcion.label, opcion);
  }
  const conservadas = new Set([...porEtiqueta.values()].map((o) => o.value));
  return opciones.filter((o) => conservadas.has(o.value));
}
