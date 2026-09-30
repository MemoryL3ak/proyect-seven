/**
 * A dónde ir después de iniciar sesión (30-09-2026). Si la sesión del panel
 * vence, apiFetch manda al login con ?next=<página donde estaba>; el login lo
 * ignoraba y dejaba a todos en el dashboard: quien estaba en Proveedores
 * aparecía en el inicio. Sólo se acepta una ruta interna del panel.
 */
export function destinoTrasLogin(search: string): string {
  let next = "";
  try {
    next = new URLSearchParams(search).get("next") ?? "";
  } catch {
    return "/";
  }
  // Sólo rutas propias: "/algo", nunca "//otro-sitio" ni "https://…", y no el login mismo.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return "/";
  return next;
}
