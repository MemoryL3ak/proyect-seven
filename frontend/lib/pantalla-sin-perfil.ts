/**
 * Qué muestra el portal del conductor cuando no tiene perfil cargado
 * (15-10-2026). Antes era siempre el login web ("Gestiona tus viajes" con el
 * campo "Código de conductor"), también dentro de la app: si al abrir fallaba
 * la carga (sin señal, la app trabada) el conductor caía en una pantalla que
 * no conocía en vez del login de la app (/m/login, las 6 casillas), con su
 * sesión aún guardada en el teléfono.
 *
 * - Navegador: el login web, como siempre.
 * - App con sesión guardada: "No pudimos cargar tus viajes" y Reintentar; la
 *   sesión no se toca.
 * - App sin sesión: al login de la app.
 */
export type PantallaSinPerfil = "login-web" | "reintentar" | "login-app";

export function pantallaSinPerfil(dentroDeLaApp: boolean, sesionDeAppGuardada: boolean): PantallaSinPerfil {
  if (!dentroDeLaApp) return "login-web";
  return sesionDeAppGuardada ? "reintentar" : "login-app";
}
