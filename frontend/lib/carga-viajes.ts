/**
 * Cómo carga sus datos la página de Viajes (13-10-2026). Antes pedía los
 * 1.946 viajes de todos los eventos (4,1 MB) y los 9 recursos de referencia
 * (atletas, conductores, sedes…) cada 8 segundos: 4,8 MB por ronda, y en un
 * MacBook con Safari la plataforma "cargaba pésimo". Ahora el sondeo de 8 s
 * trae sólo los viajes del evento activo y las referencias se renuevan cada
 * 5 minutos (y al abrir, al actualizar a mano o después de guardar).
 */
export const REFERENCIAS_CADA_MS = 5 * 60 * 1000;

/** Ruta de los viajes: del evento activo si hay uno elegido; si no, todos (como antes). */
export function rutaViajes(eventoId: string | null | undefined): string {
  return eventoId ? `/trips?eventId=${encodeURIComponent(eventoId)}` : "/trips";
}

/** Si toca volver a traer las referencias en este tic del sondeo. */
export function referenciasVencidas(ultimaCargaMs: number, ahoraMs: number, cadaMs = REFERENCIAS_CADA_MS): boolean {
  return !ultimaCargaMs || ahoraMs - ultimaCargaMs >= cadaMs;
}
