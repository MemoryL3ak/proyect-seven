/**
 * Cuánto dura el desplazamiento de un pin hasta su posición nueva. Antes eran
 * 1.200 ms fijos: con datos cada 8 s el pin corría un segundo y quedaba
 * quieto siete (12-10-2026, Ariel: "sería ideal que se viera el movimiento
 * más constante, no con saltos"). Ahora dura lo que tardó en llegar el dato
 * (entre 0,6 y 8 s), así el pin va a velocidad pareja de un punto al otro y
 * llega justo cuando aparece el siguiente.
 */
export const TWEEN_MINIMO_MS = 600;
export const TWEEN_MAXIMO_MS = 8000;

export function duracionDeTween(ahoraMs: number, ultimoCambioMs: number | undefined, minimo = TWEEN_MINIMO_MS, maximo = TWEEN_MAXIMO_MS): number {
  if (ultimoCambioMs == null) return minimo;
  const intervalo = ahoraMs - ultimoCambioMs;
  if (!Number.isFinite(intervalo) || intervalo <= 0) return minimo;
  return Math.min(maximo, Math.max(minimo, intervalo));
}
