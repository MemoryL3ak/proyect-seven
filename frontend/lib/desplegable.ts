/**
 * Hacia dónde abrir la lista de un desplegable (StyledSelect). 09-10-2026:
 * "Cambiar estado…" vive en la barra flotante al pie de la pantalla de
 * Viajes y la lista se abría hacia abajo, fuera de la ventana: sólo se veía
 * la primera opción. Si abajo no cabe y arriba hay más espacio, se abre
 * hacia arriba.
 */
export type DireccionLista = "abajo" | "arriba";

/** Alto aproximado de la lista: una fila por opción, con el tope del scroll. */
export function altoEstimadoDeLista(opciones: number, altoFila = 36, tope = 320): number {
  return Math.min(tope, Math.max(1, opciones) * altoFila + 2);
}

export function direccionDeLista(espacioAbajo: number, espacioArriba: number, altoLista: number): DireccionLista {
  if (espacioAbajo >= altoLista) return "abajo";
  return espacioArriba > espacioAbajo ? "arriba" : "abajo";
}
