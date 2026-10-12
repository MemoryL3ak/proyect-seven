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

/**
 * Si la posición que mandó el equipo es otra que la última pedida al pin. Se
 * compara contra el destino anterior y no contra dónde va el pin a medio
 * camino: el mapa se redibuja cada segundo y, comparando con la posición
 * animada, reiniciaba el tween a cada tic (el pin aceleraba y luego esperaba).
 */
export function cambioDeDestino(anterior: { lat: number; lng: number } | undefined, nuevo: { lat: number; lng: number }): boolean {
  if (!anterior) return true;
  return Math.abs(anterior.lat - nuevo.lat) > 1e-7 || Math.abs(anterior.lng - nuevo.lng) > 1e-7;
}

/**
 * Un 25 % más que el intervalo medido: los datos no llegan a ritmo exacto y,
 * con la duración justa, el pin alcanzaba el destino y quedaba quieto hasta
 * 2 s (medido en producción el 12-10-2026). Si el dato siguiente llega
 * antes, el pin simplemente cambia de rumbo desde donde va.
 */
export const HOLGURA_TWEEN = 1.25;

export function duracionDeTween(ahoraMs: number, ultimoCambioMs: number | undefined, minimo = TWEEN_MINIMO_MS, maximo = TWEEN_MAXIMO_MS): number {
  if (ultimoCambioMs == null) return minimo;
  const intervalo = ahoraMs - ultimoCambioMs;
  if (!Number.isFinite(intervalo) || intervalo <= 0) return minimo;
  return Math.min(maximo, Math.max(minimo, intervalo * HOLGURA_TWEEN));
}
