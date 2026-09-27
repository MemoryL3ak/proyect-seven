/**
 * Antes de iniciar, recoger o terminar un viaje, el portal del conductor
 * comprueba que tenga ubicación. Dentro de la app esa comprobación se le
 * pregunta a la app (puente "location.current"), no al navegador interno.
 *
 * 27-09-2026: Héctor Silva (iPhone, iOS 18.7) veía "Ubicación no disponible"
 * en cada botón del viaje aunque la app mandaba su GPS sin cortes (un punto
 * por minuto). En iOS el navegador interno de la app tiene su propio permiso
 * de ubicación, aparte del de la app: si alguna vez se tocó "No permitir" en
 * ese aviso, navigator.geolocation responde "denegado" aunque la app sí tenga
 * permiso. El panel terminó cerrando sus viajes a mano.
 */

export type ResultadoUbicacionNativa = "DENEGADA" | "BLOQUEADA" | "SIN_RESPUESTA";

/**
 * Qué dijo la app cuando no entregó la posición. Los mensajes son los del
 * handler "location.current" del shell (seven-arena-app/app/index.tsx); el
 * puente sólo transmite el texto, no el código.
 */
export function clasificarErrorUbicacionNativa(mensaje: string | null | undefined): ResultadoUbicacionNativa {
  const m = String(mensaje ?? "").toLowerCase();
  if (m.includes("bloquead")) return "BLOQUEADA";
  if (m.includes("permiso") || m.includes("permission")) return "DENEGADA";
  // Sin handler (app antigua), sin respuesta a tiempo o sin señal: no se
  // sabe nada del permiso, así que se prueba con el navegador.
  return "SIN_RESPUESTA";
}

export type EstadoRastreoApp = { running?: boolean } | null | undefined;

/**
 * Con el rastreo de la app andando, la app ya tiene permiso de ubicación y
 * está mandando posiciones: no hace falta volver a preguntar.
 */
export function appYaRastrea(estado: EstadoRastreoApp): boolean {
  return estado?.running === true;
}
